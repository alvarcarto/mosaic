const _ = require('lodash');
const BPromise = require('bluebird');
const fs = require('fs');
const request = require('request-promise');
const SphericalMercator = require('@mapbox/sphericalmercator');
const globalMerc = require('global-mercator');
const sharp = require('sharp');
const Jimp = require('jimp');
const blend = require('@mapbox/blend');
const blendAsync = BPromise.promisify(blend);

BPromise.config({
  longStackTraces: true,
});

const DEBUG = false;
const MEASURE_PERF = process.env.MOSAIC_MEASURE_PERF === 'true';

function main(_opts) {
  const opts = _.merge({
    tileSize: 256,
    zoomLevel: null,
    retina: true,
    minHeight: 500,
    minWidth: 500,
    concurrency: 10,
    failOnTileError: false,
  }, _opts);

  const merc = new SphericalMercator({ size: opts.tileSize });

  const zoomLevelAdd = opts.retina ? 1 : 0;
  const z = _.isFinite(opts.zoomLevel)
    ? opts.zoomLevel
    : getZoomLevel(merc, [opts.swLng, opts.swLat], [opts.neLng, opts.neLat], opts.minWidth, opts.minHeight) + zoomLevelAdd;
  const bounds = merc.xyz([opts.swLng, opts.swLat, opts.neLng, opts.neLat], z);

  const xyzArr = [];
  _.forEach(_.range(bounds.minY, bounds.maxY + 1), y => {
    _.forEach(_.range(bounds.minX, bounds.maxX + 1), x => {
      xyzArr.push([x, y, z]);
    });
  });

  const dLabel = getTimingLabel('download');
  const sLabel = getTimingLabel('stitch');
  const cLabel = getTimingLabel('crop');

  startTime(dLabel);

  return BPromise.map(xyzArr, (xyz) => {
    const [x, y, z] = xyz;

    return downloadTile(x, y, z, opts)
      .then(data => {
        if (DEBUG) {
          fs.writeFileSync(`${z}-${x}-${y}.png`, data, { encoding: null });
        }

        const xRange = bounds.maxX - bounds.minX;
        const yRange = bounds.maxY - bounds.minY;
        return {
          data,
          xyz,
          tileUrl: buildUrl(opts.template, [x, y, z]),
          top: (yRange - (bounds.maxY - y)) * opts.tileSize,
          left: (xRange - (bounds.maxX - x)) * opts.tileSize,
        };
      });
  }, { concurrency: opts.concurrency })
    .then((tiles) => {
      endTime(dLabel);
      startTime(sLabel);

      const goodTiles = _.filter(tiles, tile => tile.data.length > 0);
      const rows = bounds.maxY - bounds.minY + 1;
      const columns = bounds.maxX - bounds.minX + 1;
      return stitch(goodTiles, {
        rows,
        columns,
        tileSize: opts.tileSize,
        failOnTileError: opts.failOnTileError
      });
    })
    .then((image) => {
      endTime(sLabel);
      startTime(cLabel);
      // Imagine a square map with 4 tiles:
      // |a|b|
      // |c|d|
      //
      // getTilePixel returns the pixel position of the given lng, lat
      // coordinate in the tile it's located on
      // south-west coordinate should always be located on the bottom left
      // tile (c)
      // north-east coordinate should always be located on the top right
      // tile (b)
      //
      // The returned pixel coordinate is relative to the tile's top left
      // pixel. For example the tile b:
      //  -----------
      // |           |
      // |  .        |
      // |  (x, y)   |
      // |           |
      //  -----------
      // We need to calculate the pixel's position relative to the tile's
      // top right corner, because that's the real edge of the whole map
      //
      // Same method for tile c, but relative to the tile's bottom left corner.
      const bottomLeft = getTilePixel([opts.swLng, opts.swLat], z, { tileSize: opts.tileSize, relativeTo: 'bottomLeft'});
      const topRight = getTilePixel([opts.neLng, opts.neLat], z, { tileSize: opts.tileSize, relativeTo: 'topRight'});
      const topLeft = [bottomLeft[0], topRight[1]];
      const width = (bounds.maxX - bounds.minX + 1) * opts.tileSize;
      const height = (bounds.maxY - bounds.minY + 1) * opts.tileSize;
      const cropWidth = width - (bottomLeft[0] + topRight[0]);
      const cropHeight = height - (bottomLeft[1] + topRight[1]);

      if (DEBUG) {
        draw(image, topLeft[0], topLeft[1])
          .then((im) => draw(im, topLeft[0] + cropWidth, topLeft[1] + cropHeight))
          .then(image => {
            fs.writeFileSync(`stitched-marks.png`, image, { encoding: null });
          });
      }

      return sharp(image, { limitInputPixels: false })
        .extract({
          left: topLeft[0],
          top: topLeft[1],
          width: cropWidth,
          height: cropHeight,
        })
        .resize(cropWidth, cropHeight)
        .png()
        .toBuffer();
    })
    .tap(image => {
      endTime(cLabel);

      if (DEBUG) {
        fs.writeFileSync(`stitched.png`, image, { encoding: null });
      }
    });
}

function getZoomLevel(merc, sw, ne, minWidth, minHeight) {
  for (let z = 0; z < 19; ++z) {
    const px1 = merc.px(sw, z);
    const px2 = merc.px(ne, z);
    const xDiff = Math.abs(px1[0] - px2[0]);
    const yDiff = Math.abs(px1[1] - px2[1]);
    if (xDiff >= minWidth && yDiff >= minHeight) {
      return z;
    }
  }

  throw new Error(`Couldn't find any zoom level to cover ${minWidth}x${minHeight} area.`);
}

function draw(image, x, y) {
  return Jimp.read(image)
    .then((loadedImage) => {
      drawRect(loadedImage, x - 3, y - 3, 6, 6, { r: 255, g: 0, b: 0, a: 255 });
      BPromise.promisifyAll(loadedImage);
      return loadedImage.getBufferAsync(Jimp.MIME_PNG);
    });
}

function drawRect(image, x, y, w, h, rgba) {
  _.forEach(_.range(x, x + w + 1), x => {
    _.forEach(_.range(y, y + h + 1), y => {
      image.setPixelColor(hexColor(rgba), x, y);
    });
  });
}

function hexColor(rgba) {
  return Jimp.rgbaToInt(rgba.r, rgba.g, rgba.b, rgba.a);
}

function getTilePixel(ll, z, opts) {
  const fraction = globalMerc.pointToTileFraction(ll, z);
  const preciseX = (fraction[0] - Math.floor(fraction[0])) * opts.tileSize;
  const preciseY = (fraction[1] - Math.floor(fraction[1])) * opts.tileSize;
  const x = Math.round(preciseX);
  const y = Math.round(preciseY);

  if (opts.relativeTo === 'topRight') {
    return [opts.tileSize - x, y];
  } else if (opts.relativeTo === 'bottomLeft') {
    return [x, opts.tileSize - y];
  }

  return [x, y];
}

function downloadTile(x, y, z, opts) {
  const tileUrl = buildUrl(opts.template, [x, y, z]);

  return BPromise.resolve(request({
    url: tileUrl,
    encoding: null,
    timeout: 20 * 60 * 1000
  }));
}

function stitch(tiles, opts) {
  return blendAsync(_.map(tiles, tile => ({
    buffer: tile.data,
    x: tile.left,
    y: tile.top,
  })), {
    format: 'png',
    width: opts.columns * opts.tileSize,
    height: opts.rows * opts.tileSize,
  });
}

function getTimingLabel(label) {
  return `${label} ${Date.now()}`;
}

function startTime(label) {
  if (MEASURE_PERF) {
    console.time(label);
  }
}

function endTime(label) {
  if (MEASURE_PERF) {
    console.timeEnd(label);
  }
}

function buildUrl(template, xyz) {
  return template
    .replace(/\{x\}/g, xyz[0])
    .replace(/\{y\}/g, xyz[1])
    .replace(/\{z\}/g, xyz[2]);
}

module.exports = {
  tile: main,
};

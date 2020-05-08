const _ = require('lodash');
const sharp = require('sharp');
const { tile } = require('./src/index');

const url = require('url');

const renderUrl = 'http://localhost:8004/placement/api/place-map/no-flowers-in-blue-black-frame?swLat=79.94&swLng=174.73&neLat=0.37&neLng=0.20&mapStyle=bw&posterStyle=sharp&labelsEnabled=true&labelHeader=Helsinki&labelSmallHeader=Finland&labelText=60.209%C2%B0N%20%2F%2024.973%C2%B0E&resizeToWidth=400'
const queryObject = url.parse(renderUrl, true).query;

const TILE_URL = 'http://localhost:8002/{style}/{z}/{x}/{y}/tile.png';
const opts = {
  width: 800,
  height: 1000,
  template: TILE_URL.replace(/\{style\}/g, 'bw'),
  swLat: Number(queryObject.neLat),
  swLng: Number(queryObject.neLng),
  neLat: Number(queryObject.swLat),
  neLng: Number(queryObject.swLng),
};

console.log(JSON.stringify({
  "type": "FeatureCollection",
  "features": [
    {
      "type":"Feature",
      "geometry": {
        "type": "MultiPoint",
        "coordinates":[[opts.neLng,opts.neLat],[opts.swLng,opts.swLat]]
      },
      "properties": {"name":"area1"}
    }
  ]
}))

console.log(opts)
return tile(opts)
  .then(async (image) => {
    const sharpObj = sharp(image, { limitInputPixels: false });
    const meta = await sharpObj.metadata();
    console.log(`Received stiched map with dimensions: ${meta.width}x${meta.height}`);
    const newImageBuf = await sharpObj
      .resize(opts.width, opts.height)
      .png()
      .toBuffer();

    return newImageBuf;
  })
  .catch(err => {
    console.error('Body as text:', err.response.body.toString())
    throw err;
  });
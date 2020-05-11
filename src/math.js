// Get new latlng coordinate boundaries after fitting the given bounds inside given width and height
// using GROW_BBOX method which is default by mapnik.
// https://github.com/mapnik/mapnik/blob/e9ebc938e08686c8b5364dbd61827dc9d68589d5/src/map.cpp#L587
function fixBoundsAspectRatio(merc, opts) {
  // Convert to mercator x, y coordinates
  const swXy = merc.forward([opts.swLng, opts.swLat]);
  const neXy = merc.forward([opts.neLng, opts.neLat]);
  const mercatorBox = [swXy, neXy];
  const boxWidth = getMercatorBoxWidth(mercatorBox);
  const boxHeight = getMercatorBoxHeight(mercatorBox);
  const ratio1 = opts.width / opts.height;
  const ratio2 = boxWidth / boxHeight;
  if (ratio1 === ratio2) {
    return _.pick(opts, ['swLat', 'swLng', 'neLat', 'neLng']);
  }

  let newMercatorBox = setMercatorBoxWidth(mercatorBox, boxHeight * ratio1);
  if (ratio2 > ratio1) {
    newMercatorBox = setMercatorBoxHeight(mercatorBox, boxWidth / ratio1)
  }

  const sw = merc.inverse(newMercatorBox[0]);
  const ne = merc.inverse(newMercatorBox[1]);
  return {
    swLat: sw[1],
    swLng: sw[0],
    neLat: ne[1],
    neLng: ne[0],
  };
}

function getMercatorBoxHeight(mercatorBox) {
  const y1 = mercatorBox[0][1];
  const y2 = mercatorBox[1][1];
  return Math.abs(y2 - y1);
}

function getMercatorBoxWidth(mercatorBox) {
  const x1 = mercatorBox[0][0];
  const x2 = mercatorBox[1][0];
  return Math.abs(x2 - x1);
}

function getBoxCenter(box) {
  const x = (box[0][0] + box[1][0]) / 2;
  const y = (box[0][1] + box[1][1]) / 2;
  return [x, y];
}

function setMercatorBoxHeight(mercatorBox, height) {
  const y1 = mercatorBox[0][1];
  const y2 = mercatorBox[1][1];

  const cy = getBoxCenter(mercatorBox)[1];
  if (y1 > y2) {
    return [
      [mercatorBox[0][0], cy + height / 2],
      [mercatorBox[1][0], cy - height / 2],
    ];
  }
  return [
    [mercatorBox[0][0], cy - height / 2],
    [mercatorBox[1][0], cy + height / 2],
  ];
}

function setMercatorBoxWidth(mercatorBox, width) {
  const x1 = mercatorBox[0][0];
  const x2 = mercatorBox[1][0];

  const cx = getBoxCenter(mercatorBox)[0];
  if (x1 > x2) {
    return [
      [cx + width / 2, mercatorBox[0][1]],
      [cx - width / 2, mercatorBox[1][1]],
    ];
  }
  return [
    [cx - width / 2, mercatorBox[0][1]],
    [cx + width / 2, mercatorBox[1][1]],
  ];
}

module.exports = {
  fixBoundsAspectRatio,
  getMercatorBoxHeight,
  getMercatorBoxWidth,
  getBoxCenter,
  setMercatorBoxHeight,
  setMercatorBoxWidth,
};

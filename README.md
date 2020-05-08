# mosaic

A tool to stich map tiles to form a bigger map. Give it a URL template and bounding
box, it will generate a map for you.

```bash
npm install -g @alvarcarto/mosaic
```


## Examples

```js
const fs = require('fs');
const { tile } = require('@alvarcarto/mosaic');

tile({
  // Parameters below are required
  width: 700,
  height: 1000,
  template: 'http://yourtileserver.com/{z}/{x}/{y}.png',
  swLat: 32.473,
  swLng: -15.594,
  neLat: 45.298,
  neLng: 8.056,
})
  .then((image) => {
    // PNG as Buffer
    fs.writeFileSync(`map.png`, image, { encoding: null });
  });
```

This module uses Mapnik's GROW_BBOX method to fit the given coordinates to given width and height.
The implementation in Mapnik's repository: https://github.com/mapnik/mapnik/blob/e9ebc938e08686c8b5364dbd61827dc9d68589d5/src/map.cpp#L587.



# Contributors


## Release

* Commit all changes.
* Use [np](https://github.com/sindresorhus/np) to automate the release:

    `np`

* Edit GitHub release notes.

# License

MIT

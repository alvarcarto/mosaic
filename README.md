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
  templateUrl: 'http://yourtileserver.com/{z}/{x}/{y}.png',
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

# Contributors


## Release

* Commit all changes.
* Use [np](https://github.com/sindresorhus/npm) to automate the release:

    `np`

* Edit GitHub release notes.

# License

MIT

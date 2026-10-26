# Export dependencies

- `xlsx.full.min.js`: existing SheetJS 0.20.3 workbook writer.
- `jszip.min.js`: JSZip 3.10.2, loaded only when exporting copied attachments. Uses the MIT license in `jszip.LICENSE.markdown`.
  Source: https://registry.npmjs.org/jszip/-/jszip-3.10.2.tgz
  Package integrity: `sha512-3l+rb15IOWtUhU0H5MFqES/T6Kh7abYwjosBey/vD6hDt8zoEffkSC5Ws5SGtgVw3gBx2NEbhTeSW1+kWkpyTQ==`

SheetJS's bundled CFB ZIP writer does not preserve Unicode filenames. Keep archive generation in JSZip rather than modifying ZIP internals.

## Whiteboard PNG

`html-to-image` 1.11.13 is embedded in `src/task-horizon/main/render/49-render-whiteboard-interactions.js`, inside the lazily initialized `__tmGetWhiteboardPngRenderer`. Only `toBlob` and its dependencies are retained (13,711 bytes minified, about 5.5 KB gzip); there is no separate runtime request or PDF dependency. The full MIT license is preserved beside the embedded code.

- Source: https://registry.npmjs.org/html-to-image/-/html-to-image-1.11.13.tgz
- Package integrity: `sha512-cuOPoI7WApyhBElTTb9oqsawRvZ0rHhaHwghRLlTuffoD1B2aDemlCruLeZrUIIdvG7gs9xeELEPm6PhuASqrg==`
- To reproduce the embedded bundle, extract the source tarball, create an entry containing `export {toBlob} from './package/es/index.js';`, then run `esbuild@0.25.11 entry.js --bundle --minify --format=iife --global-name=__tmWhiteboardPngLibrary --target=es2017`. Keep the MIT notice when replacing the bundle.

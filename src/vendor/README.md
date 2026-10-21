# Export dependencies

- `xlsx.full.min.js`: existing SheetJS 0.20.3 workbook writer.
- `jszip.min.js`: JSZip 3.10.2, loaded only when exporting copied attachments. Uses the MIT license in `jszip.LICENSE.markdown`.
  Source: https://registry.npmjs.org/jszip/-/jszip-3.10.2.tgz
  Package integrity: `sha512-3l+rb15IOWtUhU0H5MFqES/T6Kh7abYwjosBey/vD6hDt8zoEffkSC5Ws5SGtgVw3gBx2NEbhTeSW1+kWkpyTQ==`

SheetJS's bundled CFB ZIP writer does not preserve Unicode filenames. Keep archive generation in JSZip rather than modifying ZIP internals.

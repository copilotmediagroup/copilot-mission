# RC1.4 Build Verification

## Passed

- Schema Contract Engine: passed across 28 migrations
- Local relative-import validation: passed
- Google map loader source contract: passed
- Unified map route source contract: passed
- Property marker source contract: passed
- Guard marker source contract: passed
- Blue driving-route styling source contract: passed

## Environment limitation

A full `npm install && npm run build` could not be completed in the packaging environment because its internal npm registry returned `404` for `yallist@3.1.1` while resolving the existing lockfile. This is a package-registry availability problem, not a TypeScript result.

Run the following after upload:

```bash
npm install
npm run build
npm run dev
```

// Production build for the API server.
//
// `tsc` alone leaves path aliases (@modules/*, @shared/*, ...) in the output, so
// `node dist/bootstrap.js` could not start. esbuild resolves them from tsconfig.json
// and bundles our own code into one file. Packages from node_modules stay external:
// argon2 is a native addon and the rest are loaded normally at runtime.
//
// Type checking is a separate step (`tsc --noEmit`, see the "build" script).
import { build } from 'esbuild';

await build({
  entryPoints: ['src/bootstrap.ts'],
  outfile: 'dist/bootstrap.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
});

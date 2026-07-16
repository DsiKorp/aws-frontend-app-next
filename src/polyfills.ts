// Browser polyfills required by amazon-cognito-identity-js (and any other
// CommonJS package that expects Node-like globals).
// Without these the dev server throws:
//   Uncaught ReferenceError: global is not defined

// IMPORTANT: this side-effect import must stay BEFORE `import 'buffer'`.
// ES modules hoist imports, but they evaluate depth-first in source order,
// so the shim runs first and installs `globalThis.global` before buffer's
// top-level code touches bare `global`.
import './shim-global';

import * as bufferModule from 'buffer';

const w = window as unknown as { Buffer?: unknown };

if (typeof w.Buffer === 'undefined') {
  w.Buffer = (bufferModule as { Buffer: unknown }).Buffer;
}
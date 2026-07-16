// Browser polyfills required by amazon-cognito-identity-js (and any other
// CommonJS package that expects Node-like globals).
// Without these the dev server throws:
//   Uncaught ReferenceError: global is not defined

import * as bufferModule from 'buffer';

const w = window as unknown as { global: typeof globalThis; Buffer?: unknown };

if (typeof w.global === 'undefined') {
  w.global = globalThis;
}

if (typeof w.Buffer === 'undefined') {
  w.Buffer = (bufferModule as { Buffer: unknown }).Buffer;
}
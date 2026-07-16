// Side-effect shim: define a bare `global` identifier on the global object
// so CommonJS modules loaded later (amazon-cognito-identity-js → buffer) can
// resolve it without crashing with `ReferenceError: global is not defined`.
//
// MUST be imported BEFORE any `import 'buffer'` (or any other CommonJS interop
// that references bare `global`). ES modules evaluate imports depth-first in
// source order, so listing this import first guarantees that buffer sees the
// shim already installed when its top-level code runs.
//
// `buffer/index.js` and friends read bare `global`, not `window.global`, so
// setting `globalThis.global = globalThis` exposes the global object under
// both names (window.global and the lexical `global`).
(globalThis as unknown as { global?: typeof globalThis }).global = globalThis;

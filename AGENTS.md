# Repository instructions

## Stack

- Angular 22.0.6 (standalone components, signals, control flow `@if`/`@for`/`@switch`). No NgModules.
- Node 24.18.0, npm 12.x. Build with `@angular/build` (esbuild + Vite). No webpack, Karma, Protractor, or `zone.js`.
- Zoneless change detection via `provideZonelessChangeDetection()` in `src/app/app.config.ts:4`.
- HTTP via `provideHttpClient(withFetch(), withInterceptorsFromDi())` (`src/app/app.config.ts:20`); never import `@angular/http`.
- Bootstrap 5.3 CSS + Popper + Bootstrap JS are loaded globally from `angular.json:29-35` `styles` and `scripts`. Use Bootstrap 5 classes (`navbar-expand-lg`, `bg-body-tertiary`, `col-12`, `list-group-item-warning|success|danger`), not Bootstrap 3 (`navbar-default`, `col-xs-12`).
- E2E: Playwright (`@playwright/test`). No unit tests; `npm test` exists but maps to `@angular/build:unit-test` (Vitest) with no specs.

## Commands

- Dev server on `0.0.0.0:4200` (host is set in `angular.json:79`): `npm start` (= `ng serve`).
- Production build: `npm run build:prod`. Outputs to `dist/compare-yourself/`.
- E2E: `npm run e2e`. `playwright.config.ts:21-26` starts `npm start` automatically (`reuseExistingServer: !process.env.CI`).
- First Playwright run only: `npx playwright install chromium` (~300 MB).
- Verification chain when you touch code: `npm run build:prod` → `npm run e2e`. There is no lint script wired (the `lint` script in `README.md:48` is aspirational; `ng lint` errors today because no ESLint is configured).

## Wiring

- Bootstrap: `src/main.ts` → `bootstrapApplication(App, appConfig)` against `src/app/app.ts:14` (class name is `App`, not `AppComponent`).
- Routes (`src/app/app.routes.ts:5-26`): `/` → lazy `SignInComponent`, `/signup` → lazy `SignUpComponent`, `/compare` → lazy `CompareComponent` protected by `authGuard`. Wildcard `**` redirects to `/`.
- Auth (`src/app/core/services/auth.service.ts`):
  - `signIn` is now real: SRP via `CognitoUser.authenticateUser`, with `SECRET_HASH` injected by patching `globalThis.fetch` for the duration of the call (see `auth.service.ts:80-118`). The patch is restored in `finally`.
  - `signUp` calls Cognito REST directly (`https://cognito-idp.<region>.amazonaws.com/`) because `amazon-cognito-identity-js@6.x` dropped `ClientSecret`/`SecretHash` support. `confirmUser` uses the SDK's `CognitoUser.confirmRegistration` with the same `globalThis.fetch` patch to inject `SECRET_HASH`.
  - `computeSecretHash` (in `src/app/core/services/cognito-secret-hash.ts`) implements `base64(HMAC-SHA256(clientSecret, username + clientId))` via Web Crypto.
  - `init()` only emits `statusChanged(true)` if `_isAuthenticated` is already true; it does **not** emit `false`, otherwise `App` would force-navigate to `/` from any other route (this was a deliberate fix — the original Angular 4 version had that bug).
  - `AuthService.init()` is called from `App`'s constructor (`src/app/app.ts:24`).
- Guard (`src/app/core/services/auth.guard.ts`): functional `CanActivateFn`, returns `router.parseUrl('/')` when `auth.isAuthenticated()` is false.
- Sign-up form (`src/app/features/sign-up/sign-up.component.{ts,html}`): all form state lives in `signal()` fields; mismatch between `password` and `confirmPassword` is exposed as a `computed` (`passwordsMismatch()`) and surfaces as inline `Passwords do not match!` text. The Submit button is disabled until `usrForm.form.valid && !passwordsMismatch()`. Template binds signals via explicit `[ngModel]="x()" (ngModelChange)="x.set($event)"` because `[(ngModel)]` cannot write to a `WritableSignal`.
- Compare (`src/app/core/services/compare.service.ts`): `API_BASE_URL` points at the real API Gateway (`https://hsp33ckp48.execute-api.us-east-1.amazonaws.com/dev/compare-yourself`). All three methods fetch the Cognito session via `authService.getAuthenticatedUser()?.getSession(...)` and use `session.getIdToken().getJwtToken()` for `Authorization`. `onRetrieveData` and `onDeleteData` additionally send `?accessToken=<accessToken>`. A successful `onDeleteData` clears `userData`/`compareData`/`edited` so `CompareComponent` swaps back to `<app-compare-input>`.

## Required polyfills and permissions

- `src/polyfills.ts` is wired through `angular.json:36-38`. It imports `src/shim-global.ts` (which sets `globalThis.global = globalThis`) **before** importing `buffer`. **Do not reorder these two imports** — ES modules hoist `import` statements, but evaluation is depth-first in source order, so the shim has to be first.
- `src/types/buffer.d.ts` declares the `buffer` module for TypeScript (no `@types/buffer` package exists). Don't delete it.
- `angular.json:39-44` lists `allowedCommonJsDependencies`: `amazon-cognito-identity-js`, `buffer`, `@aws-crypto/sha256-js`, `isomorphic-unfetch`. Add to this list if Cognito ever pulls in another CommonJS dep.

## Conventions

- Components are `standalone: true` and use `templateUrl` + `styleUrl` (singular, per Angular 17+ schema). The default scaffold uses `app.ts`/`app.html`/`app.css` rather than `app.component.*`.
- State is shared via `signal()`/`computed()` inside `@Injectable({ providedIn: 'root' })` services. `BehaviorSubject`/`Subject` are kept only where existing components already subscribe (Compare service).
- Selectors stay `app-` kebab-case.
- Routes use `loadComponent` lazy imports; do not eagerly import feature components into `app.routes.ts`.
- Do not re-enable `zone.js`; if a third-party lib needs it, isolate it inside a child NgZone.

## Setup gotchas

- `package.json:40-46` (`allowScripts`) approves `@parcel/watcher`, `esbuild` (0.27.7 and 0.28.1), `lmdb`, `msgpackr-extract`. `npm install-scripts approve <pkg>` if a new install script is blocked.
- `package.json:47-49` (`overrides.esbuild: 0.28.1`) is required to clear `npm audit` (`GHSA-g7r4-m6w7-qqqr`); keep it.
- `tsconfig.json` deliberately omits `baseUrl` (deprecated in TS 6.0). `paths` (`@app/*`, `@core/*`, `@features/*`) are relative to `tsconfig.json` and currently unused.
- `angular.json:79` binds the dev server to `0.0.0.0`; on Windows, `Get-NetTCPConnection -LocalPort 4200` may show a stale listener after a crash. Free it with `Stop-Process -Id <PID> -Force` or use `npm start -- --port 4300`.
- There is no lockfile for `packageManager` other than `package-lock.json`; CI installs must match Node 24.18.0.

## Environment variables

- `src/environments/environment.ts` and `environment.prod.ts` expose `production`, `userPoolId`, `clientId`, `clientSecret`. Both files currently have the **same literal values** — the prod file is not actually a separate secret store; rotate manually.
- `angular.json:61-66` swaps `environment.ts` → `environment.prod.ts` in the `production` configuration via `fileReplacements`. There is no real environment separation beyond that.

## Files to know

- `src/main.ts` — bootstrap.
- `src/app/app.ts`, `src/app/app.html`, `src/app/app.css` — shell with Bootstrap 5 navbar + `<router-outlet />`.
- `src/app/app.config.ts` — providers (zoneless, router, http).
- `src/app/app.routes.ts` — lazy routes.
- `src/polyfills.ts`, `src/shim-global.ts`, `src/types/buffer.d.ts` — Cognito/CommonJS browser shims.
- `src/app/core/services/auth.service.ts`, `cognito-secret-hash.ts`, `auth.guard.ts` — Cognito SRP sign-in, SECRET_HASH helper, guard.
- `src/app/core/services/compare.service.ts` — real backend client (see bullet above for Cognito session flow).
- `src/app/core/models/{user,compare-data}.model.ts` — interfaces.
- `src/app/features/sign-in/`, `features/sign-up/`, `features/compare/` — feature standalone components (compare is split into `compare.component.ts` + `compare-input.component.ts` + `compare-results.component.ts`).
- `playwright.config.ts`, `e2e/compare-yourself.spec.ts` — 4 specs (navbar, `/compare` guard, sign-in happy path, `/signup` render).
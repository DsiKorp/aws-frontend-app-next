# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Repo name is `aws-frontend-app-next` but stack is **Angular 22**, not Next.js. Companion docs: `README.md` (user-facing), `AGENTS.md` (Spanish, agent-facing — same baseline + Spanish editorial voice).

## Stack

- Angular 22 (standalone components, signals, native `@if`/`@for`/`@switch`)
- Node 24.18.0, npm 12.x, TypeScript ~6.0
- Build: `@angular/build:application` (esbuild + Vite). No webpack/Karma/Protractor.
- HTTP: `provideHttpClient(withFetch(), withInterceptorsFromDi())`. RxJS 7 from `rxjs` root.
- UI: Bootstrap 5.3 + Popper, loaded globally via `angular.json` `styles`/`scripts`.
- Zoneless: `provideZonelessChangeDetection()` — no `zone.js`. Side effects go in `effect()` / `afterNextRender()`.
- Tests: Playwright (`@playwright/test`) only — **no unit tests**. `npm test` exists but will fail with "no tests found"; ignore it.

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install deps |
| `npm start` | Dev server on http://localhost:4200 (host `0.0.0.0`) |
| `npm run build` | Dev build → `dist/compare-yourself/` |
| `npm run build:prod` | Prod build (hashing + `environment.prod.ts` swap) |
| `npm run watch` | Continuous dev build |
| `npm run e2e` | Playwright suite (auto-starts dev server; reused locally) |
| `npm run e2e:headed` | Playwright with visible browser |
| `npx playwright install chromium` | One-time browser download before first e2e |

**Verification chain after touching code:** `npm run build:prod` → `npm run e2e`. There is **no real `npm run lint`** — the README lists it but the script is absent (no ESLint configured); `ng lint` errors today. Treat any lint mention in docs as aspirational.

## Application wiring

- **Bootstrap**: `src/main.ts` → `bootstrapApplication(App, appConfig)` (no `AppComponent`, file is `src/app/app.ts`).
- **Providers** (`src/app/app.config.ts`): `provideBrowserGlobalErrorListeners()`, `provideZonelessChangeDetection()`, `provideRouter(routes, withComponentInputBinding())`, `provideHttpClient(withFetch(), withInterceptorsFromDi())`.
- **Routes** (`src/app/app.routes.ts`): lazy `loadComponent` for `/` → `SignInComponent`, `/signup` → `SignUpComponent`, `/compare` → `CompareComponent` (guarded). `**` → `/`.
- **Shell** (`src/app/app.ts` + `app.html`): Bootstrap 5 navbar + `<router-outlet />`. Calls `AuthService.init()` from constructor.
- **Guard** (`src/app/core/services/auth.guard.ts`): functional `CanActivateFn`; redirects unauthenticated users to `/` via `router.parseUrl('/')`.
- **Compare** (`src/app/core/services/compare.service.ts`): real `HttpClient` against `environment.apiBaseUrl`. Each call lazily fetches the Cognito session via `authService.getAuthenticatedUser()?.getSession(...)`, sends `session.getIdToken().getJwtToken()` as `Authorization`, and (for retrieve/delete) `?accessToken=<accessToken>` as a query param. POST/DELETE use `responseType: 'text'` because API Gateway returns an empty body that would otherwise fail `HttpClient`'s default JSON parse (`status: 200, ok: false`). Exposes **both** signals (`userData`, `compareData`, `isLoading`, `edited`, `loadFailed`) **and** legacy `Subject`s (`dataEdited`, `dataLoaded`, `dataLoadFailed`, `dataIsLoading`) — keep both in sync when updating.

## Cognito auth (the genuinely tricky bit)

Auth lives in `src/app/core/services/auth.service.ts`. It uses `amazon-cognito-identity-js` v6.x **combined with** direct REST calls because the v6 SDK removed built-in support for `SECRET_HASH` / `ClientSecret`. The pool backing this app has a generated client secret, so without SECRET_HASH Cognito rejects every call with `NotAuthorizedException: SECRET_HASH was not received`.

The pattern has three pieces:

1. **`computeSecretHash(username, clientId, clientSecret)`** in `src/app/core/services/cognito-secret-hash.ts`. Uses Web Crypto (`crypto.subtle.importKey` + `crypto.subtle.sign` HMAC-SHA256) and returns `base64(HMAC-SHA256(clientSecret, username + clientId))`. Zero new deps.

2. **`signUp` and `confirmUser`** bypass the SDK entirely and POST directly to `https://cognito-idp.<region>.amazonaws.com/` with `X-Amz-Target: AWSCognitoIdentityProviderService.{SignUp,ConfirmSignUp}`. `SecretHash` is a top-level field of the JSON body, computed once per call.

3. **`signIn`** still uses `CognitoUser.authenticateUser` for the SRP math (BigInteger, AuthenticationHelper) but injects `SECRET_HASH` via a short-lived `globalThis.fetch` patch inside the function. The patch is installed before `authenticateUser` and restored in `finally` so it never leaks. Inspects the `X-Amz-Target` header to know which call to patch and adds `SECRET_HASH` to `AuthParameters` (for `InitiateAuth`) or `ChallengeResponses` (for `RespondToAuthChallenge`).

**Why `fetch` and not `Client.prototype.request`**: the SDK ships two parallel builds — `lib/Client.js` (CommonJS) and `es/Client.js` (ESM). With `@angular/build` (esbuild) + `module: preserve`, the SDK's internal `new Client(...)` constructs instances from `es/Client`, so patching `lib/Client.prototype` (the previous attempt) affected a different class. Both variants funnel through global `fetch`, so patching `fetch` is module-system agnostic.

`AuthService` exposes signals:
- `isAuthenticated` (readonly derived from `_isAuthenticated`), `isLoading`, `didFail`
- `lastErrorCode` — most recent Cognito error type (`UsernameExistsException`, `InvalidPasswordException`, `UserNotConfirmedException`, …). UI uses it to pick friendly messages.
- `confirmRequired` — set to the username when `UserNotConfirmedException` is raised so the UI can redirect into the confirmation flow with the username pre-filled.
- `statusChanged` — `Subject<boolean>` for cross-component notification.
- `registeredUser` — `signal<CognitoUser | null>` populated after signUp.

## Polyfills (subtly load-order-sensitive)

`src/polyfills.ts` needs `import './shim-global'` to run **before** `import * as bufferModule from 'buffer'`. ES modules hoist imports but evaluate them depth-first in source order, so the explicit ordering gets `globalThis.global = globalThis` installed before `buffer/index.js`'s top-level code touches bare `global`. Setting `window.global` later in the body is too late — the throw happens first.

`src/types/buffer.d.ts` provides the ambient declaration for the `buffer` module the polyfill imports (no `@types/buffer` package exists; do not delete the `.d.ts`).

## Conventions

- Every component is `standalone: true`. Do not create NgModules.
- Shared state via `signal()` / `computed()`; `Observable`s only for external streams (HTTP, browser events).
- Selectors keep the `app-` kebab-case prefix (`@angular-eslint` rule).
- Templates in separate `.html` files; use `templateUrl` + `styleUrl` (singular, not `styleUrls`).
- Bootstrap 5 replaces Bootstrap 3: `navbar-expand-lg bg-body-tertiary`, `col-12` (not `col-xs-12`). `list-group-item-{warning|success|danger}` unchanged.
- TypeScript has `noPropertyAccessFromIndexSignature: true` — properties of `Record<string, string>` and similar index signatures must be accessed with `['key']`, never `.key`.
- `tsconfig.json` has no `baseUrl` (deprecated in TS 6). Path aliases (`@app/*`, `@core/*`, `@features/*`) are configured but unused in current code.
- **`[(ngModel)]` cannot write to a `WritableSignal`** — `signal()` returns a function-like object without `set` assignment semantics, so two-way binding fails type-check. Bind explicitly: `[ngModel]="x()" (ngModelChange)="x.set($event)"`. The sign-up form (`features/sign-up`) uses this pattern; mismatch between `password` / `confirmPassword` is a `computed()` named `passwordsMismatch()` and the Submit button is disabled while `usrForm.form.valid && !passwordsMismatch()` is false.

## Files to know

- `src/main.ts`, `src/polyfills.ts`, `src/shim-global.ts`, `src/types/buffer.d.ts`, `src/index.html`
- `src/app/app.{ts,html,css,config.ts,routes.ts}` — shell, providers, routing
- `src/app/core/models/{user,compare-data}.model.ts` — domain interfaces
- `src/app/core/services/{auth,compare}.service.ts`, `cognito-secret-hash.ts`, `auth.guard.ts`
- `src/app/features/sign-in/`, `features/sign-up/`, `features/compare/` — feature folders. `compare/` has `compare.component.ts` (parent), `compare-input.component.ts`, `compare-results.component.ts`.
- `src/environments/environment.ts`, `environment.prod.ts` — **gitignored** (contain `userPoolId`, `clientId`, `clientSecret`); copied locally by each dev from a project-internal template. Swapped by `angular.json` `fileReplacements` in prod build.
- `playwright.config.ts`, `e2e/compare-yourself.spec.ts` — 4 specs cover public navbar, `/compare` redirect, sign-in happy path + authenticated navbar, `/signup` form. Reports → `playwright-report/`, `test-results/`.
- `angular.json` — Bootstrap/Popper assets, env `fileReplacements`, dev server on `0.0.0.0:4200`.

## Risks / gotchas

- **`CompareService` hits a real backend**; `Save Data` / `Get Results` / `Delete Data` will call `environment.apiBaseUrl` with Cognito id/access tokens. E2E only exercises sign-in happy path and form presence, not the API surface.
- **`npm test` is intentionally a no-op** (Vitest unit runner wired with no specs). Playwright is the chosen test strategy.
- **Prod build budgets**: initial bundle ≤ 2 mb warn / 4 mb error; per-component styles ≤ 8 kb warn / 16 kb error.
- **SECRET_HASH and concurrency**: the `signIn` `fetch` patch uses a single shared `globalThis.fetch` slot; parallel sign-ins in different tabs would race on the captured `secretHash`. Single-user SPA, negligible in practice.
- **`AuthService.init()` only re-emits `statusChanged(true)`** when `_isAuthenticated` is already `true` — it deliberately does **not** emit `false`, otherwise `App`'s constructor subscriber would force-navigate to `/` from any other route (carryover bug from the Angular 4 original; do not "fix" by adding the `false` branch).
- **`logout()` wipes every `localStorage` key matching `CognitoIdentityServiceProvider.<clientId>.<username>.*`** after `CognitoUser.signOut()`. Without this, the SDK rehydrates tokens on next page load and the user appears still signed in until the access token expires.
- **Environment files in `src/environments/` are `clientSecret`-bearing**. Even though they are `.gitignore`'d, a production bundle still ships them to every browser. Long term, move auth through a backend (e.g. API Gateway + Lambda authorizer) or use Cognito with public clients (`Generate client secret` disabled) to remove the secret from the SPA entirely.
- **`package.json` load-bearing fields** — do not delete:
  - `overrides.esbuild: 0.28.1` clears `GHSA-g7r4-m6w7-qqqr` in `npm audit`; pinning both `0.27.7` and `0.28.1` in `allowScripts` is required for the same reason.
  - `allowScripts` whitelist (`@parcel/watcher`, `esbuild`, `lmdb`, `msgpackr-extract`); add new postinstall scripts via `npm install-scripts approve <pkg>` rather than disabling the check.
  - `angular.json` `allowedCommonJsDependencies` (`amazon-cognito-identity-js`, `buffer`, `@aws-crypto/sha256-js`, `isomorphic-unfetch`) — append any new CommonJS dep Cognito pulls in, otherwise the build warns and may fail.

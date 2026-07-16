# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Repo name is `aws-frontend-app-next` but stack is **Angular 22**, not Next.js. Companion docs: `README.md` (user-facing), `AGENTS.md` (agent-facing, in Spanish — same architectural content).

## Stack

- Angular 22 (standalone components, signals, native `@if`/`@for`/`@switch` control flow)
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
| `npm run build` | Dev build to `dist/compare-yourself/` |
| `npm run build:prod` | Prod build (hashing + `environment.prod.ts` swap) |
| `npm run watch` | Continuous dev build |
| `npm run e2e` | Playwright suite (auto-starts dev server; reused locally) |
| `npm run e2e:headed` | Playwright with visible browser |
| `npx playwright install chromium` | One-time browser download before first e2e |

## Application wiring

- **Bootstrap**: `src/main.ts` → `bootstrapApplication(App, appConfig)` (no `AppComponent`, file is `src/app/app.ts`).
- **Providers** (`src/app/app.config.ts`): `provideBrowserGlobalErrorListeners()`, `provideZonelessChangeDetection()`, `provideRouter(routes, withComponentInputBinding())`, `provideHttpClient(withFetch(), withInterceptorsFromDi())`.
- **Routes** (`src/app/app.routes.ts`): lazy `loadComponent` for `/` → `SignInComponent`, `/signup` → `SignUpComponent`, `/compare` → `CompareComponent` (guarded). `**` → `/`.
- **Shell** (`src/app/app.ts` + `app.html`): Bootstrap 5 navbar + `<router-outlet />`. Calls `AuthService.init()` from constructor.
- **Auth** (`src/app/core/services/auth.service.ts`): **stub**. Exposes signals (`isAuthenticated`, `isLoading`, `didFail`) plus a `Subject<boolean>` `statusChanged` consumed by `App` for redirects. Methods: `signIn`, `signUp`, `confirmUser`, `logout`, `init`. Cognito/Amplify are NOT wired — do not add `amazon-cognito-identity-js` deps.
- **Guard** (`src/app/core/services/auth.guard.ts`): functional `CanActivateFn`; redirects unauthenticated users to `/` via `router.parseUrl('/')`.
- **Compare** (`src/app/core/services/compare.service.ts`): `HttpClient` against placeholder `https://API_ID.execute-api.REGION.amazonaws.com/dev/` with `Authorization: XX/XXX` headers. Both placeholders must be replaced before any real Save/Get. Exposes both signals and Subjects.

## Conventions

- Every component is `standalone: true`. Do not create NgModules.
- Shared state via `signal()` / `computed()`; `Observable`s only for external streams (HTTP, browser events). Services still expose `BehaviorSubject`/`Subject` to preserve the original project's API contract — keep both.
- Selectors keep the `app-` kebab-case prefix (`@angular-eslint` rule).
- Templates in separate `.html` files; use `templateUrl` + `styleUrl` (singular, not `styleUrls`).
- Bootstrap 5 replaces Bootstrap 3: `navbar-expand-lg bg-body-tertiary`, `col-12` (not `col-xs-12`). `list-group-item-{warning|success|danger}` unchanged.
- Services preserve legacy method names (`onStoreData`, `onRetrieveData`, `onDeleteData`, `signIn`, `signUp`, `confirmUser`, `logout`) even when stubbed — original project's interface contract.
- `tsconfig.json` has no `baseUrl` (deprecated in TS 6). Path aliases (`@app/*`, `@core/*`, `@features/*`) are configured but unused in current code.

## Key files

- `src/main.ts`, `src/polyfills.ts`, `src/index.html`
- `src/app/app.{ts,html,css,config.ts,routes.ts}` — shell + providers + routing
- `src/app/core/models/{user,compare-data}.model.ts` — domain interfaces
- `src/app/core/services/{auth,compare}.service.ts`, `auth.guard.ts` — global state + guard
- `src/app/features/sign-in/`, `features/sign-up/`, `features/compare/` — feature folders. `compare/` has `compare.component.ts` (parent, toggles input ↔ results), `compare-input.component.ts`, `compare-results.component.ts`.
- `src/environments/{environment,environment.prod}.ts` — swapped by `angular.json` `fileReplacements` in prod build.
- `playwright.config.ts`, `e2e/compare-yourself.spec.ts` — 4 specs cover: public navbar, `/compare` redirect when unauthenticated, sign-in flow + authenticated navbar, `/signup` form. Reports → `playwright-report/`, `test-results/`.
- `angular.json` — Bootstrap/Popper assets, empty polyfills, env `fileReplacements`, dev server on `0.0.0.0:4200`.

## Risks / gotchas

- `CompareService.baseUrl` is a placeholder; any `Save Data` / `Get Results` will fail with HTTP error → `loadFailed` signal. E2E only verifies sign-in happy path and form presence, not the API.
- `npm test` is wired to `@angular/build:unit-test` (Vitest) with no specs. Expected failure: **do not add unit-test infrastructure** — Playwright is the chosen strategy.
- Production build budgets: initial bundle ≤ 2mb warn / 4mb error; per-component styles ≤ 8kb warn / 16kb error.
- `amazon-cognito-identity-js` is in `dependencies` and listed in `allowedCommonJsDependencies`, but no service imports it. Treat Cognito wiring as out of scope.

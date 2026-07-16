# Compare Yourself

Single-page Angular 22 application that lets a signed-in user store personal stats (age, height, income) and compare them against a global dataset served by a backend API.

This project was scaffolded with [Angular CLI](https://github.com/angular/angular-cli) 22.0.6 and then customized to use standalone components, signals, zoneless change detection, Bootstrap 5, and Playwright for end-to-end testing.

## Stack

- Angular 22.0.6 (standalone, signals, `@if` / `@for` / `@switch` control flow)
- Node.js 24.18.0, npm 12.x
- Build: `@angular/build` (esbuild + Vite)
- UI: Bootstrap 5.3 + Popper (loaded globally through `angular.json`)
- HTTP: `provideHttpClient(withFetch(), withInterceptorsFromDi())`
- Routing: lazy `loadComponent` routes with a functional `authGuard`
- Change detection: zoneless (`provideZonelessChangeDetection()`)
- E2E: Playwright (`@playwright/test`)
- No unit tests, no Karma, no Protractor, no Cognito, no `zone.js`

## Prerequisites

- Node.js 24.18.0 (use `nvm`, `fnm`, or `volta` to pin the version)
- npm 12.x
- A Chromium download for Playwright (one-time, ~300 MB)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Install the Playwright browser (only the first time)
npx playwright install chromium

# 3. Start the dev server on http://localhost:4200
npm start
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Runs `ng serve` and watches for changes. |
| `npm run build` | Development build, outputs to `dist/compare-yourself/`. |
| `npm run build:prod` | Production build with hashing and `fileReplacements` for `environment.prod.ts`. |
| `npm run watch` | Continuous development build. |
| `npm run e2e` | Runs the Playwright suite. Starts `npm start` automatically when no dev server is running. |
| `npm run e2e:headed` | Same as above but with a visible browser window. |
| `npm run lint` | Runs `ng lint` against the configured ESLint rules. |

## Project structure

```
src/
├── index.html                       # App shell with <app-root></app-root>
├── main.ts                          # bootstrapApplication(App, appConfig)
├── styles.css                       # Global .loader animation
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
└── app/
    ├── app.ts                       # Root component (shell + navbar)
    ├── app.html
    ├── app.css
    ├── app.config.ts                # provideZonelessChangeDetection, Router, HttpClient
    ├── app.routes.ts                # Lazy routes for /, /signup, /compare
    ├── core/
    │   ├── models/
    │   │   ├── user.model.ts
    │   │   └── compare-data.model.ts
    │   └── services/
    │       ├── auth.service.ts      # Stub auth: signals + Subject, signIn/signUp/confirmUser/logout/init
    │       ├── auth.guard.ts        # Functional CanActivateFn
    │       └── compare.service.ts   # HttpClient + signals for /compare data
    └── features/
        ├── sign-in/
        ├── sign-up/
        └── compare/
            ├── compare.component.ts        # Toggles between input and results
            ├── compare-input.component.ts  # Form to store or fetch user data
            └── compare-results.component.ts # Filterable list with success/warning/danger classes
```

## Routing

| Path | Component | Guard |
| --- | --- | --- |
| `/` | `SignInComponent` | none |
| `/signup` | `SignUpComponent` | none |
| `/compare` | `CompareComponent` | `authGuard` (redirects to `/` when not authenticated) |
| `**` | redirect to `/` | none |

## Backend integration

`AuthService` and `CompareService` are stubbed. The `CompareService.baseUrl` points at `https://API_ID.execute-api.REGION.amazonaws.com/dev/` with `Authorization: XX` / `Authorization: XXX` placeholder headers. Replace both with real values (or wire Cognito / Amplify) before going to production.

## End-to-end tests

Specs live under `e2e/`. Playwright owns the dev server lifecycle through `playwright.config.ts`. Four specs cover:

1. Public navbar renders Sign In / Sign Up links.
2. `/compare` redirects to `/` when unauthenticated.
3. Signing in shows the `Your Data` form and authenticated navbar.
4. `/signup` renders the registration form.

```bash
npm run e2e
```

Reports land in `playwright-report/` and `test-results/`.

## Additional resources

- [Angular documentation](https://angular.dev)
- [Angular CLI reference](https://angular.dev/tools/cli)
- [Playwright docs](https://playwright.dev/docs/intro)
- [Bootstrap 5 documentation](https://getbootstrap.com/docs/5.3/getting-started/introduction/)
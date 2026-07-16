# Repository instructions

## Stack

- Angular 22.0.6 (standalone components, signals, control flow nativo `@if`/`@for`/`@switch`).
- Node 24.18.0, npm 12.x.
- Build con `@angular/build` (esbuild + Vite). No hay webpack, Karma ni Protractor.
- HttpClient (no `HttpModule`). RxJS 7 con imports desde `rxjs` raíz.
- Bootstrap 5.3 y Popper cargados globalmente vía `angular.json` `styles` y `scripts`.
- Zoneless: `provideZonelessChangeDetection()` en `src/app/app.config.ts`. No hay `zone.js`.
- Tests E2E con Playwright (`@playwright/test`). No hay tests unitarios.

## Commands

- Dev server (port 4200): `npm start`.
- Build de desarrollo: `npm run build` o `npm run watch`.
- Build de producción: `npm run build:prod` (artefactos en `dist/compare-yourself/`).
- E2E: `npm run e2e`. El `playwright.config.ts` arranca `npm start` automáticamente si no hay servidor (con `reuseExistingServer: true` fuera de CI).
- Primera vez con Playwright: `npx playwright install chromium`.

## Application wiring

- `src/main.ts` hace `bootstrapApplication(App, appConfig)` desde `src/app/app.ts` (no `AppComponent`).
- Providers en `src/app/app.config.ts`: `provideBrowserGlobalErrorListeners`, `provideZonelessChangeDetection`, `provideRouter(routes, withComponentInputBinding())`, `provideHttpClient(withFetch(), withInterceptorsFromDi())`.
- Rutas perezosas en `src/app/app.routes.ts`: `/`, `/signup`, `/compare` (protegida por `authGuard`).
- Auth (`src/app/core/services/auth.service.ts`): stub con signals (`isAuthenticated`, `isLoading`, `didFail`) y un `Subject<boolean>` `statusChanged` consumido por `App` para redirigir. `init()` se invoca desde el constructor de `App`.
- Guard (`src/app/core/services/auth.guard.ts`): `CanActivateFn` funcional; si no autenticado, redirige a `/` con `router.parseUrl('/')`.
- Compare (`src/app/core/services/compare.service.ts`): usa `HttpClient` con placeholder `https://API_ID.execute-api.REGION.amazonaws.com/dev/` y headers `Authorization: XX/XXX`. Expone signals y Subjects a la vez para mantener la firma del proyecto original.
- Estado compartido entre componentes con signals (`signal`, `asReadonly`). Los servicios siguen exponiendo también `BehaviorSubject`/`Subject` para que los consumidores que esperan streams RxJS no rompan.

## Conventions

- Cada componente es `standalone: true`. No crear NgModules.
- Compartir estado con `signal()` y `computed()`; usar `Observable` solo para flujos externos (HTTP, eventos del navegador).
- Selectores siguen siendo `app-` kebab-case (regla `@angular-eslint`).
- Templates en archivos `.html` separados con `templateUrl` y `styleUrl` (singular, no `styleUrls`).
- Sin `zone.js`; los efectos secundarios van en `effect()` o `afterNextRender()`.
- Bootstrap 5 sustituye a Bootstrap 3: `navbar-expand-lg bg-body-tertiary`, `col-12` (no `col-xs-12`), clases `list-group-item-{warning|success|danger}` siguen iguales.
- `AuthService` y `CompareService` mantienen las cuatro firmas y los métodos del proyecto viejo (`signIn`, `signUp`, `confirmUser`, `logout`, `onStoreData`, `onRetrieveData`, `onDeleteData`) aunque sean stubs.
- Cognito/Amplify no están cableados; no añadir `amazon-cognito-identity-js`.

## Files to know

- `src/main.ts` → bootstrap.
- `src/app/app.ts`, `src/app/app.html`, `src/app/app.css` → shell con navbar Bootstrap 5 y `<router-outlet />`.
- `src/app/app.config.ts` → providers globales.
- `src/app/app.routes.ts` → rutas perezosas.
- `src/app/core/models/{user,compare-data}.model.ts` → interfaces de dominio.
- `src/app/core/services/{auth,compare}.service.ts`, `auth.guard.ts` → estado global y guard.
- `src/app/features/sign-in/`, `features/sign-up/`, `features/compare/` → componentes standalone por feature. `features/compare/` contiene `compare.component.ts` (padre), `compare-input.component.ts`, `compare-results.component.ts`.
- `src/environments/environment.ts` y `environment.prod.ts` → reemplazados en build producción por `angular.json` `fileReplacements`.
- `playwright.config.ts`, `e2e/compare-yourself.spec.ts` → pruebas e2e.
- `angular.json` → configura Bootstrap, Popper, polyfills vacíos y `fileReplacements` de environment.

## Risks / gotchas

- `tsconfig.json` no incluye `baseUrl` (TS 6.0 lo deprecó). Los `paths` (`@app/*`, `@core/*`, `@features/*`) son relativos a `tsconfig.json` y actualmente no se usan en código; se pueden ignorar o referenciar.
- `ng test` existe en scripts pero apunta a `@angular/build:unit-test` (Vitest) sin specs; ejecutarlo fallará oirá "no tests found". El plan vigente es **sin tests unitarios**, sólo Playwright.
- El placeholder de API Gateway en `CompareService.baseUrl` no es real; cualquier llamada de `Save Data` o `Get Results` va a fallar con error HTTP y el estado `loadFailed` se activará. El e2e sólo verifica el flujo feliz de sign-in y la presencia del formulario de entrada.
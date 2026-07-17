import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from './app/app.config';
import { App } from './app/app';
import { AuthService } from './app/core/services/auth.service';
import { environment } from './environments/environment';

bootstrapApplication(App, appConfig)
  .then((ref) => {
    // Expose the AuthService on `window` outside of production so
    // the e2e test can drive `logout()` without standing up a real
    // SRP sign-in flow. Stripped from the production bundle by the
    // `environment.production` check.
    if (!environment.production) {
      (globalThis as unknown as { __authService?: AuthService }).__authService =
        ref.injector.get(AuthService);
    }
  })
  .catch((err) => console.error(err));

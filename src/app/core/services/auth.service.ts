import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
// 4$pJhEtOhH&Ny*Sv
import { environment } from '../../../environments/environment';
import { computeSecretHash } from './cognito-secret-hash';
import { clippingParents } from '@popperjs/core';

// amazon-cognito-identity-js v6.x removed built-in SECRET_HASH / ClientSecret
// support, so any auth call that needs a SecretHash must be issued directly
// against the Cognito REST endpoint. The URL region comes from the pool id
// (`us-east-1_xxxxx` → `cognito-idp.us-east-1.amazonaws.com/`).
const COGNITO_REGION = environment.userPoolId.split('_')[0];
const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

// SDK wrapper still needs a CognitoUserPool to build `CognitoUser` instances
// for `authenticateUser`. `ClientSecret` is omitted on purpose: the v6 SDK
// silently drops it, so SECRET_HASH is injected later via the Client patch
// inside `signIn`.
const POOL_DATA = {
  UserPoolId: environment.userPoolId,
  ClientId: environment.clientId,
};
const userPool = new CognitoUserPool(POOL_DATA);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  private readonly _isAuthenticated = signal(false);
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  readonly isLoading = signal(false);
  readonly didFail = signal(false);
  readonly statusChanged = new Subject<boolean>();

  /**
   * Cognito's machine-readable error code for the most recent failure
   * (e.g. `UsernameExistsException`, `InvalidPasswordException`,
   * `InvalidParameterException`, `UserNotConfirmedException`,
   * `NotAuthorizedException`). The UI uses this to pick a friendly
   * message or open a modal. Cleared at the start of every new attempt.
   */
  readonly lastErrorCode = signal<string | null>(null);

  /**
   * Set when signIn fails with Cognito's `UserNotConfirmedException`. The UI
   * watches this to redirect to the confirmation flow with the username
   * pre-filled. It is cleared at the start of every new signIn attempt.
   */
  readonly confirmRequired = signal<string | null>(null);

  /**
   * Performs an SRP sign-in against Cognito, reusing the SDK's
   * `CognitoUser.authenticateUser` (SRP math, BigInteger, AuthenticationHelper)
   * and injecting SECRET_HASH via a short-lived `globalThis.fetch` patch.
   *
   * Why `fetch` and not `Client.prototype.request`: amazon-cognito-identity-js
   * ships two parallel builds — `lib/Client.js` (CommonJS) and `es/Client.js`
   * (ESM). With Angular's `@angular/build` (esbuild) + `module: preserve`,
   * the SDK's internal `new Client(...)` calls construct instances from
   * `es/Client`, so patching `lib/Client.prototype` (which we did before)
   * affected a different prototype and SECRET_HASH never reached the wire.
   * Both variants funnel through global `fetch`, so patching `fetch` is
   * module-system agnostic and catches every outgoing Cognito request.
   *
   * Mirrors the example flow:
   *   - authIsLoading → isLoading signal,
   *   - onSuccess   → authDidFail=false, authStatusChanged=true,
   *   - onFailure   → authDidFail=true.
   *
   * The patch is installed before `authenticateUser` and restored in a
   * `finally` block so it never leaks past a single auth attempt.
   */
  async signIn(username: string, password: string): Promise<void> {
    this.isLoading.set(true);
    this.didFail.set(false);
    this.confirmRequired.set(null);
    this.lastErrorCode.set(null);

    try {
      const secretHash = await computeSecretHash(
        username,
        environment.clientId,
        environment.clientSecret,
      );

      console.log({ secretHash });

      // Patch global fetch: every Cognito request passes through here with
      // an `X-Amz-Target: AWSCognitoIdentityProviderService.<Operation>`
      // header. We parse the JSON body and inject SECRET_HASH into the
      // right container for InitiateAuth / RespondToAuthChallenge.
      const originalFetch = globalThis.fetch.bind(globalThis);
      const patchedFetch: typeof globalThis.fetch = ((
        input: RequestInfo | URL,
        init?: RequestInit,
      ) =>
        (async () => {
          const safeInit: RequestInit = init ?? {};
          const headers = new Headers(safeInit.headers);
          const target = headers.get('X-Amz-Target');

          if (
            typeof target === 'string' &&
            target.startsWith('AWSCognitoIdentityProviderService.') &&
            typeof safeInit.body === 'string'
          ) {
            try {
              const parsed = JSON.parse(safeInit.body) as {
                AuthParameters?: Record<string, string>;
                ChallengeResponses?: Record<string, string>;
              };

              if (target.endsWith('.InitiateAuth') && parsed.AuthParameters) {
                parsed.AuthParameters['SECRET_HASH'] = secretHash;
              } else if (
                target.endsWith('.RespondToAuthChallenge') &&
                parsed.ChallengeResponses
              ) {
                parsed.ChallengeResponses['SECRET_HASH'] = secretHash;
              }
              safeInit.body = JSON.stringify(parsed);
            } catch {
              // Body wasn't JSON or wasn't a Cognito request; let it pass.
            }
          }

          return originalFetch(input, safeInit);
        })()) as typeof globalThis.fetch;

      globalThis.fetch = patchedFetch;

      try {
        const authDetails = new AuthenticationDetails({
          Username: username,
          Password: password,
        });
        const userData = { Username: username, Pool: userPool };
        const cognitoUser = new CognitoUser(userData);

        await new Promise<void>((resolve, reject) => {
          cognitoUser.authenticateUser(authDetails, {
            onSuccess: (result: CognitoUserSession) => {
              console.log(result);
              this._isAuthenticated.set(true);
              this.statusChanged.next(true);
              this.didFail.set(false);
              resolve();
            },
            onFailure: (err: unknown) => {
              console.error(err);
              this.didFail.set(true);
              // Cognito throws `UserNotConfirmedException` when the account
              // exists but the email/phone verification code has not been
              // redeemed yet. Surface that as `confirmRequired` so the UI
              // can route to the confirmation form with the username
              // pre-filled instead of just showing a generic failure.
              if (isUserNotConfirmed(err)) {
                this.confirmRequired.set(username);
              }
              reject(err);
            },
          });
        });
      } finally {
        // Always restore, even on error, so concurrent or future callers
        // do not pick up a stale SECRETHash from a previous attempt.
        globalThis.fetch = originalFetch;
      }
    } catch {
      // `didFail` is already set inside the inner `onFailure` handler.
      // Swallow the rejection so the outer `finally` only does its job.
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Performs a SignUp against Cognito's REST endpoint directly, computing
   * SECRET_HASH with Web Crypto and including it in the JSON body.
   *
   * SignUp supports `SecretHash` as a top-level field (it isn't part of
   * the AuthParameters object as it is in InitiateAuth).
   *
   * On failure the Cognito response body contains an `__type` field with
   * the exception name (e.g. `UsernameExistsException`,
   * `InvalidPasswordException`, `InvalidParameterException`). We surface
   * that to the UI via `lastErrorCode` so it can pick a friendly message;
   * `didFail` stays true so the existing in-form alert still works.
   */
  async signUp(username: string, email: string, password: string): Promise<void> {
    this.isLoading.set(true);
    this.didFail.set(false);
    this.lastErrorCode.set(null);

    try {
      const secretHash = await computeSecretHash(
        username,
        environment.clientId,
        environment.clientSecret,
      );

      const body = {
        ClientId: environment.clientId,
        Username: username,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
        SecretHash: secretHash,
      };

      const response = await fetch(COGNITO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorPayload: { __type?: string; message?: string; } = await response
          .json()
          .catch(() => ({}));
        const code = stripTypePrefix(errorPayload.__type);
        this.lastErrorCode.set(code);
        throw new Error(
          errorPayload.message ?? `SignUp failed with HTTP ${response.status}`,
        );
      }

      const data: { UserSub: string; UserConfirmed: boolean; } = await response.json();
      console.log('User registration successful. UserSub:', data.UserSub);
      this.didFail.set(false);
    } catch (err) {
      console.error('SignUp error:', err);
      this.didFail.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Confirms a previously-registered user via the SDK's
   * `CognitoUser.confirmRegistration(code, forceAliasCreation, callback)`.
   *
   * Mirrors the example flow from the original Angular 4 service:
   *   - sets isLoading up front,
   *   - flips didFail on error,
   *   - on success clears isLoading.
   *
   * Because the app is **zoneless**, navigation triggered from inside the
   * SDK callback (which runs on a native microtask) does not always
   * reach the Angular Router. We therefore return a boolean from the
   * service and let the calling component do the navigation itself
   * inside the Angular zone.
   *
   * Because `amazon-cognito-identity-js@6.x` removed built-in ClientSecret
   * support, we patch `globalThis.fetch` for the duration of the call and
   * inject `SECRET_HASH` into the outgoing `ConfirmSignUp` body — same
   * mechanism that `signIn` uses for `InitiateAuth` /
   * `RespondToAuthChallenge`.
   *
   * @returns `true` on success, `false` on failure.
   */
  async confirmUser(username: string, code: string): Promise<boolean> {
    this.isLoading.set(true);
    this.didFail.set(false);
    this.lastErrorCode.set(null);

    try {
      const secretHash = await computeSecretHash(
        username,
        environment.clientId,
        environment.clientSecret,
      );

      const originalFetch = globalThis.fetch.bind(globalThis);
      const patchedFetch: typeof globalThis.fetch = ((
        input: RequestInfo | URL,
        init?: RequestInit,
      ) =>
        (async () => {
          const safeInit: RequestInit = init ?? {};
          const headers = new Headers(safeInit.headers);
          const target = headers.get('X-Amz-Target');

          if (
            typeof target === 'string' &&
            target === 'AWSCognitoIdentityProviderService.ConfirmSignUp' &&
            typeof safeInit.body === 'string'
          ) {
            try {
              const parsed = JSON.parse(safeInit.body) as {
                SecretHash?: string;
              };
              parsed.SecretHash = secretHash;
              safeInit.body = JSON.stringify(parsed);
            } catch {
              // Body wasn't JSON; let it pass.
            }
          }

          return originalFetch(input, safeInit);
        })()) as typeof globalThis.fetch;

      globalThis.fetch = patchedFetch;

      try {
        const userData = { Username: username, Pool: userPool };
        const cognitoUser = new CognitoUser(userData);

        const result = await new Promise<{ ok: boolean; }>((resolve) => {
          cognitoUser.confirmRegistration(code, true, (err, sdkResult) => {
            if (err) {
              console.error('ConfirmRegistration error:', err);
              this.didFail.set(true);
              resolve({ ok: false });
              return;
            }
            console.log('User confirmation successful.', sdkResult);
            this.confirmRequired.set(null);
            this.didFail.set(false);
            resolve({ ok: true });
          });
        });
        return result.ok;
      } finally {
        // Always restore, even on error, so concurrent or future callers
        // do not pick up a stale SECRET_HASH from a previous attempt.
        globalThis.fetch = originalFetch;
      }
    } catch {
      // `didFail` is already set inside the inner callback.
      // Swallow the rejection so the outer `finally` only does its job.
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Performs a full sign-out:
   *   1. Calls the SDK's `CognitoUser.signOut()` to clear the in-memory
   *      session and fire the global `signOut` event.
   *   2. Deletes every `localStorage` key the SDK may have written
   *      (they follow the pattern
   *      `CognitoIdentityServiceProvider.<clientId>.<username>.*`).
   *   3. Updates the in-memory signals so the navbar switches to the
   *      unauthenticated view and the `App` component routes to `/`.
   *
   * Without step 2 the tokens stick around in `localStorage` and the
   * SDK will re-hydrate them on the next page load, which makes the
   * user appear "still logged in" until the access token expires.
   */
  logout(): void {
    try {
      const current = userPool.getCurrentUser();
      current?.signOut();
    } catch (err) {
      // `signOut()` is best-effort: even if it throws (e.g. no
      // active session), we still want to wipe local storage and
      // flip the auth signal.
      console.warn('CognitoUser.signOut failed; continuing cleanup', err);
    }

    clearCognitoLocalStorage();

    this._isAuthenticated.set(false);
    this.statusChanged.next(false);
  }

  init(): void {
    if (this._isAuthenticated()) {
      this.statusChanged.next(true);
    }
  }

  getAuthenticatedUser() {
    return userPool.getCurrentUser();
  }
}

/**
 * Detects Cognito's `UserNotConfirmedException` regardless of whether the
 * SDK surfaces it as a typed `code`/`name` field or as the JSON `__type`
 * discriminator on the raw HTTP error. Returns `true` only for the exact
 * "UserNotConfirmed" exception so unrelated failures still surface as
 * generic `didFail`.
 */
function isUserNotConfirmed(err: unknown): boolean {
  if (err === null || typeof err !== 'object') {
    return false;
  }
  const anyErr = err as {
    code?: unknown;
    name?: unknown;
    message?: unknown;
  };
  const fields: unknown[] = [anyErr.code, anyErr.name];
  for (const field of fields) {
    if (typeof field === 'string' && field === 'UserNotConfirmedException') {
      return true;
    }
  }
  if (typeof anyErr.message === 'string' && anyErr.message.includes('UserNotConfirmedException')) {
    return true;
  }
  return false;
}

/**
 * Cognito's `__type` field on error responses is namespaced, e.g.
 *   com.amazonaws.cognito.idp.model.UsernameExistsException
 * Strip everything up to and including the last `.` so we end up with
 * the bare exception name (`UsernameExistsException`). If `__type` is
 * missing or empty, returns `null` so callers can fall back to a
 * generic failure UI.
 */
function stripTypePrefix(type: string | undefined): string | null {
  if (typeof type !== 'string' || type.length === 0) {
    return null;
  }
  const lastDot = type.lastIndexOf('.');
  return lastDot === -1 ? type : type.slice(lastDot + 1);
}

/**
 * Removes every `localStorage` key written by the Cognito SDK.
 *
 * The SDK uses the key pattern:
 *   `CognitoIdentityServiceProvider.<clientId>.<username>.<field>`
 * where `<field>` is one of `LastAuthUser`, `accessToken`, `clockDrift`,
 * `idToken`, `refreshToken`. We iterate `localStorage` and delete any
 * key that starts with the well-known SDK prefix, regardless of the
 * current clientId / username — this also catches stale entries from
 * previous users who shared the same browser.
 */
function clearCognitoLocalStorage(): void {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }
  const storage = globalThis.localStorage;
  const cognitoPrefix = 'CognitoIdentityServiceProvider.';
  const keysToDelete: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(cognitoPrefix)) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    storage.removeItem(key);
  }
}

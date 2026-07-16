import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import {
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

import { environment } from '../../../environments/environment';
import { computeSecretHash } from './cognito-secret-hash';

// amazon-cognito-identity-js v6.x removed built-in SECRET_HASH / ClientSecret
// support, so any auth call that needs a SecretHash must be issued directly
// against the Cognito REST endpoint. The URL region comes from the pool id
// (`us-east-1_xxxxx` → `cognito-idp.us-east-1.amazonaws.com/`).
const COGNITO_REGION = environment.userPoolId.split('_')[0];
const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  private readonly _isAuthenticated = signal(false);
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  readonly isLoading = signal(false);
  readonly didFail = signal(false);
  readonly statusChanged = new Subject<boolean>();
  readonly registeredUser = signal<CognitoUser | null>(null);

  /** Stub kept for API compatibility. Will call InitiateAuth with SECRET_HASH. */
  async signIn(username: string, password: string): Promise<void> {
    this.isLoading.set(true);

    // Reference implementation (kept as a comment until needed):
    //
    //   const secretHash = await computeSecretHash(username, environment.clientId, environment.clientSecret);
    //   const body = {
    //     AuthFlow: 'USER_SRP_AUTH',
    //     ClientId: environment.clientId,
    //     AuthParameters: {
    //       USERNAME: username,
    //       SRP_A: '<srp-a-value>',
    //       SECRET_HASH: secretHash,
    //     },
    //   };
    //   await fetch(COGNITO_ENDPOINT, { method: 'POST', headers: ..., body: JSON.stringify(body) });
    //
    void username;
    void password;

    this._isAuthenticated.set(true);
    this.statusChanged.next(true);
    this.isLoading.set(false);
  }

  /**
   * Performs a SignUp against Cognito's REST endpoint directly, computing
   * SECRET_HASH with Web Crypto and including it in the JSON body.
   *
   * SignUp supports `SecretHash` as a top-level field (it isn't part of
   * the AuthParameters object as it is in InitiateAuth).
   */
  async signUp(username: string, email: string, password: string): Promise<void> {
    this.isLoading.set(true);
    this.didFail.set(false);

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
        const errorPayload: { __type?: string; message?: string } = await response
          .json()
          .catch(() => ({}));
        throw new Error(
          errorPayload.message ?? `SignUp failed with HTTP ${response.status}`,
        );
      }

      const data: { UserSub: string; UserConfirmed: boolean } = await response.json();
      console.log('User registration successful. UserSub:', data.UserSub);
      this.didFail.set(false);
    } catch (err) {
      console.error('SignUp error:', err);
      this.didFail.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Stub kept for API compatibility. Will call ConfirmSignUp with SECRET_HASH. */
  async confirmUser(username: string, code: string): Promise<void> {
    this.isLoading.set(true);

    // Reference implementation (kept as a comment until needed):
    //
    //   const secretHash = await computeSecretHash(username, environment.clientId, environment.clientSecret);
    //   const body = {
    //     ClientId: environment.clientId,
    //     Username: username,
    //     ConfirmationCode: code,
    //     SecretHash: secretHash,
    //   };
    //   await fetch(COGNITO_ENDPOINT, { method: 'POST', headers: ..., body: JSON.stringify(body) });
    //
    void username;
    void code;
    void AuthenticationDetails;
    void CognitoUserSession;

    this.isLoading.set(false);
  }

  logout(): void {
    this._isAuthenticated.set(false);
    this.statusChanged.next(false);
  }

  init(): void {
    if (this._isAuthenticated()) {
      this.statusChanged.next(true);
    }
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import { environment } from '../../../environments/environment';

const POOL_DATA = {
  UserPoolId: environment.userPoolId, // Your user pool id here
  ClientId: environment.clientId, // Your client id here
};

//let  userPool = new AmazonCognitoIdentity.CognitoUserPool(POOL_DATA);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  private readonly _isAuthenticated = signal(false);
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  readonly isLoading = signal(false);
  readonly didFail = signal(false);
  readonly statusChanged = new Subject<boolean>();

  signIn(username: string, password: string): void {
    this.isLoading.set(true);
    const authData = {
      Username: username,
      Password: password,
    };
    this._isAuthenticated.set(true);
    this.statusChanged.next(true);
  }

  signUp(username: string, email: string, password: string): void {
    this.isLoading.set(true);
    const user = {
      username,
      email,
      password,
    };
    const emailAttribute = {
      Name: 'email',
      Value: user.email,
    };
  }

  confirmUser(username: string, code: string): void {
    this.isLoading.set(true);
    const userData = {
      Username: username,
    };
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

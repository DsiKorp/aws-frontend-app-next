import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Subject } from 'rxjs';
import { CognitoUserSession } from 'amazon-cognito-identity-js';

import { CompareData } from '../models/compare-data.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CompareService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  /**
   * Public state mirror: `AuthService.userData` (loaded by the
   * retrieval flow) is re-exposed here for the components that
   * consumed the legacy `userData` field.
   */
  readonly userData = signal<CompareData | undefined>(undefined);
  readonly compareData = signal<CompareData[]>([]);
  readonly isLoading = signal(false);
  readonly edited = signal(false);
  readonly loadFailed = signal(false);

  /**
   * Backwards-compatible RxJS streams. The original Angular 4 service
   * exposed only Subjects; we keep them so existing components can
   * subscribe while the rest of the code base moves to signals.
   */
  readonly dataEdited = new BehaviorSubject<boolean>(false);
  readonly dataLoaded = new Subject<CompareData[] | null>();
  readonly dataLoadFailed = new Subject<boolean>();
  readonly dataIsLoading = new BehaviorSubject<boolean>(false);

  /**
   * Persists the user's stats to the backend. The Cognito session
   * is fetched lazily (and the access token is used as the
   * Authorization header) so we never call Cognito unless the user
   * is actually submitting data.
   *
   * Mirrors the original example:
   *   `authService.getAuthenticatedUser().getSession(...).post(...)`
   * but uses the modern `HttpClient` API and `HttpHeaders`.
   */
  onStoreData(data: CompareData): void {
    this.dataLoadFailed.next(false);
    this.dataIsLoading.next(true);
    this.dataEdited.next(false);
    this.loadFailed.set(false);
    this.isLoading.set(true);
    this.edited.set(false);
    this.userData.set(data);

    this.authService.getAuthenticatedUser()?.getSession((err: unknown, session: CognitoUserSession | null) => {
      if (err || !session) {
        console.warn('No active session; cannot store data', err);
        this.isLoading.set(false);
        this.dataIsLoading.next(false);
        this.loadFailed.set(true);
        this.dataLoadFailed.next(true);
        this.edited.set(false);
        this.dataEdited.next(false);
        return;
      }

      const idToken = session.getIdToken().getJwtToken();
      const headers = new HttpHeaders({ Authorization: idToken });

      console.log({ idToken });
      console.log({ headers });

      // API Gateway + Lambda typically returns an empty body on a
      // successful POST. `HttpClient` defaults to `responseType:
      // 'json'`, which causes it to call `response.json()` and throw
      // a parse error (surfaced as `HttpErrorResponse { status: 200,
      // ok: false }`) when the body is empty. Asking for `'text'`
      // keeps Angular from parsing and lets the call resolve cleanly.
      this.http
        .post(environment.apiBaseUrl, data, { headers, responseType: 'text' })
        .subscribe({
          next: () => {
            this.loadFailed.set(false);
            this.dataLoadFailed.next(false);
            this.isLoading.set(false);
            this.dataIsLoading.next(false);
            this.edited.set(true);
            this.dataEdited.next(true);
            console.log('Guardado ok');
          },
          error: (error) => {
            console.error('Store data error', error);
            this.isLoading.set(false);
            this.dataIsLoading.next(false);
            this.loadFailed.set(true);
            this.dataLoadFailed.next(true);
            this.edited.set(false);
            this.dataEdited.next(false);
          },
        });
    });
  }

  /**
   * Retrieves either the full list of users (`all = true`) or the
   * current user's record (`all = false`). Matches the example
   * `onRetrieveData(all: boolean)` exactly, including the
   * `?accessToken=...` query parameter and the
   * `Authorization: <idToken>` header.
   */
  onRetrieveData(all = true): void {
    this.dataLoaded.next(null);
    this.dataLoadFailed.next(false);

    this.authService.getAuthenticatedUser()?.getSession((err: unknown, session: CognitoUserSession | null) => {
      if (err || !session) {
        console.warn('No active session; cannot retrieve data', err);
        this.loadFailed.set(true);
        this.dataLoadFailed.next(true);
        return;
      }

      const accessToken = session.getAccessToken().getJwtToken();
      const idToken = session.getIdToken().getJwtToken();
      const queryParam = `?accessToken=${accessToken}`;
      const urlParam = all ? 'all' : 'single';
      const headers = new HttpHeaders({
        Authorization: idToken,
        'Content-Type': 'application/json',
      });

      console.log("_".repeat(50));
      console.log({
        urlParam: urlParam,
        accessToken: accessToken,
        queryParam: queryParam,
        idToken: idToken,
        headers: headers,
      });

      this.http
        .get<CompareData[]>(`${environment.apiBaseUrl}/${urlParam}${queryParam}`, { headers })
        .subscribe({
          next: (data) => {
            if (all) {
              this.compareData.set(data);
              this.dataLoaded.next(data);
            } else {
              console.log(data);
              if (!data) {
                this.loadFailed.set(true);
                this.dataLoadFailed.next(true);
                return;
              }
              this.userData.set(data[0]);
              this.edited.set(true);
              this.dataEdited.next(true);
            }
          },
          error: (error) => {
            console.log(error);
            this.loadFailed.set(true);
            this.dataLoadFailed.next(true);
            this.compareData.set([]);
            this.dataLoaded.next(null);
          },
        });
    });
  }

  /**
   * Deletes the current user's record. Sends the real Cognito access
   * token as both the `Authorization` header and the legacy
   * `?accessToken=...` query parameter (the example backend expects
   * both). After a successful DELETE, the in-memory state is fully
   * reset so `CompareComponent` swaps back to `<app-compare-input>`
   * and the user can re-enter data.
   */
  onDeleteData(): void {
    this.dataLoadFailed.next(false);
    this.loadFailed.set(false);

    this.authService.getAuthenticatedUser()?.getSession((err: unknown, session: CognitoUserSession | null) => {
      if (err || !session) {
        console.warn('No active session; cannot delete data', err);
        this.loadFailed.set(true);
        this.dataLoadFailed.next(true);
        return;
      }

      const accessToken = session.getAccessToken().getJwtToken();
      const idToken = session.getIdToken().getJwtToken();
      const headers = new HttpHeaders({ Authorization: idToken });

      this.http
        .delete(`${environment.apiBaseUrl}/?accessToken=${accessToken}`, {
          headers,
          responseType: 'text',
        })
        .subscribe({
          next: () => {
            this.userData.set(undefined);
            this.compareData.set([]);
            this.edited.set(false);
            this.dataEdited.next(false);
            this.loadFailed.set(false);
            this.dataLoadFailed.next(false);
          },
          error: (error) => {
            console.error('Delete data error', error);
            this.loadFailed.set(true);
            this.dataLoadFailed.next(true);
          },
        });
    });
  }
}

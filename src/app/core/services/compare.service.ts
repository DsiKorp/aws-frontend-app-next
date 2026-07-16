import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Subject } from 'rxjs';

import { CompareData } from '../models/compare-data.model';

@Injectable({ providedIn: 'root' })
export class CompareService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    'https://API_ID.execute-api.REGION.amazonaws.com/dev/';

  readonly userData = signal<CompareData | undefined>(undefined);
  readonly compareData = signal<CompareData[]>([]);
  readonly isLoading = signal(false);
  readonly edited = signal(false);
  readonly loadFailed = signal(false);

  readonly dataEdited = new BehaviorSubject<boolean>(false);
  readonly dataLoaded = new Subject<CompareData[]>();
  readonly dataLoadFailed = new Subject<boolean>();
  readonly dataIsLoading = new BehaviorSubject<boolean>(false);

  onStoreData(data: CompareData): void {
    this.loadFailed.set(false);
    this.isLoading.set(true);
    this.edited.set(false);
    this.userData.set(data);
    this.http
      .post(this.baseUrl, data, {
        headers: new HttpHeaders({ Authorization: 'XX' }),
      })
      .subscribe({
        next: () => {
          this.loadFailed.set(false);
          this.isLoading.set(false);
          this.edited.set(true);
          this.dataEdited.next(true);
        },
        error: () => {
          this.isLoading.set(false);
          this.loadFailed.set(true);
          this.edited.set(false);
          this.dataEdited.next(false);
        },
      });
  }

  onRetrieveData(all = true): void {
    this.compareData.set([]);
    this.loadFailed.set(false);
    const urlParam = all ? 'all' : 'single';
    this.http
      .get<CompareData[]>(`${this.baseUrl}${urlParam}`, {
        headers: new HttpHeaders({ Authorization: 'XXX' }),
      })
      .subscribe({
        next: (data) => {
          if (all) {
            this.compareData.set(data);
            this.dataLoaded.next(data);
          } else {
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
        error: () => {
          this.loadFailed.set(true);
          this.compareData.set([]);
          this.dataLoadFailed.next(true);
        },
      });
  }

  onDeleteData(): void {
    this.loadFailed.set(false);
    this.http
      .delete(this.baseUrl, {
        headers: new HttpHeaders({ Authorization: 'XXX' }),
      })
      .subscribe({
        error: () => this.loadFailed.set(true),
      });
  }
}
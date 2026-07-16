import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { CompareService } from '../../core/services/compare.service';
import { CompareData } from '../../core/models/compare-data.model';

@Component({
  selector: 'app-compare-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './compare-input.component.html',
  styleUrl: './compare-input.component.css',
})
export class CompareInputComponent {
  protected readonly compareService = inject(CompareService);

  age: number | null = null;
  height: number | null = null;
  income: number | null = null;

  private readonly subs: Subscription[] = [];

  constructor() {
    this.subs.push(
      this.compareService.dataIsLoading.subscribe((loading) => {
        this.compareService.isLoading.set(loading);
      }),
      this.compareService.dataLoadFailed.subscribe((failed) => {
        this.compareService.loadFailed.set(failed);
        if (failed) {
          this.compareService.isLoading.set(false);
        }
      }),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

  onSubmit(): void {
    const data: CompareData = {
      age: Number(this.age ?? 0),
      height: Number(this.height ?? 0),
      income: Number(this.income ?? 0),
    };
    this.compareService.onStoreData(data);
  }

  onFetchStoredData(): void {
    this.compareService.onRetrieveData(false);
  }
}
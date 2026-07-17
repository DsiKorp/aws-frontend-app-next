import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
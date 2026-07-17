import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';

import { CompareService } from '../../core/services/compare.service';
import { CompareData } from '../../core/models/compare-data.model';

@Component({
  selector: 'app-compare-results',
  standalone: true,
  imports: [NgClass],
  templateUrl: './compare-results.component.html',
  styleUrl: './compare-results.component.css',
})
export class CompareResultsComponent {
  protected readonly compareService = inject(CompareService);

  readonly filter = signal<'age' | 'height' | 'income'>('age');
  readonly lowerIsBetter = signal(false);
  readonly didFail = computed(() => this.compareService.loadFailed());

  constructor() {
    this.compareService.onRetrieveData();
  }

  get user(): CompareData | undefined {
    return this.compareService.userData();
  }

  get list(): CompareData[] {
    return this.compareService.compareData();
  }

  getListGroupItemClass(item: CompareData): string {
    const user = this.user;
    if (!user) {
      return '';
    }
    const userValue = Number(user[this.filter()]);
    const itemValue = Number(item[this.filter()]);
    if (userValue === itemValue) {
      return 'list-group-item-warning';
    }
    if (this.lowerIsBetter()) {
      return userValue < itemValue
        ? 'list-group-item-success'
        : 'list-group-item-danger';
    }
    return userValue > itemValue
      ? 'list-group-item-success'
      : 'list-group-item-danger';
  }

  onFilter(value: 'age' | 'height' | 'income'): void {
    this.filter.set(value);
  }

  onSelectLower(isBetter: boolean): void {
    this.lowerIsBetter.set(isBetter);
  }

  onStartSetData(): void {
    this.compareService.dataEdited.next(false);
  }

  onGetResults(): void {
    this.compareService.onRetrieveData();
  }

  onClearData(): void {
    this.compareService.onDeleteData();
  }
}
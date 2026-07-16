import { Component, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { CompareService } from '../../core/services/compare.service';
import { CompareInputComponent } from './compare-input.component';
import { CompareResultsComponent } from './compare-results.component';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [CompareInputComponent, CompareResultsComponent],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.css',
})
export class CompareComponent {
  private readonly compareService = inject(CompareService);

  readonly doInput = signal(true);

  private readonly sub: Subscription;

  constructor() {
    this.sub = this.compareService.dataEdited.subscribe((edited) => {
      this.doInput.set(!edited);
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
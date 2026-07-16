import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly sub: Subscription;

  constructor() {
    this.sub = this.auth.statusChanged.subscribe((authenticated) => {
      this.router.navigate([authenticated ? '/compare' : '/']);
    });
    this.auth.init();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onLogout(): void {
    this.auth.logout();
  }
}
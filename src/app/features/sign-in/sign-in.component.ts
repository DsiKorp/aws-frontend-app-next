import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
})
export class SignInComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';

  constructor() {
    // When Cognito rejects sign-in with `UserNotConfirmedException`, the
    // service stores the username in `confirmRequired`. Route to the
    // confirmation flow with `username` as a query param so the signup
    // component can pre-fill the form.
    effect(() => {
      const pending = this.auth.confirmRequired();
      if (pending !== null) {
        this.router.navigate(['/signup'], {
          queryParams: { username: pending, mode: 'confirm' },
        });
      }
    });
  }

  onSubmit(): void {
    this.auth.signIn(this.username, this.password);
  }
}
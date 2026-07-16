import { Component, inject } from '@angular/core';
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

  onSubmit(): void {
    this.auth.signIn(this.username, this.password);
  }
}
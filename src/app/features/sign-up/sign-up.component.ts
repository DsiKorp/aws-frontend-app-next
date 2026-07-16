import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.css',
})
export class SignUpComponent {
  protected readonly auth = inject(AuthService);

  username = '';
  email = '';
  password = '';
  validationCode = '';
  confirmUser = false;

  onSubmit(): void {
    this.auth.signUp(this.username, this.email, this.password);
  }

  onDoConfirm(): void {
    this.confirmUser = true;
  }

  onConfirm(): void {
    this.auth.confirmUser(this.username, this.validationCode);
  }
}
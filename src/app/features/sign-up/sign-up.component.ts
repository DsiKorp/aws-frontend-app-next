import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

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
  private readonly route = inject(ActivatedRoute);

  username = '';
  email = '';
  password = '';
  validationCode = '';
  confirmUser = false;

  constructor() {
    // The SignIn component navigates here with `?username=<u>&mode=confirm`
    // when Cognito rejects sign-in with `UserNotConfirmedException`. Pre-fill
    // the username and skip straight to the validation-code form.
    const params = this.route.snapshot.queryParamMap;
    const pendingUsername = params.get('username');
    if (pendingUsername) {
      this.username = pendingUsername;
    }
    if (params.get('mode') === 'confirm') {
      this.confirmUser = true;
    }
  }

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
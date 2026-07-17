import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

interface SignUpErrorCopy {
  title: string;
  message: string;
  action: 'signin' | 'fix-password' | 'fix-fields' | 'retry';
}

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
  private readonly router = inject(Router);

  readonly username = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly validationCode = signal('');
  readonly confirmUser = signal(false);

  /**
   * `true` only when both password fields have content and differ.
   * Showing the warning while either field is empty would fire as soon
   * as the user typed the first character of the first field — the
   * legacy Angular 4 version had that UX bug.
   */
  readonly passwordsMismatch = computed(() => {
    const p = this.password();
    const cp = this.confirmPassword();
    return p !== '' && cp !== '' && p !== cp;
  });

  /**
   * Drives the error modal. Null = closed. We mirror
   * `auth.lastErrorCode()` so we can also map machine codes to friendly
   * copy without leaking Cognito jargon into the template.
   */
  readonly errorModal = signal<SignUpErrorCopy | null>(null);

  /** Resolved friendly copy for the current error code, or null. */
  readonly activeError = computed(() => this.errorModal());

  constructor() {
    // The SignIn component navigates here with `?username=<u>&mode=confirm`
    // when Cognito rejects sign-in with `UserNotConfirmedException`. Pre-fill
    // the username and skip straight to the validation-code form.
    const params = this.route.snapshot.queryParamMap;
    const pendingUsername = params.get('username');
    if (pendingUsername) {
      this.username.set(pendingUsername);
    }
    if (params.get('mode') === 'confirm') {
      this.confirmUser.set(true);
    }

    // React to any non-null error code the service publishes (signUp or
    // confirmUser) and translate it to user-facing copy. `signIn` is
    // the only flow that sets `confirmRequired`; here we only act on
    // the generic `lastErrorCode` signal.
    effect(() => {
      const code = this.auth.lastErrorCode();
      if (code === null) {
        return;
      }
      // If the user already dismissed a modal for this exact code,
      // don't re-open it. `closeErrorModal()` and `onErrorAction()`
      // clear `lastErrorCode` to keep the state in sync.
      if (this.errorModal() && this.errorModal()?.title === mapSignUpError(code)?.title) {
        return;
      }
      const copy = mapSignUpError(code);
      if (copy) {
        this.errorModal.set(copy);
      }
    });
  }

  onSubmit(): void {
    this.errorModal.set(null);
    this.auth.signUp(this.username(), this.email(), this.password());
  }

  onDoConfirm(): void {
    this.confirmUser.set(true);
  }

  async onConfirm(): Promise<void> {
    this.errorModal.set(null);
    const ok = await this.auth.confirmUser(this.username(), this.validationCode());
    if (ok) {
      // Navigate from the component, not the service, so the Router
      // change is observed by Angular's change detection even in
      // zoneless mode. The SDK callback in `confirmUser` runs on a
      // native microtask and its `Router.navigate` does not always
      // reach the router in zoneless setups.
      this.router.navigate(['/']);
    }
  }

  closeErrorModal(): void {
    // Clearing `lastErrorCode` is what actually unmounts the modal: the
    // effect below re-opens it whenever a non-null code is published,
    // so leaving the signal set would re-render the dialog on the next
    // change-detection cycle.
    this.auth.lastErrorCode.set(null);
    this.errorModal.set(null);
  }

  onErrorAction(): void {
    const err = this.errorModal();
    if (!err) {
      return;
    }
    // Same reasoning as `closeErrorModal`: clear the upstream error
    // code so the effect does not reopen the modal.
    this.auth.lastErrorCode.set(null);
    this.errorModal.set(null);
    switch (err.action) {
      case 'signin':
        this.router.navigate(['/']);
        return;
      case 'fix-password':
      case 'fix-fields':
      case 'retry':
      default:
        return;
    }
  }
}

/**
 * Maps Cognito's machine-readable error codes from `signUp` (and the
 * generic confirm flow) to a user-friendly title, message and
 * follow-up action.
 */
function mapSignUpError(code: string | null): SignUpErrorCopy | null {
  switch (code) {
    case 'UsernameExistsException':
      return {
        title: 'User already exists',
        message:
          'An account with that username already exists. Try signing in instead, or pick a different username.',
        action: 'signin',
      };
    case 'InvalidPasswordException':
      return {
        title: 'Password too weak',
        message:
          'Your password does not meet the policy. Use at least 8 characters with a mix of letters, numbers and symbols.',
        action: 'fix-password',
      };
    case 'InvalidParameterException':
      return {
        title: 'Check the form fields',
        message:
          'One of the fields is not in the expected format. Verify the email and try again.',
        action: 'fix-fields',
      };
    case 'CodeMismatchException':
      return {
        title: 'Invalid validation code',
        message:
          'The validation code you entered is incorrect or has expired. Request a new one and try again.',
        action: 'retry',
      };
    case 'ExpiredCodeException':
      return {
        title: 'Validation code expired',
        message:
          'The validation code has expired. Request a new one and try again.',
        action: 'retry',
      };
    default:
      return null;
  }
}
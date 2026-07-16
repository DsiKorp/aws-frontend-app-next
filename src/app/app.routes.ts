import { Routes } from '@angular/router';

import { authGuard } from './core/services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/sign-in/sign-in.component').then((m) => m.SignInComponent),
    title: 'Sign In',
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/sign-up/sign-up.component').then((m) => m.SignUpComponent),
    title: 'Sign Up',
  },
  {
    path: 'compare',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/compare/compare.component').then((m) => m.CompareComponent),
    title: 'Compare',
  },
  { path: '**', redirectTo: '' },
];
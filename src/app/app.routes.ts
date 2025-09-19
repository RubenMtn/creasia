import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent), data: { headerKey: 'header.brand' } },
      { path: 'socios', loadComponent: () => import('./features/socios/socios.component').then(m => m.SociosComponent), data: { headerKey: 'header.partners' } },
      { path: 'legal', loadComponent: () => import('./features/legal/legal.component').then(m => m.LegalComponent), data: { headerKey: 'header.legal' } }
    ]
  },
  { path: '**', redirectTo: '' }
];




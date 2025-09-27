import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent), data: { headerKey: 'header.brand' } },
      { path: 'actividades', loadComponent: () => import('./features/actividades/actividades.component').then(m => m.ActividadesComponent), data: { headerKey: 'header.activities' } },
      { path: 'galeria', loadComponent: () => import('./features/galeria/galeria.component').then(m => m.GaleriaComponent), data: { headerKey: 'header.galeria' } },
      { path: 'socios', loadComponent: () => import('./features/socios/socios.component').then(m => m.SociosComponent), data: { headerKey: 'header.partners' } },
      { path: 'viajes', loadComponent: () => import('./features/viajes/viajes.component').then(m => m.ViajesComponent), data: { headerKey: 'header.trips' } },
      { path: 'consultoria', loadComponent: () => import('./features/consultoria/consultoria.component').then(m => m.ConsultoriaComponent), data: { headerKey: 'header.consulting' } },
      { path: 'gourmet', loadComponent: () => import('./features/gourmet/gourmet.component').then(m => m.GourmetComponent), data: { headerKey: 'header.gourmet' } },
      { path: 'networking', loadComponent: () => import('./features/networking/networking.component').then(m => m.NetworkingComponent), data: { headerKey: 'header.networking' } },
      { path: 'idiomas', loadComponent: () => import('./features/idiomas/idiomas.component').then(m => m.IdiomasComponent), data: { headerKey: 'header.languages' } },
      { path: 'legal', loadComponent: () => import('./features/legal/legal.component').then(m => m.LegalComponent), data: { headerKey: 'header.legal' } }
    ]
  },
  { path: '**', redirectTo: '' }
];













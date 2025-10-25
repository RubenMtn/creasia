﻿import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { GaleriaComponent } from './features/galeria/galeria.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
        data: { headerKey: 'header.brand', seoTitleKey: 'home.title', seoDescKey: 'home.caption', seoImage: 'assets/pics/slide1.jpg' }
      },
      {
        path: 'actividades',
        loadComponent: () => import('./features/actividades/actividades.component').then(m => m.ActividadesComponent),
        data: { headerKey: 'header.activities', seoTitleKey: 'actividades.title', seoDescKey: 'actividades.section1.body1' }
      },
      {
        path: 'galeria',
        loadComponent: () => import('./features/galeria/galeria.component').then(m => m.GaleriaComponent),
        data: { headerKey: 'header.galeria', seoTitleKey: 'galeria.title', seoDescKey: 'galeria.empty' }
      },
      {
        path: 'socios',
        loadComponent: () => import('./features/socios/socios.component').then(m => m.SociosComponent),
        data: { headerKey: 'header.partners', seoTitleKey: 'socios.title', seoDescKey: 'socios.registerCaption' }
      },
      {
        path: 'viajes',
        loadComponent: () => import('./features/viajes/viajes.component').then(m => m.ViajesComponent),
        data: { headerKey: 'header.trips', seoTitleKey: 'viajes.title', seoDescKey: 'viajes.section1.body1' }
      },
      {
        path: 'viajes-wizard',
        loadComponent: () => import('./features/viajes/viajes-wizard.component').then(m => m.ViajesWizardComponent)
      },
      {
        path: 'consultoria',
        loadComponent: () => import('./features/consultoria/consultoria.component').then(m => m.ConsultoriaComponent),
        data: { headerKey: 'header.consulting', seoTitleKey: 'consultoria.title', seoDescKey: 'consultoria.caption' }
      },
      {
        path: 'gourmet',
        loadComponent: () => import('./features/gourmet/gourmet.component').then(m => m.GourmetComponent),
        data: { headerKey: 'header.gourmet', seoTitleKey: 'gourmet.title', seoDescKey: 'gourmet.benefitsIntro', seoImage: 'assets/images/pasaporte.webp' }
      },
      {
        path: 'networking',
        loadComponent: () => import('./features/networking/networking.component').then(m => m.NetworkingComponent),
        data: { headerKey: 'header.networking', seoTitleKey: 'networking.title', seoDescKey: 'home.caption' }
      },
      {
        path: 'idiomas',
        loadComponent: () => import('./features/idiomas/idiomas.component').then(m => m.IdiomasComponent),
        data: { headerKey: 'header.languages', seoTitleKey: 'idiomas.title', seoDescKey: 'actividades.section2.body1' }
      },
      {
        path: 'legal',
        loadComponent: () => import('./features/legal/legal.component').then(m => m.LegalComponent),
        data: { headerKey: 'header.legal', seoTitleKey: 'legal.title', seoDescKey: 'legal.section1.body' }
      }
    ]
  },
  // Ruta directa que ya traías:
  { path: 'galeria', component: GaleriaComponent },
  { path: '**', redirectTo: '' }
];

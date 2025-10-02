import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';
import { ScrollTopButtonComponent } from '../../shared/ui/scroll-top-button/scroll-top-button.component';

@Component({
  selector: 'app-actividades',
  standalone: true,
  imports: [CommonModule, TPipe, ScrollTopButtonComponent],
  templateUrl: './actividades.component.html',
  styleUrl: './actividades.component.scss'
})
export class ActividadesComponent {}

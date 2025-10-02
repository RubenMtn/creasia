import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';
import { ViajesCalendarioComponent } from './viajes-calendario.component';
import { ScrollTopButtonComponent } from '../../shared/ui/scroll-top-button/scroll-top-button.component';

@Component({
  selector: 'app-viajes',
  standalone: true,
  imports: [CommonModule, TPipe, ViajesCalendarioComponent, ScrollTopButtonComponent],
  templateUrl: './viajes.component.html',
  styleUrl: './viajes.component.scss'
})
export class ViajesComponent {}

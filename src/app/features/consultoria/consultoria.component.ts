import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-consultoria',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './consultoria.component.html',
  styleUrls: ['./consultoria.component.scss']
})
export class ConsultoriaComponent {}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-idiomas',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './idiomas.component.html',
  styleUrl: './idiomas.component.scss'
})
export class IdiomasComponent {}


import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-cultura',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './cultura.component.html',
  styleUrl: './cultura.component.scss'
})
export class CulturaComponent {}

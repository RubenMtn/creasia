import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-gourmet',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './gourmet.component.html',
  styleUrl: './gourmet.component.scss'
})
export class GourmetComponent {}

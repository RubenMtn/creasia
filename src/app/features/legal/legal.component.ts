import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../shared/i18n/t.pipe';
import { ScrollTopButtonComponent } from '../../shared/ui/scroll-top-button/scroll-top-button.component';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterLink, TPipe, ScrollTopButtonComponent],
  templateUrl: './legal.component.html',
  styleUrl: './legal.component.scss'
})
export class LegalComponent {}

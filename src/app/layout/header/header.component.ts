import { Component } from '@angular/core';
import { LangSwitcherComponent } from '../../shared/i18n/lang-switcher.component'; // <-- nuevo

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LangSwitcherComponent], // <-- para usar <app-lang-switcher>
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {}

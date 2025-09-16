import { Component } from '@angular/core';
import { LangSwitcherComponent } from '../../shared/i18n/lang-switcher.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LangSwitcherComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {}

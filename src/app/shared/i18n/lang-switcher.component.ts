import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService, Lang } from './translation.service';

@Component({
  selector: 'app-lang-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lang-switcher.component.html',
  styleUrls: ['./lang-switcher.component.scss']
})
export class LangSwitcherComponent {
  // ✅ prefer-inject
  private readonly i18n = inject(TranslationService);

  langs = [
    { code: 'es', label: 'ES' },
    { code: 'en', label: 'EN' },
    { code: 'zh', label: '中文' },
  ] as const;

  // Lee el idioma actual del servicio
  current: Lang = this.i18n.lang;

  async onChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const lang: Lang = (value === 'es' || value === 'en' || value === 'zh') ? value : 'es';
    this.current = lang;
    await this.i18n.setLang(lang);
  }
}

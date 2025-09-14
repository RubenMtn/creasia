import { Component, ElementRef, HostListener, inject } from '@angular/core';
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
  private readonly i18n = inject(TranslationService);
  private readonly host = inject(ElementRef<HTMLElement>);

  // Lista fija de idiomas
  readonly langs: readonly { code: Lang; label: string }[] = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
  ] as const;

  current: Lang = this.i18n.lang;
  open = false;

  // Solo mostrar los que NO son el idioma actual
  get otherLangs(): readonly { code: Lang; label: string }[] {
    return this.langs.filter(l => l.code !== this.current) as readonly { code: Lang; label: string }[];
  }

  toggle(ev?: Event) {
    ev?.stopPropagation();
    this.open = !this.open;
  }

  async onChoose(code: Lang, ev: Event) {
    ev.stopPropagation();
    this.current = code;
    await this.i18n.setLang(code);
    this.open = false;
  }

  flagSrc(code: Lang): string {
    return `assets/images/flags/${code}.svg`;
  }

  // Fallback de .svg -> .png -> 1x1 transparente
  onFlagError(ev: Event, code: Lang) {
    const img = ev.target as HTMLImageElement | null;
    if (!img) return;
    const cur = img.getAttribute('src') ?? '';
    if (cur.endsWith('.svg')) {
      img.src = `assets/images/flags/${code}.png`;
    } else {
      img.onerror = null;
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    }
  }

  currentAlt(): string {
    const found = this.langs.find(l => l.code === this.current);
    return found ? found.label : this.current.toUpperCase();
  }

  // Cerrar al clicar fuera o con Escape
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.host.nativeElement.contains(ev.target as Node)) this.open = false;
  }
  @HostListener('document:keydown.escape')
  onEsc() { this.open = false; }
}

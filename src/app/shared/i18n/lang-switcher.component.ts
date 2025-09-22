import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Lang, TranslationService } from './translation.service';

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

  private autoCloseTimer?: ReturnType<typeof setTimeout>;

  readonly langs: readonly { code: Lang; label: string }[] = [
    { code: 'es', label: 'Espanol' },
    { code: 'en', label: 'English' },
    { code: 'zh', label: 'Mandarin' },
  ] as const;

  current: Lang = this.i18n.lang;
  open = false;

  get otherLangs(): readonly { code: Lang; label: string }[] {
    return this.langs.filter((lang) => lang.code !== this.current) as readonly {
      code: Lang;
      label: string;
    }[];
  }

  toggle(event?: Event): void {
    event?.stopPropagation();
    this.open = !this.open;
    if (this.open) {
      this.startAutoClose();
    } else {
      this.clearAutoClose();
    }
  }

  async onChoose(code: Lang, event: Event): Promise<void> {
    event.stopPropagation();
    this.current = code;
    await this.i18n.setLang(code);
    this.open = false;
    this.clearAutoClose();
  }

  flagSrc(code: Lang): string {
    return `assets/images/flags/${code}.svg`;
  }

  onFlagError(event: Event, code: Lang): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) {
      return;
    }

    const currentSrc = img.getAttribute('src') ?? '';
    if (currentSrc.endsWith('.svg')) {
      img.src = `assets/images/flags/${code}.png`;
    } else {
      img.onerror = null;
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    }
  }

  currentAlt(): string {
    const found = this.langs.find((lang) => lang.code === this.current);
    return found ? found.label : this.current.toUpperCase();
  }

  private startAutoClose(delayMs = 7000): void {
    this.clearAutoClose();
    this.autoCloseTimer = setTimeout(() => {
      if (this.open) {
        this.open = false;
      }
      this.clearAutoClose();
    }, delayMs);
  }

  private clearAutoClose(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = undefined;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open = false;
      this.clearAutoClose();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
    this.clearAutoClose();
  }
}

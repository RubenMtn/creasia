import { Component, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Lang, TranslationService } from './translation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-lang-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lang-switcher.component.html',
  styleUrls: ['./lang-switcher.component.scss']
})
export class LangSwitcherComponent implements OnInit, OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private sub?: Subscription;

  private autoCloseTimer?: ReturnType<typeof setTimeout>;

  readonly langs: readonly { code: Lang; label: string }[] = [
    { code: 'es', label: 'Español' },  // opcional: acento
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' }       // opcional: mostrar en chino
  ] as const;

  current: Lang = this.i18n.lang;
  open = false;

  ngOnInit(): void {
    // ?? Mantener sync cuando el idioma cambia desde fuera
    this.sub = this.i18n.langChanges.subscribe((l) => {
      this.current = l;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.clearAutoClose();
  }

  get otherLangs(): readonly { code: Lang; label: string }[] {
    return this.langs.filter((lang) => lang.code !== this.current) as readonly {
      code: Lang;
      label: string;
    }[];
  }

  toggle(event?: Event): void {
    event?.stopPropagation();
    this.open = !this.open;
    this.emitToggle();
    if (this.open) this.startAutoClose();
    else this.clearAutoClose();
  }

  async onChoose(code: Lang, event: Event): Promise<void> {
    event.stopPropagation();
    // Ya no seteamos current aquí, lo hará la suscripción
    await this.i18n.setLang(code);
    this.open = false;
    this.emitToggle();
    this.clearAutoClose();
  }

  flagSrc(code: Lang): string {
    return `assets/images/flags/${code}.svg`;
  }

  onFlagError(event: Event, code: Lang): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
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

  private emitToggle(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('creasia:lang-menu-toggle', { detail: { open: this.open } }));
  }

  private startAutoClose(delayMs = 7000): void {
    this.clearAutoClose();
    this.autoCloseTimer = setTimeout(() => {
      if (this.open) {
        this.open = false;
        this.emitToggle();
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

  closeFromExternal(): void {
    if (!this.open) return;
    this.open = false;
    this.emitToggle();
    this.clearAutoClose();
  }

  @HostListener('window:creasia:user-menu-toggle', ['$event'])
  onUserMenuToggle(event: Event): void {
    const detail = (event as CustomEvent<{ open: boolean }>).detail;
    if (detail?.open) {
      this.closeFromExternal();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      if (this.open) {
        this.open = false;
        this.emitToggle();
      }
      this.clearAutoClose();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
    this.emitToggle();
    this.clearAutoClose();
  }
}


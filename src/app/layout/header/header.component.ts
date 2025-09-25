/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LangSwitcherComponent } from '../../shared/i18n/lang-switcher.component';
import { TPipe } from '../../shared/i18n/t.pipe';
import { UserSessionService } from '../../services/user-session.service';
import { SociosService } from '../../services/socios.service';

interface MenuItem {
  labelKey: string;
  route?: string;
  action?: 'reload' | 'home';
  icon?: string;
}

interface SavedFieldState {
  index: number;
  value: string;
  checked: boolean | null;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LangSwitcherComponent, TPipe],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  private static readonly RETURN_STATE_KEY = 'creasia:returnState';
  private static readonly USER_MENU_AUTO_CLOSE_MS = 7000;

  private readonly session = inject(UserSessionService);
  private readonly socios = inject(SociosService);

  readonly userName = this.session.userName;
  readonly userInitials = this.session.userInitials;
  readonly isLoggedIn = this.session.isLoggedIn;

  @ViewChild(LangSwitcherComponent)
  private langSwitcher?: LangSwitcherComponent;

  readonly userMenuOpen = signal(false);

  readonly headerKey = signal('header.brand');
  readonly isHome = signal(true);
  readonly menuOpen = signal(false);
  readonly menuOffsets = signal({ top: 0, bottom: 0 });

  readonly menuItems: MenuItem[] = [
    { labelKey: 'menu.home', action: 'home', icon: 'assets/icons/home.png' },
    { labelKey: 'menu.animation', action: 'reload', icon: 'assets/icons/animationw.png' },
    { labelKey: 'menu.activities', route: '/actividades', icon: 'assets/icons/rutina-diaria.png' },
    { labelKey: 'menu.partners', route: '/socios', icon: 'assets/icons/media.png' },
    { labelKey: 'menu.culture', route: '/cultura', icon: 'assets/icons/amor.png' },
    { labelKey: 'menu.gourmet', route: '/gourmet', icon: 'assets/icons/arroz.png' },
    { labelKey: 'menu.trips', route: '/viajes', icon: 'assets/icons/plane.png' },
    { labelKey: 'menu.languages', route: '/idiomas', icon: 'assets/icons/contacto.png' },
    { labelKey: 'menu.networking', route: '/networking', icon: 'assets/icons/shake.png' },
    { labelKey: 'menu.consulting', route: '/consultoria', icon: 'assets/icons/shake.png' },
    { labelKey: 'menu.legal', route: '/legal', icon: 'assets/icons/legal.png' }
  ];

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);
  private originalBodyOverflow: string | null = null;
  private userMenuTimer: ReturnType<typeof setTimeout> | null = null;


  constructor() {
    this.updateKey();
    this.session.refreshFromStorage();
    this.closeUserMenu();

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe((event) => {
        this.updateKey();
        this.restorePendingState(event.urlAfterRedirects);
        // re-hidratar por si el login ocurrió en otra ruta
        this.session.refreshFromStorage();
        this.closeUserMenu();
      });
  }

  goToProfile(): void {
    // Llévale a /socios (o a una futura pantalla de perfil)
    void this.router.navigateByUrl('/socios');
  }
  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.userMenuOpen();
    if (next) {
      this.langSwitcher?.closeFromExternal();
    }
    this.userMenuOpen.set(next);
    this.emitUserMenuToggle(next);
    if (next) {
      this.scheduleUserMenuAutoClose();
    } else {
      this.clearUserMenuTimer();
    }
  }

  closeUserMenu(): void {
    if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
      this.emitUserMenuToggle(false);
    }
  }

  private emitUserMenuToggle(open: boolean): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('creasia:user-menu-toggle', { detail: { open } }));
  }

  private scheduleUserMenuAutoClose(): void {
    this.clearUserMenuTimer();
    this.userMenuTimer = setTimeout(() => {
      this.userMenuOpen.set(false);
      this.emitUserMenuToggle(false);
      this.userMenuTimer = null;
    }, HeaderComponent.USER_MENU_AUTO_CLOSE_MS);
  }

  private clearUserMenuTimer(): void {
    if (this.userMenuTimer) {
      clearTimeout(this.userMenuTimer);
      this.userMenuTimer = null;
    }
  }

  onUserMenuSelect(option: '1' | '2'): void {
    this.closeUserMenu();
    if (option === '1') {
      this.goToProfile();
    } else if (option === '2') {
      this.socios.logout();
    }
  }

  @HostListener('window:creasia:lang-menu-toggle', ['$event'])
  onLangMenuToggle(event: Event): void {
    const detail = (event as CustomEvent<{ open: boolean }>).detail;
    if (detail?.open) this.closeUserMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    const wrapper = this.host.nativeElement.querySelector('.user-menu');
    if (wrapper && wrapper.contains(target)) return;
    this.closeUserMenu();
  }


  /* --------- Header existente --------- */

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
    this.closeUserMenu();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.menuOpen()) return;

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => this.updateMenuOffsets());
    } else {
      this.updateMenuOffsets();
    }
  }

  toggleMenu(): void {
    const next = !this.menuOpen();
    this.menuOpen.set(next);
    this.toggleBodyScroll(next);

    if (next) {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => this.updateMenuOffsets());
      } else {
        this.updateMenuOffsets();
      }
    } else {
      this.menuOffsets.set({ top: 0, bottom: 0 });
    }
  }

  closeMenu(): void {
    if (this.menuOpen()) this.menuOpen.set(false);
    this.toggleBodyScroll(false);
    this.menuOffsets.set({ top: 0, bottom: 0 });
  }

  onMenuItemSelect(item: MenuItem): void {
    if (item.action === 'reload') {
      this.closeMenu();
      this.restartAnimation();
      return;
    }

    if (item.action === 'home') {
      this.goHome();
      return;
    }

    if (item.route) {
      this.closeMenu();
      void this.router.navigateByUrl(item.route);
      return;
    }

    this.closeMenu();
  }

  goHome(event?: Event): void {
    event?.preventDefault();
    this.closeMenu();

    if (this.isHome()) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('homeSkipToEnd'));
      }
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(HeaderComponent.RETURN_STATE_KEY);
    }

    void this.router.navigate(['/'], {
      queryParams: { skip: '1' },
      replaceUrl: true
    });
  }

  private updateKey(): void {
    let current: ActivatedRoute | null = this.route;
    while (current?.firstChild) {
      current = current.firstChild;
    }
    const snapshot = current?.snapshot;
    const key = snapshot?.data?.['headerKey'];

    let isHomeRoute = false;
    if (snapshot) {
      const routePath = snapshot.routeConfig?.path ?? '';
      const urlLength = snapshot.url?.length ?? 0;
      isHomeRoute = routePath === '' && urlLength === 0;
    }

    this.isHome.set(isHomeRoute);
    this.headerKey.set(typeof key === 'string' && key.length > 0 ? key : 'header.brand');
  }

  private updateMenuOffsets(): void {
    if (typeof window === 'undefined') return;

    const headerEl = this.host.nativeElement.querySelector('.hdr') as HTMLElement | null;
    const footerEl = document.querySelector('app-footer') as HTMLElement | null;

    const top = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 0;
    const bottom = footerEl ? Math.ceil(footerEl.getBoundingClientRect().height) : 0;

    this.menuOffsets.set({ top, bottom });
  }

  private restartAnimation(): void {
    if (typeof window === 'undefined') return;

    const currentUrl = this.router.url;
    const isOnHome = this.isHome();

    if (!isOnHome) {
      this.storeReturnState(currentUrl);

      const queryParams: Record<string, string> = {};
      if (currentUrl && currentUrl !== '/') {
        queryParams['returnUrl'] = encodeURIComponent(currentUrl);
      }

      const tree = this.router.createUrlTree(['/'], { queryParams });
      window.location.href = this.router.serializeUrl(tree);
      return;
    }

    const tree = this.router.createUrlTree(['/']);
    window.location.href = this.router.serializeUrl(tree);
  }

  private storeReturnState(originUrl: string): void {
    if (typeof window === 'undefined') return;

    const fields = this.captureFormState();
    const payload = { url: originUrl, fields };

    if (originUrl.startsWith('/socios')) {
      try {
        window.sessionStorage.setItem(HeaderComponent.RETURN_STATE_KEY, '1');
      } catch { }
    }

    try {
      window.sessionStorage.setItem(HeaderComponent.RETURN_STATE_KEY, JSON.stringify(payload));
    } catch { }
  }

  private restorePendingState(url: string): void {
    if (typeof window === 'undefined') return;

    const raw = window.sessionStorage.getItem(HeaderComponent.RETURN_STATE_KEY);
    if (!raw) return;

    let payload: { url: string; fields: SavedFieldState[] } | null = null;
    try {
      payload = JSON.parse(raw) as { url: string; fields: SavedFieldState[] };
    } catch {
      window.sessionStorage.removeItem(HeaderComponent.RETURN_STATE_KEY);
      return;
    }

    if (!payload || payload.url !== url) return;

    window.sessionStorage.removeItem(HeaderComponent.RETURN_STATE_KEY);
    queueMicrotask(() => this.restoreFormState(payload!.fields ?? []));
  }

  private captureFormState(): SavedFieldState[] {
    if (typeof document === 'undefined') return [];

    const elements = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
    );

    return elements.map((element, index) => {
      const entry: SavedFieldState = { index, value: element.value ?? '', checked: null };

      if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        entry.checked = element.checked;
      }

      return entry;
    });
  }

  private restoreFormState(fields: SavedFieldState[]): void {
    if (typeof document === 'undefined') return;

    const elements = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
    );

    fields.forEach(({ index, value, checked }) => {
      const element = elements[index];
      if (!element) return;

      if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        if (checked !== null) element.checked = checked;
      }

      element.value = value ?? '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  private toggleBodyScroll(disable: boolean): void {
    if (typeof document === 'undefined') return;

    if (disable) {
      if (this.originalBodyOverflow === null) {
        this.originalBodyOverflow = document.body.style.overflow || '';
      }
      document.body.style.overflow = 'hidden';
    } else if (this.originalBodyOverflow !== null) {
      document.body.style.overflow = this.originalBodyOverflow;
      this.originalBodyOverflow = null;
    }
  }
}





















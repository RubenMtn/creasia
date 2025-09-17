import { Component, inject, signal } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LangSwitcherComponent } from '../../shared/i18n/lang-switcher.component';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LangSwitcherComponent, TPipe],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  readonly headerKey = signal('header.brand');
  readonly isHome = signal(true);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    this.updateKey();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.updateKey());
  }

  goHome(event: Event): void {
    event.preventDefault();
    void this.router.navigate(['/'], { queryParams: { skip: '1' } });
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
}

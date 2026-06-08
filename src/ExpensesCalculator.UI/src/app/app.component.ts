import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { VerticalNavbarComponent } from "./shared/vertical-navbar/vertical-navbar.component";
import { HorizontalNavbarComponent } from './shared/horizontal-navbar/horizontal-navbar.component';
import { ToastComponent } from './shared/toast/toast.component';
import { ModalWindowComponent } from './shared/modal-window/modal-window.component';
import { RouterOutlet } from "@angular/router";
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  imports: [VerticalNavbarComponent, HorizontalNavbarComponent, ToastComponent, ModalWindowComponent, RouterOutlet, TranslatePipe]
})
export class AppComponent {
  title = 'Expenses Calculator';
  private platformId = inject(PLATFORM_ID);

  constructor(private translate: TranslateService) {
    let savedLang = 'en';
    if (isPlatformBrowser(this.platformId)) {
      savedLang = localStorage.getItem('lang') || 'en';
    }
    this.translate.setFallbackLang('en');
    this.translate.use(savedLang);
  }
}

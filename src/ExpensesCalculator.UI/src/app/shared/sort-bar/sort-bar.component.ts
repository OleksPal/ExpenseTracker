import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, AfterViewInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

export interface SortOption {
  value: string;
  labelKey: string;
}

@Component({
  selector: 'app-sort-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './sort-bar.component.html',
  styleUrl: './sort-bar.component.css'
})
export class SortBarComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() sortOptions: SortOption[] = [];
  @Input() selectedColumn: string = '';
  @Input() selectedOrder: 'asc' | 'desc' = 'asc';

  @Output() sortChange = new EventEmitter<{ column: string; order: 'asc' | 'desc' }>();

  sortButtonWidth: string = 'auto';
  private sortButtonWidthCache: Map<string, string> = new Map();
  private langChangeSub!: Subscription;
  private resizeListener: (() => void) | null = null;

  // Temporary sort state for modal
  tempSortColumn: string = '';
  tempSortOrder: 'asc' | 'desc' = 'asc';

  constructor(private translate: TranslateService) {}

  ngOnInit(): void {
    this.updateTempValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update temp values whenever inputs change
    if (changes['selectedColumn'] || changes['selectedOrder']) {
      this.updateTempValues();
    }
  }

  private updateTempValues(): void {
    // Initialize temp values with current selections or defaults
    this.tempSortColumn = this.selectedColumn || (this.sortOptions.length > 0 ? this.sortOptions[0].value : '');
    this.tempSortOrder = this.selectedOrder || 'asc';
  }

  ngAfterViewInit(): void {
    this.syncSortButtonWidth();

    // Re-sync button width when language changes
    this.langChangeSub = this.translate.onLangChange.subscribe(() => {
      setTimeout(() => this.syncSortButtonWidth(), 0);
    });

    // Re-sync button width when window is resized
    this.resizeListener = () => {
      this.syncSortButtonWidth();
    };
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    if (this.langChangeSub) {
      this.langChangeSub.unsubscribe();
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  get sortDisplayText(): string {
    const option = this.sortOptions.find(opt => opt.value === this.selectedColumn);
    return option ? this.translate.instant(option.labelKey) : '';
  }

  get sortArrowIcon(): string {
    return this.selectedOrder === 'asc' ? 'bi bi-arrow-up' : 'bi bi-arrow-down';
  }

  openSortModal(): void {
    // Ensure temp values are synced with current values when dropdown opens
    this.tempSortColumn = this.selectedColumn || (this.sortOptions.length > 0 ? this.sortOptions[0].value : '');
    this.tempSortOrder = this.selectedOrder || 'asc';
  }

  applySorting(): void {
    this.sortChange.emit({
      column: this.tempSortColumn,
      order: this.tempSortOrder
    });
    this.closeSortDropdown();
  }

  resetSorting(): void {
    this.tempSortColumn = this.sortOptions.length > 0 ? this.sortOptions[0].value : '';
    this.tempSortOrder = 'asc';
  }

  closeSortDropdown(): void {
    const dropdownElement = document.getElementById('sortDropdown');
    if (dropdownElement) {
      const bootstrap = (window as any).bootstrap;
      if (bootstrap) {
        const dropdown = bootstrap.Dropdown.getInstance(dropdownElement);
        if (dropdown) {
          dropdown.hide();
        }
      }
    }
  }

  syncSortButtonWidth(): void {
    // On small screens (< 576px), let CSS handle the width
    if (window.innerWidth < 576) {
      this.sortButtonWidth = 'auto';
      return;
    }

    // Find the longest translated text with arrow
    let longestText = '';
    let maxLength = 0;
    this.sortOptions.forEach(option => {
      const translated = this.translate.instant(option.labelKey);
      const textWithArrow = translated + ' ↑';
      if (textWithArrow.length > maxLength) {
        maxLength = textWithArrow.length;
        longestText = textWithArrow;
      }
    });

    // Check cache using the longest text as key
    const cachedWidth = this.sortButtonWidthCache.get(longestText);
    if (cachedWidth) {
      this.sortButtonWidth = cachedWidth;
      return;
    }

    setTimeout(() => {
      // Create a temporary hidden element to measure the text
      const tempButton = document.createElement('button');
      tempButton.className = 'btn btn-outline-primary text-white dropdown-toggle';
      tempButton.style.visibility = 'hidden';
      tempButton.style.position = 'absolute';
      tempButton.style.whiteSpace = 'nowrap';
      tempButton.innerHTML = longestText;

      // Add to DOM to measure
      document.body.appendChild(tempButton);

      // Measure the width
      const buttonWidth = tempButton.offsetWidth;

      // Remove the temporary element
      document.body.removeChild(tempButton);

      // Apply and cache the measured width
      if (buttonWidth > 0) {
        this.sortButtonWidth = buttonWidth + 'px';
        this.sortButtonWidthCache.set(longestText, this.sortButtonWidth);
      }
    }, 200);
  }
}

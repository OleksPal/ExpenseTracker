import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChecksService, Check } from '../../services/checks.service';
import { ItemListComponent } from '../../items/item-list/item-list.component';
import { ItemsService, Item } from '../../services/items.service';
import { ModalService } from '../../services/modal.service';
import { FilterBarComponent, FilterOption } from '../../shared/filter-bar/filter-bar.component';
import { SortBarComponent, SortOption } from '../../shared/sort-bar/sort-bar.component';
import { TourAnchorNgBootstrapDirective } from 'ngx-ui-tour-ng-bootstrap';
import { CheckAddFormComponent } from '../../modals/check-form/check-add-form.component';
import { CheckEditFormComponent } from '../../modals/check-form/check-edit-form.component';
import { CheckDeleteFormComponent } from '../../modals/check-form/check-delete-form.component';

declare var bootstrap: any;

@Component({
  selector: 'app-check-list',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ItemListComponent, FilterBarComponent, SortBarComponent, TourAnchorNgBootstrapDirective],
  templateUrl: './check-list.component.html',
  styleUrl: './check-list.component.css'
})
export class CheckListComponent implements OnInit, OnChanges {
  @Input() dayExpensesId!: string;
  @Input() dayExpensesLocation?: string;
  @Input() dayExpensesDate?: Date;
  @Input() currentLocale: string = 'en';
  @Input() participants: string[] = [];
  @Input() checks?: Check[]; // Optional: if provided, use these instead of loading
  @Input() scrollToCheckId?: string;
  @Input() scrollToItemId?: string;
  @Output() checksLoaded = new EventEmitter<void>();

  // Data properties
  checksList: Check[] = [];
  filteredChecksList: Check[] = [];
  expandedCheckIds: Set<string> = new Set();
  checkItemsMap: Map<string, Item[]> = new Map(); // Store items per check
  checkLoadingMap: Map<string, boolean> = new Map(); // Track loading state per check

  // Filter and sort properties
  filterText = '';
  filterCriteria: string = 'Location';
  filterOptions: FilterOption[] = [
    { value: 'Location', labelKey: 'CHECKS.FILTER.LOCATION' },
    { value: 'Payer', labelKey: 'CHECKS.FILTER.PAYER' },
    { value: 'Sum', labelKey: 'CHECKS.FILTER.SUM' }
  ];
  sortColumn: 'location' | 'totalSum' | 'payer' = 'totalSum';
  sortOrder: 'asc' | 'desc' = 'desc';
  sortOptions: SortOption[] = [
    { value: 'location', labelKey: 'CHECKS.LOCATION' },
    { value: 'payer', labelKey: 'CHECKS.PAYER' },
    { value: 'totalSum', labelKey: 'CHECKS.SUM' }
  ];

  // UI state properties
  isLoading = false;

  // Scroll to check flag
  private shouldScrollToCheck = false;

  // Scroll to item flag and highlighted item ID
  private shouldScrollToItem = false;
  highlightedItemId?: string;

  constructor(
    private checksService: ChecksService,
    private itemsService: ItemsService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    // If checks are provided, use them; otherwise load them
    if (this.checks !== undefined) {
      this.checksList = this.checks;
      this.applyLocalFiltering();
      this.checksLoaded.emit();

      // Handle scrolling after checks are set
      if (this.scrollToCheckId) {
        this.shouldScrollToCheck = true;
        setTimeout(() => this.scrollToCheck(this.scrollToCheckId!), 100);
      }
    } else if (this.dayExpensesId) {
      this.loadChecks();
    }

    // Check if we should scroll to a specific check
    if (this.scrollToCheckId) {
      this.shouldScrollToCheck = true;
    }

    // Set highlighted item ID if provided (check scroll will handle item visibility)
    if (this.scrollToItemId) {
      this.highlightedItemId = this.scrollToItemId;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If checks are provided and changed, use them
    if (changes['checks'] && !changes['checks'].firstChange && this.checks !== undefined) {
      this.checksList = this.checks;
      this.applyLocalFiltering();
      // Don't emit checksLoaded here to avoid infinite loop when parent updates checks
    } else if (changes['dayExpensesId'] && !changes['dayExpensesId'].firstChange && this.checks === undefined) {
      this.loadChecks();
    }
  }


  // Data loading methods
  loadChecks(): void {
    if (!this.dayExpensesId) return;

    this.isLoading = true;
    this.checksService.getAllDayExpensesChecks(this.dayExpensesId).subscribe({
      next: (data) => {
        this.checksList = data;
        this.applyLocalFiltering();
        this.isLoading = false;

        // Emit event to parent to re-initialize tour
        this.checksLoaded.emit();

        // Scroll to check if needed
        if (this.shouldScrollToCheck && this.scrollToCheckId) {
          this.scrollToCheck(this.scrollToCheckId);
          this.shouldScrollToCheck = false;
        }
      },
      error: (err) => {
        console.error('Error loading checks:', err);
        this.isLoading = false;
      }
    });
  }

  // Local filtering and sorting methods
  onFilterChange(filterText: string): void {
    this.filterText = filterText;
    this.applyLocalFiltering();
  }

  changeFilterCriteria(criteria: string): void {
    this.filterCriteria = criteria;
    this.applyLocalFiltering();
  }

  sortChecks(column: 'location' | 'totalSum' | 'payer'): void {
    if (this.sortColumn === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortOrder = 'asc';
    }
    this.applyLocalSorting();
  }

  onSortChange(event: { column: string; order: 'asc' | 'desc' }): void {
    this.sortColumn = event.column as 'location' | 'totalSum' | 'payer';
    this.sortOrder = event.order;
    this.applyLocalSorting();
  }

  applyLocalFiltering(): void {
    const searchTerm = this.filterText.toLowerCase().trim();

    if (!searchTerm) {
      this.filteredChecksList = [...this.checksList];
    } else {
      this.filteredChecksList = this.checksList.filter(check => {
        if (this.filterCriteria === 'Location') {
          return check.location.toLowerCase().includes(searchTerm);
        } else if (this.filterCriteria === 'Payer') {
          return check.payer.toLowerCase().includes(searchTerm);
        } else if (this.filterCriteria === 'Sum') {
          return check.totalSum.toFixed(2).includes(searchTerm);
        }
        return false;
      });
    }

    this.applyLocalSorting();
  }

  applyLocalSorting(): void {
    this.filteredChecksList.sort((a, b) => {
      let valueA: any = a[this.sortColumn];
      let valueB: any = b[this.sortColumn];

      // Handle string comparison for location and payer
      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) return this.sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Row expansion methods
  toggleCheckExpansion(id: string): void {
    const collapseElement = document.getElementById('collapse' + id);
    if (collapseElement) {
      const bsCollapse = new bootstrap.Collapse(collapseElement, { toggle: false });

      if (this.expandedCheckIds.has(id)) {
        this.expandedCheckIds.delete(id);
        bsCollapse.hide();
      } else {
        this.expandedCheckIds.add(id);

        // Listen for the collapse shown event to reinitialize tooltips
        collapseElement.addEventListener('shown.bs.collapse', () => {
          // Give Angular time to render the items, then reinitialize tooltips
          // Use longer delay to ensure items are fully loaded and rendered
          setTimeout(() => {
            const tooltipElements = collapseElement.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltipElements.forEach((el: any) => {
              // Dispose existing tooltip if any
              const existingTooltip = bootstrap.Tooltip.getInstance(el);
              if (existingTooltip) existingTooltip.dispose();
              // Initialize new tooltip with explicit configuration
              new bootstrap.Tooltip(el, {
                html: true,
                trigger: 'hover',
                container: 'body',
                placement: 'top'
              });
            });
          }, 300);
        }, { once: true }); // Use once: true to auto-remove listener after firing

        bsCollapse.show();

        // Load items if not already loaded
        if (!this.checkItemsMap.has(id)) {
          this.loadItemsForCheck(id);
        }
      }
    }
  }

  loadItemsForCheck(checkId: string): void {
    if (this.checkLoadingMap.get(checkId)) {
      return;
    }

    this.checkLoadingMap.set(checkId, true);

    this.itemsService.getAllCheckItems(checkId).subscribe({
      next: (items) => {
        this.checkItemsMap.set(checkId, items);
        this.checkLoadingMap.set(checkId, false);

        // Force change detection to ensure DOM is updated
        this.cdr.detectChanges();

        // Reinitialize tooltips after items are loaded and rendered
        setTimeout(() => {
          const collapseElement = document.getElementById('collapse' + checkId);
          if (collapseElement && collapseElement.classList.contains('show')) {
            const tooltipElements = collapseElement.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltipElements.forEach((el: any) => {
              const existingTooltip = bootstrap.Tooltip.getInstance(el);
              if (existingTooltip) existingTooltip.dispose();
              new bootstrap.Tooltip(el, {
                html: true,
                trigger: 'hover',
                container: 'body',
                placement: 'top'
              });
            });
          }
        }, 200);
      },
      error: (err) => {
        console.error('Error loading items for check:', err);
        this.checkLoadingMap.set(checkId, false);
      }
    });
  }

  getItemsForCheck(checkId: string): Item[] {
    return this.checkItemsMap.get(checkId) || [];
  }

  isCheckItemsLoading(checkId: string): boolean {
    return this.checkLoadingMap.get(checkId) || false;
  }

  onCheckSumUpdated(event: { checkId: string, newSum: number }): void {
    const check = this.checksList.find(c => c.id === event.checkId);
    if (check) {
      check.totalSum = event.newSum;
      this.cdr.detectChanges();
    }
  }

  isCheckExpanded(id: string): boolean {
    return this.expandedCheckIds.has(id);
  }

  // Modal management methods
  openModal(type: 'add' | 'edit' | 'delete', id: string = ''): void {
    if (type === 'add') {
      this.modalService.open(
        CheckAddFormComponent,
        this.translate.instant('CHECKS.MODAL.ADD_TITLE'),
        {
          participants: this.participants,
          dayExpensesId: this.dayExpensesId,
          onSuccess: () => this.refreshChecks()
        },
        'md'
      );
      return;
    }

    if (type === 'edit') {
      const check = this.checksList.find(c => c.id === id);
      if (!check) return;

      this.modalService.open(
        CheckEditFormComponent,
        this.translate.instant('CHECKS.MODAL.EDIT_TITLE'),
        {
          participants: this.participants,
          checkId: check.id,
          location: check.location,
          payer: check.payer,
          onSuccess: () => this.refreshChecks()
        },
        'md'
      );
      return;
    }

    if (type === 'delete') {
      const check = this.checksList.find(c => c.id === id);
      if (!check) return;

      this.modalService.open(
        CheckDeleteFormComponent,
        this.translate.instant('CHECKS.MODAL.DELETE_TITLE'),
        {
          checkId: check.id,
          dayExpensesId: this.dayExpensesId,
          location: check.location,
          payer: check.payer,
          totalSum: check.totalSum,
          onSuccess: () => this.refreshChecks()
        },
        'md'
      );
      return;
    }
  }

  refreshChecks(): void {
    this.loadChecks();
    this.checksLoaded.emit();
  }

  getIconOrderClass(column: string): string {
    if (this.sortColumn !== column) {
      return 'bi bi-funnel-fill ps-1';
    }
    return this.sortOrder === 'asc' ? 'bi bi-arrow-up ps-1' : 'bi bi-arrow-down ps-1';
  }


  // Scroll to specific check
  private scrollToCheck(checkId: string): void {
    setTimeout(() => {
      // Expand the check if not already expanded
      if (!this.expandedCheckIds.has(checkId)) {
        this.toggleCheckExpansion(checkId);
      }

      // Wait for expansion animation then scroll
      setTimeout(() => {
        const checkElement = document.querySelector(`[data-check-id="${checkId}"]`) as HTMLElement;
        if (checkElement) {
          // Get element position
          const elementRect = checkElement.getBoundingClientRect();
          const absoluteElementTop = elementRect.top + window.scrollY;
          // Scroll with offset to show header/previous row (approximately 80px above)
          window.scrollTo({
            top: absoluteElementTop - 80,
            behavior: 'smooth'
          });
        }
      }, 400);
    }, 200);
  }
}

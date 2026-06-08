import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../services/modal.service';
import { FilterBarComponent, FilterOption } from '../../shared/filter-bar/filter-bar.component';
import { SortBarComponent, SortOption } from '../../shared/sort-bar/sort-bar.component';
import { RecommendationAddFormComponent } from '../../modals/recommendation-form/recommendation-add-form/recommendation-add-form.component';
import { RecommendationEditFormComponent } from '../../modals/recommendation-form/recommendation-edit-form/recommendation-edit-form.component';
import { RecommendationDeleteFormComponent } from '../../modals/recommendation-form/recommendation-delete-form/recommendation-delete-form.component';
import { ItemsService, Item } from '../../services/items.service';
import { ToastService } from '../../services/toast.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TourService, TourAnchorNgBootstrapDirective, TourStepTemplateComponent } from 'ngx-ui-tour-ng-bootstrap';

declare var bootstrap: any;

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FilterBarComponent, SortBarComponent, TranslatePipe, TourAnchorNgBootstrapDirective, TourStepTemplateComponent],
  templateUrl: './recommendations.component.html',
  styleUrl: './recommendations.component.css'
})
export class RecommendationsComponent implements OnInit, AfterViewInit, OnDestroy {
  // Data properties
  itemsList: Item[] = [];
  filteredItemsList: Item[] = [];
  paginatedItemsList: Item[] = [];

  // Pagination properties
  currentPage = 1;
  itemsPerPage = 12;
  totalPages = 1;
  totalCount = 0;

  // Filter and sort properties
  filterText = '';
  filterCriteria: string = 'Name';
  filterTags: string[] = [];
  tagFilterInput = '';
  allAvailableTags: string[] = [];
  filteredTagSuggestions: string[] = [];
  showTagSuggestions = false;
  // Internal filter state for backend (may differ from displayed filter)
  private actualFilterText = '';
  private actualFilterCriteria = 'Name';
  sortColumn: 'name' | 'price' | 'amount' | 'totalPrice' | 'userCount' | 'rating' = 'rating';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Filter and sort options for shared components
  filterOptions: FilterOption[] = [
    { value: 'Name', labelKey: 'ITEMS.FILTER.NAME' },
    { value: 'Description', labelKey: 'ITEMS.FILTER.DESCRIPTION' },
    { value: 'Price', labelKey: 'ITEMS.FILTER.PRICE' },
    { value: 'Amount', labelKey: 'ITEMS.FILTER.AMOUNT' },
    { value: 'TotalSum', labelKey: 'ITEMS.FILTER.TOTAL_SUM' },
    { value: 'UserCount', labelKey: 'ITEMS.FILTER.USER_COUNT' },
    { value: 'Rating', labelKey: 'ITEMS.FILTER.RATING' }
  ];

  sortOptions: SortOption[] = [
    { value: 'name', labelKey: 'ITEMS.SORT.NAME' },
    { value: 'price', labelKey: 'ITEMS.SORT.PRICE' },
    { value: 'amount', labelKey: 'ITEMS.SORT.AMOUNT' },
    { value: 'totalPrice', labelKey: 'ITEMS.SORT.TOTAL_PRICE' },
    { value: 'userCount', labelKey: 'ITEMS.SORT.USER_COUNT' },
    { value: 'rating', labelKey: 'ITEMS.SORT.RATING' }
  ];

  // UI state properties
  isLoading = false;

  onlyMyItems = false; // Filter to show only current user's items

  // Subscription for language changes
  private langChangeSub!: Subscription;
  private filterTextSubject = new Subject<string>();
  private filterTextSubscription!: Subscription;

  get filterCriteriaKey(): string {
    const keyMap: Record<string, string> = {
      'Name': 'ITEMS.FILTER.NAME',
      'Description': 'ITEMS.FILTER.DESCRIPTION',
      'Price': 'ITEMS.FILTER.PRICE',
      'Amount': 'ITEMS.FILTER.AMOUNT',
      'TotalSum': 'ITEMS.FILTER.TOTAL_SUM',
      'UserCount': 'ITEMS.FILTER.USER_COUNT',
      'Rating': 'ITEMS.FILTER.RATING',
      'Tags': 'ITEMS.FILTER.TAGS'
    };
    return keyMap[this.filterCriteria] || 'ITEMS.FILTER.NAME';
  }

  get paginationStartIndex(): number {
    return this.paginatedItemsList.length === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get paginationEndIndex(): number {
    return this.paginatedItemsList.length === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + this.paginatedItemsList.length;
  }

  get totalItemsCount(): number {
    return this.totalPages * this.itemsPerPage;
  }

  constructor(
    private itemsService: ItemsService,
    private translate: TranslateService,
    private toastService: ToastService,
    private modalService: ModalService,
    public tourService: TourService
  ) {}

  ngOnInit(): void {
    // Setup debounced filter
    this.filterTextSubscription = this.filterTextSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadItems();
    });

    // Set items per page based on screen size
    this.setItemsPerPageByScreenSize();

    this.loadItems();
    this.loadAllTags();
  }

  loadAllTags(): void {
    this.itemsService.getAllDistinctTags().subscribe({
      next: (tags) => {
        this.allAvailableTags = tags;
      },
      error: (err) => {
        console.error('Error loading tags:', err);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initializeTooltips();

    this.langChangeSub = this.translate.onLangChange.subscribe(() => {
      this.destroyTooltips();
      setTimeout(() => {
        this.initializeTooltips();
        this.initializeTour();
      }, 0);
    });
  }

  ngOnDestroy(): void {
    this.destroyTooltips();
    if (this.langChangeSub) {
      this.langChangeSub.unsubscribe();
    }
    if (this.filterTextSubscription) {
      this.filterTextSubscription.unsubscribe();
    }
  }

  setItemsPerPageByScreenSize(): void {
    // Bootstrap's md breakpoint is 768px
    if (window.innerWidth < 768) {
      this.itemsPerPage = 3;
    } else {
      this.itemsPerPage = 12;
    }
  }

  initializeTooltips(): void {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
      new bootstrap.Tooltip(tooltipTriggerEl, {
        html: true
      });
    });
  }

  destroyTooltips(): void {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
      const existing = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
      if (existing) existing.dispose();
    });
  }

  loadItems(): void {
    this.isLoading = true;

    const request = {
      sortColumn: this.sortColumn,
      sortOrder: this.sortOrder,
      filterText: this.actualFilterText || undefined,
      filterCriteria: this.actualFilterCriteria || undefined,
      tags: this.filterTags.length > 0 ? this.filterTags : undefined,
      pageNumber: this.currentPage,
      pageSize: this.itemsPerPage,
      onlyMyItems: this.onlyMyItems
    };

    this.itemsService.getAllUserItems(request).subscribe({
      next: (data) => {
        this.itemsList = data.items;
        this.filteredItemsList = data.items;
        this.paginatedItemsList = data.items;
        this.totalPages = data.totalPages;
        this.totalCount = data.totalCount;
        this.isLoading = false;
        setTimeout(() => {
          this.initializeTooltips();
          this.initializeTour();
        }, 0);
      },
      error: (err) => {
        console.error('Error loading items:', err);
        this.isLoading = false;
      }
    });
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadItems();
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadItems();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadItems();
    }
  }

  getTotalPrice(item: Item): number {
    return item.price * item.amount;
  }

  onFilterChange(text?: string): void {
    if (text !== undefined) {
      this.filterText = text;
    }
    // Text filter and tag filter are now independent
    this.actualFilterText = this.filterText;
    this.actualFilterCriteria = this.filterCriteria;
    this.filterTextSubject.next(this.filterText);
  }

  changeFilterCriteria(criteria: string): void {
    this.filterCriteria = criteria;
    this.actualFilterCriteria = criteria;
    this.onFilterChange();
  }

  onSortChange(event: { column: string; order: 'asc' | 'desc' }): void {
    this.sortColumn = event.column as 'name' | 'price' | 'amount' | 'totalPrice' | 'userCount' | 'rating';
    this.sortOrder = event.order;
    this.currentPage = 1;
    this.loadItems();
  }

  onOnlyMyItemsChange(): void {
    this.currentPage = 1;
    this.loadItems();
  }

  resetSorting(): void {
    this.sortColumn = 'name';
    this.sortOrder = 'asc';
    this.currentPage = 1;
    this.loadItems();
  }

  closeSortDropdown(): void {
    const dropdownElement = document.getElementById('sortDropdown');
    if (dropdownElement) {
      const dropdown = bootstrap.Dropdown.getInstance(dropdownElement);
      if (dropdown) {
        dropdown.hide();
      }
    }
  }

  getUsersTooltipContent(itemId: string): string {
    const item = this.itemsList.find(i => i.id === itemId);
    if (!item || !item.users || item.users.length === 0) return '';

    const maxDisplay = 3;
    const displayUsers = item.users.slice(0, maxDisplay);
    const moreCount = item.users.length > maxDisplay ? item.users.length - maxDisplay : 0;

    let content = `<i class="bi bi-people-fill me-1"></i><span class="fw-bold">${this.translate.instant('ITEMS.TOOLTIP.USERS_TITLE')}</span><br/>`;
    displayUsers.forEach((user) => {
      content += `<i class="bi bi-person-fill me-1"></i> ${user}<br>`;
    });

    if (moreCount > 0) {
      content += this.translate.instant('ITEMS.TOOLTIP.AND_MORE', { count: moreCount });
    }

    return content;
  }

  openModal(type: 'add' | 'edit' | 'delete', id: string = ''): void {
    if (type === 'add') {
      this.modalService.open(
        RecommendationAddFormComponent,
        this.translate.instant('ITEMS.MODAL.ADD_TITLE'),
        { onSuccess: () => this.loadItems() },
        'lg'
      );
    } else if (type === 'edit' && id) {
      const item = this.itemsList.find(i => i.id === id);
      if (!item) return;

      this.modalService.open(
        RecommendationEditFormComponent,
        this.translate.instant('ITEMS.MODAL.EDIT_TITLE'),
        {
          id: item.id,
          name: item.name,
          comment: item.comment || '',
          price: item.price,
          amount: item.amount,
          rating: item.rating,
          tags: [...item.tags],
          canEdit: item.canEdit || false,
          onSuccess: () => this.loadItems()
        },
        'lg'
      );
    } else if (type === 'delete' && id) {
      const item = this.itemsList.find(i => i.id === id);
      if (!item) return;

      this.modalService.open(
        RecommendationDeleteFormComponent,
        this.translate.instant('ITEMS.MODAL.DELETE_TITLE'),
        {
          id: item.id,
          name: item.name,
          comment: item.comment || '',
          price: item.price,
          amount: item.amount,
          rating: item.rating,
          tags: [...item.tags],
          canDelete: item.canEdit || false,
          onSuccess: () => this.loadItems()
        },
        'lg'
      );
    }
  }

  addFilterTag(): void {
    const tag = this.tagFilterInput.trim().replace(/\s+/g, '_').toLowerCase();
    if (tag && !this.filterTags.includes(tag)) {
      this.filterTags.push(tag);
      this.tagFilterInput = '';
      this.showTagSuggestions = false;
      this.applyTagFilter();
    }
  }

  removeFilterTag(tag: string): void {
    const index = this.filterTags.indexOf(tag);
    if (index > -1) {
      this.filterTags.splice(index, 1);
      this.applyTagFilter();
    }
  }

  onTagInputChange(): void {
    const input = this.tagFilterInput.trim().toLowerCase();
    if (input) {
      this.filteredTagSuggestions = this.allAvailableTags
        .filter(tag => tag.toLowerCase().includes(input) && !this.filterTags.includes(tag))
        .slice(0, 5);
      this.showTagSuggestions = this.filteredTagSuggestions.length > 0;
    } else {
      this.showTagSuggestions = false;
    }
  }

  selectTagSuggestion(tag: string): void {
    if (!this.filterTags.includes(tag)) {
      this.filterTags.push(tag);
      this.tagFilterInput = '';
      this.showTagSuggestions = false;
      this.applyTagFilter();
    }
  }

  applyTagFilter(): void {
    // Tags are now sent as a separate array parameter, so just reload items
    this.currentPage = 1;
    this.loadItems();
  }

  translateBackendError(errorMessage: string): string {
    return errorMessage;
  }

  // Tour
  initializeTour(): void {
    const hasItems = !!document.querySelector('[touranchor="items-grid"]');
    const isSmallScreen = window.innerWidth < 576;

    const tourSteps: any[] = [];

    // Add item button - always visible
    tourSteps.push({
      anchorId: 'add-item-btn',
      content: this.translate.instant('TOUR_RECOMMENDATIONS.ADD_ITEM_CONTENT'),
      title: this.translate.instant('TOUR_RECOMMENDATIONS.ADD_ITEM_TITLE'),
      placement: 'bottom',
      enableBackdrop: true
    });

    // Different steps for small vs large screens
    if (isSmallScreen) {
      // Steps for small screens (filter/sort group)
      tourSteps.push({
        anchorId: 'filter-sort-controls',
        content: this.translate.instant('TOUR_RECOMMENDATIONS.FILTER_SORT_CONTROLS_CONTENT'),
        title: this.translate.instant('TOUR_RECOMMENDATIONS.FILTER_SORT_CONTROLS_TITLE'),
        placement: 'bottom',
        enableBackdrop: true
      });
    } else {
      // Steps for large screens (individual controls)
      tourSteps.push(
        {
          anchorId: 'tag-filter',
          content: this.translate.instant('TOUR_RECOMMENDATIONS.TAG_FILTER_CONTENT'),
          title: this.translate.instant('TOUR_RECOMMENDATIONS.TAG_FILTER_TITLE'),
          placement: 'bottom',
          enableBackdrop: true
        },
        {
          anchorId: 'search-filter',
          content: this.translate.instant('TOUR_RECOMMENDATIONS.SEARCH_FILTER_CONTENT'),
          title: this.translate.instant('TOUR_RECOMMENDATIONS.SEARCH_FILTER_TITLE'),
          placement: 'bottom',
          enableBackdrop: true
        },
        {
          anchorId: 'sort-bar',
          content: this.translate.instant('TOUR_RECOMMENDATIONS.SORT_BAR_CONTENT'),
          title: this.translate.instant('TOUR_RECOMMENDATIONS.SORT_BAR_TITLE'),
          placement: 'left',
          enableBackdrop: true
        },
        {
          anchorId: 'only-my-items',
          content: this.translate.instant('TOUR_RECOMMENDATIONS.ONLY_MY_ITEMS_CONTENT'),
          title: this.translate.instant('TOUR_RECOMMENDATIONS.ONLY_MY_ITEMS_TITLE'),
          placement: 'left',
          enableBackdrop: true
        }
      );
    }

    // Add items grid step only if items exist
    if (hasItems) {
      tourSteps.push({
        anchorId: 'items-grid',
        content: this.translate.instant('TOUR_RECOMMENDATIONS.ITEMS_GRID_CONTENT'),
        title: this.translate.instant('TOUR_RECOMMENDATIONS.ITEMS_GRID_TITLE'),
        placement: isSmallScreen ? 'bottom' : 'right',
        enableBackdrop: true
      });
    }

    // Initialize tour with global button title configuration
    this.tourService.initialize(tourSteps, {
      prevBtnTitle: this.translate.instant('TOUR.PREV_BTN'),
      nextBtnTitle: this.translate.instant('TOUR.NEXT_BTN'),
      endBtnTitle: this.translate.instant('TOUR.END_BTN')
    });
  }

  startTour(): void {
    this.tourService.start();
  }
}

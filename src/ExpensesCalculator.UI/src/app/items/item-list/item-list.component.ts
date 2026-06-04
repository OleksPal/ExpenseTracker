import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, AfterViewInit, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalWindowComponent } from '../../shared/modal-window/modal-window.component';
import { SortBarComponent, SortOption } from '../../shared/sort-bar/sort-bar.component';
import { FilterBarComponent, FilterOption } from '../../shared/filter-bar/filter-bar.component';
import { ValidationErrors, parseValidationErrors } from '../../shared/models/validation-errors.model';
import { ItemsService, Item, ItemResponse, DeleteItemResponse } from '../../services/items.service';
import { DayExpensesTotalSumUpdateService } from '../../services/day-expenses-total-sum-update.service';
import { ToastService } from '../../services/toast.service';
import { TooltipService } from '../../services/tooltip.service';
import { FormValidationService } from '../../services/form-validation.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TourAnchorNgBootstrapDirective } from 'ngx-ui-tour-ng-bootstrap';

declare var bootstrap: any;

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalWindowComponent, SortBarComponent, FilterBarComponent, TranslatePipe, TourAnchorNgBootstrapDirective],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.css'
})
export class ItemListComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() checkId!: string;
  @Input() dayExpensesId!: string;
  @Input() users: string[] = [];
  @Input() items?: Item[]; // Optional: if provided, use these instead of loading
  @Input() isLoading?: boolean; // Optional: external loading state
  @Input() highlightedItemId?: string;
  @Input() disableTooltipManagement: boolean = false; // When true, parent handles tooltips
  @Input() isFirstCheck: boolean = false; // Indicates if this is the first check (for tour anchor)
  @Output() checkSumUpdated = new EventEmitter<{ checkId: string, newSum: number }>();
  @Output() itemsChanged = new EventEmitter<string>(); // Emit when items are modified (checkId)

  // Data properties
  itemsList: Item[] = [];
  filteredItemsList: Item[] = [];
  paginatedItemsList: Item[] = [];
  expandedItemIds: Set<string> = new Set();
  expandedTagsItemIds: Set<string> = new Set();

  // Pagination properties
  currentPage = 1;
  itemsPerPage = 8;
  totalPages = 1;

  // Modal properties
  modalInstance: any;
  currentModalContent: 'add' | 'edit' | 'delete' = 'add';
  modalTitle: string = '';

  // Form properties
  id = '';
  name = '';
  comment = '';
  price = 0;
  amount = 1;
  rating = 0;
  hoverRating = 0;
  tags: string[] = [];
  tagInput = '';
  selectedUsers: string[] = [];

  // Validation properties
  formErrors: ValidationErrors = {};
  formValidated = false;

  // Filter and sort properties
  filterText = '';
  filterCriteria: string = 'Name';
  sortColumn: 'name' | 'price' | 'amount' | 'totalPrice' | 'userCount' | 'rating' = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';

  sortOptions: SortOption[] = [
    { value: 'name', labelKey: 'ITEMS.SORT.NAME' },
    { value: 'price', labelKey: 'ITEMS.SORT.PRICE' },
    { value: 'amount', labelKey: 'ITEMS.SORT.AMOUNT' },
    { value: 'totalPrice', labelKey: 'ITEMS.SORT.TOTAL_PRICE' },
    { value: 'userCount', labelKey: 'ITEMS.SORT.USER_COUNT' },
    { value: 'rating', labelKey: 'ITEMS.SORT.RATING' }
  ];

  filterOptions: FilterOption[] = [
    { value: 'Name', labelKey: 'ITEMS.FILTER.NAME' },
    { value: 'Description', labelKey: 'ITEMS.FILTER.DESCRIPTION' },
    { value: 'Price', labelKey: 'ITEMS.FILTER.PRICE' },
    { value: 'Amount', labelKey: 'ITEMS.FILTER.AMOUNT' },
    { value: 'TotalSum', labelKey: 'ITEMS.FILTER.TOTAL_SUM' },
    { value: 'UserCount', labelKey: 'ITEMS.FILTER.USER_COUNT' },
    { value: 'Rating', labelKey: 'ITEMS.FILTER.RATING' },
    { value: 'Tags', labelKey: 'ITEMS.FILTER.TAGS' }
  ];

  // UI state properties
  internalLoading = false;
  private viewInitialized = false;

  // Subscription for language changes
  private langChangeSub!: Subscription;
  private filterTextSubject = new Subject<string>();
  private filterTextSubscription!: Subscription;

  // Inject services using inject() for better SSR compatibility
  private dayExpensesTotalSumUpdateService = inject(DayExpensesTotalSumUpdateService);

  constructor(
    private itemsService: ItemsService,
    private translate: TranslateService,
    private toastService: ToastService,
    private tooltipService: TooltipService,
    private formValidationService: FormValidationService
  ) {}

  ngOnInit(): void {
    // Setup debounced filter
    this.filterTextSubscription = this.filterTextSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.applyLocalFiltering();
    });

    // Set items per page based on screen size
    this.setItemsPerPageByScreenSize();

    // If items are provided, use them; otherwise load them
    if (this.items && this.items.length > 0) {
      this.itemsList = this.items;
      this.applyLocalFiltering();
    } else if (this.checkId && !this.items) {
      this.loadItems();
    }
  }

  get loading(): boolean {
    return this.isLoading !== undefined ? this.isLoading : this.internalLoading;
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    if (!this.disableTooltipManagement) {
      this.initializeTooltips();
    }

    // Re-initialize tooltips when language changes
    this.langChangeSub = this.translate.onLangChange.subscribe(() => {
      if (!this.disableTooltipManagement) {
        this.destroyTooltips();
        setTimeout(() => {
          this.initializeTooltips();
        }, 100);
      }
    });
  }


  ngOnChanges(changes: SimpleChanges): void {
    // If items are provided and changed, use them
    if (changes['items'] && !changes['items'].firstChange && this.items) {
      this.itemsList = this.items;
      this.applyLocalFiltering();
    } else if (changes['checkId'] && !changes['checkId'].firstChange && !this.items) {
      this.loadItems();
    }
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

  initializeTooltips(): void {
    this.tooltipService.initialize({ html: true });
  }

  destroyTooltips(): void {
    this.tooltipService.destroy();
  }

  // Data loading methods
  loadItems(): void {
    if (!this.checkId) return;

    this.internalLoading = true;
    this.itemsService.getAllCheckItems(this.checkId).subscribe({
      next: (data) => {
        this.itemsList = data;
        this.applyLocalFiltering();
        this.internalLoading = false;

        // Re-initialize tooltips after data loads
        this.reinitializeTooltipsAfterDelay();
      },
      error: (err) => {
        console.error('Error loading items:', err);
        this.internalLoading = false;
      }
    });
  }

  loadSingleItem(id: string): void {
    const item = this.itemsList.find(i => i.id === id);
    if (item) {
      this.id = item.id;
      this.name = item.name;
      this.comment = item.comment || '';
      this.price = item.price;
      this.amount = item.amount;
      this.rating = item.rating;
      this.tags = [...item.tags];
      this.selectedUsers = [...item.users];
    }
  }

  // Local filtering and sorting methods
  onFilterChange(filterText: string): void {
    this.filterText = filterText;
    this.filterTextSubject.next(this.filterText);
  }

  changeFilterCriteria(criteria: string): void {
    this.filterCriteria = criteria;
    this.applyLocalFiltering();
  }

  onSortChange(event: { column: string; order: 'asc' | 'desc' }): void {
    this.sortColumn = event.column as 'name' | 'price' | 'amount' | 'totalPrice' | 'userCount' | 'rating';
    this.sortOrder = event.order;
    this.applyLocalSorting();
  }

  applyLocalFiltering(): void {
    const searchTerm = this.filterText.toLowerCase().trim();

    if (!searchTerm) {
      this.filteredItemsList = [...this.itemsList];
    } else {
      this.filteredItemsList = this.itemsList.filter(item => {
        if (this.filterCriteria === 'Name') {
          return item.name.toLowerCase().includes(searchTerm);
        } else if (this.filterCriteria === 'Description') {
          return (item.comment || '').toLowerCase().includes(searchTerm);
        } else if (this.filterCriteria === 'Price') {
          return item.price.toString().includes(searchTerm);
        } else if (this.filterCriteria === 'Amount') {
          return item.amount.toString().includes(searchTerm);
        } else if (this.filterCriteria === 'TotalSum') {
          const totalSum = item.price * item.amount;
          return totalSum.toString().includes(searchTerm);
        } else if (this.filterCriteria === 'UserCount') {
          return item.users.length.toString().includes(searchTerm);
        } else if (this.filterCriteria === 'Rating') {
          return item.rating.toString().includes(searchTerm);
        } else if (this.filterCriteria === 'Tags') {
          // Normalize search term: replace spaces with underscores to match tag format
          const normalizedSearch = searchTerm.replace(/\s+/g, '_');
          return item.tags.some(tag => tag.toLowerCase().includes(normalizedSearch));
        }
        return false;
      });
    }

    this.applyLocalSorting();
  }

  applyLocalSorting(): void {
    this.filteredItemsList.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      // Get values based on sort column
      switch (this.sortColumn) {
        case 'totalPrice':
          valueA = a.price * a.amount;
          valueB = b.price * b.amount;
          break;
        case 'userCount':
          valueA = a.users?.length || 0;
          valueB = b.users?.length || 0;
          break;
        case 'rating':
          valueA = a.rating;
          valueB = b.rating;
          break;
        case 'name':
          valueA = a.name;
          valueB = b.name;
          break;
        case 'price':
          valueA = a.price;
          valueB = b.price;
          break;
        case 'amount':
          valueA = a.amount;
          valueB = b.amount;
          break;
      }

      // Handle string comparison for name
      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) return this.sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    this.updatePagination();
  }

  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredItemsList.length / this.itemsPerPage);

    // If we have a highlighted item, switch to the page where it's located
    if (this.highlightedItemId) {
      const itemIndex = this.filteredItemsList.findIndex(item => item.id === this.highlightedItemId);
      if (itemIndex !== -1) {
        const itemPage = Math.ceil((itemIndex + 1) / this.itemsPerPage);
        this.currentPage = itemPage;
      }
    }

    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    this.updatePaginatedItems();
  }

  updatePaginatedItems(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedItemsList = this.filteredItemsList.slice(startIndex, endIndex);

    // Scroll to highlighted item if present
    if (this.highlightedItemId) {
      setTimeout(() => this.scrollToHighlightedItem(), 100);
    }

    // Reinitialize tooltips after updating displayed items
    this.reinitializeTooltipsAfterDelay();
  }

  scrollToHighlightedItem(): void {
    if (!this.highlightedItemId) return;

    // Remove highlight after animation completes (1s * 1 iteration = 1s)
    setTimeout(() => {
      this.highlightedItemId = undefined;
    }, 1000);
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedItems();
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedItems();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedItems();
    }
  }

  private reinitializeTooltipsAfterDelay(): void {
    if (!this.viewInitialized || this.disableTooltipManagement) {
      return;
    }

    setTimeout(() => {
      this.destroyTooltips();
      this.initializeTooltips();
    }, 100);
  }

  // Row expansion methods
  toggleItemExpansion(id: string): void {
    if (this.expandedItemIds.has(id)) {
      this.expandedItemIds.delete(id);
    } else {
      this.expandedItemIds.add(id);
    }
  }

  isItemExpanded(id: string): boolean {
    return this.expandedItemIds.has(id);
  }

  toggleTagsExpand(id: string): void {
    if (this.expandedTagsItemIds.has(id)) {
      this.expandedTagsItemIds.delete(id);
    } else {
      this.expandedTagsItemIds.add(id);
    }
  }

  isTagsExpanded(id: string): boolean {
    return this.expandedTagsItemIds.has(id);
  }

  // Modal management methods
  openModal(type: 'add' | 'edit' | 'delete', id: string = ''): void {
    this.currentModalContent = type;
    this.modalTitle = this.translate.instant(`ITEMS.MODAL.${type.toUpperCase()}_TITLE`);

    const modalElement = document.getElementById('itemsModal-' + this.checkId);
    if (!modalElement) return;

    if (type === 'add') {
      this.clearFormData();
    } else if (id) {
      this.loadSingleItem(id);
    }

    if (!this.modalInstance) {
      this.modalInstance = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: false
      });
    }

    this.formErrors = {};
    this.formValidated = false;

    this.modalInstance.show();
  }

  hideModal(): void {
    if (this.modalInstance) {
      this.modalInstance.hide();
      this.formErrors = {};
      this.formValidated = false;
      this.clearFormData();
    }
  }

  clearFormData(): void {
    this.id = '';
    this.name = '';
    this.comment = '';
    this.price = 0;
    this.amount = 1;
    this.rating = 0;
    this.hoverRating = 0;
    this.tags = [];
    this.tagInput = '';
    this.selectedUsers = [];
  }

  // Rating methods
  setRating(rating: number): void {
    this.rating = rating;
  }

  // User selection methods
  onUserSelectionChange(user: string, event: any): void {
    if (event.target.checked) {
      if (!this.selectedUsers.includes(user)) {
        this.selectedUsers.push(user);
      }
    } else {
      const index = this.selectedUsers.indexOf(user);
      if (index > -1) {
        this.selectedUsers.splice(index, 1);
      }
    }
  }

  isAllUsersSelected(): boolean {
    return this.users.length > 0 && this.selectedUsers.length === this.users.length;
  }

  toggleAllUsers(event: any): void {
    if (event.target.checked) {
      // Select all users
      this.selectedUsers = [...this.users];
    } else {
      // Deselect all users
      this.selectedUsers = [];
    }
  }

  // Tag management methods
  addTag(): void {
    const trimmedTag = this.tagInput.trim().replace(/\s+/g, '_').toLowerCase();
    if (trimmedTag && !this.tags.includes(trimmedTag)) {
      this.tags.push(trimmedTag);
      this.tagInput = '';
    }
  }

  removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
    }
  }

  // CRUD operations
  validateItemForm(): boolean {
    this.formErrors = this.formValidationService.validateItemForm(
      this.name,
      this.price,
      this.amount,
      this.rating,
      this.selectedUsers
    );
    this.formValidated = true;

    return !this.formValidationService.hasErrors(this.formErrors);
  }

  createItem(): void {
    if (!this.validateItemForm()) return;
    this.formValidated = true;

    const newItem: Item = {
      id: '00000000-0000-0000-0000-000000000000',
      name: this.name,
      comment: this.comment,
      price: this.price,
      amount: this.amount,
      rating: this.rating,
      tags: this.tags,
      users: this.selectedUsers,
      checkId: this.checkId
    };

    this.itemsService.createItem(newItem).subscribe({
      next: (response: ItemResponse) => {
        this.hideModal();
        // Emit check sum update
        this.checkSumUpdated.emit({ checkId: this.checkId, newSum: response.checkTotalSum });
        // If items are provided from parent, emit event; otherwise reload
        if (this.items !== undefined) {
          this.itemsChanged.emit(this.checkId);
        } else {
          this.loadItems();
        }
        this.dayExpensesTotalSumUpdateService.emitDayExpensesTotalSumUpdate(this.dayExpensesId, response.dayExpensesTotalSum);
        this.toastService.success(
          this.translate.instant('ITEMS.TOAST.SUCCESS'),
          this.translate.instant('ITEMS.TOAST.CREATE_SUCCESS')
        );
      },
      error: error => {
        this.formErrors = parseValidationErrors(error);
        this.formValidated = true;
        if (Object.keys(this.formErrors).length === 0 || this.formErrors['general']) {
          const errorMessage = this.formErrors['general'] || error?.error?.message || error?.message || this.translate.instant('ITEMS.TOAST.CREATE_ERROR');
          this.toastService.error(
            this.translate.instant('ITEMS.TOAST.ERROR'),
            this.translateBackendError(errorMessage)
          );
        }
      }
    });
  }

  editItem(): void {
    if (!this.validateItemForm()) return;
    this.formValidated = true;

    const updatedItem: Item = {
      id: this.id,
      name: this.name,
      comment: this.comment,
      price: this.price,
      amount: this.amount,
      rating: this.rating,
      tags: this.tags,
      users: this.selectedUsers,
      checkId: this.checkId
    };

    this.itemsService.editItem(updatedItem).subscribe({
      next: (response: ItemResponse) => {
        this.hideModal();
        // Emit check sum update
        this.checkSumUpdated.emit({ checkId: this.checkId, newSum: response.checkTotalSum });
        // If items are provided from parent, emit event; otherwise reload
        if (this.items !== undefined) {
          this.itemsChanged.emit(this.checkId);
        } else {
          this.loadItems();
        }
        this.dayExpensesTotalSumUpdateService.emitDayExpensesTotalSumUpdate(this.dayExpensesId, response.dayExpensesTotalSum);
        this.toastService.success(
          this.translate.instant('ITEMS.TOAST.SUCCESS'),
          this.translate.instant('ITEMS.TOAST.EDIT_SUCCESS')
        );
      },
      error: error => {
        this.formErrors = parseValidationErrors(error);
        this.formValidated = true;
        if (Object.keys(this.formErrors).length === 0 || this.formErrors['general']) {
          const errorMessage = this.formErrors['general'] || error?.error?.message || error?.message || this.translate.instant('ITEMS.TOAST.EDIT_ERROR');
          this.toastService.error(
            this.translate.instant('ITEMS.TOAST.ERROR'),
            this.translateBackendError(errorMessage)
          );
        }
      }
    });
  }

  deleteItem(): void {
    this.itemsService.deleteItem(this.id).subscribe({
      next: (response: DeleteItemResponse) => {
        // Remove the item from the local list
        const index = this.itemsList.findIndex(i => i.id === this.id);
        if (index !== -1) {
          this.itemsList.splice(index, 1);
          this.applyLocalFiltering();
        }

        this.hideModal();
        // Emit check sum update
        this.checkSumUpdated.emit({ checkId: this.checkId, newSum: response.checkTotalSum });
        // If items are provided from parent, emit event
        if (this.items !== undefined) {
          this.itemsChanged.emit(this.checkId);
        }
        this.dayExpensesTotalSumUpdateService.emitDayExpensesTotalSumUpdate(this.dayExpensesId, response.dayExpensesTotalSum);
        this.toastService.success(
          this.translate.instant('ITEMS.TOAST.SUCCESS'),
          this.translate.instant('ITEMS.TOAST.DELETE_SUCCESS')
        );
      },
      error: error => {
        console.log(error);
        const errorMessage = error?.error?.message || error?.message || this.translate.instant('ITEMS.TOAST.DELETE_ERROR');
        this.toastService.error(
          this.translate.instant('ITEMS.TOAST.ERROR'),
          this.translateBackendError(errorMessage)
        );
      }
    });
  }

  // Helper methods
  translateBackendError(errorMessage: string): string {
    if (!errorMessage) return '';

    const errorMap: Record<string, string> = {
      'Invalid data': 'ITEMS.BACKEND_ERRORS.INVALID_DATA',
      'Unauthorized': 'ITEMS.BACKEND_ERRORS.UNAUTHORIZED'
    };

    const translationKey = errorMap[errorMessage];
    if (translationKey) {
      return this.translate.instant(translationKey);
    }

    for (const [key, value] of Object.entries(errorMap)) {
      if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
        return this.translate.instant(value);
      }
    }

    return errorMessage;
  }

  getIconOrderClass(column: string): string {
    if (this.sortColumn !== column) {
      return 'bi bi-funnel-fill ps-1';
    }
    return this.sortOrder === 'asc' ? 'bi bi-arrow-up ps-1' : 'bi bi-arrow-down ps-1';
  }

  getTotalPrice(item: Item): number {
    return item.price * item.amount;
  }

  // Tooltips
  getUsersTooltipContent(id: string): string {
    const item = this.itemsList.find(i => i.id === id);
    const users = item?.users || [];
    return this.tooltipService.generateUsersTooltip(users, 3);
  }

  getCommentTooltipContent(id: string): string {
    const item = this.itemsList.find(i => i.id === id);
    return item?.comment || '';
  }

  // Pagination display helpers
  get paginationStartIndex(): number {
    if (this.filteredItemsList.length === 0) return 0;
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get paginationEndIndex(): number {
    if (this.filteredItemsList.length === 0) return 0;
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredItemsList.length);
  }

  setItemsPerPageByScreenSize(): void {
    // Bootstrap's md breakpoint is 768px
    if (window.innerWidth < 768) {
      this.itemsPerPage = 3;
    } else {
      this.itemsPerPage = 8;
    }
  }
}

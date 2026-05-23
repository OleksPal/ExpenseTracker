import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesService, DayExpenses } from '../../services/expenses.service';
import { ToastService } from '../../services/toast.service';
import { DateRangeService } from '../../services/date-range.service';
import { TooltipService } from '../../services/tooltip.service';
import { FormValidationService } from '../../services/form-validation.service';
import { ModalWindowComponent } from "../../shared/modal-window/modal-window.component";
import { FilterBarComponent, FilterOption } from '../../shared/filter-bar/filter-bar.component';
import { SortBarComponent, SortOption } from '../../shared/sort-bar/sort-bar.component';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink } from "@angular/router";
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ValidationErrors, parseValidationErrors } from '../../shared/models/validation-errors.model';
import { TourService, TourAnchorNgBootstrapDirective, TourStepTemplateComponent } from 'ngx-ui-tour-ng-bootstrap';

declare var bootstrap: any;

@Component({
  selector: 'app-day-expenses-list',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule, ModalWindowComponent, FilterBarComponent, SortBarComponent, TranslatePipe, TourAnchorNgBootstrapDirective, TourStepTemplateComponent],
  providers: [DatePipe],
  templateUrl: './day-expenses-list.component.html',
  styleUrl: './day-expenses-list.component.css'
})
export class DayExpensesListComponent implements OnInit, AfterViewInit, OnDestroy {
  private flatpickrInitialized = false;
  private flatpickrInstance: any;
  private modalFlatpickrInstance: any;
  private settingDatesFromApiWrapper = { value: false };
  private langChangeSub!: Subscription;
  private filterTextSubject = new Subject<string>();
  private filterTextSubscription!: Subscription;
  private hasLoadedOnce = false;

  ngAfterViewInit() {
    this.tryInitializeFlatpickr();
    this.tooltipService.initialize();
  }

  ngOnDestroy(): void {
    this.dateRangeService.destroy(this.flatpickrInstance);
    this.destroyModalFlatpickr();
    if (this.langChangeSub) {
      this.langChangeSub.unsubscribe();
    }
    if (this.filterTextSubscription) {
      this.filterTextSubscription.unsubscribe();
    }
  }

  firstDateRangeChange: boolean = true;

  // Flatpickr
  tryInitializeFlatpickr() {
    if (this.flatpickrInitialized) return;

    this.flatpickrInstance = this.dateRangeService.initializeDateRangePicker(
      'dateRangeInput',
      {
        calendarButtonId: 'calendarButton',
        onChange: (dates: Date[]) => {
          this.fromDate = this.dateRangeService.formatDate(dates[0]);
          this.toDate = this.dateRangeService.formatDate(dates[1]);

          // Destroy and reinitialize to ensure clean state with new dates
          this.dateRangeService.destroy(this.flatpickrInstance);
          this.flatpickrInstance = null;
          this.flatpickrInitialized = false;

          this.loadExpenses();
        }
      },
      this.settingDatesFromApiWrapper
    );

    if (this.flatpickrInstance) {
      this.flatpickrInitialized = true;
    }
  }

  setFlatpickrDates(fromDate: string, toDate: string): void {
    this.dateRangeService.setFlatpickrDates(
      this.flatpickrInstance,
      fromDate,
      toDate,
      this.settingDatesFromApiWrapper
    );
  }

  initModalFlatpickr(readonly: boolean = false) {
    this.destroyModalFlatpickr();

    this.modalFlatpickrInstance = this.dateRangeService.initializeSingleDatePicker(
      'modalDateInput',
      {
        defaultDate: this.date || undefined,
        readonly: readonly,
        onChange: (dates: Date[]) => {
          this.date = this.dateRangeService.formatDate(dates[0]);
        }
      }
    );
  }

  destroyModalFlatpickr() {
    this.dateRangeService.destroy(this.modalFlatpickrInstance);
    this.modalFlatpickrInstance = null;
  }

  clearDateRange(): void {
    if (this.flatpickrInstance) {
      // Destroy and reinitialize to ensure clean state
      this.dateRangeService.destroy(this.flatpickrInstance);
      this.flatpickrInstance = null;
      this.flatpickrInitialized = false;

      // Reset date variables and reload
      this.fromDate = '';
      this.toDate = '';
      this.currentPage = 1;
      this.loadExpenses('', '');
    }
  }

  parseDateOnly(date: any): string {
    // Handle null or undefined
    if (date === null || date === undefined) {
      return '';
    }
    if (typeof date === 'string') {
      return date; // Already a string
    }
    // If it's an object with year, month, day properties
    if (date.year && date.month && date.day) {
      const month = String(date.month).padStart(2, '0');
      const day = String(date.day).padStart(2, '0');
      return `${date.year}-${month}-${day}`;
    }
    return date.toString();
  }

  formatFlatPickrDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  currentLocale: string = 'en';

  fromDate: string = '';
  toDate: string = '';

  expensesList: DayExpenses[] = [];

  totalPages: number = 0;
  currentPage: number = 1;
  pageSize: number = 10;

  // Expenses data
  id = '';
  date = '';
  location = '';
  participants = '';
  totalSum = 0;

  // Add new user with access
  newUserWithAccess = '';
  shareIsSuccess = false;
  shareError = '';

  // Form validation errors
  formErrors: ValidationErrors = {};
  formValidated = false;

  // Searching
  filterText = '';

  // Sorting
  sortColumn: 'date' | 'location' | 'participants' | 'totalSum' = 'date';
  sortOrder: 'asc' | 'desc' = 'desc';
  sortOptions: SortOption[] = [
    { value: 'date', labelKey: 'EXPENSES.DATE' },
    { value: 'location', labelKey: 'EXPENSES.LOCATION' },
    { value: 'participants', labelKey: 'EXPENSES.PARTICIPANTS' },
    { value: 'totalSum', labelKey: 'EXPENSES.TOTAL_SUM' }
  ];

  constructor(
    private expensesService: ExpensesService,
    private router: Router,
    private datePipe: DatePipe,
    private translate: TranslateService,
    private toastService: ToastService,
    private dateRangeService: DateRangeService,
    private tooltipService: TooltipService,
    private formValidationService: FormValidationService,
    public tourService: TourService
  ) {}

  ngOnInit(): void {
    // Initialize locale
    this.currentLocale = this.dateRangeService.langToLocale(this.translate.getCurrentLang());

    // Setup language change subscription
    this.langChangeSub = this.translate.onLangChange.subscribe((event) => {
      this.currentLocale = this.dateRangeService.langToLocale(event.lang);
      this.tooltipService.destroy();
      setTimeout(() => this.tooltipService.initialize(), 0);

      if (this.flatpickrInstance) {
        this.dateRangeService.updateLocale(this.flatpickrInstance, event.lang, true);
        if (this.fromDate && this.toDate) {
          this.setFlatpickrDates(this.fromDate, this.toDate);
        }
      }

      if (this.modalFlatpickrInstance) {
        this.dateRangeService.updateLocale(this.modalFlatpickrInstance, event.lang, false);
      }

      // Re-initialize tour with new language
      this.initializeTour();
    });

    // Setup debounced filter
    this.filterTextSubscription = this.filterTextSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadExpenses();
    });

    this.loadExpenses();
  }

  loadExpenses(fromDate = this.fromDate, toDate = this.toDate) {
    this.isLoading = true;

    this.expensesService.getAllDayExpenses(this.sortColumn, this.sortOrder,
      this.filterText, this.filterCriteria,
      fromDate, toDate,
      this.currentPage, this.pageSize).subscribe({
      next: (data) => {
        this.expensesList = data.items;
        this.totalPages = data.totalPages;

        this.fromDate = this.parseDateOnly(data.fromDate);
        this.toDate = this.parseDateOnly(data.toDate);

        // Initialize flatpickr on first load or after clear
        if (!this.flatpickrInitialized) {
          setTimeout(() => {
            this.tryInitializeFlatpickr();

            // Set the dates in flatpickr after initialization
            if (this.fromDate && this.toDate) {
              this.setFlatpickrDates(this.fromDate, this.toDate);
            }
          }, 100);
        }

        // Re-initialize tooltips after data loads
        setTimeout(() => this.tooltipService.initialize(), 100);

        // Initialize tour after data is loaded so it can properly check if table/pagination steps should be included
        this.initializeTour();

        this.isLoading = false;
        this.hasLoadedOnce = true;
      },
      error: (err) => {
        console.error('Error day expenses list:', err);
        this.isLoading = false;
      }
    })
  }

  modalInstance: any;
  currentModalContent: 'add' | 'edit' | 'delete' | 'share' = 'add';
  modalTitle: string = '';

  openModal(type: 'add' | 'edit' | 'delete' | 'share', id: string) {
    // End tour if it's running
    if (this.tourService.getStatus() !== 0) {
      this.tourService.end();
      // Scroll to top after ending tour to ensure modal is visible
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    }

    this.currentModalContent = type;
    this.modalTitle = this.translate.instant(`EXPENSES.MODAL.${type.toUpperCase()}_TITLE`);

    const modalElement = document.getElementById('staticBackdrop');
    if (!modalElement) return;

    // Clear form fields for 'add' modal, populate from list for others
    if (type === 'add') {
      this.clearFormData();
    } else if (id !== undefined) {
      const expense = this.expensesList.find(e => e.id === id);
      if (expense) {
        this.id = expense.id;
        this.date = (new Date(expense.date)).toISOString().substring(0, 10);
        this.location = expense.location;
        this.participants = expense.participants.join(', ');
        this.totalSum = expense.totalSum;
      }
    }

    if (!this.modalInstance) {
      this.modalInstance = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: false
      });
    }

    this.formErrors = {};
    this.shareError = '';
    this.formValidated = false;

    this.modalInstance.show();

    const readonly = type === 'delete' || type === 'share';
    setTimeout(() => this.initModalFlatpickr(readonly), 0);
  }

  private clearFormData(): void {
    this.date = '';
    this.location = '';
    this.participants = '';
    this.totalSum = 0;
    this.newUserWithAccess = '';
    this.formErrors = {};
    this.formValidated = false;
    this.shareError = '';
  }

  hideModal() {
    if (this.modalInstance) {
      this.destroyModalFlatpickr();
      this.modalInstance.hide();
      this.clearFormData();
    }
  }  

  // Filtering
  filterCriteria: string = 'Location';
  isLoading = false;
  filterOptions: FilterOption[] = [
    { value: 'Location', labelKey: 'EXPENSES.FILTER.LOCATION' },
    { value: 'Participants', labelKey: 'EXPENSES.FILTER.PARTICIPANTS' }
  ];

  get filterCriteriaKey(): string {
    const keyMap: Record<string, string> = {
      'Location': 'EXPENSES.FILTER.LOCATION',
      'Participants': 'EXPENSES.FILTER.PARTICIPANTS'
    };
    return keyMap[this.filterCriteria] || 'EXPENSES.FILTER.LOCATION';
  }

  onFilterChange(text: string): void {
    this.filterText = text;
    this.filterTextSubject.next(this.filterText);
  }

  changeFilterCriteria(criteria: string): void {
    this.filterCriteria = criteria;
    this.loadExpenses();
  }

  formatDate(date: string | Date): string {
    return this.datePipe.transform(date, 'MMM dd, yyyy') ?? '';
  }

  // Sorting
  sortExpenses(column: 'date' | 'location' | 'participants' | 'totalSum') {
    if (this.sortColumn === column) {
      // Toggle direction if the same column is clicked again
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortOrder = 'asc';
    }

    this.currentPage = 1;

    this.loadExpenses();
  }

  onSortChange(event: { column: string; order: 'asc' | 'desc' }): void {
    this.sortColumn = event.column as 'date' | 'location' | 'participants' | 'totalSum';
    this.sortOrder = event.order;
    this.currentPage = 1;
    this.loadExpenses();
  }

  getIconOrderClass(column: 'date' | 'location' | 'participants' | 'totalSum') {
    if (this.sortColumn !== column)
      return 'ps-1 bi bi-funnel-fill'
    else
      return this.sortOrder == 'asc' ? 'ps-1 bi-arrow-up' : 'ps-1 bi-arrow-down'
  }

  // Tooltips
  getTooltipContent(id: string) {
    const participants = this.expensesList.find(d => d.id === id)?.participants || [];
    return this.tooltipService.generateParticipantsTooltip(participants);
  }

  translateBackendError(errorMessage: string): string {
    if (!errorMessage) return '';

    // Map common backend error messages to translation keys
    const errorMap: Record<string, string> = {
      'User not found': 'EXPENSES.BACKEND_ERRORS.USER_NOT_FOUND',
      'Invalid data': 'EXPENSES.BACKEND_ERRORS.INVALID_DATA',
      'Unauthorized': 'EXPENSES.BACKEND_ERRORS.UNAUTHORIZED',
      'Already shared': 'EXPENSES.BACKEND_ERRORS.ALREADY_SHARED',
      'already has access': 'EXPENSES.BACKEND_ERRORS.ALREADY_HAS_ACCESS'
    };

    // Check if we have a translation for this error
    const translationKey = errorMap[errorMessage];
    if (translationKey) {
      return this.translate.instant(translationKey);
    }

    // If no exact match, check for partial matches
    for (const [key, value] of Object.entries(errorMap)) {
      if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
        return this.translate.instant(value);
      }
    }

    // Return original message if no translation found
    return errorMessage;
  }

  // Pagination
  getPageNumbers(): number[] {
    const maxVisible = 5;
    const pages: number[] = [];
    
    if (this.totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show smart range around current page
      let start = Math.max(1, this.currentPage - 2);
      let end = Math.min(this.totalPages, this.currentPage + 2);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  }

  changePageSize(size: number): void {
    if (size !== this.pageSize)
    {
      this.currentPage = 1;
      this.pageSize = size;
      this.loadExpenses();
    }    
  }

  goToPage(pageNumber: number = 1){
    this.currentPage = pageNumber;
    this.loadExpenses();
  }

  // Data modification
  private setDateInputValidation(state: 'valid' | 'invalid' | 'none') {
    const altInput = this.modalFlatpickrInstance?.altInput;
    if (!altInput) return;

    altInput.classList.toggle('is-valid', state === 'valid');
    altInput.classList.toggle('is-invalid', state === 'invalid');
  }

  private validateDayExpensesForm(): boolean {
    this.formErrors = this.formValidationService.validateDayExpensesForm(this.date, this.participants);
    this.formValidated = true;

    // Update date input validation styling
    if (!this.date) {
      this.setDateInputValidation('invalid');
    } else {
      this.setDateInputValidation('valid');
    }

    return !this.formValidationService.hasErrors(this.formErrors);
  }

  createDayExpenses() {
    if (!this.validateDayExpensesForm()) return;
    this.formValidated = true;

    let participantsList = this.participants.split(',').map(p => p.trim())

    this.expensesService.createDayExpenses(this.date, this.location, participantsList).subscribe({
      next: (createdDay) => {
        this.hideModal();
        this.toastService.success(
          this.translate.instant('EXPENSES.TOAST.SUCCESS'),
          this.translate.instant('EXPENSES.TOAST.CREATE_SUCCESS'));
        this.router.navigate(['day-expenses-details', createdDay.id]);
      },
      error: error => {
        this.formErrors = parseValidationErrors(error);
        this.formValidated = true;
        if (Object.keys(this.formErrors).length === 0 || this.formErrors['general']) {
          const errorMessage = this.formErrors['general'] || error?.error?.message || error?.message || this.translate.instant('EXPENSES.TOAST.CREATE_ERROR');
          this.toastService.error(
            this.translate.instant('EXPENSES.TOAST.ERROR'),
            this.translateBackendError(errorMessage));
        }
      }
    })
  }

  editDayExpenses() {
    if (!this.validateDayExpensesForm()) return;
    this.formValidated = true;

    let participantsList = this.participants.split(',').map(p => p.trim())

    this.expensesService.editDayExpenses(this.id, this.date, this.location, participantsList).subscribe({
      next: (updatedDay) => {
        // Update the item in the local list
        const index = this.expensesList.findIndex(e => e.id === this.id);
        if (index !== -1) {
          this.expensesList[index] = updatedDay;
        }

        this.hideModal();
        this.toastService.success(
          this.translate.instant('EXPENSES.TOAST.SUCCESS'),
          this.translate.instant('EXPENSES.TOAST.EDIT_SUCCESS'));

        // Re-initialize tooltips after data updates
        setTimeout(() => this.tooltipService.initialize(), 0);
      },
      error: error => {
        this.formErrors = parseValidationErrors(error);
        this.formValidated = true;
        if (Object.keys(this.formErrors).length === 0 || this.formErrors['general']) {
          const errorMessage = this.formErrors['general'] || error?.error?.message || error?.message || this.translate.instant('EXPENSES.TOAST.EDIT_ERROR');
          this.toastService.error(
            this.translate.instant('EXPENSES.TOAST.ERROR'),
            this.translateBackendError(errorMessage));
        }
      }
    })
  }

  deleteDayExpenses() {
    this.expensesService.deleteDayExpenses(this.id).subscribe({
      next: () => {
        // Remove the item from the local list
        const index = this.expensesList.findIndex(e => e.id === this.id);
        if (index !== -1) {
          this.expensesList.splice(index, 1);
        }

        // If the current page is now empty and we're not on page 1, go to previous page
        if (this.expensesList.length === 0 && this.currentPage > 1) {
          this.currentPage--;
          this.loadExpenses();
        } else if (this.expensesList.length === 0) {
          // If we're on page 1 and it's empty, clear filters to show "no data" view
          this.filterText = '';
          this.fromDate = '';
          this.toDate = '';
          this.currentPage = 1;
          this.totalPages = 0;
        }

        this.hideModal();
        this.toastService.success(
          this.translate.instant('EXPENSES.TOAST.SUCCESS'),
          this.translate.instant('EXPENSES.TOAST.DELETE_SUCCESS'));
      },
      error: error =>
        {
          console.log(error);
          const errorMessage = error?.error?.message || error?.message || this.translate.instant('EXPENSES.TOAST.DELETE_ERROR');
          this.toastService.error(
            this.translate.instant('EXPENSES.TOAST.ERROR'),
            this.translateBackendError(errorMessage));
        }
    })
  }

  shareDayExpenses() {
    this.formErrors = this.formValidationService.validateShareForm(this.newUserWithAccess);
    this.shareError = '';
    this.formValidated = true;

    if (this.formValidationService.hasErrors(this.formErrors)) {
      return;
    }

    this.expensesService.shareDayExpenses(this.id, this.newUserWithAccess).subscribe({
      next: (data) => {
        if (data.isSuccess) {
          this.hideModal();
          this.loadExpenses();
          this.shareIsSuccess = false;
          this.toastService.success(
            this.translate.instant('EXPENSES.TOAST.SUCCESS'),
            this.translate.instant('EXPENSES.TOAST.SHARE_SUCCESS'));
        }
        else {
          this.shareIsSuccess = data.isSuccess;
          this.shareError = this.translateBackendError(data.error);
          this.formErrors['newUserWithAccess'] = this.shareError;
        }
      },
      error: error => {
        this.formErrors = parseValidationErrors(error);
        this.formValidated = true;
        if (Object.keys(this.formErrors).length === 0 || this.formErrors['general']) {
          const errorMessage = this.formErrors['general'] || error?.error?.message || error?.message || this.translate.instant('EXPENSES.BACKEND_ERRORS.UNKNOWN_ERROR');
          this.toastService.error(
            this.translate.instant('EXPENSES.TOAST.ERROR'),
            this.translateBackendError(errorMessage));
        }
      }
    })
  }

  openDetails(id: string) {
    // Hide all tooltips before navigating
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach((tooltip) => {
      const bsTooltip = (window as any).bootstrap?.Tooltip?.getInstance(tooltip);
      if (bsTooltip) {
        bsTooltip.hide();
      }
    });

    this.router.navigate(['/day-expenses-details', id]);
  }

  navigateToCalculations(id: string) {
    this.router.navigate(['/day-expenses', id, 'calculations']);
  }

  showNoDataMessage(): boolean {
    return this.expensesList.length === 0 && this.filterText === '' && this.fromDate === '' && !this.isLoading;
  }

  showNoSearchResults(): boolean {
    return this.expensesList.length === 0 && (this.filterText !== '' || this.fromDate !== '');
  }

  showFilterControls(): boolean {
    // Hide filter controls during initial load only, keep visible during subsequent loads
    const hideOnInitialLoad = !this.hasLoadedOnce && this.isLoading;
    return !hideOnInitialLoad && !this.showNoDataMessage();
  }

  showAddExpenseButton(): boolean {
    return !this.showNoDataMessage() && !this.isLoading;
  }

  initializeTour() {
    const tourSteps: any[] = [];
    const isSmallScreen = window.innerWidth < 576;

    // If there's no data, show only the "Add Expense" step
    if (this.expensesList.length === 0) {
      tourSteps.push({
        anchorId: 'add-expense-btn',
        content: this.translate.instant('TOUR.ADD_EXPENSE_CONTENT'),
        title: this.translate.instant('TOUR.ADD_EXPENSE_TITLE'),
        placement: 'bottom',
        enableBackdrop: true
      });
    } else {
      // Common steps for all screen sizes
      tourSteps.push(
        {
          anchorId: 'add-expense-btn',
          content: this.translate.instant('TOUR.ADD_EXPENSE_CONTENT'),
          title: this.translate.instant('TOUR.ADD_EXPENSE_TITLE'),
          placement: 'bottom',
          enableBackdrop: true
        },
        {
          anchorId: 'date-range-filter',
          content: this.translate.instant('TOUR.DATE_FILTER_CONTENT'),
          title: this.translate.instant('TOUR.DATE_FILTER_TITLE'),
          placement: 'bottom',
          enableBackdrop: true
        }
      );

      // Different steps for small vs large screens
      if (isSmallScreen) {
        // Steps for small screens (accordion view)
        tourSteps.push(
          {
            anchorId: 'sort-controls',
            content: this.translate.instant('TOUR.SORT_CONTROLS_CONTENT'),
            title: this.translate.instant('TOUR.SORT_CONTROLS_TITLE'),
            placement: 'bottom',
            enableBackdrop: true
          },
          {
            anchorId: 'expenses-accordion',
            content: this.translate.instant('TOUR.EXPENSES_ACCORDION_CONTENT'),
            title: this.translate.instant('TOUR.EXPENSES_ACCORDION_TITLE'),
            placement: 'bottom',
            enableBackdrop: true
          },
          {
            anchorId: 'pagination',
            content: this.translate.instant('TOUR.PAGINATION_CONTENT'),
            title: this.translate.instant('TOUR.PAGINATION_TITLE'),
            placement: 'top',
            enableBackdrop: true
          }
        );
      } else {
        // Steps for large screens (table view)
        tourSteps.push(
          {
            anchorId: 'search-filter',
            content: this.translate.instant('TOUR.SEARCH_FILTER_CONTENT'),
            title: this.translate.instant('TOUR.SEARCH_FILTER_TITLE'),
            placement: 'top',
            enableBackdrop: true
          },
          {
            // Highlights the table header only (tourAnchor on <thead>)
            anchorId: 'expenses-table',
            content: this.translate.instant('TOUR.EXPENSES_TABLE_CONTENT'),
            title: this.translate.instant('TOUR.EXPENSES_TABLE_TITLE'),
            placement: 'bottom',
            enableBackdrop: true
          },
          {
            // Highlights the actions menu column
            anchorId: 'actions-menu',
            content: this.translate.instant('TOUR.ACTIONS_MENU_CONTENT'),
            title: this.translate.instant('TOUR.ACTIONS_MENU_TITLE'),
            placement: 'left',
            enableBackdrop: true
          },
          {
            // Highlights pagination controls
            anchorId: 'pagination',
            content: this.translate.instant('TOUR.PAGINATION_CONTENT'),
            title: this.translate.instant('TOUR.PAGINATION_TITLE'),
            placement: 'top',
            enableBackdrop: true
          }
        );
      }
    }

    // Initialize tour with global button title configuration
    this.tourService.initialize(tourSteps, {
      prevBtnTitle: this.translate.instant('TOUR.PREV_BTN'),
      nextBtnTitle: this.translate.instant('TOUR.NEXT_BTN'),
      endBtnTitle: this.translate.instant('TOUR.END_BTN')
    });
  }

  startTour() {
    this.tourService.start();
  }
}

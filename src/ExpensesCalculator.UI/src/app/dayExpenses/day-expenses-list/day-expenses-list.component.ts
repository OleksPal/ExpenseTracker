import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesService, DayExpenses } from '../../services/expenses.service';
import { DateRangeService } from '../../services/date-range.service';
import { TooltipService } from '../../services/tooltip.service';
import { ModalService } from '../../services/modal.service';
import { FilterBarComponent, FilterOption } from '../../shared/filter-bar/filter-bar.component';
import { SortBarComponent, SortOption } from '../../shared/sort-bar/sort-bar.component';
import { Router } from '@angular/router';
import { RouterLink } from "@angular/router";
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TourService, TourAnchorNgBootstrapDirective, TourStepTemplateComponent } from 'ngx-ui-tour-ng-bootstrap';
import { DayExpensesAddFormComponent } from '../../modals/day-expenses-form/day-expenses-add-form.component';
import { DayExpensesEditFormComponent } from '../../modals/day-expenses-form/day-expenses-edit-form.component';
import { DayExpensesDeleteFormComponent } from '../../modals/day-expenses-form/day-expenses-delete-form.component';
import { DayExpensesShareFormComponent } from '../../modals/day-expenses-form/day-expenses-share-form.component';

declare var bootstrap: any;

@Component({
  selector: 'app-day-expenses-list',
  standalone: true,
  imports: [RouterLink, CommonModule, FilterBarComponent, SortBarComponent, TranslatePipe, TourAnchorNgBootstrapDirective, TourStepTemplateComponent],
  providers: [DatePipe],
  templateUrl: './day-expenses-list.component.html',
  styleUrl: './day-expenses-list.component.css'
})
export class DayExpensesListComponent implements OnInit, AfterViewInit, OnDestroy {
  private flatpickrInitialized = false;
  private flatpickrInstance: any;
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
    private dateRangeService: DateRangeService,
    private tooltipService: TooltipService,
    private modalService: ModalService,
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

  openModal(type: 'add' | 'edit' | 'delete' | 'share', id: string = '') {
    // End tour if it's running
    if (this.tourService.getStatus() !== 0) {
      this.tourService.end();
      // Scroll to top after ending tour to ensure modal is visible
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    }

    if (type === 'add') {
      this.modalService.open(
        DayExpensesAddFormComponent,
        this.translate.instant('EXPENSES.MODAL.ADD_TITLE'),
        {
          currentLocale: this.currentLocale,
          onSuccess: () => { /* No callback needed as navigation happens in component */ }
        },
        'md'
      );
      return;
    }

    const expense = this.expensesList.find(e => e.id === id);
    if (!expense) return;

    if (type === 'edit') {
      this.modalService.open(
        DayExpensesEditFormComponent,
        this.translate.instant('EXPENSES.MODAL.EDIT_TITLE'),
        {
          currentLocale: this.currentLocale,
          id: expense.id,
          date: (new Date(expense.date)).toISOString().substring(0, 10),
          location: expense.location,
          participants: expense.participants.join(', '),
          totalSum: expense.totalSum,
          onSuccess: () => this.refreshExpenses()
        },
        'md'
      );
      return;
    }

    if (type === 'delete') {
      this.modalService.open(
        DayExpensesDeleteFormComponent,
        this.translate.instant('EXPENSES.MODAL.DELETE_TITLE'),
        {
          currentLocale: this.currentLocale,
          id: expense.id,
          date: (new Date(expense.date)).toISOString().substring(0, 10),
          location: expense.location,
          participants: expense.participants.join(', '),
          totalSum: expense.totalSum,
          onSuccess: () => this.refreshExpenses()
        },
        'md'
      );
      return;
    }

    if (type === 'share') {
      this.modalService.open(
        DayExpensesShareFormComponent,
        this.translate.instant('EXPENSES.MODAL.SHARE_TITLE'),
        {
          currentLocale: this.currentLocale,
          id: expense.id,
          date: (new Date(expense.date)).toISOString().substring(0, 10),
          location: expense.location,
          participants: expense.participants.join(', '),
          totalSum: expense.totalSum,
          onSuccess: () => this.refreshExpenses()
        },
        'md'
      );
      return;
    }
  }

  refreshExpenses(): void {
    this.loadExpenses();
    this.tooltipService.destroy();
    setTimeout(() => this.tooltipService.initialize(), 100);
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

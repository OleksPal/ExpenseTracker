import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpensesService, DayExpenses } from '../../services/expenses.service';
import { Check } from '../../services/checks.service';
import { CheckListComponent } from '../../checks/check-list/check-list.component';
import { ToastService } from '../../services/toast.service';
import { TooltipService } from '../../services/tooltip.service';
import { ModalService } from '../../services/modal.service';
import { DateRangeService } from '../../services/date-range.service';
import { DayExpensesTotalSumUpdateService } from '../../services/day-expenses-total-sum-update.service';
import { Subscription } from 'rxjs';
import { TourService, TourAnchorNgBootstrapDirective, TourStepTemplateComponent } from 'ngx-ui-tour-ng-bootstrap';
import { DayExpensesEditFormComponent } from '../../modals/day-expenses-form/day-expenses-edit-form.component';
import { DayExpensesDeleteFormComponent } from '../../modals/day-expenses-form/day-expenses-delete-form.component';
import { DayExpensesShareFormComponent } from '../../modals/day-expenses-form/day-expenses-share-form.component';

declare var bootstrap: any;

@Component({
  selector: 'app-day-expenses-details',
  imports: [TranslatePipe, CommonModule, CheckListComponent, TourAnchorNgBootstrapDirective, TourStepTemplateComponent],
  standalone: true,
  templateUrl: './day-expenses-details.component.html',
  styleUrl: './day-expenses-details.component.css'
})
export class DayExpensesDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  // Private variables
  private langChangeSub!: Subscription;
  private dayExpensesTotalSumUpdateSub?: Subscription;

  // Locale
  currentLocale: string = 'en';

  // Day expenses data
  dayExpenses: DayExpenses | null = null;
  checks: Check[] = [];
  id = '';
  date = '';
  location = '';
  participants = '';
  totalSum = 0;
  scrollToCheckId?: string;
  scrollToItemId?: string;

  // Loading state
  isLoading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private expensesService: ExpensesService,
    private toastService: ToastService,
    private tooltipService: TooltipService,
    private modalService: ModalService,
    private dateRangeService: DateRangeService,
    private dayExpensesTotalSumUpdateService: DayExpensesTotalSumUpdateService,
    public tourService: TourService
  ) {}

  // Lifecycle hooks
  ngOnInit(): void {
    // Get the day expenses ID from route params
    this.id = this.route.snapshot.paramMap.get('id') || '';

    // Get checkId and itemId from query params for scrolling
    this.route.queryParams.subscribe(params => {
      this.scrollToCheckId = params['checkId'] || undefined;
      this.scrollToItemId = params['itemId'] || undefined;
    });

    // Set current locale based on translation service
    this.currentLocale = this.dateRangeService.langToLocale(this.translate.currentLang);

    // Subscribe to language changes
    this.langChangeSub = this.translate.onLangChange.subscribe((event) => {
      this.currentLocale = this.dateRangeService.langToLocale(event.lang);

      this.tooltipService.destroy();
      setTimeout(() => this.tooltipService.initialize({ html: true }), 0);

      // Re-initialize tour with new language
      this.initializeTour();
    });

    if (this.id) {
      this.loadDayExpenses();
    }

    // Subscribe to day expenses total sum updates
    this.dayExpensesTotalSumUpdateSub = this.dayExpensesTotalSumUpdateService.dayExpensesTotalSumUpdates.subscribe(
      (update) => this.onDayExpensesTotalSumUpdated(update)
    );
  }

  ngAfterViewInit() {
    this.currentLocale = this.dateRangeService.langToLocale(this.translate.currentLang);
    this.tooltipService.initialize({ html: true });
  }

  ngOnDestroy(): void {
    this.tooltipService.destroy();
    if (this.langChangeSub) {
      this.langChangeSub.unsubscribe();
    }
    if (this.dayExpensesTotalSumUpdateSub) {
      this.dayExpensesTotalSumUpdateSub.unsubscribe();
    }
  }

  // Data loading
  loadDayExpenses() {
    this.isLoading = true;
    this.expensesService.getDayExpensesDetails(this.id).subscribe({
      next: (data) => {
        // Store the full object for display
        this.dayExpenses = data;
        this.checks = data.checks;

        // Also store form-friendly versions for editing
        this.date = (new Date(data.date)).toISOString().substring(0, 10);
        this.location = data.location;
        this.participants = data.participants.join(', ');
        this.totalSum = data.totalSum;

        this.isLoading = false;

        // Re-initialize tooltips after data loads
        setTimeout(() => this.tooltipService.initialize({ html: true }), 0);
      },
      error: (err) => {
        console.error('Error loading day expenses:', err);
        this.isLoading = false;
      }
    });
  }

  // Modal management
  openModal(type: 'edit' | 'delete' | 'share', id: string = '') {
    if (id && id !== this.id) {
      this.id = id;
      this.loadDayExpenses();
      return;
    }

    if (type === 'edit') {
      this.modalService.open(
        DayExpensesEditFormComponent,
        this.translate.instant('EXPENSES.MODAL.EDIT_TITLE'),
        {
          currentLocale: this.currentLocale,
          id: this.id,
          date: this.date,
          location: this.location,
          participants: this.participants,
          totalSum: this.totalSum,
          onSuccess: () => this.refreshDayExpenses()
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
          id: this.id,
          date: this.date,
          location: this.location,
          participants: this.participants,
          totalSum: this.totalSum,
          onSuccess: () => this.router.navigate(['/day-expenses'])
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
          id: this.id,
          date: this.date,
          location: this.location,
          participants: this.participants,
          totalSum: this.totalSum,
          onSuccess: () => this.refreshDayExpenses()
        },
        'md'
      );
      return;
    }
  }

  refreshDayExpenses(): void {
    this.loadDayExpenses();
    this.tooltipService.destroy();
    setTimeout(() => this.tooltipService.initialize({ html: true }), 100);
  }

  getTooltipContent() {
    const participants = this.dayExpenses?.participants || [];
    return this.tooltipService.generateParticipantsTooltip(participants);
  }

  // Navigation
  navigateToList(): void {
    this.router.navigate(['/day-expenses']);
  }

  navigateToCalculations(): void {
    this.router.navigate(['/day-expenses', this.id, 'calculations']);
  }

  // Handle day expenses total sum updates from check-list component
  onDayExpensesTotalSumUpdated(event: { dayExpensesId: string, newSum: number }): void {
    if (this.id === event.dayExpensesId) {
      this.totalSum = event.newSum;
      // Also update the dayExpenses object if it exists
      if (this.dayExpenses) {
        this.dayExpenses.totalSum = event.newSum;
      }
    }
  }

  // Handle checks loaded event - re-initialize tour when checks data changes
  onChecksLoaded(): void {
    // Reload day expenses to get updated checks array
    this.expensesService.getDayExpensesDetails(this.id).subscribe({
      next: (data) => {
        this.checks = data.checks;
        this.totalSum = data.totalSum;

        // Update dayExpenses object if it exists
        if (this.dayExpenses) {
          this.dayExpenses.totalSum = data.totalSum;
        }

        // Re-initialize tour after checks are updated
        setTimeout(() => this.initializeTour(), 100);
      },
      error: (err) => {
        console.error('Error reloading day expenses for tour update:', err);
        // Still try to initialize tour even if reload fails
        setTimeout(() => this.initializeTour(), 100);
      }
    });
  }

  // Tour
  initializeTour() {
    // Check if checks exist by checking the checks array
    const checksExist = this.checks && this.checks.length > 0;

    const tourSteps: any[] = [];

    // Always show these basic steps
    tourSteps.push(
      {
        anchorId: 'back-btn',
        content: this.translate.instant('TOUR_DETAILS.BACK_BTN_CONTENT'),
        title: this.translate.instant('TOUR_DETAILS.BACK_BTN_TITLE'),
        placement: 'bottom',
        enableBackdrop: true
      },
      {
        anchorId: 'add-check-btn',
        content: this.translate.instant('TOUR_DETAILS.ADD_CHECK_CONTENT'),
        title: this.translate.instant('TOUR_DETAILS.ADD_CHECK_TITLE'),
        placement: 'top',
        enableBackdrop: true
      }
    );

    // Add workflow steps only if checks exist
    if (checksExist) {
      // Get the first check's ID to construct the dynamic add-item-btn anchor
      const firstCheckId = this.checks[0].id;
      const addItemBtnAnchorId = `add-item-btn-${firstCheckId}`;

      tourSteps.push(
        {
          anchorId: 'expand-check-btn',
          content: this.translate.instant('TOUR_DETAILS.EXPAND_CHECK_CONTENT'),
          title: this.translate.instant('TOUR_DETAILS.EXPAND_CHECK_TITLE'),
          placement: 'right',
          enableBackdrop: true
        },
        {
          anchorId: addItemBtnAnchorId,
          content: this.translate.instant('TOUR_DETAILS.ADD_ITEM_CONTENT'),
          title: this.translate.instant('TOUR_DETAILS.ADD_ITEM_TITLE'),
          placement: 'right',
          enableBackdrop: true
        },
        {
          anchorId: 'calculator-btn',
          content: this.translate.instant('TOUR_DETAILS.CALCULATOR_CONTENT'),
          title: this.translate.instant('TOUR_DETAILS.CALCULATOR_TITLE'),
          placement: 'left',
          enableBackdrop: true
        }
      );
    }

    // Initialize tour with global button title configuration
    this.tourService.initialize(tourSteps, {
      prevBtnTitle: this.translate.instant('TOUR.PREV_BTN'),
      nextBtnTitle: this.translate.instant('TOUR.NEXT_BTN'),
      endBtnTitle: this.translate.instant('TOUR.END_BTN')
    });
  }

  startTour() {
    // Auto-expand the first check when tour starts so the Add Item button becomes visible
    const expandButton = document.querySelector('[touranchor="expand-check-btn"]') as HTMLElement;
    if (expandButton) {
      // Find the collapse target from the button's data-bs-target attribute
      const collapseTarget = expandButton.getAttribute('data-bs-target');
      if (collapseTarget) {
        const collapseElement = document.querySelector(collapseTarget);
        if (collapseElement && !collapseElement.classList.contains('show')) {
          // Programmatically expand the first check
          expandButton.click();
        }
      }
    }

    this.tourService.start();
  }
}

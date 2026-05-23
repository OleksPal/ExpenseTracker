import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalWindowComponent } from "../../shared/modal-window/modal-window.component";
import { ValidationErrors, parseValidationErrors } from '../../shared/models/validation-errors.model';
import { ExpensesService, DayExpenses, DayExpensesDetails } from '../../services/expenses.service';
import { Check } from '../../services/checks.service';
import { CheckListComponent } from '../../checks/check-list/check-list.component';
import { ToastService } from '../../services/toast.service';
import { TooltipService } from '../../services/tooltip.service';
import { FormValidationService } from '../../services/form-validation.service';
import { DateRangeService } from '../../services/date-range.service';
import { DayExpensesTotalSumUpdateService } from '../../services/day-expenses-total-sum-update.service';
import { Subscription } from 'rxjs';
import { TourService, TourAnchorNgBootstrapDirective, TourStepTemplateComponent } from 'ngx-ui-tour-ng-bootstrap';

declare var bootstrap: any;

@Component({
  selector: 'app-day-expenses-details',
  imports: [TranslatePipe, CommonModule, FormsModule, ModalWindowComponent, CheckListComponent, TourAnchorNgBootstrapDirective, TourStepTemplateComponent],
  standalone: true,
  templateUrl: './day-expenses-details.component.html',
  styleUrl: './day-expenses-details.component.css'
})
export class DayExpensesDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  // Private variables
  private modalFlatpickrInstance: any;
  private langChangeSub!: Subscription;
  private dayExpensesTotalSumUpdateSub?: Subscription;

  // Modal properties
  modalInstance: any;
  currentModalContent: 'edit' | 'delete' | 'share' = 'edit';
  modalTitle: string = '';

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

  // Share functionality
  newUserWithAccess = '';
  shareIsSuccess = false;
  shareError = '';

  // Form validation
  formErrors: ValidationErrors = {};
  formValidated = false;

  // Loading state
  isLoading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private expensesService: ExpensesService,
    private toastService: ToastService,
    private tooltipService: TooltipService,
    private formValidationService: FormValidationService,
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

      if (this.modalFlatpickrInstance) {
        this.dateRangeService.updateLocale(this.modalFlatpickrInstance, event.lang);
      }

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
    this.dateRangeService.destroy(this.modalFlatpickrInstance);
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
    this.currentModalContent = type;
    this.modalTitle = this.translate.instant(`EXPENSES.MODAL.${type.toUpperCase()}_TITLE`);

    const modalElement = document.getElementById('staticBackdrop');
    if (!modalElement) return;

    if (id && id !== this.id) {
      // If a different ID is provided, load that day expenses
      this.id = id;
      this.loadDayExpenses();
    }

    if (!this.modalInstance) {
      this.modalInstance = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: false
      });
    }

    this.formErrors = {};
    this.formValidated = false;
    this.newUserWithAccess = '';

    this.modalInstance.show();

    // Initialize flatpickr for edit modal
    const readonly = type === 'delete' || type === 'share';
    setTimeout(() => this.initModalFlatpickr(readonly), 0);
  }

  hideModal() {
    if (this.modalInstance) {
      this.dateRangeService.destroy(this.modalFlatpickrInstance);
      this.modalInstance.hide();
      this.newUserWithAccess = '';
      this.formErrors = {};
      this.formValidated = false;
    }
  }

  // Flatpickr
  initModalFlatpickr(readonly: boolean = false) {
    this.dateRangeService.destroy(this.modalFlatpickrInstance);

    this.modalFlatpickrInstance = this.dateRangeService.initializeSingleDatePicker('modalDateInput', {
      readonly: readonly,
      defaultDate: this.date || undefined,
      onChange: (dates: Date[]) => {
        if (dates.length > 0) {
          this.date = this.dateRangeService.formatDate(dates[0]);
        }
      }
    });
  }

  // Form validation
  private setDateInputValidation(invalid: boolean, valid: boolean) {
    // Flatpickr altInput is the visible input next to the hidden #modalDateInput
    if (this.modalFlatpickrInstance?.altInput) {
      if (invalid) {
        this.modalFlatpickrInstance.altInput.classList.add('is-invalid');
        this.modalFlatpickrInstance.altInput.classList.remove('is-valid');
      } else if (valid) {
        this.modalFlatpickrInstance.altInput.classList.add('is-valid');
        this.modalFlatpickrInstance.altInput.classList.remove('is-invalid');
      } else {
        this.modalFlatpickrInstance.altInput.classList.remove('is-invalid');
        this.modalFlatpickrInstance.altInput.classList.remove('is-valid');
      }
    }
  }

  private validateDayExpensesForm(): boolean {
    this.formErrors = {};
    this.formValidated = true;
    this.setDateInputValidation(false, false);

    this.formErrors = this.formValidationService.validateDayExpensesForm(this.date, this.participants);

    if (this.formErrors['date']) {
      this.setDateInputValidation(true, false);
    } else if (this.date) {
      this.setDateInputValidation(false, true);
    }

    return !this.formValidationService.hasErrors(this.formErrors);
  }

  // Data modification
  editDayExpenses() {
    if (!this.validateDayExpensesForm()) return;
    this.formValidated = true;

    const participantsList = this.participants.split(',').map(p => p.trim());

    this.expensesService.editDayExpenses(this.id, this.date, this.location, participantsList).subscribe({
      next: (updatedDay) => {
        // Update local data with returned values
        this.dayExpenses = updatedDay;
        this.date = (new Date(updatedDay.date)).toISOString().substring(0, 10);
        this.location = updatedDay.location;
        this.participants = updatedDay.participants.join(', ');
        this.totalSum = updatedDay.totalSum;

        this.hideModal();
        this.toastService.success(
          this.translate.instant('EXPENSES.TOAST.SUCCESS'),
          this.translate.instant('EXPENSES.TOAST.EDIT_SUCCESS')
        );

        // Re-initialize tooltips after data updates
        setTimeout(() => this.tooltipService.initialize({ html: true }), 0);
      },
      error: error => {
        this.formErrors = parseValidationErrors(error);
        this.formValidated = true;
        if (Object.keys(this.formErrors).length === 0 || this.formErrors['general']) {
          const errorMessage = this.formErrors['general'] || error?.error?.message || error?.message || this.translate.instant('EXPENSES.TOAST.EDIT_ERROR');
          this.toastService.error(
            this.translate.instant('EXPENSES.TOAST.ERROR'),
            this.translateBackendError(errorMessage)
          );
        }
      }
    });
  }

  deleteDayExpenses() {
    this.expensesService.deleteDayExpenses(this.id).subscribe({
      next: () => {
        this.hideModal();
        this.router.navigate(['/day-expenses']);
      },
      error: error => {
        console.log(error);
        const errorMessage = error?.error?.message || error?.message || this.translate.instant('EXPENSES.TOAST.DELETE_ERROR');
        this.toastService.error(
          this.translate.instant('EXPENSES.TOAST.ERROR'),
          this.translateBackendError(errorMessage)
        );
      }
    });
  }

  shareDayExpenses() {
    this.formErrors = {};
    this.shareError = '';
    this.formValidated = true;

    this.formErrors = this.formValidationService.validateShareForm(this.newUserWithAccess);
    if (this.formValidationService.hasErrors(this.formErrors)) {
      return;
    }

    this.expensesService.shareDayExpenses(this.id, this.newUserWithAccess).subscribe({
      next: (data) => {
        if (data.isSuccess) {
          this.hideModal();
          this.loadDayExpenses();
          this.shareIsSuccess = false;
          this.toastService.success(
            this.translate.instant('EXPENSES.TOAST.SUCCESS'),
            this.translate.instant('EXPENSES.TOAST.SHARE_SUCCESS')
          );
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
            this.translateBackendError(errorMessage)
          );
        }
      }
    });
  }

  // Helper methods
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

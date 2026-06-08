import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../services/modal.service';
import { ExpensesService } from '../../services/expenses.service';
import { ToastService } from '../../services/toast.service';
import { FormValidationService } from '../../services/form-validation.service';
import { DateRangeService } from '../../services/date-range.service';
import { parseValidationErrors } from '../../shared/models/validation-errors.model';

@Component({
  selector: 'app-day-expenses-share-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './day-expenses-share-form.component.html'
})
export class DayExpensesShareFormComponent implements OnDestroy {
  // Injected by modal service
  modalService!: ModalService;

  // Data passed from parent component
  currentLocale: string = 'en';
  id: string = '';
  date: string = '';
  location: string = '';
  participants: string = '';
  totalSum: number = 0;

  // Share functionality
  newUserWithAccess: string = '';
  shareError: string = '';

  // Form validation
  formErrors: { [key: string]: string } = {};
  formValidated: boolean = false;

  // Flatpickr instance
  private modalFlatpickrInstance: any;

  // Callback functions passed from parent
  onSuccess?: () => void;

  constructor(
    private translate: TranslateService,
    private expensesService: ExpensesService,
    private toastService: ToastService,
    private formValidationService: FormValidationService,
    private dateRangeService: DateRangeService
  ) {
    // Initialize flatpickr after a short delay to ensure DOM is ready
    setTimeout(() => this.initModalFlatpickr(), 0);
  }

  ngOnDestroy(): void {
    this.destroyModalFlatpickr();
  }

  initModalFlatpickr() {
    this.destroyModalFlatpickr();

    this.modalFlatpickrInstance = this.dateRangeService.initializeSingleDatePicker(
      'modalDateInput',
      {
        defaultDate: this.date || undefined,
        readonly: true
      }
    );
  }

  destroyModalFlatpickr() {
    this.dateRangeService.destroy(this.modalFlatpickrInstance);
    this.modalFlatpickrInstance = null;
  }

  submit(): void {
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
          this.modalService.close();
          this.toastService.success(
            this.translate.instant('EXPENSES.TOAST.SUCCESS'),
            this.translate.instant('EXPENSES.TOAST.SHARE_SUCCESS')
          );

          // Call success callback to refresh data
          if (this.onSuccess) {
            this.onSuccess();
          }
        } else {
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

  translateBackendError(error: string): string {
    const errorKey = `BACKEND_ERRORS.${error.toUpperCase().replace(/\s+/g, '_')}`;
    const translated = this.translate.instant(errorKey);
    return translated !== errorKey ? translated : error;
  }
}

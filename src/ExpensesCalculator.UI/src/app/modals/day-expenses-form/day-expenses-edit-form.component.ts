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
  selector: 'app-day-expenses-edit-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './day-expenses-edit-form.component.html'
})
export class DayExpensesEditFormComponent implements OnDestroy {
  // Injected by modal service
  modalService!: ModalService;

  // Data passed from parent component
  currentLocale: string = 'en';
  id: string = '';
  date: string = '';
  location: string = '';
  participants: string = '';
  totalSum: number = 0;

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

  validateForm(): boolean {
    this.formErrors = {};

    this.formErrors = this.formValidationService.validateDayExpensesForm(this.date, this.participants);

    return !this.formValidationService.hasErrors(this.formErrors);
  }

  submit(): void {
    if (!this.validateForm()) {
      this.formValidated = true;
      return;
    }

    this.formValidated = true;

    const participantsList = this.participants.split(',').map(p => p.trim());

    this.expensesService.editDayExpenses(this.id, this.date, this.location, participantsList).subscribe({
      next: (updatedDay) => {
        this.modalService.close();
        this.toastService.success(
          this.translate.instant('EXPENSES.TOAST.SUCCESS'),
          this.translate.instant('EXPENSES.TOAST.EDIT_SUCCESS')
        );

        // Call success callback to refresh the list
        if (this.onSuccess) {
          this.onSuccess();
        }
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

  translateBackendError(error: string): string {
    const errorKey = `BACKEND_ERRORS.${error.toUpperCase().replace(/\s+/g, '_')}`;
    const translated = this.translate.instant(errorKey);
    return translated !== errorKey ? translated : error;
  }
}

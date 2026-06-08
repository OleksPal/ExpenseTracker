import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../services/modal.service';
import { ExpensesService } from '../../services/expenses.service';
import { ToastService } from '../../services/toast.service';
import { DateRangeService } from '../../services/date-range.service';

@Component({
  selector: 'app-day-expenses-delete-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './day-expenses-delete-form.component.html'
})
export class DayExpensesDeleteFormComponent implements OnDestroy {
  // Injected by modal service
  modalService!: ModalService;

  // Data passed from parent component
  currentLocale: string = 'en';
  id: string = '';
  date: string = '';
  location: string = '';
  participants: string = '';
  totalSum: number = 0;

  // Flatpickr instance
  private modalFlatpickrInstance: any;

  // Callback functions passed from parent
  onSuccess?: () => void;

  constructor(
    private translate: TranslateService,
    private expensesService: ExpensesService,
    private toastService: ToastService,
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
    this.expensesService.deleteDayExpenses(this.id).subscribe({
      next: () => {
        this.modalService.close();
        this.toastService.success(
          this.translate.instant('EXPENSES.TOAST.SUCCESS'),
          this.translate.instant('EXPENSES.TOAST.DELETE_SUCCESS')
        );

        // Call success callback
        if (this.onSuccess) {
          this.onSuccess();
        }
      },
      error: error => {
        const errorMessage = error?.error?.message || error?.message || this.translate.instant('EXPENSES.TOAST.DELETE_ERROR');
        this.toastService.error(
          this.translate.instant('EXPENSES.TOAST.ERROR'),
          this.translateBackendError(errorMessage)
        );
      }
    });
  }

  translateBackendError(error: string): string {
    const errorKey = `BACKEND_ERRORS.${error.toUpperCase().replace(/\s+/g, '_')}`;
    const translated = this.translate.instant(errorKey);
    return translated !== errorKey ? translated : error;
  }
}

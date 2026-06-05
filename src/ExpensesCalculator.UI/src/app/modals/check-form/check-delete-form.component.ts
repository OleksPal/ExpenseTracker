import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../services/modal.service';
import { ChecksService, DeleteCheckResponse } from '../../services/checks.service';
import { ToastService } from '../../services/toast.service';
import { DayExpensesTotalSumUpdateService } from '../../services/day-expenses-total-sum-update.service';

@Component({
  selector: 'app-check-delete-form',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './check-delete-form.component.html'
})
export class CheckDeleteFormComponent {
  // Injected by modal service
  modalService!: ModalService;

  // Data passed from parent component
  checkId: string = '';
  dayExpensesId: string = '';
  location: string = '';
  payer: string = '';
  totalSum: number = 0;

  // Callback functions passed from parent
  onSuccess?: () => void;

  private dayExpensesTotalSumUpdateService = inject(DayExpensesTotalSumUpdateService);

  constructor(
    private translate: TranslateService,
    private checksService: ChecksService,
    private toastService: ToastService
  ) {}

  submit(): void {
    this.checksService.deleteCheck(this.checkId).subscribe({
      next: (response: DeleteCheckResponse) => {
        this.modalService.close();
        this.toastService.success(
          this.translate.instant('CHECKS.TOAST.SUCCESS'),
          this.translate.instant('CHECKS.TOAST.DELETE_SUCCESS')
        );

        // Emit day expenses total sum update
        this.dayExpensesTotalSumUpdateService.emitDayExpensesTotalSumUpdate(
          this.dayExpensesId,
          response.dayExpensesTotalSum
        );

        // Call success callback to refresh the list
        if (this.onSuccess) {
          this.onSuccess();
        }
      },
      error: error => {
        const errorMessage = error?.error?.message || error?.message || this.translate.instant('CHECKS.TOAST.DELETE_ERROR');
        this.toastService.error(
          this.translate.instant('CHECKS.TOAST.ERROR'),
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

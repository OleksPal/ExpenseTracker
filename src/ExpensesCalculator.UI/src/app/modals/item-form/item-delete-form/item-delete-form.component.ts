import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../../services/modal.service';
import { ItemsService, DeleteItemResponse } from '../../../services/items.service';
import { ToastService } from '../../../services/toast.service';
import { DayExpensesTotalSumUpdateService } from '../../../services/day-expenses-total-sum-update.service';

@Component({
  selector: 'app-item-delete-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './item-delete-form.component.html'
})
export class ItemDeleteFormComponent {
  // Injected by modal service
  modalService!: ModalService;

  // Data passed from parent component
  checkId: string = '';
  dayExpensesId: string = '';
  itemId: string = '';

  // Display fields
  name: string = '';
  comment: string = '';
  price: number = 0;
  amount: number = 1;
  rating: number = 5;
  tags: string[] = [];
  selectedUsers: string[] = [];

  // Callback functions passed from parent
  onSuccess?: (checkId: string, newSum: number, dayExpensesTotalSum: number) => void;

  constructor(
    private translate: TranslateService,
    private itemsService: ItemsService,
    private toastService: ToastService,
    private dayExpensesTotalSumUpdateService: DayExpensesTotalSumUpdateService
  ) {}

  submit(): void {
    this.itemsService.deleteItem(this.itemId).subscribe({
      next: (response: DeleteItemResponse) => {
        this.modalService.close();
        this.toastService.success(
          this.translate.instant('ITEMS.TOAST.SUCCESS'),
          this.translate.instant('ITEMS.TOAST.DELETE_SUCCESS')
        );

        // Update day expenses total sum
        this.dayExpensesTotalSumUpdateService.emitDayExpensesTotalSumUpdate(
          this.dayExpensesId,
          response.dayExpensesTotalSum
        );

        // Call success callback to refresh the list and update check sum
        if (this.onSuccess) {
          this.onSuccess(this.checkId, response.checkTotalSum, response.dayExpensesTotalSum);
        }
      },
      error: error => {
        const errorMessage = error?.error?.message || error?.message || this.translate.instant('ITEMS.TOAST.DELETE_ERROR');
        this.toastService.error(
          this.translate.instant('ITEMS.TOAST.ERROR'),
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

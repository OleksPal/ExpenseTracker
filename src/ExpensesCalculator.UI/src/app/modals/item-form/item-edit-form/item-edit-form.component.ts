import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../../services/modal.service';
import { ItemsService, Item, ItemResponse } from '../../../services/items.service';
import { ToastService } from '../../../services/toast.service';
import { FormValidationService } from '../../../services/form-validation.service';
import { DayExpensesTotalSumUpdateService } from '../../../services/day-expenses-total-sum-update.service';
import { parseValidationErrors } from '../../../shared/models/validation-errors.model';

@Component({
  selector: 'app-item-edit-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './item-edit-form.component.html'
})
export class ItemEditFormComponent {
  // Injected by modal service
  modalService!: ModalService;

  // Data passed from parent component
  users: string[] = [];
  checkId: string = '';
  dayExpensesId: string = '';
  itemId: string = '';

  // Form fields
  name: string = '';
  comment: string = '';
  price: number = 0;
  amount: number = 1;
  rating: number = 5;
  hoverRating: number = 0;
  tags: string[] = [];
  tagInput: string = '';
  selectedUsers: string[] = [];

  // Form validation
  formErrors: { [key: string]: string } = {};
  formValidated: boolean = false;

  // Callback functions passed from parent
  onSuccess?: (checkId: string, newSum: number, dayExpensesTotalSum: number) => void;

  constructor(
    private translate: TranslateService,
    private itemsService: ItemsService,
    private toastService: ToastService,
    private formValidationService: FormValidationService,
    private dayExpensesTotalSumUpdateService: DayExpensesTotalSumUpdateService
  ) {}

  setRating(rating: number): void {
    this.rating = rating;
  }

  addTag(): void {
    const trimmedTag = this.tagInput.trim().replace(/\s+/g, '_').toLowerCase();
    if (trimmedTag && !this.tags.includes(trimmedTag) && this.tags.length < 5) {
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

  isAllUsersSelected(): boolean {
    return this.users.length > 0 && this.selectedUsers.length === this.users.length;
  }

  toggleAllUsers(event: any): void {
    if (event.target.checked) {
      this.selectedUsers = [...this.users];
    } else {
      this.selectedUsers = [];
    }
  }

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

  validateForm(): boolean {
    this.formErrors = this.formValidationService.validateItemForm(
      this.name,
      this.price,
      this.amount,
      this.rating,
      this.selectedUsers
    );
    return Object.keys(this.formErrors).length === 0;
  }

  submit(): void {
    if (!this.validateForm()) {
      this.formValidated = true;
      return;
    }

    this.formValidated = true;

    const updatedItem: Item = {
      id: this.itemId,
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
        this.modalService.close();
        this.toastService.success(
          this.translate.instant('ITEMS.TOAST.SUCCESS'),
          this.translate.instant('ITEMS.TOAST.EDIT_SUCCESS')
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

  translateBackendError(error: string): string {
    const errorKey = `BACKEND_ERRORS.${error.toUpperCase().replace(/\s+/g, '_')}`;
    const translated = this.translate.instant(errorKey);
    return translated !== errorKey ? translated : error;
  }
}

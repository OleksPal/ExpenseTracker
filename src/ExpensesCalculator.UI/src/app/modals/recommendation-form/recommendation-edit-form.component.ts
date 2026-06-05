import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../services/modal.service';
import { ItemsService } from '../../services/items.service';
import { ToastService } from '../../services/toast.service';
import { parseValidationErrors } from '../../shared/models/validation-errors.model';

@Component({
  selector: 'app-recommendation-edit-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './recommendation-edit-form.component.html'
})
export class RecommendationEditFormComponent {
  // Injected by modal service
  modalService!: ModalService;

  // Data passed from parent component
  id: string = '';
  name: string = '';
  comment: string = '';
  price: number = 0;
  amount: number = 1;
  rating: number = 0;
  hoverRating: number = 0;
  tags: string[] = [];
  tagInput: string = '';
  canEdit: boolean = true;

  // Form validation
  formErrors: { [key: string]: string } = {};
  formValidated: boolean = false;

  // Callback functions passed from parent
  onSuccess?: () => void;

  constructor(
    private translate: TranslateService,
    private itemsService: ItemsService,
    private toastService: ToastService
  ) {}

  validateForm(): boolean {
    this.formErrors = {};
    this.formValidated = true;

    if (!this.name.trim()) {
      this.formErrors['name'] = this.translate.instant('ITEMS.VALIDATION.NAME_REQUIRED');
    }
    if (this.price <= 0) {
      this.formErrors['price'] = this.translate.instant('ITEMS.VALIDATION.PRICE_INVALID');
    }
    if (this.amount <= 0) {
      this.formErrors['amount'] = this.translate.instant('ITEMS.VALIDATION.AMOUNT_INVALID');
    }
    if (this.rating <= 0) {
      this.formErrors['rating'] = this.translate.instant('ITEMS.VALIDATION.RATING_REQUIRED');
    }

    return Object.keys(this.formErrors).length === 0;
  }

  submit(): void {
    if (!this.validateForm()) return;
    this.formValidated = true;

    const updatedItem = {
      id: this.id,
      name: this.name,
      comment: this.comment,
      price: this.price,
      amount: this.amount,
      rating: this.rating,
      tags: this.tags
    };

    this.itemsService.editRecommendationItem(updatedItem).subscribe({
      next: () => {
        this.modalService.close();
        this.toastService.success(
          this.translate.instant('ITEMS.TOAST.SUCCESS'),
          this.translate.instant('ITEMS.TOAST.EDIT_SUCCESS')
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
          const errorMessage = this.formErrors['general'] || error?.error?.message || error?.message || this.translate.instant('ITEMS.TOAST.EDIT_ERROR');
          this.toastService.error(
            this.translate.instant('ITEMS.TOAST.ERROR'),
            errorMessage
          );
        }
      }
    });
  }

  setRating(value: number): void {
    this.rating = value;
  }

  setHoverRating(value: number): void {
    this.hoverRating = value;
  }

  addTag(): void {
    const tag = this.tagInput.trim();
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
      this.tagInput = '';
    }
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter(t => t !== tag);
  }

  getTotalPrice(): number {
    return this.price * this.amount;
  }
}

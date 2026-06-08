import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../../services/modal.service';
import { ItemsService } from '../../../services/items.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-recommendation-delete-form',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './recommendation-delete-form.component.html'
})
export class RecommendationDeleteFormComponent {
  // Injected by modal service
  modalService!: ModalService;

  // Data passed from parent component
  id: string = '';
  name: string = '';
  comment: string = '';
  price: number = 0;
  amount: number = 1;
  rating: number = 0;
  tags: string[] = [];
  canDelete: boolean = true;

  // Callback functions passed from parent
  onSuccess?: () => void;

  constructor(
    private translate: TranslateService,
    private itemsService: ItemsService,
    private toastService: ToastService
  ) {}

  submit(): void {
    this.itemsService.deleteRecommendationItem(this.id).subscribe({
      next: () => {
        this.modalService.close();
        this.toastService.success(
          this.translate.instant('ITEMS.TOAST.SUCCESS'),
          this.translate.instant('ITEMS.TOAST.DELETE_SUCCESS')
        );

        // Call success callback to refresh the list
        if (this.onSuccess) {
          this.onSuccess();
        }
      },
      error: (error: any) => {
        const errorMessage = error?.error?.message || error?.message || this.translate.instant('ITEMS.TOAST.DELETE_ERROR');
        this.toastService.error(
          this.translate.instant('ITEMS.TOAST.ERROR'),
          errorMessage
        );
      }
    });
  }

  getTotalPrice(): number {
    return this.price * this.amount;
  }
}

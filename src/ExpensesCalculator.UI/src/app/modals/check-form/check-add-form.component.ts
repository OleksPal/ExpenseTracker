import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalService } from '../../services/modal.service';
import { ChecksService } from '../../services/checks.service';
import { ToastService } from '../../services/toast.service';
import { parseValidationErrors } from '../../shared/models/validation-errors.model';

@Component({
  selector: 'app-check-add-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './check-add-form.component.html'
})
export class CheckAddFormComponent {
  // Injected by modal service
  modalService!: ModalService;

  // Data passed from parent component
  participants: string[] = [];
  dayExpensesId: string = '';

  // Form fields
  location: string = '';
  payer: string = '';

  // Form validation
  formErrors: { [key: string]: string } = {};
  formValidated: boolean = false;

  // Callback functions passed from parent
  onSuccess?: () => void;

  constructor(
    private translate: TranslateService,
    private checksService: ChecksService,
    private toastService: ToastService
  ) {}

  validateForm(): boolean {
    this.formErrors = {};

    if (!this.location.trim()) {
      this.formErrors['location'] = this.translate.instant('CHECKS.MODAL.LOCATION_REQUIRED');
    }

    if (!this.payer) {
      this.formErrors['payer'] = this.translate.instant('CHECKS.MODAL.PAYER_REQUIRED');
    }

    return Object.keys(this.formErrors).length === 0;
  }

  submit(): void {
    if (!this.validateForm()) {
      this.formValidated = true;
      return;
    }

    this.formValidated = true;

    this.checksService.createCheck(this.location, this.payer, this.dayExpensesId).subscribe({
      next: (createdCheck) => {
        this.modalService.close();
        this.toastService.success(
          this.translate.instant('CHECKS.TOAST.SUCCESS'),
          this.translate.instant('CHECKS.TOAST.CREATE_SUCCESS')
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
          const errorMessage = this.formErrors['general'] || error?.error?.message || error?.message || this.translate.instant('CHECKS.TOAST.CREATE_ERROR');
          this.toastService.error(
            this.translate.instant('CHECKS.TOAST.ERROR'),
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

import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ValidationErrors } from '../shared/models/validation-errors.model';

@Injectable({
  providedIn: 'root'
})
export class FormValidationService {
  constructor(private translate: TranslateService) {}

  /**
   * Validate day expenses form
   */
  validateDayExpensesForm(date: string, participants: string): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!date) {
      errors['date'] = this.translate.instant('EXPENSES.VALIDATION.DATE_REQUIRED');
    }

    if (!participants.trim()) {
      errors['participants'] = this.translate.instant('EXPENSES.VALIDATION.PARTICIPANTS_REQUIRED');
    }

    return errors;
  }

  /**
   * Validate share form
   */
  validateShareForm(username: string): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!username.trim()) {
      errors['newUserWithAccess'] = this.translate.instant('EXPENSES.VALIDATION.USERNAME_REQUIRED');
    }

    return errors;
  }

  /**
   * Validate check form
   */
  validateCheckForm(location: string, payer: string): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!location.trim()) {
      errors['location'] = this.translate.instant('CHECKS.VALIDATION.LOCATION_REQUIRED');
    }

    if (!payer.trim()) {
      errors['payer'] = this.translate.instant('CHECKS.VALIDATION.PAYER_REQUIRED');
    }

    return errors;
  }

  /**
   * Validate item form
   */
  validateItemForm(name: string, price: number | null, amount: number, rating: number, selectedUsers: string[]): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!name.trim()) {
      errors['name'] = this.translate.instant('ITEMS.VALIDATION.NAME_REQUIRED');
    }
    if (!price || price <= 0) {
      errors['price'] = this.translate.instant('ITEMS.VALIDATION.PRICE_INVALID');
    }
    if (amount <= 0) {
      errors['amount'] = this.translate.instant('ITEMS.VALIDATION.AMOUNT_INVALID');
    }
    if (rating <= 0) {
      errors['rating'] = this.translate.instant('ITEMS.VALIDATION.RATING_REQUIRED');
    }
    if (selectedUsers.length === 0) {
      errors['users'] = this.translate.instant('ITEMS.VALIDATION.USERS_REQUIRED');
    }

    return errors;
  }

  /**
   * Check if form has any errors
   */
  hasErrors(errors: ValidationErrors): boolean {
    return Object.keys(errors).length > 0;
  }
}

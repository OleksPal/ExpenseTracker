import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ExpensesService, DayExpensesCalculationsDto, ItemCalculation } from '../../services/expenses.service';
import { TooltipService } from '../../services/tooltip.service';
import { Subscription } from 'rxjs';
import { TourService, TourAnchorNgBootstrapDirective, TourStepTemplateComponent } from 'ngx-ui-tour-ng-bootstrap';

@Component({
  selector: 'app-day-expenses-calculations',
  standalone: true,
  imports: [CommonModule, TranslatePipe, TourAnchorNgBootstrapDirective, TourStepTemplateComponent],
  templateUrl: './day-expenses-calculations.component.html',
  styleUrl: './day-expenses-calculations.component.css'
})
export class DayExpensesCalculationsComponent implements OnInit, AfterViewInit, OnDestroy {
  // Data
  calculationsData: DayExpensesCalculationsDto | null = null;
  dayExpensesId: string = '';

  // UI state
  isLoading = false;
  activeTab: string = '';
  showFullTransactionList = false;

  // Subscription for language changes
  private langChangeSub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private expensesService: ExpensesService,
    private tooltipService: TooltipService,
    public tourService: TourService
  ) {}

  ngOnInit(): void {
    this.dayExpensesId = this.route.snapshot.paramMap.get('id') || '';
    if (this.dayExpensesId) {
      this.loadCalculations();
    }
  }

  ngAfterViewInit(): void {
    this.initializeTooltips();

    // Re-initialize tooltips and tour when language changes
    this.langChangeSub = this.translate.onLangChange.subscribe(() => {
      this.destroyTooltips();
      setTimeout(() => {
        this.initializeTooltips();
        this.initializeTour();
      }, 0);
    });
  }

  ngOnDestroy(): void {
    this.destroyTooltips();
    if (this.langChangeSub) {
      this.langChangeSub.unsubscribe();
    }
  }

  initializeTooltips(): void {
    this.tooltipService.initialize({ html: true });
  }

  destroyTooltips(): void {
    this.tooltipService.destroy();
  }

  loadCalculations(): void {
    this.isLoading = true;
    this.expensesService.getCalculations(this.dayExpensesId).subscribe({
      next: (data) => {
        this.calculationsData = data;
        // Set first participant as active tab
        if (data.participants && data.participants.length > 0) {
          this.activeTab = data.participants[0];
        }
        this.isLoading = false;
        // Re-initialize tooltips after data loads
        setTimeout(() => {
          this.initializeTooltips();
          this.initializeTour();
        }, 0);
      },
      error: (err) => {
        console.error('Error loading calculations:', err);
        this.isLoading = false;
      }
    });
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    // Re-initialize tooltips when tab changes
    setTimeout(() => this.initializeTooltips(), 0);
  }

  toggleFullTransactionList(): void {
    this.showFullTransactionList = !this.showFullTransactionList;
  }

  getCalculationForUser(userName: string) {
    return this.calculationsData?.dayExpensesCalculations.find(c => c.userName === userName);
  }

  getTotalForUser(userName: string): number {
    const userCalc = this.getCalculationForUser(userName);
    if (!userCalc) return 0;
    return userCalc.checkCalculations.reduce((total, checkCalc) => total + checkCalc.sumPerParticipant, 0);
  }

  getCheckSum(checkId: string): number {
    const check = this.calculationsData?.checks?.find(c => c.id === checkId);
    // Calculate sum from items if needed, or return 0
    return 0;
  }

  navigateBack(): void {
    this.router.navigate(['/day-expenses-details', this.dayExpensesId]);
  }

  getItemUsersTooltip(users: string[]): string {
    return this.tooltipService.generateUsersTooltip(users, 3);
  }

  getCheckTooltip(totalSum: number, payer: string): string {
    return this.tooltipService.generateCheckTooltip(totalSum, payer);
  }

  // Tour
  initializeTour(): void {
    const hasData = !!document.querySelector('[touranchor="participant-tabs"]');

    const tourSteps: any[] = [];

    // Always show back button step
    tourSteps.push({
      anchorId: 'back-to-details-btn',
      content: this.translate.instant('TOUR_CALCULATIONS.BACK_BTN_CONTENT'),
      title: this.translate.instant('TOUR_CALCULATIONS.BACK_BTN_TITLE'),
      placement: 'bottom',
      enableBackdrop: true
    });

    // Only add tab steps if there is data
    if (hasData) {
      tourSteps.push(
        {
          anchorId: 'participant-tabs',
          content: this.translate.instant('TOUR_CALCULATIONS.PARTICIPANT_TABS_CONTENT'),
          title: this.translate.instant('TOUR_CALCULATIONS.PARTICIPANT_TABS_TITLE'),
          placement: 'bottom',
          enableBackdrop: true
        },
        {
          anchorId: 'transaction-list-tab',
          content: this.translate.instant('TOUR_CALCULATIONS.TRANSACTION_TAB_CONTENT'),
          title: this.translate.instant('TOUR_CALCULATIONS.TRANSACTION_TAB_TITLE'),
          placement: 'bottom',
          enableBackdrop: true
        }
      );
    }

    // Initialize tour with global button title configuration
    this.tourService.initialize(tourSteps, {
      prevBtnTitle: this.translate.instant('TOUR.PREV_BTN'),
      nextBtnTitle: this.translate.instant('TOUR.NEXT_BTN'),
      endBtnTitle: this.translate.instant('TOUR.END_BTN')
    });
  }

  startTour(): void {
    this.tourService.start();
  }
}

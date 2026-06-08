import { Component, Input, ViewChild, ViewContainerRef, ComponentRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService, ModalConfig } from '../../services/modal.service';
import { Subscription } from 'rxjs';

declare const bootstrap: any;

@Component({
  selector: 'app-modal-window',
  imports: [CommonModule],
  templateUrl: './modal-window.component.html',
  styleUrl: './modal-window.component.css'
})
export class ModalWindowComponent implements OnInit, OnDestroy {
  @ViewChild('dynamicContent', { read: ViewContainerRef }) dynamicContent!: ViewContainerRef;

  // For backwards compatibility with old modal usage
  @Input() modalId = 'myModal';
  @Input() currentModalContent: 'add' | 'edit' | 'delete' | 'share' = 'add';
  @Input() modalTitle: string = '';
  @Input() modalSize: 'sm' | 'md' | 'lg' | 'xl' = 'md';

  private modalInstance: any = null;
  private componentRef: ComponentRef<any> | null = null;
  private subscription!: Subscription;

  constructor(private modalService: ModalService) {}

  ngOnInit(): void {
    // Set modalId to 'globalModal' for service-based usage
    if (this.modalId === 'myModal') {
      this.modalId = 'globalModal';
    }

    this.subscription = this.modalService.modal$.subscribe(
      (config: ModalConfig | null) => {
        if (config && config.show) {
          this.openModal(config);
        } else if (config && !config.show) {
          this.closeModal();
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.componentRef) {
      this.componentRef.destroy();
    }
    if (this.modalInstance) {
      this.modalInstance.dispose();
    }
  }

  private openModal(config: ModalConfig): void {
    // Set modal properties
    this.modalTitle = config.title;
    this.modalSize = config.size || 'md';

    // Clear previous content
    if (this.componentRef) {
      this.componentRef.destroy();
    }
    this.dynamicContent.clear();

    // Create the component dynamically
    this.componentRef = this.dynamicContent.createComponent(config.component);

    // Pass data to the component if provided
    if (config.data) {
      Object.assign(this.componentRef.instance, config.data);
    }

    // Set the modal service as a property on the component instance
    // so components can call modalService.close()
    this.componentRef.instance.modalService = this.modalService;

    // Notify the service about the component ref
    this.modalService.setComponentRef(this.componentRef);

    // Show the Bootstrap modal
    const modalElement = document.getElementById(this.modalId);
    if (modalElement) {
      this.modalInstance = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: false
      });
      this.modalService.setModalInstance(this.modalInstance);
      this.modalInstance.show();
    }
  }

  private closeModal(): void {
    if (this.modalInstance) {
      this.modalInstance.hide();
    }
  }

  hideModal(): void {
    this.modalService.close();
  }
}

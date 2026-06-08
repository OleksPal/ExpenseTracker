import { Injectable, Type, ComponentRef } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ModalConfig {
  component: Type<any>;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  data?: any;
  show: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalSubject = new BehaviorSubject<ModalConfig | null>(null);
  public modal$: Observable<ModalConfig | null> = this.modalSubject.asObservable();

  private modalInstance: any = null;
  private componentRef: ComponentRef<any> | null = null;

  /**
   * Open a modal with a dynamic component
   * @param component - The component class to load
   * @param title - Modal title
   * @param data - Data to pass to the component
   * @param size - Modal size
   */
  open(component: Type<any>, title: string, data?: any, size: 'sm' | 'md' | 'lg' | 'xl' = 'md'): void {
    const config: ModalConfig = {
      component,
      title,
      size,
      data,
      show: true
    };

    this.modalSubject.next(config);
  }

  /**
   * Close the modal
   */
  close(): void {
    if (this.modalInstance) {
      this.modalInstance.hide();
      this.modalInstance = null;
    }

    const currentModal = this.modalSubject.value;
    if (currentModal) {
      this.modalSubject.next({ ...currentModal, show: false });

      // Clear the modal after animation
      setTimeout(() => {
        this.modalSubject.next(null);
        this.componentRef = null;
      }, 300);
    }
  }

  /**
   * Set the Bootstrap modal instance (called by modal-window component)
   */
  setModalInstance(instance: any): void {
    this.modalInstance = instance;
  }

  /**
   * Set the component ref (called by modal-window component)
   */
  setComponentRef(ref: ComponentRef<any>): void {
    this.componentRef = ref;
  }

  /**
   * Get the current component ref
   */
  getComponentRef(): ComponentRef<any> | null {
    return this.componentRef;
  }

  /**
   * Check if modal is open
   */
  isOpen(): boolean {
    return this.modalSubject.value?.show ?? false;
  }

  /**
   * Get current modal config
   */
  getCurrentConfig(): ModalConfig | null {
    return this.modalSubject.value;
  }
}

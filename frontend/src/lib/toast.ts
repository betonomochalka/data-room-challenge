/**
 * Simple toast notification utility
 * Can be replaced with react-hot-toast later
 */

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

interface ToastOptions {
  duration?: number;
  id?: string;
}

class ToastManager {
  private container: HTMLElement | null = null;
  private toasts: Map<string, HTMLElement> = new Map();

  private ensureContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  private getIcon(type: ToastType): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      case 'loading':
        return '⟳';
      default:
        return '';
    }
  }

  private getColor(type: ToastType): string {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      case 'loading':
        return '#6b7280';
      default:
        return '#3b82f6';
    }
  }

  show(message: string, type: ToastType = 'info', options: ToastOptions = {}) {
    const container = this.ensureContainer();
    const id = options.id || `toast-${Date.now()}`;
    const duration = options.duration ?? (type === 'loading' ? 0 : 3000);

    // Remove existing toast with same ID
    if (this.toasts.has(id)) {
      this.remove(id);
    }

    const toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = `
      background: white;
      color: #1f2937;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 300px;
      max-width: 500px;
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      border-left: 4px solid ${this.getColor(type)};
    `;

    const icon = document.createElement('span');
    icon.style.cssText = `
      font-size: 20px;
      color: ${this.getColor(type)};
      font-weight: bold;
      ${type === 'loading' ? 'animation: spin 1s linear infinite;' : ''}
    `;
    icon.textContent = this.getIcon(type);

    const text = document.createElement('span');
    text.style.cssText = 'flex: 1; font-size: 14px;';
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #9ca3af;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => this.remove(id);

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeBtn);

    container.appendChild(toast);
    this.toasts.set(id, toast);

    // Auto-dismiss (except loading toasts)
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }

    return id;
  }

  remove(id: string) {
    const toast = this.toasts.get(id);
    if (toast) {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        toast.remove();
        this.toasts.delete(id);
        
        // Remove container if no toasts
        if (this.toasts.size === 0 && this.container) {
          this.container.remove();
          this.container = null;
        }
      }, 300);
    }
  }

  success(message: string, options?: ToastOptions) {
    return this.show(message, 'success', options);
  }

  error(message: string, options?: ToastOptions) {
    return this.show(message, 'error', options);
  }

  info(message: string, options?: ToastOptions) {
    return this.show(message, 'info', options);
  }

  warning(message: string, options?: ToastOptions) {
    return this.show(message, 'warning', options);
  }

  loading(message: string, options?: ToastOptions) {
    return this.show(message, 'loading', options);
  }

  dismiss(id: string) {
    this.remove(id);
  }

  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ): Promise<T> {
    const id = this.loading(messages.loading);

    return promise
      .then((result) => {
        this.dismiss(id);
        this.success(messages.success);
        return result;
      })
      .catch((error) => {
        this.dismiss(id);
        this.error(messages.error);
        throw error;
      });
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;
document.head.appendChild(style);

// Export singleton instance
export const toast = new ToastManager();


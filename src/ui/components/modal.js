/**
 * Modal Component
 * Reusable modal dialog system
 */

export class Modal {
  constructor(options = {}) {
    this.options = {
      title: options.title || '',
      content: options.content || '',
      size: options.size || 'medium', // small, medium, large, fullscreen
      closeOnEscape: options.closeOnEscape !== false,
      closeOnOverlay: options.closeOnOverlay !== false,
      showClose: options.showClose !== false,
      actions: options.actions || [],
      onOpen: options.onOpen || null,
      onClose: options.onClose || null,
      className: options.className || ''
    };
    
    this.element = null;
    this.overlay = null;
    this.isOpen = false;
  }
  
  /**
   * Open modal
   */
  open() {
    if (this.isOpen) return;
    
    this.create();
    this.setupEventListeners();
    
    document.body.appendChild(this.overlay);
    document.body.style.overflow = 'hidden';
    
    // Animate in
    requestAnimationFrame(() => {
      this.overlay.classList.add('modal-open');
      this.element.classList.add('modal-enter');
    });
    
    this.isOpen = true;
    
    if (this.options.onOpen) {
      this.options.onOpen(this);
    }
  }
  
  /**
   * Close modal
   */
  close() {
    if (!this.isOpen) return;
    
    this.overlay.classList.remove('modal-open');
    this.element.classList.remove('modal-enter');
    this.element.classList.add('modal-exit');
    
    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.remove();
      }
      document.body.style.overflow = '';
      this.isOpen = false;
      
      if (this.options.onClose) {
        this.options.onClose(this);
      }
    }, 300);
  }
  
  /**
   * Create modal elements
   */
  create() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    
    // Create modal
    this.element = document.createElement('div');
    this.element.className = `modal modal-${this.options.size} ${this.options.className}`;
    
    // Build content
    this.element.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">${this.options.title}</h2>
        ${this.options.showClose ? `
          <button class="modal-close" aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        ` : ''}
      </div>
      
      <div class="modal-body">
        ${typeof this.options.content === 'string' ? this.options.content : ''}
      </div>
      
      ${this.options.actions.length > 0 ? `
        <div class="modal-footer">
          ${this.options.actions.map((action, index) => `
            <button class="modal-action ${action.className || ''}" data-index="${index}">
              ${action.text}
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;
    
    // If content is an element, append it
    if (this.options.content instanceof HTMLElement) {
      const body = this.element.querySelector('.modal-body');
      body.innerHTML = '';
      body.appendChild(this.options.content);
    }
    
    this.overlay.appendChild(this.element);
    
    this.injectStyles();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Close button
    if (this.options.showClose) {
      const closeBtn = this.element.querySelector('.modal-close');
      closeBtn.addEventListener('click', () => this.close());
    }
    
    // Overlay click
    if (this.options.closeOnOverlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
    }
    
    // Escape key
    if (this.options.closeOnEscape) {
      this.escapeHandler = (e) => {
        if (e.key === 'Escape') {
          this.close();
        }
      };
      document.addEventListener('keydown', this.escapeHandler);
    }
    
    // Action buttons
    this.options.actions.forEach((action, index) => {
      const btn = this.element.querySelector(`[data-index="${index}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (action.handler) {
            action.handler(this);
          }
          if (action.closeOnClick !== false) {
            this.close();
          }
        });
      }
    });
  }
  
  /**
   * Update modal content
   */
  updateContent(content) {
    const body = this.element.querySelector('.modal-body');
    
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.innerHTML = '';
      body.appendChild(content);
    }
  }
  
  /**
   * Update modal title
   */
  updateTitle(title) {
    const titleEl = this.element.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }
  
  /**
   * Inject styles
   */
  injectStyles() {
    if (document.getElementById('modal-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'modal-styles';
    style.textContent = `
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        transition: background 0.3s;
      }
      
      .modal-overlay.modal-open {
        background: rgba(0, 0, 0, 0.5);
      }
      
      .modal {
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-height: calc(100vh - 40px);
        display: flex;
        flex-direction: column;
        opacity: 0;
        transform: scale(0.9) translateY(20px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .modal.modal-enter {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      
      .modal.modal-exit {
        opacity: 0;
        transform: scale(0.9) translateY(20px);
      }
      
      .modal-small {
        width: 100%;
        max-width: 400px;
      }
      
      .modal-medium {
        width: 100%;
        max-width: 600px;
      }
      
      .modal-large {
        width: 100%;
        max-width: 900px;
      }
      
      .modal-fullscreen {
        width: calc(100vw - 40px);
        height: calc(100vh - 40px);
        max-width: none;
        max-height: none;
      }
      
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .modal-title {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #1f2937;
      }
      
      .modal-close {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        border-radius: 8px;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .modal-close:hover {
        background: #f3f4f6;
        color: #374151;
      }
      
      .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }
      
      .modal-body::-webkit-scrollbar {
        width: 8px;
      }
      
      .modal-body::-webkit-scrollbar-track {
        background: #f3f4f6;
      }
      
      .modal-body::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 4px;
      }
      
      .modal-body::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }
      
      .modal-footer {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        padding: 24px;
        border-top: 1px solid #e5e7eb;
      }
      
      .modal-action {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .modal-action.primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .modal-action.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      
      .modal-action.secondary {
        background: #f3f4f6;
        color: #374151;
      }
      
      .modal-action.secondary:hover {
        background: #e5e7eb;
      }
      
      .modal-action.danger {
        background: #fee2e2;
        color: #991b1b;
      }
      
      .modal-action.danger:hover {
        background: #fecaca;
      }
      
      @media (max-width: 768px) {
        .modal {
          width: 100%;
          max-width: none;
          margin: 0;
          border-radius: 16px 16px 0 0;
          align-self: flex-end;
        }
        
        .modal-fullscreen {
          border-radius: 0;
          height: 100vh;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Cleanup
   */
  destroy() {
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }
    
    this.close();
  }
  
  /**
   * Static method to create and open modal
   */
  static show(options) {
    const modal = new Modal(options);
    modal.open();
    return modal;
  }
  
  /**
   * Confirm dialog
   */
  static confirm(options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title: options.title || 'Confirm',
        content: options.message || 'Are you sure?',
        size: 'small',
        actions: [
          {
            text: options.cancelText || 'Cancel',
            className: 'secondary',
            handler: () => resolve(false)
          },
          {
            text: options.confirmText || 'Confirm',
            className: options.danger ? 'danger' : 'primary',
            handler: () => resolve(true)
          }
        ]
      });
      
      modal.open();
    });
  }
  
  /**
   * Alert dialog
   */
  static alert(options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title: options.title || 'Alert',
        content: options.message || '',
        size: 'small',
        actions: [
          {
            text: options.buttonText || 'OK',
            className: 'primary',
            handler: () => resolve(true)
          }
        ]
      });
      
      modal.open();
    });
  }
  
  /**
   * Prompt dialog
   */
  static prompt(options = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = options.placeholder || '';
      input.value = options.defaultValue || '';
      input.style.cssText = `
        width: 100%;
        padding: 10px 12px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 14px;
        transition: border-color 0.2s;
      `;
      
      input.addEventListener('focus', () => {
        input.style.borderColor = '#667eea';
      });
      
      input.addEventListener('blur', () => {
        input.style.borderColor = '#e5e7eb';
      });
      
      const modal = new Modal({
        title: options.title || 'Input',
        content: input,
        size: 'small',
        actions: [
          {
            text: 'Cancel',
            className: 'secondary',
            handler: () => resolve(null)
          },
          {
            text: 'OK',
            className: 'primary',
            handler: () => resolve(input.value)
          }
        ],
        onOpen: () => {
          setTimeout(() => input.focus(), 100);
        }
      });
      
      // Submit on Enter
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          resolve(input.value);
          modal.close();
        }
      });
      
      modal.open();
    });
  }
}


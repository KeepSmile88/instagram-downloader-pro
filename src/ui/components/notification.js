/**
 * Notification Component
 * Reusable notification system for all UI pages
 */

import { Helpers } from '../../utils/helpers.js';

export class Notification {
  static container = null;
  static notifications = new Map();
  static nextId = 1;
  
  /**
   * Initialize notification system
   */
  static init() {
    if (this.container) return;
    
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
      pointer-events: none;
    `;
    
    document.body.appendChild(this.container);
    
    // Add styles
    this.injectStyles();
  }
  
  /**
   * Show notification
   */
  static show(type, message, options = {}) {
    this.init();
    
    const id = this.nextId++;
    const {
      title = null,
      duration = 5000,
      persistent = false,
      actions = [],
      progress = null,
      icon = null
    } = options;
    
    const notification = this.create({
      id,
      type,
      title,
      message,
      duration,
      persistent,
      actions,
      progress,
      icon
    });
    
    this.notifications.set(id, notification);
    this.container.appendChild(notification.element);
    
    // Auto dismiss
    if (!persistent && duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    
    return {
      id,
      update: (updates) => this.update(id, updates),
      dismiss: () => this.dismiss(id)
    };
  }
  
  /**
   * Create notification element
   */
  static create(config) {
    const { id, type, title, message, actions, progress, icon } = config;
    
    const element = document.createElement('div');
    element.className = `notification notification-${type}`;
    element.dataset.id = id;
    element.style.pointerEvents = 'auto';
    
    // Icon
    const iconEl = icon || this.getDefaultIcon(type);
    
    element.innerHTML = `
      <div class="notification-icon">${iconEl}</div>
      <div class="notification-content">
        ${title ? `<div class="notification-title">${title}</div>` : ''}
        <div class="notification-message">${message}</div>
        ${progress !== null ? `
          <div class="notification-progress">
            <div class="notification-progress-bar" style="width: ${progress}%"></div>
          </div>
        ` : ''}
        ${actions.length > 0 ? `
          <div class="notification-actions">
            ${actions.map((action, index) => `
              <button class="notification-action" data-index="${index}">
                ${action.text}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <button class="notification-close" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 6.586l3.293-3.293a1 1 0 111.414 1.414L9.414 8l3.293 3.293a1 1 0 01-1.414 1.414L8 9.414l-3.293 3.293a1 1 0 01-1.414-1.414L6.586 8 3.293 4.707a1 1 0 011.414-1.414L8 6.586z"/>
        </svg>
      </button>
    `;
    
    // Close button handler
    const closeBtn = element.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.dismiss(id);
    });
    
    // Action button handlers
    actions.forEach((action, index) => {
      const btn = element.querySelector(`[data-index="${index}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (action.handler) {
            action.handler();
          }
          if (action.dismissOnClick !== false) {
            this.dismiss(id);
          }
        });
      }
    });
    
    // Animate in
    requestAnimationFrame(() => {
      element.classList.add('notification-enter');
    });
    
    return { element, config };
  }
  
  /**
   * Update notification
   */
  static update(id, updates) {
    const notification = this.notifications.get(id);
    if (!notification) return;
    
    const { element } = notification;
    
    // Update message
    if (updates.message) {
      const messageEl = element.querySelector('.notification-message');
      if (messageEl) {
        messageEl.textContent = updates.message;
      }
    }
    
    // Update title
    if (updates.title) {
      let titleEl = element.querySelector('.notification-title');
      if (!titleEl) {
        titleEl = document.createElement('div');
        titleEl.className = 'notification-title';
        element.querySelector('.notification-content').prepend(titleEl);
      }
      titleEl.textContent = updates.title;
    }
    
    // Update progress
    if (updates.progress !== undefined) {
      let progressBar = element.querySelector('.notification-progress-bar');
      
      if (!progressBar) {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'notification-progress';
        progressContainer.innerHTML = '<div class="notification-progress-bar"></div>';
        element.querySelector('.notification-content').appendChild(progressContainer);
        progressBar = progressContainer.querySelector('.notification-progress-bar');
      }
      
      progressBar.style.width = `${updates.progress}%`;
    }
    
    // Update type
    if (updates.type) {
      element.className = `notification notification-${updates.type} notification-enter`;
      
      const iconEl = element.querySelector('.notification-icon');
      if (iconEl) {
        iconEl.innerHTML = updates.icon || this.getDefaultIcon(updates.type);
      }
    }
  }
  
  /**
   * Dismiss notification
   */
  static dismiss(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;
    
    const { element } = notification;
    
    element.classList.remove('notification-enter');
    element.classList.add('notification-exit');
    
    setTimeout(() => {
      if (element.parentNode) {
        element.remove();
      }
      this.notifications.delete(id);
    }, 300);
  }
  
  /**
   * Dismiss all notifications
   */
  static dismissAll() {
    this.notifications.forEach((_, id) => {
      this.dismiss(id);
    });
  }
  
  /**
   * Get default icon for type
   */
  static getDefaultIcon(type) {
    const icons = {
      success: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
        </svg>
      `,
      error: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      `,
      warning: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
      `,
      info: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
      `,
      loading: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" opacity="0.25"/>
          <path d="M12 2 A10 10 0 0 1 22 12" stroke-linecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
          </path>
        </svg>
      `
    };
    
    return icons[type] || icons.info;
  }
  
  /**
   * Inject styles
   */
  static injectStyles() {
    if (document.getElementById('notification-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .notification {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        min-width: 320px;
        opacity: 0;
        transform: translateX(400px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .notification-enter {
        opacity: 1;
        transform: translateX(0);
      }
      
      .notification-exit {
        opacity: 0;
        transform: translateX(400px);
      }
      
      .notification-success {
        border-left: 4px solid #10b981;
      }
      
      .notification-success .notification-icon {
        color: #10b981;
      }
      
      .notification-error {
        border-left: 4px solid #ef4444;
      }
      
      .notification-error .notification-icon {
        color: #ef4444;
      }
      
      .notification-warning {
        border-left: 4px solid #f59e0b;
      }
      
      .notification-warning .notification-icon {
        color: #f59e0b;
      }
      
      .notification-info {
        border-left: 4px solid #3b82f6;
      }
      
      .notification-info .notification-icon {
        color: #3b82f6;
      }
      
      .notification-loading .notification-icon {
        color: #8b5cf6;
      }
      
      .notification-icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
      }
      
      .notification-content {
        flex: 1;
        min-width: 0;
      }
      
      .notification-title {
        font-weight: 600;
        font-size: 14px;
        color: #1f2937;
        margin-bottom: 4px;
      }
      
      .notification-message {
        font-size: 13px;
        color: #6b7280;
        line-height: 1.5;
        word-break: break-word;
      }
      
      .notification-progress {
        margin-top: 12px;
        height: 4px;
        background: #e5e7eb;
        border-radius: 2px;
        overflow: hidden;
      }
      
      .notification-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        transition: width 0.3s ease;
      }
      
      .notification-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      
      .notification-action {
        padding: 6px 12px;
        background: #f3f4f6;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #374151;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .notification-action:hover {
        background: #e5e7eb;
      }
      
      .notification-action:active {
        transform: scale(0.95);
      }
      
      .notification-close {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s;
      }
      
      .notification-close:hover {
        background: #f3f4f6;
        color: #6b7280;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // Convenience methods
  static success(message, options = {}) {
    return this.show('success', message, options);
  }
  
  static error(message, options = {}) {
    return this.show('error', message, options);
  }
  
  static warning(message, options = {}) {
    return this.show('warning', message, options);
  }
  
  static info(message, options = {}) {
    return this.show('info', message, options);
  }
  
  static loading(message, options = {}) {
    return this.show('loading', message, { ...options, persistent: true });
  }
}


/**
 * UI Injector
 * Injects custom UI elements into Instagram page
 */

import { Logger } from '../core/logger.js';
import { Helpers } from '../utils/helpers.js';

export class UIInjector {
  constructor() {
    this.injected = false;
    this.elements = new Map();
  }
  
  /**
   * Inject scan button into page
   */
  injectScanButton() {
    if (this.elements.has('scanButton')) {
      return this.elements.get('scanButton');
    }
    
    try {
      // Create button
      const button = document.createElement('button');
      button.id = 'igdl-scan-btn';
      button.className = 'igdl-scan-button';
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 13l-5-5 1.41-1.41L9 10.17l9.59-9.59L20 2l-11 11z"/>
        </svg>
        <span>Scan & Download All</span>
      `;
      
      // Add styles
      this.injectStyles();
      
      // Position button
      button.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 99999;
        padding: 12px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;
      
      // Hover effect
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
      });
      
      // Add to page
      document.body.appendChild(button);
      
      this.elements.set('scanButton', button);
      
      Logger.debug('Scan button injected');
      
      return button;
    } catch (error) {
      Logger.error('Failed to inject scan button', {}, error);
      return null;
    }
  }
  
  /**
   * Inject progress indicator
   */
  injectProgressIndicator() {
    if (this.elements.has('progressIndicator')) {
      return this.elements.get('progressIndicator');
    }
    
    try {
      const indicator = document.createElement('div');
      indicator.id = 'igdl-progress';
      indicator.className = 'igdl-progress-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 140px;
        right: 20px;
        z-index: 99999;
        padding: 16px 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        display: none;
        min-width: 250px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;
      
      indicator.innerHTML = `
        <div class="igdl-progress-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-weight: 600; font-size: 14px; color: #262626;">Scanning...</span>
          <button id="igdl-stop-scan" style="background: none; border: none; cursor: pointer; padding: 4px; color: #8e8e8e;">✕</button>
        </div>
        <div class="igdl-progress-text" style="font-size: 13px; color: #8e8e8e; margin-bottom: 8px;">
          Found <span id="igdl-found-count">0</span> items
        </div>
        <div class="igdl-progress-bar" style="width: 100%; height: 4px; background: #efefef; border-radius: 2px; overflow: hidden;">
          <div id="igdl-progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); transition: width 0.3s;"></div>
        </div>
        <div class="igdl-progress-detail" style="font-size: 11px; color: #8e8e8e; margin-top: 8px;">
          Scroll attempts: <span id="igdl-scroll-count">0</span>
        </div>
      `;
      
      document.body.appendChild(indicator);
      
      this.elements.set('progressIndicator', indicator);
      
      Logger.debug('Progress indicator injected');
      
      return indicator;
    } catch (error) {
      Logger.error('Failed to inject progress indicator', {}, error);
      return null;
    }
  }
  
  /**
   * Update progress indicator
   */
  updateProgress(data) {
    const indicator = this.elements.get('progressIndicator');
    
    if (!indicator) return;
    
    indicator.style.display = 'block';
    
    const foundCount = indicator.querySelector('#igdl-found-count');
    const scrollCount = indicator.querySelector('#igdl-scroll-count');
    const progressFill = indicator.querySelector('#igdl-progress-fill');
    
    if (foundCount) foundCount.textContent = data.found || 0;
    if (scrollCount) scrollCount.textContent = data.scrollAttempts || 0;
    
    // Animate progress bar
    if (progressFill && data.progress !== undefined) {
      progressFill.style.width = `${data.progress}%`;
    }
  }
  
  /**
   * Hide progress indicator
   */
  hideProgress() {
    const indicator = this.elements.get('progressIndicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }
  
  /**
   * Inject notification
   */
  showNotification(type, message, options = {}) {
    const notification = document.createElement('div');
    notification.className = `igdl-notification igdl-notification-${type}`;
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    notification.innerHTML = `
      <div class="igdl-notification-icon">${icons[type] || 'ℹ'}</div>
      <div class="igdl-notification-content">
        ${options.title ? `<div class="igdl-notification-title">${options.title}</div>` : ''}
        <div class="igdl-notification-message">${message}</div>
      </div>
      <button class="igdl-notification-close">✕</button>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      padding: 16px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: flex-start;
      gap: 12px;
      max-width: 400px;
      animation: slideIn 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    // Color based on type
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    
    notification.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
    
    // Close button
    const closeBtn = notification.querySelector('.igdl-notification-close');
    closeBtn.addEventListener('click', () => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    });
    
    // Auto close
    if (!options.persistent) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease';
          setTimeout(() => notification.remove(), 300);
        }
      }, options.duration || 5000);
    }
    
    document.body.appendChild(notification);
    
    return notification;
  }
  
  /**
   * Inject global styles
   */
  injectStyles() {
    if (document.getElementById('igdl-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'igdl-styles';
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
      
      .igdl-scan-button:active {
        transform: scale(0.95) !important;
      }
      
      .igdl-notification-icon {
        font-size: 20px;
        font-weight: bold;
      }
      
      .igdl-notification-title {
        font-weight: 600;
        font-size: 14px;
        color: #262626;
        margin-bottom: 4px;
      }
      
      .igdl-notification-message {
        font-size: 13px;
        color: #8e8e8e;
        line-height: 1.4;
      }
      
      .igdl-notification-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
        color: #8e8e8e;
        font-size: 18px;
        line-height: 1;
      }
      
      .igdl-notification-close:hover {
        color: #262626;
      }
      
      /* Tooltip styles */
      .igdl-tooltip {
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 999999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .igdl-tooltip.visible {
        opacity: 1;
      }
      
      /* Loading spinner */
      .igdl-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Show loading overlay
   */
  showLoading(message = 'Loading...') {
    const overlay = document.createElement('div');
    overlay.id = 'igdl-loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    `;
    
    overlay.innerHTML = `
      <div style="background: white; padding: 32px; border-radius: 16px; text-align: center; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);">
        <div class="igdl-spinner" style="width: 40px; height: 40px; border-width: 3px; margin: 0 auto 16px;"></div>
        <div style="font-size: 16px; font-weight: 600; color: #262626;">${message}</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    this.elements.set('loadingOverlay', overlay);
  }
  
  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = this.elements.get('loadingOverlay');
    if (overlay) {
      overlay.remove();
      this.elements.delete('loadingOverlay');
    }
  }
  
  /**
   * Remove all injected elements
   */
  cleanup() {
    this.elements.forEach((element, key) => {
      if (element && element.parentNode) {
        element.remove();
      }
    });
    
    this.elements.clear();
    this.injected = false;
    
    Logger.debug('UI cleanup completed');
  }
}

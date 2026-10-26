/**
 * Content Script - Main Entry Point
 * Handles all page interactions on Instagram
 */

import { Logger } from '../core/logger.js';
import { ProfileScanner } from './scanner.js';
import { UIInjector } from './ui-injector.js';
import { CredentialsExtractor } from './credentials-extractor.js';
import { Helpers } from '../utils/helpers.js';

class ContentScript {
  constructor() {
    this.scanner = new ProfileScanner();
    this.uiInjector = new UIInjector();
    this.initialized = false;
    this.currentUrl = window.location.href;
  }
  
  /**
   * Initialize content script
   */
  async init() {
    if (this.initialized) return;
    
    try {
      Logger.info('Content script initializing', {
        url: window.location.href
      });
      
      // Wait for page to be ready
      await this.waitForPageReady();
      
      // Check if on valid Instagram page
      if (!this.isValidPage()) {
        Logger.debug('Not a valid Instagram page for injection');
        return;
      }
      
      // Extract and save credentials
      await this.extractCredentials();
      
      // Inject UI elements
      this.injectUI();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Setup message listener
      this.setupMessageListener();
      
      // Watch for URL changes (SPA navigation)
      this.watchUrlChanges();
      
      // Check if first time
      await this.checkFirstTime();
      
      this.initialized = true;
      
      Logger.info('Content script initialized successfully');
    } catch (error) {
      Logger.error('Content script initialization failed', {}, error);
    }
  }
  
  /**
   * Wait for page to be ready
   */
  async waitForPageReady() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });
  }
  
  /**
   * Check if current page is valid for injection
   */
  isValidPage() {
    const url = window.location.href;
    
    // Valid pages: profile pages, post pages, explore
    const validPatterns = [
      /instagram\.com\/[^\/]+\/?$/,  // Profile
      /instagram\.com\/p\//,          // Post
      /instagram\.com\/reel\//,       // Reel
      /instagram\.com\/explore/       // Explore
    ];
    
    return validPatterns.some(pattern => pattern.test(url));
  }
  
  /**
   * Extract and save credentials
   */
  async extractCredentials() {
    try {
      const credentials = await CredentialsExtractor.extractAll();
      
      // Save to storage (encrypted)
      await chrome.runtime.sendMessage({
        type: 'SAVE_CREDENTIALS',
        payload: { credentials }
      });
      
      Logger.info('Credentials extracted and saved');
    } catch (error) {
      Logger.error('Failed to extract credentials', {}, error);
    }
  }
  
  /**
   * Inject UI elements
   */
  injectUI() {
    // Inject scan button
    const scanButton = this.uiInjector.injectScanButton();
    
    if (scanButton) {
      scanButton.addEventListener('click', () => this.handleScanClick());
    }
    
    // Inject progress indicator
    this.uiInjector.injectProgressIndicator();
    
    // Add stop button listener
    const stopButton = document.getElementById('igdl-stop-scan');
    if (stopButton) {
      stopButton.addEventListener('click', () => this.handleStopScan());
    }
    
    Logger.debug('UI elements injected');
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for scan progress
    window.addEventListener('igdl:scanProgress', (event) => {
      this.uiInjector.updateProgress(event.detail);
    });
    
    // Listen for keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      // Ctrl/Cmd + Shift + S: Start scan
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        this.handleScanClick();
      }
      
      // Escape: Stop scan
      if (event.key === 'Escape' && this.scanner.isScanning) {
        event.preventDefault();
        this.handleStopScan();
      }
    });
    
    Logger.debug('Event listeners setup');
  }
  
  /**
   * Setup message listener
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message)
        .then(response => sendResponse(response))
        .catch(error => {
          Logger.error('Message handler error', { type: message.type }, error);
          sendResponse({ error: error.message });
        });
      
      return true; // Keep channel open
    });
  }
  
  /**
   * Handle incoming messages
   */
  async handleMessage(message) {
    const { type, payload } = message;
    
    switch (type) {
      case 'TRIGGER_SCAN':
        return await this.handleScanClick();
        
      case 'STOP_SCAN':
        return this.handleStopScan();
        
      case 'QUICK_SCAN':
        return await this.handleQuickScan();
        
      case 'EXTRACT_CURRENT':
        return this.handleExtractCurrent();
        
      case 'TOGGLE_SELECTION':
        return this.handleToggleSelection();
        
      case 'GET_PAGE_INFO':
        return this.getPageInfo();
        
      default:
        return { error: 'Unknown message type' };
    }
  }
  
  /**
   * Handle scan button click
   */
  async handleScanClick() {
    try {
      // Check if logged in
      if (!CredentialsExtractor.isLoggedIn()) {
        this.uiInjector.showNotification('error', 
          'Please log in to Instagram first',
          { title: 'Not Logged In' }
        );
        return { success: false, error: 'Not logged in' };
      }
      
      // Check if already scanning
      if (this.scanner.isScanning) {
        this.uiInjector.showNotification('warning',
          'Scan already in progress',
          { title: 'Already Scanning' }
        );
        return { success: false, error: 'Already scanning' };
      }
      
      // Show loading
      this.uiInjector.showLoading('Starting scan...');
      
      // Disable button
      const scanButton = this.uiInjector.elements.get('scanButton');
      if (scanButton) {
        scanButton.disabled = true;
        scanButton.style.opacity = '0.6';
        scanButton.innerHTML = `
          <div class="igdl-spinner"></div>
          <span>Scanning...</span>
        `;
      }
      
      // Start scan
      const result = await this.scanner.scan();
      
      // Hide loading
      this.uiInjector.hideLoading();
      
      if (result.success) {
        // Show success notification
        this.uiInjector.showNotification('success',
          `Found ${result.mediaItems.length} items! Opening preview...`,
          { 
            title: 'Scan Complete',
            duration: 3000
          }
        );
        
        // Hide progress indicator
        this.uiInjector.hideProgress();
        
        // Open preview window
        await this.openPreview(result.mediaItems);
        
        Logger.info('Scan completed successfully', {
          totalItems: result.mediaItems.length
        });
      } else {
        // Show error notification
        this.uiInjector.showNotification('error',
          result.error || 'Scan failed',
          { title: 'Scan Failed' }
        );
      }
      
      // Re-enable button
      if (scanButton) {
        scanButton.disabled = false;
        scanButton.style.opacity = '1';
        scanButton.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 13l-5-5 1.41-1.41L9 10.17l9.59-9.59L20 2l-11 11z"/>
          </svg>
          <span>Scan & Download All</span>
        `;
      }
      
      return result;
    } catch (error) {
      Logger.error('Scan click handler failed', {}, error);
      this.uiInjector.hideLoading();
      this.uiInjector.showNotification('error',
        error.message || 'An error occurred',
        { title: 'Error' }
      );
      
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Handle stop scan
   */
  handleStopScan() {
    this.scanner.stop();
    this.uiInjector.hideProgress();
    
    this.uiInjector.showNotification('info',
      'Scan stopped by user',
      { title: 'Scan Stopped', duration: 2000 }
    );
    
    return { success: true };
  }
  
  /**
   * Handle quick scan (visible content only)
   */
  async handleQuickScan() {
    try {
      const result = await this.scanner.quickScan();
      
      if (result.success) {
        await this.openPreview(result.mediaItems);
      }
      
      return result;
    } catch (error) {
      Logger.error('Quick scan failed', {}, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Handle extract current view
   */
  handleExtractCurrent() {
    try {
      const mediaItems = this.scanner.extractFromCurrentView();
      
      return {
        success: true,
        mediaItems: mediaItems
      };
    } catch (error) {
      Logger.error('Extract current view failed', {}, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Handle toggle selection
   */
  handleToggleSelection() {
    // This will be handled by preview window
    window.dispatchEvent(new CustomEvent('igdl:toggleSelection'));
    
    return { success: true };
  }
  
  /**
   * Open preview window
   */
  async openPreview(mediaItems) {
    try {
      // Get page metadata
      const metadata = this.getPageInfo();
      
      // Create session
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_SESSION',
        payload: {
          mediaItems: mediaItems,
          metadata: metadata
        }
      });
      
      if (response.success) {
        // Open preview page
        const previewUrl = chrome.runtime.getURL(
          `preview.html?session=${response.session.sessionId}`
        );
        
        window.open(previewUrl, '_blank', 'width=1200,height=800');
        
        Logger.info('Preview opened', {
          sessionId: response.session.sessionId
        });
      }
    } catch (error) {
      Logger.error('Failed to open preview', {}, error);
      this.uiInjector.showNotification('error',
        'Failed to open preview window',
        { title: 'Error' }
      );
    }
  }
  
  /**
   * Get current page info
   */
  getPageInfo() {
    const info = {
      url: window.location.href,
      title: document.title,
      username: this.extractUsername(),
      timestamp: Date.now()
    };
    
    return info;
  }
  
  /**
   * Extract username from current page
   */
  extractUsername() {
    // From URL
    const urlMatch = window.location.pathname.match(/^\/([^\/]+)/);
    if (urlMatch && !['explore', 'p', 'reel', 'reels', 'tv'].includes(urlMatch[1])) {
      return urlMatch[1];
    }
    
    // From page title
    const titleMatch = document.title.match(/@([^\s\)]+)/);
    if (titleMatch) {
      return titleMatch[1];
    }
    
    return 'unknown';
  }
  
  /**
   * Watch for URL changes (SPA navigation)
   */
  watchUrlChanges() {
    // Use MutationObserver to detect URL changes
    let lastUrl = window.location.href;
    
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.handleUrlChange(currentUrl);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also listen to popstate
    window.addEventListener('popstate', () => {
      this.handleUrlChange(window.location.href);
    });
  }
  
  /**
   * Handle URL change
   */
  handleUrlChange(newUrl) {
    Logger.debug('URL changed', { 
      from: this.currentUrl,
      to: newUrl
    });
    
    this.currentUrl = newUrl;
    
    // Re-inject UI if needed
    if (this.isValidPage() && !this.uiInjector.elements.has('scanButton')) {
      setTimeout(() => {
        this.injectUI();
      }, 1000);
    }
    
    // Clean up if no longer valid page
    if (!this.isValidPage() && this.uiInjector.elements.size > 0) {
      this.uiInjector.cleanup();
    }
  }
  
  /**
   * Check if first time user
   */
  async checkFirstTime() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS'
      });
      
      if (response.settings?.firstTime) {
        // Show tour/guide
        this.showFirstTimeGuide();
        
        // Mark as not first time
        await chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          payload: {
            settings: { firstTime: false }
          }
        });
      }
    } catch (error) {
      Logger.error('Failed to check first time', {}, error);
    }
  }
  
  /**
   * Show first time guide
   */
  showFirstTimeGuide() {
    const guide = document.createElement('div');
    guide.style.cssText = `
      position: fixed;
      top: 80px;
      right: 280px;
      z-index: 999999;
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: slideIn 0.3s ease;
    `;
    
    guide.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #262626;">
          👋 Welcome!
        </h3>
        <button id="igdl-close-guide" style="background: none; border: none; cursor: pointer; font-size: 20px; padding: 0; color: #8e8e8e;">×</button>
      </div>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: #8e8e8e;">
        Click the <strong>Scan & Download All</strong> button to start downloading Instagram posts!
      </p>
      <div style="display: flex; gap: 8px;">
        <button id="igdl-try-now" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Try Now
        </button>
        <button id="igdl-guide-later" style="flex: 1; padding: 8px; background: #f0f0f0; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Later
        </button>
      </div>
    `;
    
    document.body.appendChild(guide);
    
    // Close button
    document.getElementById('igdl-close-guide').addEventListener('click', () => {
      guide.remove();
    });
    
    // Try now button
    document.getElementById('igdl-try-now').addEventListener('click', () => {
      guide.remove();
      this.handleScanClick();
    });
    
    // Later button
    document.getElementById('igdl-guide-later').addEventListener('click', () => {
      guide.remove();
    });
    
    // Animate scan button
    const scanButton = this.uiInjector.elements.get('scanButton');
    if (scanButton) {
      scanButton.style.animation = 'pulse 2s infinite';
      
      // Add pulse animation
      const pulseStyle = document.createElement('style');
      pulseStyle.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `;
      document.head.appendChild(pulseStyle);
      
      // Remove animation after guide is closed
      setTimeout(() => {
        if (scanButton) {
          scanButton.style.animation = '';
        }
      }, 10000);
    }
    
    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (guide.parentNode) {
        guide.remove();
      }
    }, 15000);
  }
  
  /**
   * Cleanup
   */
  cleanup() {
    this.uiInjector.cleanup();
    this.scanner.cleanup();
    this.initialized = false;
    
    Logger.info('Content script cleaned up');
  }
}

// Initialize
const contentScript = new ContentScript();

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    contentScript.init();
  });
} else {
  contentScript.init();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  contentScript.cleanup();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentScript;
}


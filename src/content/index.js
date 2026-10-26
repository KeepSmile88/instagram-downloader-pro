/**
 * Content Script Entry Point
 * Main content script that runs on Instagram pages
 */

import { Logger } from '../core/logger.js';
import { ProfileScanner } from './scanner.js';
import { UIInjector } from './ui-injector.js';
import { CredentialsExtractor } from './credentials-extractor.js';

class ContentScript {
  constructor() {
    this.logger = new Logger('Content');
    this.scanner = new ProfileScanner();
    this.uiInjector = new UIInjector();
    this.credentialsExtractor = new CredentialsExtractor();
    this.initialized = false;
    this.isInstagramPage = false;
  }

  /**
   * Initialize content script
   */
  async init() {
    try {
      // Check if we're on Instagram
      if (!this.checkIsInstagram()) {
        this.logger.debug('Not an Instagram page, skipping initialization');
        return;
      }

      this.logger.info('Initializing content script...');

      this.isInstagramPage = true;

      // Wait for page to be ready
      await this.waitForPageReady();

      // Initialize modules
      await this.scanner.init();
      await this.uiInjector.init();
      await this.credentialsExtractor.init();

      // Setup message listeners
      this.setupMessageListeners();

      // Setup observers
      this.setupObservers();

      // Inject UI if on profile page
      if (this.isProfilePage()) {
        await this.injectUI();
      }

      this.initialized = true;
      this.logger.success('Content script initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize content script:', error);
    }
  }

  /**
   * Check if current page is Instagram
   */
  checkIsInstagram() {
    return window.location.hostname.includes('instagram.com');
  }

  /**
   * Check if current page is a profile page
   */
  isProfilePage() {
    // Profile page pattern: instagram.com/username
    const path = window.location.pathname;
    return path !== '/' && 
           !path.includes('/p/') && 
           !path.includes('/reel/') && 
           !path.includes('/tv/') &&
           !path.includes('/explore/') &&
           !path.includes('/direct/') &&
           !path.includes('/accounts/');
  }

  /**
   * Wait for page to be ready
   */
  waitForPageReady() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', () => resolve());
      }
    });
  }

  /**
   * Setup message listeners
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message)
        .then(response => sendResponse(response))
        .catch(error => {
          this.logger.error('Message handler error:', error);
          sendResponse({ 
            success: false, 
            error: error.message 
          });
        });

      return true; // Keep channel open for async response
    });

    this.logger.info('Message listeners setup complete');
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(message) {
    const { type, payload } = message;

    this.logger.info('Received message:', type);

    try {
      switch (type) {
        case 'START_SCAN':
          return await this.startScan();

        case 'TOGGLE_PANEL':
          return await this.togglePanel();

        case 'GET_PAGE_INFO':
          return await this.getPageInfo();

        case 'GET_CREDENTIALS':
          return await this.getCredentials();

        case 'INJECT_UI':
          return await this.injectUI();

        case 'REMOVE_UI':
          return await this.removeUI();

        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Error handling message ${type}:`, error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Setup observers for dynamic content
   */
  setupObservers() {
    // Observe URL changes (Instagram is SPA)
    let lastUrl = location.href;
    
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.handleUrlChange(url);
      }
    }).observe(document.body, {
      childList: true,
      subtree: true
    });

    this.logger.info('Observers setup complete');
  }

  /**
   * Handle URL change
   */
  async handleUrlChange(url) {
    this.logger.info('URL changed:', url);

    // Remove old UI
    await this.removeUI();

    // Inject new UI if on profile page
    if (this.isProfilePage()) {
      // Wait a bit for page to load
      setTimeout(async () => {
        await this.injectUI();
      }, 1000);
    }
  }

  /**
   * Start scanning profile
   */
  async startScan() {
    try {
      if (!this.isProfilePage()) {
        throw new Error('Not on a profile page');
      }

      this.logger.info('Starting profile scan...');

      // Show loading state
      this.uiInjector.showLoading();

      // Extract username
      const username = this.extractUsername();

      // Get credentials
      const credentials = await this.credentialsExtractor.extract();

      // Start scanning
      const result = await this.scanner.scanProfile(username, credentials);

      // Hide loading
      this.uiInjector.hideLoading();

      // Create session
      const sessionResponse = await chrome.runtime.sendMessage({
        type: 'CREATE_SESSION',
        payload: {
          username,
          profileUrl: window.location.href,
          mediaItems: result.items,
          credentials
        }
      });

      if (!sessionResponse.success) {
        throw new Error(sessionResponse.error);
      }

      // Open preview page
      const previewUrl = chrome.runtime.getURL(
        `ui/preview/preview.html?session=${sessionResponse.session.id}`
      );
      
      window.open(previewUrl, '_blank');

      return { 
        success: true, 
        sessionId: sessionResponse.session.id 
      };

    } catch (error) {
      this.logger.error('Scan failed:', error);
      this.uiInjector.showError(error.message);
      
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Toggle download panel
   */
  async togglePanel() {
    this.uiInjector.togglePanel();
    return { success: true };
  }

  /**
   * Get current page info
   */
  async getPageInfo() {
    return {
      success: true,
      info: {
        url: window.location.href,
        isProfilePage: this.isProfilePage(),
        username: this.isProfilePage() ? this.extractUsername() : null
      }
    };
  }

  /**
   * Get credentials
   */
  async getCredentials() {
    try {
      const credentials = await this.credentialsExtractor.extract();
      return { 
        success: true, 
        credentials 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Inject UI
   */
  async injectUI() {
    try {
      await this.uiInjector.inject();
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to inject UI:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Remove UI
   */
  async removeUI() {
    try {
      this.uiInjector.remove();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Extract username from URL
   */
  extractUsername() {
    const path = window.location.pathname;
    const match = path.match(/^\/([^\/]+)\/?$/);
    return match ? match[1] : null;
  }
}

// Initialize content script
const contentScript = new ContentScript();
contentScript.init().catch(error => {
  console.error('Fatal error initializing content script:', error);
});

// Export for testing
export default contentScript;

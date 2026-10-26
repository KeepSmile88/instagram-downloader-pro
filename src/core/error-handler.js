/**
 * Centralized Error Handling System
 */

import { Logger } from './logger.js';
import { ERROR_CODES } from '../utils/constants.js';

export class AppError extends Error {
  constructor(message, code, retryable = false, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    this.timestamp = Date.now();
  }
}

export class ErrorHandler {
  static async handle(error, context = {}) {
    await Logger.error('Error occurred', context, error);
    
    const classified = this.classifyError(error);
    const solution = this.getSolution(classified);
    
    // Show user notification
    await this.notifyUser(classified, solution);
    
    // Attempt auto-recovery
    if (classified.autoRecoverable) {
      await this.attemptAutoRecovery(classified, context);
    }
    
    // Update statistics
    await this.updateErrorStats(classified);
    
    return {
      error: classified,
      solution,
      recovered: classified.autoRecoverable
    };
  }
  
  static classifyError(error) {
    // Network errors
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return new AppError(
        'Network connection issue',
        ERROR_CODES.NETWORK_ERROR,
        true,
        { originalError: error }
      );
    }
    
    // Rate limiting
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      return new AppError(
        'Instagram rate limit reached',
        ERROR_CODES.RATE_LIMIT,
        true,
        { originalError: error, waitTime: 5 * 60 * 1000 }
      );
    }
    
    // Authentication
    if (error.message?.includes('auth') || error.message?.includes('login')) {
      return new AppError(
        'Authentication required',
        ERROR_CODES.AUTH_ERROR,
        false,
        { originalError: error }
      );
    }
    
    // Storage
    if (error.message?.includes('storage') || error.message?.includes('quota')) {
      return new AppError(
        'Storage quota exceeded',
        ERROR_CODES.STORAGE_FULL,
        false,
        { originalError: error }
      );
    }
    
    // Download errors
    if (error.message?.includes('download')) {
      return new AppError(
        'Download failed',
        ERROR_CODES.DOWNLOAD_FAILED,
        true,
        { originalError: error }
      );
    }
    
    // Unknown
    return new AppError(
      error.message || 'Unknown error occurred',
      ERROR_CODES.UNKNOWN_ERROR,
      false,
      { originalError: error }
    );
  }
  
  static getSolution(error) {
    const solutions = {
      [ERROR_CODES.NETWORK_ERROR]: {
        title: 'Network Connection Issue 📡',
        message: 'Could not connect to Instagram. Please check your internet connection.',
        actions: [
          {
            text: 'Retry',
            type: 'primary',
            handler: () => this.retryLastAction()
          },
          {
            text: 'Check Connection',
            type: 'secondary',
            handler: () => this.openNetworkSettings()
          }
        ],
        autoRecoverable: true
      },
      
      [ERROR_CODES.RATE_LIMIT]: {
        title: 'Rate Limit Reached ⏸️',
        message: 'Instagram temporarily blocked requests. The extension will automatically slow down and retry in 5 minutes.',
        actions: [
          {
            text: 'Wait & Retry',
            type: 'primary',
            handler: () => this.scheduleRetry(5 * 60 * 1000)
          },
          {
            text: 'Adjust Settings',
            type: 'secondary',
            handler: () => this.openSettings()
          }
        ],
        autoRecoverable: true
      },
      
      [ERROR_CODES.AUTH_ERROR]: {
        title: 'Please Log In to Instagram 🔐',
        message: 'You need to be logged in to Instagram to download content.',
        actions: [
          {
            text: 'Open Instagram',
            type: 'primary',
            handler: () => window.open('https://instagram.com', '_blank')
          }
        ],
        autoRecoverable: false
      },
      
      [ERROR_CODES.STORAGE_FULL]: {
        title: 'Storage Full 💾',
        message: 'Your device storage is full. Please free up some space or change the download location.',
        actions: [
          {
            text: 'Manage Storage',
            type: 'primary',
            handler: () => this.openStorageSettings()
          },
          {
            text: 'Clear History',
            type: 'secondary',
            handler: () => this.clearDownloadHistory()
          }
        ],
        autoRecoverable: false
      },
      
      [ERROR_CODES.DOWNLOAD_FAILED]: {
        title: 'Download Failed ❌',
        message: 'Could not download the file. This might be a temporary issue.',
        actions: [
          {
            text: 'Retry',
            type: 'primary',
            handler: () => this.retryDownload()
          },
          {
            text: 'Skip',
            type: 'secondary',
            handler: () => this.skipCurrent()
          }
        ],
        autoRecoverable: true
      }
    };
    
    return solutions[error.code] || {
      title: 'Something Went Wrong 😕',
      message: error.message || 'An unexpected error occurred. Please try again.',
      actions: [
        {
          text: 'Retry',
          type: 'primary',
          handler: () => this.retryLastAction()
        },
        {
          text: 'Get Help',
          type: 'secondary',
          handler: () => this.openHelp(error)
        }
      ],
      autoRecoverable: false
    };
  }
  
  static async notifyUser(error, solution) {
    // Send message to UI
    chrome.runtime.sendMessage({
      type: 'SHOW_ERROR',
      payload: {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable
        },
        solution
      }
    }).catch(() => {
      // If no UI is open, use browser notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: solution.title,
        message: solution.message,
        priority: 2
      });
    });
  }
  
  static async attemptAutoRecovery(error, context) {
    Logger.info('Attempting auto-recovery', { error: error.code, context });
    
    switch (error.code) {
      case ERROR_CODES.NETWORK_ERROR:
        await this.waitForConnection();
        break;
        
      case ERROR_CODES.RATE_LIMIT:
        await this.increaseDelays();
        await this.scheduleRetry(error.details.waitTime || 5 * 60 * 1000);
        break;
        
      case ERROR_CODES.DOWNLOAD_FAILED:
        if (context.retryCount < 3) {
          await this.retryWithBackoff(context);
        }
        break;
    }
  }
  
  static async waitForConnection() {
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (navigator.onLine) {
          resolve();
        } else {
          setTimeout(checkConnection, 2000);
        }
      };
      checkConnection();
    });
  }
  
  static async increaseDelays() {
    const settings = await chrome.storage.local.get('settings');
    const newSettings = {
      ...settings.settings,
      delayMin: Math.min(settings.settings.delayMin * 1.5, 5000),
      delayMax: Math.min(settings.settings.delayMax * 1.5, 10000),
      concurrentDownloads: Math.max(settings.settings.concurrentDownloads - 1, 1)
    };
    
    await chrome.storage.local.set({ settings: newSettings });
    Logger.info('Increased delays to avoid rate limiting', newSettings);
  }
  
  static async scheduleRetry(delayMs) {
    chrome.alarms.create('retry_download', { delayInMinutes: delayMs / 60000 });
  }
  
  static async retryWithBackoff(context) {
    const retryCount = context.retryCount || 0;
    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    
    Logger.info('Retrying with backoff', {
      retryCount,
      backoffDelay
    });
  }
  
  static async updateErrorStats(error) {
    const { errorStats = {} } = await chrome.storage.local.get('errorStats');
    
    errorStats[error.code] = (errorStats[error.code] || 0) + 1;
    errorStats.lastError = {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp
    };
    
    await chrome.storage.local.set({ errorStats });
  }
  
  // Action handlers
  static retryLastAction() {
    chrome.runtime.sendMessage({ type: 'RETRY_LAST_ACTION' });
  }
  
  static openSettings() {
    chrome.runtime.openOptionsPage();
  }
  
  static openHelp(error) {
    const url = chrome.runtime.getURL(`help.html?error=${error.code}`);
    chrome.tabs.create({ url });
  }
  
  static openNetworkSettings() {
    // Platform-specific
    chrome.tabs.create({ url: 'chrome://settings/system' });
  }
  
  static openStorageSettings() {
    chrome.tabs.create({ url: 'chrome://settings/clearBrowserData' });
  }
}

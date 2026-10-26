/**
 * Background Service Worker Entry Point
 * Main background script that coordinates all background services
 */

import { Logger } from '../core/logger.js';
import { StorageManager } from '../core/storage-manager.js';
import { ErrorHandler } from '../core/error-handler.js';
import { SessionManager } from './session-manager.js';
import { DownloadManager } from './download-manager.js';
import { NetworkMonitor } from './network-monitor.js';

class BackgroundService {
  constructor() {
    this.logger = new Logger('Background');
    this.storage = new StorageManager();
    this.errorHandler = new ErrorHandler();
    this.sessionManager = new SessionManager();
    this.downloadManager = new DownloadManager();
    this.networkMonitor = new NetworkMonitor();
    this.initialized = false;
  }

  /**
   * Initialize background service
   */
  async init() {
    try {
      this.logger.info('Initializing background service...');

      // Initialize core modules
      await this.storage.init();
      await this.errorHandler.init();
      
      // Initialize managers
      await this.sessionManager.init();
      await this.downloadManager.init();
      await this.networkMonitor.init();

      // Setup message listeners
      this.setupMessageListeners();
      
      // Setup chrome event listeners
      this.setupChromeListeners();
      
      // Check for updates
      this.checkForUpdates();
      
      // Resume incomplete downloads
      await this.resumeIncompleteDownloads();

      this.initialized = true;
      this.logger.success('Background service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize background service:', error);
      await this.errorHandler.handle(error, 'BackgroundInit');
    }
  }

  /**
   * Setup message listeners
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender)
        .then(response => sendResponse(response))
        .catch(error => {
          this.logger.error('Message handler error:', error);
          sendResponse({ 
            success: false, 
            error: error.message 
          });
        });
      
      // Return true to indicate async response
      return true;
    });

    this.logger.info('Message listeners setup complete');
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(message, sender) {
    const { type, payload } = message;
    
    this.logger.info('Received message:', type, payload);

    try {
      switch (type) {
        // Session Management
        case 'CREATE_SESSION':
          return await this.sessionManager.createSession(payload);
          
        case 'GET_SESSION':
          return await this.sessionManager.getSession(payload.sessionId);
          
        case 'UPDATE_SESSION':
          return await this.sessionManager.updateSession(payload.sessionId, payload.data);
          
        case 'DELETE_SESSION':
          return await this.sessionManager.deleteSession(payload.sessionId);
          
        case 'LIST_SESSIONS':
          return await this.sessionManager.listSessions();

        // Download Management
        case 'START_DOWNLOAD':
          return await this.downloadManager.startDownload(payload);
          
        case 'PAUSE_DOWNLOAD':
          return await this.downloadManager.pauseDownload(payload.sessionId);
          
        case 'RESUME_DOWNLOAD':
          return await this.downloadManager.resumeDownload(payload.sessionId);
          
        case 'CANCEL_DOWNLOAD':
          return await this.downloadManager.cancelDownload(payload.sessionId);
          
        case 'GET_DOWNLOAD_STATUS':
          return await this.downloadManager.getStatus(payload.sessionId);

        // Settings Management
        case 'GET_SETTINGS':
          return await this.getSettings();
          
        case 'UPDATE_SETTINGS':
          return await this.updateSettings(payload.settings);
          
        case 'RESET_SETTINGS':
          return await this.resetSettings();

        // Statistics
        case 'GET_STATS':
          return await this.getStats();
          
        case 'UPDATE_STATS':
          return await this.updateStats(payload);

        // Data Management
        case 'EXPORT_DATA':
          return await this.exportData();
          
        case 'IMPORT_DATA':
          return await this.importData(payload.data);
          
        case 'CLEAR_HISTORY':
          return await this.clearHistory();
          
        case 'CLEAR_DATA':
          return await this.clearAllData();

        // Network
        case 'CHECK_NETWORK':
          return await this.networkMonitor.checkConnection();
          
        case 'GET_NETWORK_STATUS':
          return await this.networkMonitor.getStatus();

        // Utility
        case 'PING':
          return { success: true, message: 'pong' };
          
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
   * Setup Chrome event listeners
   */
  setupChromeListeners() {
    // Extension installed/updated
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    // Extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });

    // Tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Download events
    chrome.downloads.onChanged.addListener((delta) => {
      this.handleDownloadChanged(delta);
    });

    // Command shortcuts
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });

    this.logger.info('Chrome listeners setup complete');
  }

  /**
   * Handle extension installed/updated
   */
  async handleInstalled(details) {
    this.logger.info('Extension installed:', details.reason);

    if (details.reason === 'install') {
      // First time install
      await this.handleFirstInstall();
    } else if (details.reason === 'update') {
      // Extension updated
      await this.handleUpdate(details.previousVersion);
    }
  }

  /**
   * Handle first install
   */
  async handleFirstInstall() {
    this.logger.info('First install detected');

    // Set default settings
    await this.storage.set('settings', {
      language: 'en',
      theme: 'light',
      notifications: true,
      sounds: false,
      autoUpdate: true,
      delayMin: 1000,
      delayMax: 3000,
      concurrentDownloads: 3,
      maxRetries: 3,
      downloadPath: 'Downloads/Instagram',
      organizeFolders: true,
      addMetadata: true,
      autoResume: true,
      filterImages: true,
      filterVideos: true,
      minResolution: 1080,
      minFileSize: 0,
      skipDuplicates: true,
      keepHistory: true,
      historyRetention: 30,
      analytics: false,
      crashReports: false,
      requestTimeout: 30,
      userAgent: '',
      debugMode: false,
      experimental: false,
      onboardingComplete: false,
      firstTime: true
    });

    // Initialize stats
    await this.storage.set('stats', {
      totalDownloads: 0,
      totalImages: 0,
      totalVideos: 0,
      totalSize: 0,
      lastDownload: null
    });

    // Open onboarding
    chrome.tabs.create({
      url: chrome.runtime.getURL('ui/onboarding/onboarding.html')
    });
  }

  /**
   * Handle extension update
   */
  async handleUpdate(previousVersion) {
    this.logger.info('Extension updated from:', previousVersion);

    // Migration logic here if needed
    // Example: migrate old settings format to new format

    // Show update notification
    const settings = await this.storage.get('settings');
    if (settings?.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
        title: 'Instagram Downloader Pro Updated',
        message: `Updated to version ${chrome.runtime.getManifest().version}`,
        priority: 1
      });
    }
  }

  /**
   * Handle extension startup
   */
  async handleStartup() {
    this.logger.info('Extension started');

    // Resume incomplete downloads if auto-resume is enabled
    const settings = await this.storage.get('settings');
    if (settings?.autoResume) {
      await this.resumeIncompleteDownloads();
    }
  }

  /**
   * Handle tab update
   */
  handleTabUpdate(tabId, changeInfo, tab) {
    // Only process Instagram tabs
    if (!tab.url?.includes('instagram.com')) return;

    // Tab loaded
    if (changeInfo.status === 'complete') {
      this.logger.debug('Instagram tab loaded:', tabId);
      
      // Inject content script if needed
      this.injectContentScript(tabId);
    }
  }

  /**
   * Inject content script
   */
  async injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      
      this.logger.debug('Content script injected:', tabId);
    } catch (error) {
      // Tab might be closed or not accessible
      this.logger.debug('Failed to inject content script:', error.message);
    }
  }

  /**
   * Handle download changed
   */
  handleDownloadChanged(delta) {
    this.downloadManager.handleDownloadChanged(delta);
  }

  /**
   * Handle keyboard command
   */
  async handleCommand(command) {
    this.logger.info('Command received:', command);

    switch (command) {
      case 'scan-profile':
        // Send message to active tab to start scanning
        const [tab] = await chrome.tabs.query({ 
          active: true, 
          currentWindow: true 
        });
        
        if (tab?.url?.includes('instagram.com')) {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'START_SCAN' 
          });
        }
        break;

      case 'toggle-panel':
        // Toggle download panel in active tab
        const [activeTab] = await chrome.tabs.query({ 
          active: true, 
          currentWindow: true 
        });
        
        if (activeTab?.url?.includes('instagram.com')) {
          chrome.tabs.sendMessage(activeTab.id, { 
            type: 'TOGGLE_PANEL' 
          });
        }
        break;
    }
  }

  /**
   * Resume incomplete downloads
   */
  async resumeIncompleteDownloads() {
    try {
      const sessions = await this.sessionManager.listSessions();
      const incomplete = sessions.filter(s => 
        s.status === 'downloading' || s.status === 'paused'
      );

      if (incomplete.length > 0) {
        this.logger.info(`Resuming ${incomplete.length} incomplete downloads`);
        
        for (const session of incomplete) {
          await this.downloadManager.resumeDownload(session.id);
        }
      }
    } catch (error) {
      this.logger.error('Failed to resume incomplete downloads:', error);
    }
  }

  /**
   * Get settings
   */
  async getSettings() {
    const settings = await this.storage.get('settings');
    return { 
      success: true, 
      settings: settings || {} 
    };
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings) {
    const current = await this.storage.get('settings') || {};
    const updated = { ...current, ...newSettings };
    
    await this.storage.set('settings', updated);
    
    this.logger.info('Settings updated');
    
    return { 
      success: true, 
      settings: updated 
    };
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings() {
    await this.storage.remove('settings');
    await this.handleFirstInstall();
    
    this.logger.info('Settings reset to defaults');
    
    return { success: true };
  }

  /**
   * Get statistics
   */
  async getStats() {
    const stats = await this.storage.get('stats');
    return { 
      success: true, 
      stats: stats || {} 
    };
  }

  /**
   * Update statistics
   */
  async updateStats(update) {
    const current = await this.storage.get('stats') || {};
    const updated = {
      totalDownloads: (current.totalDownloads || 0) + (update.downloads || 0),
      totalImages: (current.totalImages || 0) + (update.images || 0),
      totalVideos: (current.totalVideos || 0) + (update.videos || 0),
      totalSize: (current.totalSize || 0) + (update.size || 0),
      lastDownload: Date.now()
    };
    
    await this.storage.set('stats', updated);
    
    return { 
      success: true, 
      stats: updated 
    };
  }

  /**
   * Export all data
   */
  async exportData() {
    const data = {
      settings: await this.storage.get('settings'),
      stats: await this.storage.get('stats'),
      sessions: await this.sessionManager.listSessions(),
      exportedAt: Date.now(),
      version: chrome.runtime.getManifest().version
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    
    await chrome.downloads.download({
      url,
      filename: `igdl_backup_${Date.now()}.json`,
      saveAs: true
    });

    return { success: true };
  }

  /**
   * Import data
   */
  async importData(data) {
    if (data.settings) {
      await this.storage.set('settings', data.settings);
    }

    if (data.stats) {
      await this.storage.set('stats', data.stats);
    }

    this.logger.info('Data imported successfully');

    return { success: true };
  }

  /**
   * Clear download history
   */
  async clearHistory() {
    const sessions = await this.sessionManager.listSessions();
    
    for (const session of sessions) {
      if (session.status === 'completed' || session.status === 'failed') {
        await this.sessionManager.deleteSession(session.id);
      }
    }

    this.logger.info('Download history cleared');

    return { success: true };
  }

  /**
   * Clear all extension data
   */
  async clearAllData() {
    await chrome.storage.local.clear();
    
    this.logger.info('All data cleared');

    return { success: true };
  }

  /**
   * Check for updates
   */
  async checkForUpdates() {
    const settings = await this.storage.get('settings');
    
    if (!settings?.autoUpdate) {
      return;
    }

    // Check for extension updates
    chrome.runtime.requestUpdateCheck((status) => {
      if (status === 'update_available') {
        this.logger.info('Update available');
        
        if (settings?.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
            title: 'Update Available',
            message: 'A new version is available and will be installed automatically.',
            priority: 1
          });
        }
      }
    });
  }
}

// Initialize background service
const backgroundService = new BackgroundService();
backgroundService.init().catch(error => {
  console.error('Fatal error initializing background service:', error);
});

// Export for testing
export default backgroundService;

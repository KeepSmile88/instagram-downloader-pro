/**
 * Background Service Worker - Main Entry Point
 * Orchestrates all background operations
 */

import { Logger, PerformanceMonitor } from '../core/logger.js';
import { StorageManager } from '../core/storage-manager.js';
import { ErrorHandler } from '../core/error-handler.js';
import { SessionManager } from './session-manager.js';
import { DownloadManager } from './download-manager.js';
import { NetworkMonitor } from './network-monitor.js';
import { AchievementSystem } from './achievement-system.js';
import { Helpers } from '../utils/helpers.js';

class BackgroundService {
  constructor() {
    this.sessionManager = new SessionManager();
    this.downloadManager = new DownloadManager(this.sessionManager);
    this.networkMonitor = new NetworkMonitor();
    this.achievementSystem = new AchievementSystem();
    this.initialized = false;
  }
  
  /**
   * Initialize all services
   */
  async init() {
    if (this.initialized) return;
    
    try {
      PerformanceMonitor.start('background-init');
      
      Logger.info('Initializing background service...');
      
      // Initialize storage first
      await StorageManager.init();
      
      // Initialize other services
      await this.sessionManager.init();
      await this.downloadManager.init();
      await this.networkMonitor.init();
      await this.achievementSystem.init();
      
      // Setup message handlers
      this.setupMessageHandlers();
      
      // Setup command handlers
      this.setupCommandHandlers();
      
      // Setup alarm handlers
      this.setupAlarmHandlers();
      
      // Check for pending sessions (crash recovery)
      await this.checkPendingSessions();
      
      // Schedule maintenance tasks
      this.scheduleMaintenance();
      
      this.initialized = true;
      
      const duration = PerformanceMonitor.end('background-init');
      
      Logger.info('Background service initialized', {
        duration: `${duration.toFixed(2)}ms`
      });
    } catch (error) {
      Logger.error('Background service initialization failed', {}, error);
      throw error;
    }
  }
  
  /**
   * Setup message handlers
   */
  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender)
        .then(response => sendResponse(response))
        .catch(error => {
          Logger.error('Message handler error', { type: message.type }, error);
          sendResponse({ error: error.message });
        });
      
      return true; // Keep channel open for async response
    });
    
    Logger.debug('Message handlers setup complete');
  }
  
  /**
   * Handle incoming messages
   */
  async handleMessage(message, sender) {
    const { type, payload } = message;
    
    Logger.debug('Message received', { type, from: sender.tab?.id });
    
    try {
      switch (type) {
        // Session management
        case 'CREATE_SESSION':
          return await this.handleCreateSession(payload);
          
        case 'START_DOWNLOAD':
          return await this.handleStartDownload(payload);
          
        case 'PAUSE_DOWNLOAD':
          return await this.handlePauseDownload(payload);
          
        case 'RESUME_DOWNLOAD':
          return await this.handleResumeDownload(payload);
          
        case 'CANCEL_DOWNLOAD':
          return await this.handleCancelDownload(payload);
          
        case 'GET_SESSION':
          return await this.handleGetSession(payload);
          
        case 'GET_SESSIONS':
          return await this.handleGetSessions(payload);
          
        case 'DELETE_SESSION':
          return await this.handleDeleteSession(payload);
          
        case 'RETRY_FAILED':
          return await this.handleRetryFailed(payload);
          
        // Progress
        case 'GET_PROGRESS':
          return await this.handleGetProgress(payload);
          
        // Settings
        case 'GET_SETTINGS':
          return await this.handleGetSettings();
          
        case 'UPDATE_SETTINGS':
          return await this.handleUpdateSettings(payload);
          
        case 'RESET_SETTINGS':
          return await this.handleResetSettings();
          
        // History
        case 'GET_HISTORY':
          return await this.handleGetHistory(payload);
          
        case 'SEARCH_HISTORY':
          return await this.handleSearchHistory(payload);
          
        case 'CLEAR_HISTORY':
          return await this.handleClearHistory();
          
        // Stats
        case 'GET_STATS':
          return await this.handleGetStats();
          
        // Achievements
        case 'GET_ACHIEVEMENTS':
          return await this.handleGetAchievements();
          
        // Network
        case 'GET_NETWORK_STATUS':
          return await this.handleGetNetworkStatus();
          
        case 'TEST_SPEED':
          return await this.handleTestSpeed();
          
        // Data management
        case 'EXPORT_DATA':
          return await this.handleExportData();
          
        case 'IMPORT_DATA':
          return await this.handleImportData(payload);
          
        case 'CLEAR_DATA':
          return await this.handleClearData();
          
        // Logs
        case 'GET_LOGS':
          return await this.handleGetLogs(payload);
          
        case 'EXPORT_LOGS':
          return await this.handleExportLogs();
          
        case 'CLEAR_LOGS':
          return await this.handleClearLogs();
          
        // Preview
        case 'OPEN_PREVIEW':
          return await this.handleOpenPreview(payload);
          
        default:
          Logger.warn('Unknown message type', { type });
          return { error: 'Unknown message type' };
      }
    } catch (error) {
      await ErrorHandler.handle(error, { messageType: type, payload });
      throw error;
    }
  }
  
  // Message handlers implementation
  
  async handleCreateSession(payload) {
    const { mediaItems, metadata } = payload;
    
    const session = await this.sessionManager.createSession(
      mediaItems,
      metadata
    );
    
    return { success: true, session };
  }
  
  async handleStartDownload(payload) {
    const { sessionId } = payload;
    
    await this.downloadManager.startDownload(sessionId);
    
    return { success: true };
  }
  
  async handlePauseDownload(payload) {
    const { sessionId } = payload;
    
    await this.downloadManager.pauseDownload(sessionId);
    
    return { success: true };
  }
  
  async handleResumeDownload(payload) {
    const { sessionId } = payload;
    
    await this.downloadManager.resumeDownload(sessionId);
    
    return { success: true };
  }
  
  async handleCancelDownload(payload) {
    const { sessionId } = payload;
    
    await this.downloadManager.cancelDownload(sessionId);
    
    return { success: true };
  }
  
  async handleGetSession(payload) {
    const { sessionId } = payload;
    
    const session = await this.sessionManager.getSession(sessionId);
    
    return { session };
  }
  
  async handleGetSessions(payload) {
    const sessions = await this.sessionManager.getAllSessions(payload.filters || {});
    
    return { sessions };
  }
  
  async handleDeleteSession(payload) {
    const { sessionId } = payload;
    
    await this.sessionManager.deleteSession(sessionId);
    
    return { success: true };
  }
  
  async handleRetryFailed(payload) {
    const { sessionId } = payload;
    
    const session = await this.sessionManager.retryFailedItems(sessionId);
    
    // Restart download
    await this.downloadManager.startDownload(sessionId);
    
    return { success: true, session };
  }
  
  async handleGetProgress(payload) {
    const { sessionId } = payload;
    
    const progress = await this.sessionManager.getProgress(sessionId);
    
    return { progress };
  }
  
  async handleGetSettings() {
    const settings = await StorageManager.getSettings();
    
    return { settings };
  }
  
  async handleUpdateSettings(payload) {
    const { settings } = payload;
    
    const updated = await StorageManager.updateSettings(settings);
    
    // Update download manager settings
    await this.downloadManager.updateSettings(updated);
    
    return { success: true, settings: updated };
  }
  
  async handleResetSettings() {
    const settings = await StorageManager.resetSettings();
    
    return { success: true, settings };
  }
  
  async handleGetHistory(payload) {
    const history = await StorageManager.getHistory(payload);
    
    return { history };
  }
  
  async handleSearchHistory(payload) {
    const { query } = payload;
    
    const results = await StorageManager.searchHistory(query);
    
    return { results };
  }
  
  async handleClearHistory() {
    await StorageManager.clearHistory();
    
    return { success: true };
  }
  
  async handleGetStats() {
    const stats = await StorageManager.getStats();
    const downloadStats = await this.downloadManager.getDownloadStats();
    
    return { 
      stats,
      downloadStats
    };
  }
  
  async handleGetAchievements() {
    const achievements = await StorageManager.getAchievements();
    
    return { achievements };
  }
  
  async handleGetNetworkStatus() {
    const status = this.networkMonitor.getStatus();
    
    return { status };
  }
  
  async handleTestSpeed() {
    const speed = await this.networkMonitor.testSpeed();
    
    return { speed };
  }
  
  async handleExportData() {
    const data = await StorageManager.exportData();
    
    // Download as file
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
  
  async handleImportData(payload) {
    const { data } = payload;
    
    await StorageManager.importData(data);
    
    return { success: true };
  }
  
  async handleClearData() {
    await StorageManager.clear();
    
    return { success: true };
  }
  
  async handleGetLogs(payload) {
    const logs = await Logger.getLogs(payload);
    
    return { logs };
  }
  
  async handleExportLogs() {
    await Logger.exportLogs();
    
    return { success: true };
  }
  
  async handleClearLogs() {
    await Logger.clearLogs();
    
    return { success: true };
  }
  
  async handleOpenPreview(payload) {
    const { url } = payload;
    
    await chrome.tabs.create({ url });
    
    return { success: true };
  }
  
  /**
   * Setup keyboard command handlers
   */
  setupCommandHandlers() {
    chrome.commands.onCommand.addListener((command) => {
      Logger.debug('Command received', { command });
      
      switch (command) {
        case 'scan-page':
          this.triggerScan();
          break;
          
        case 'toggle-selection':
          this.triggerToggleSelection();
          break;
      }
    });
  }
  
  async triggerScan() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tabs[0]?.url?.includes('instagram.com')) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'TRIGGER_SCAN'
      }).catch(() => {
        Logger.warn('Could not trigger scan - content script not ready');
      });
    }
  }
  
  async triggerToggleSelection() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'TOGGLE_SELECTION'
      }).catch(() => {});
    }
  }
  
  /**
   * Setup alarm handlers
   */
  setupAlarmHandlers() {
    chrome.alarms.onAlarm.addListener((alarm) => {
      Logger.debug('Alarm triggered', { name: alarm.name });
      
      switch (alarm.name) {
        case 'maintenance':
          this.runMaintenance();
          break;
          
        case 'retry_download':
          this.retryAfterRateLimit();
          break;
          
        case 'session_cleanup':
          this.sessionManager.cleanup();
          break;
      }
    });
  }
  
  /**
   * Check for pending sessions (crash recovery)
   */
  async checkPendingSessions() {
    const currentSession = await StorageManager.getCurrentSession();
    
    if (!currentSession) return;
    
    if (currentSession.status === 'active' && currentSession.pendingItems.length > 0) {
      Logger.info('Found incomplete session, offering to resume', {
        sessionId: currentSession.sessionId,
        pending: currentSession.pendingItems.length
      });
      
      // Show notification
      const notificationId = await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Resume Download? 🔄',
        message: `Found incomplete download for @${currentSession.username}. ${currentSession.pendingItems.length} items remaining.`,
        buttons: [
          { title: 'Resume' },
          { title: 'Cancel' }
        ],
        requireInteraction: true
      });
      
      // Handle button clicks
      chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
        if (notifId === notificationId) {
          if (buttonIndex === 0) {
            // Resume
            this.downloadManager.resumeDownload(currentSession.sessionId);
          } else {
            // Cancel
            this.sessionManager.cancelSession(currentSession.sessionId);
          }
          
          chrome.notifications.clear(notificationId);
        }
      });
    }
  }
  
  /**
   * Schedule maintenance tasks
   */
  scheduleMaintenance() {
    // Run maintenance daily
    chrome.alarms.create('maintenance', {
      periodInMinutes: 24 * 60
    });
    
    // Run initial maintenance after 1 minute
    setTimeout(() => this.runMaintenance(), 60 * 1000);
  }
  
  /**
   * Run maintenance tasks
   */
  async runMaintenance() {
    Logger.info('Running maintenance tasks...');
    
    try {
      // Cleanup old data
      await StorageManager.cleanup();
      
      // Check storage usage
      const usage = await StorageManager.getUsage();
      
      if (usage.percentage > 90) {
        Logger.warn('Storage usage high', usage);
        
        // Notify user
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Storage Warning ⚠️',
          message: `Extension storage is ${usage.percentage}% full. Consider clearing old data.`
        });
      }
      
      // Check for achievements
      await this.achievementSystem.checkAll();
      
      Logger.info('Maintenance completed');
    } catch (error) {
      Logger.error('Maintenance failed', {}, error);
    }
  }
  
  /**
   * Retry download after rate limit
   */
  async retryAfterRateLimit() {
    const currentSession = await StorageManager.getCurrentSession();
    
    if (currentSession && currentSession.status === 'active') {
      Logger.info('Retrying after rate limit', {
        sessionId: currentSession.sessionId
      });
      
      await this.downloadManager.resumeDownload(currentSession.sessionId);
    }
  }
}

// Initialize on service worker startup
const backgroundService = new BackgroundService();

// Handle installation
chrome.runtime.onInstalled.addListener(async (details) => {
  Logger.info('Extension installed/updated', { reason: details.reason });
  
  if (details.reason === 'install') {
    // First time install
    await StorageManager.set('firstTime', true);
    
    // Open onboarding
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html')
    });
  } else if (details.reason === 'update') {
    // Extension updated
    const manifest = chrome.runtime.getManifest();
    Logger.info('Extension updated to version', { version: manifest.version });
  }
  
  // Initialize service
  await backgroundService.init();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  Logger.info('Browser started, initializing service');
  await backgroundService.init();
});

// Ensure initialization
(async () => {
  await backgroundService.init();
})();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackgroundService;
}

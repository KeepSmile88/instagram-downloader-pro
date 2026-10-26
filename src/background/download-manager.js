/**
 * Download Management System
 * Handles concurrent downloads, queue management, and retry logic
 */

import { Logger } from '../core/logger.js';
import { StorageManager } from '../core/storage-manager.js';
import { ErrorHandler, AppError } from '../core/error-handler.js';
import { Helpers } from '../utils/helpers.js';
import { ERROR_CODES } from '../utils/constants.js';

export class DownloadManager {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.activeDownloads = new Map();
    this.downloadQueue = [];
    this.isProcessing = false;
    this.maxConcurrent = 3;
    this.downloadHistory = new Map();
  }
  
  /**
   * Initialize download manager
   */
  async init() {
    const settings = await StorageManager.getSettings();
    this.maxConcurrent = settings.concurrentDownloads || 3;
    
    // Listen for download events
    this.setupDownloadListeners();
    
    Logger.info('Download manager initialized', {
      maxConcurrent: this.maxConcurrent
    });
  }
  
  /**
   * Start downloading a session
   */
  async startDownload(sessionId) {
    try {
      // Start the session
      await this.sessionManager.startSession(sessionId);
      
      // Begin processing queue
      this.processQueue(sessionId);
      
      Logger.info('Download started', { sessionId });
      
      return true;
    } catch (error) {
      Logger.error('Failed to start download', { sessionId }, error);
      await ErrorHandler.handle(error, { sessionId });
      throw error;
    }
  }
  
  /**
   * Process download queue
   */
  async processQueue(sessionId) {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const session = await this.sessionManager.getSession(sessionId);
      
      if (!session || session.status !== 'active') {
        this.isProcessing = false;
        return;
      }
      
      while (session.pendingItems.length > 0) {
        // Check if session is still active
        const currentSession = await this.sessionManager.getSession(sessionId);
        
        if (!currentSession || currentSession.status !== 'active') {
          Logger.info('Session no longer active, stopping queue', { sessionId });
          break;
        }
        
        // Wait if max concurrent reached
        while (this.activeDownloads.size >= this.maxConcurrent) {
          await Helpers.delay(100);
        }
        
        // Get next item
        const item = await this.sessionManager.getNextItem(sessionId);
        
        if (!item) break;
        
        // Start download
        this.downloadItem(sessionId, item).catch(error => {
          Logger.error('Download item failed', {
            sessionId,
            itemIndex: item.index
          }, error);
        });
        
        // Random delay between downloads
        const settings = await StorageManager.getSettings();
        const delay = Helpers.random(
          settings.delayMin || 1000,
          settings.delayMax || 3000
        );
        
        await Helpers.delay(delay);
      }
      
      // Wait for all active downloads to complete
      while (this.activeDownloads.size > 0) {
        await Helpers.delay(500);
      }
      
      // Check if session is complete
      const finalSession = await this.sessionManager.getSession(sessionId);
      
      if (finalSession.pendingItems.length === 0) {
        await this.sessionManager.completeSession(sessionId);
        
        // Show completion notification
        this.showCompletionNotification(finalSession);
      }
    } catch (error) {
      Logger.error('Queue processing failed', { sessionId }, error);
      await ErrorHandler.handle(error, { sessionId });
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Download a single item
   */
  async downloadItem(sessionId, item) {
    const downloadKey = `${sessionId}_${item.index}`;
    
    try {
      this.activeDownloads.set(downloadKey, {
        sessionId,
        item,
        startTime: Date.now()
      });
      
      Logger.debug('Starting download', {
        sessionId,
        itemIndex: item.index,
        filename: item.filename
      });
      
      // Check if already downloaded
      if (await this.isDuplicate(item.url)) {
        const settings = await StorageManager.getSettings();
        
        if (settings.skipDuplicates) {
          await this.sessionManager.markItemSkipped(
            sessionId,
            item.index,
            'Already downloaded'
          );
          
          this.activeDownloads.delete(downloadKey);
          return;
        }
      }
      
      // Generate filename
      const filename = await this.generateFilename(sessionId, item);
      
      // Start Chrome download
      const downloadId = await this.chromeDownload(item.url, filename);
      
      // Wait for download to complete
      const downloadInfo = await this.waitForDownload(downloadId);
      
      // Mark as completed
      await this.sessionManager.markItemCompleted(sessionId, item.index, {
        downloadId,
        fileSize: downloadInfo.fileSize,
        duration: Date.now() - this.activeDownloads.get(downloadKey).startTime
      });
      
      // Record in history
      this.downloadHistory.set(item.url, {
        downloadedAt: Date.now(),
        filename: filename,
        sessionId: sessionId
      });
      
      Logger.info('Download completed', {
        sessionId,
        itemIndex: item.index,
        filename: filename,
        fileSize: Helpers.formatBytes(downloadInfo.fileSize || 0)
      });
      
    } catch (error) {
      Logger.error('Download failed', {
        sessionId,
        itemIndex: item.index,
        filename: item.filename
      }, error);
      
      await this.sessionManager.markItemFailed(sessionId, item.index, error);
      
      // Handle error
      await ErrorHandler.handle(error, {
        sessionId,
        itemIndex: item.index,
        retryCount: item.retryCount
      });
      
    } finally {
      this.activeDownloads.delete(downloadKey);
    }
  }
  
  /**
   * Chrome download API wrapper
   */
  async chromeDownload(url, filename) {
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new AppError(
            chrome.runtime.lastError.message,
            ERROR_CODES.DOWNLOAD_FAILED,
            true
          ));
        } else {
          resolve(downloadId);
        }
      });
    });
  }
  
  /**
   * Wait for download to complete or fail
   */
  async waitForDownload(downloadId) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        try {
          const downloads = await chrome.downloads.search({ id: downloadId });
          
          if (downloads.length === 0) {
            clearInterval(checkInterval);
            reject(new AppError(
              'Download not found',
              ERROR_CODES.DOWNLOAD_FAILED,
              false
            ));
            return;
          }
          
          const download = downloads[0];
          
          if (download.state === 'complete') {
            clearInterval(checkInterval);
            resolve({
              downloadId,
              filename: download.filename,
              fileSize: download.fileSize
            });
          } else if (download.state === 'interrupted') {
            clearInterval(checkInterval);
            reject(new AppError(
              `Download interrupted: ${download.error}`,
              ERROR_CODES.DOWNLOAD_FAILED,
              true,
              { interruptReason: download.error }
            ));
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 500);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new AppError(
          'Download timeout',
          ERROR_CODES.DOWNLOAD_FAILED,
          true
        ));
      }, 5 * 60 * 1000);
    });
  }
  
  /**
   * Generate filename based on template
   */
  async generateFilename(sessionId, item) {
    const session = await this.sessionManager.getSession(sessionId);
    const settings = await StorageManager.getSettings();
    
    const template = settings.namingTemplate || '{username}_{date}_{index}';
    const extension = item.type === 'video' ? 'mp4' : 'jpg';
    
    // Create folder name
    const folderName = `Instagram_${session.username}_${session.createdAt}`;
    
    // Apply folder organization
    let path = folderName;
    
    if (settings.organizeByDate) {
      const date = new Date(item.timestamp || Date.now());
      const dateStr = date.toISOString().split('T')[0];
      path += `/${dateStr}`;
    }
    
    if (settings.organizeByType) {
      path += `/${item.type}s`;
    }
    
    // Generate filename from template
    const filename = this.applyNamingTemplate(template, {
      username: session.username,
      date: new Date(item.timestamp || Date.now()).toISOString().split('T')[0],
      time: new Date(item.timestamp || Date.now()).toTimeString().split(' ')[0].replace(/:/g, '-'),
      index: String(item.index).padStart(4, '0'),
      likes: item.likes || 0,
      type: item.type,
      postid: item.postId || 'unknown',
      caption: this.sanitizeCaption(item.caption || '')
    });
    
    return `${path}/${filename}.${extension}`;
  }
  
  /**
   * Apply naming template
   */
  applyNamingTemplate(template, variables) {
    let filename = template;
    
    Object.keys(variables).forEach(key => {
      const placeholder = `{${key}}`;
      filename = filename.replace(new RegExp(placeholder, 'g'), variables[key]);
    });
    
    return Helpers.sanitizeFilename(filename);
  }
  
  /**
   * Sanitize caption for filename
   */
  sanitizeCaption(caption) {
    if (!caption) return 'no-caption';
    
    return caption
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30)
      .toLowerCase();
  }
  
  /**
   * Check if URL is duplicate
   */
  async isDuplicate(url) {
    // Check in-memory history
    if (this.downloadHistory.has(url)) {
      return true;
    }
    
    // Check storage
    const inStorage = await StorageManager.isInHistory(url);
    
    return inStorage;
  }
  
  /**
   * Pause download
   */
  async pauseDownload(sessionId) {
    await this.sessionManager.pauseSession(sessionId);
    
    // Cancel active downloads for this session
    for (const [key, download] of this.activeDownloads) {
      if (download.sessionId === sessionId) {
        // Chrome doesn't support pausing, so we cancel
        // Item will be marked for retry when resumed
        this.activeDownloads.delete(key);
      }
    }
    
    Logger.info('Download paused', { sessionId });
  }
  
  /**
   * Resume download
   */
  async resumeDownload(sessionId) {
    await this.sessionManager.resumeSession(sessionId);
    this.processQueue(sessionId);
    
    Logger.info('Download resumed', { sessionId });
  }
  
  /**
   * Cancel download
   */
  async cancelDownload(sessionId) {
    await this.sessionManager.cancelSession(sessionId);
    
    // Cancel all active downloads for this session
    for (const [key, download] of this.activeDownloads) {
      if (download.sessionId === sessionId) {
        this.activeDownloads.delete(key);
      }
    }
    
    Logger.info('Download cancelled', { sessionId });
  }
  
  /**
   * Setup download event listeners
   */
  setupDownloadListeners() {
    // Listen for download state changes
    chrome.downloads.onChanged.addListener((downloadDelta) => {
      if (downloadDelta.state) {
        Logger.debug('Download state changed', {
          downloadId: downloadDelta.id,
          state: downloadDelta.state.current
        });
      }
      
      if (downloadDelta.error) {
        Logger.warn('Download error', {
          downloadId: downloadDelta.id,
          error: downloadDelta.error.current
        });
      }
    });
  }
  
  /**
   * Show completion notification
   */
  showCompletionNotification(session) {
    const completed = session.completedItems.length;
    const failed = session.failedItems.length;
    
    let message = `Successfully downloaded ${completed} item${completed !== 1 ? 's' : ''}`;
    
    if (failed > 0) {
      message += ` (${failed} failed)`;
    }
    
    message += ` from @${session.username}`;
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Download Complete! 🎉',
      message: message,
      priority: 2
    });
    
    Logger.info('Completion notification shown', {
      sessionId: session.sessionId,
      completed,
      failed
    });
  }
  
  /**
   * Get download statistics
   */
  async getDownloadStats() {
    return {
      active: this.activeDownloads.size,
      maxConcurrent: this.maxConcurrent,
      queueSize: this.downloadQueue.length,
      historySize: this.downloadHistory.size
    };
  }
  
  /**
   * Update settings
   */
  async updateSettings(settings) {
    if (settings.concurrentDownloads) {
      this.maxConcurrent = settings.concurrentDownloads;
      Logger.info('Download concurrency updated', {
        maxConcurrent: this.maxConcurrent
      });
    }
  }
}


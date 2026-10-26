/**
 * Session Management System
 * Handles download sessions, progress tracking, and crash recovery
 */

import { Logger } from '../core/logger.js';
import { StorageManager } from '../core/storage-manager.js';
import { Helpers } from '../utils/helpers.js';

export class SessionManager {
  constructor() {
    this.currentSession = null;
    this.sessionCache = new Map();
  }
  
  /**
   * Initialize session manager
   */
  async init() {
    // Load current session if exists
    const currentSession = await StorageManager.getCurrentSession();
    
    if (currentSession && currentSession.status === 'active') {
      this.currentSession = currentSession;
      Logger.info('Resumed active session', {
        sessionId: currentSession.sessionId,
        pending: currentSession.pendingItems.length
      });
    }
    
    // Schedule cleanup
    this.scheduleCleanup();
  }
  
  /**
   * Create a new download session
   */
  async createSession(mediaItems, metadata = {}) {
    const sessionId = Helpers.generateId('session_');
    
    const session = {
      sessionId,
      username: metadata.username || 'unknown',
      profileUrl: metadata.profileUrl || '',
      totalItems: mediaItems.length,
      completedItems: [],
      failedItems: [],
      skippedItems: [],
      pendingItems: mediaItems.map((item, index) => ({
        ...item,
        index,
        status: 'pending',
        retryCount: 0,
        addedAt: Date.now()
      })),
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      lastUpdated: Date.now(),
      status: 'created', // created, active, paused, completed, cancelled, failed
      settings: await StorageManager.getSettings(),
      stats: {
        totalBytes: 0,
        downloadSpeed: 0,
        estimatedTimeRemaining: 0,
        errors: []
      }
    };
    
    await StorageManager.saveSession(session);
    await StorageManager.setCurrentSession(sessionId);
    
    this.currentSession = session;
    this.sessionCache.set(sessionId, session);
    
    Logger.info('Session created', {
      sessionId,
      totalItems: mediaItems.length,
      username: metadata.username
    });
    
    return session;
  }
  
  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    // Check cache first
    if (this.sessionCache.has(sessionId)) {
      return this.sessionCache.get(sessionId);
    }
    
    // Load from storage
    const session = await StorageManager.getSession(sessionId);
    
    if (session) {
      this.sessionCache.set(sessionId, session);
    }
    
    return session;
  }
  
  /**
   * Update session
   */
  async updateSession(sessionId, updates) {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      Logger.warn('Session not found for update', { sessionId });
      return null;
    }
    
    // Apply updates
    Object.assign(session, updates, {
      lastUpdated: Date.now()
    });
    
    // Save to storage
    await StorageManager.saveSession(session);
    
    // Update cache
    this.sessionCache.set(sessionId, session);
    
    // Notify listeners
    this.notifySessionUpdate(session);
    
    return session;
  }
  
  /**
   * Start session
   */
  async startSession(sessionId) {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    if (session.status !== 'created' && session.status !== 'paused') {
      throw new Error(`Cannot start session with status: ${session.status}`);
    }
    
    await this.updateSession(sessionId, {
      status: 'active',
      startedAt: session.startedAt || Date.now()
    });
    
    Logger.info('Session started', { sessionId });
    
    return session;
  }
  
  /**
   * Pause session
   */
  async pauseSession(sessionId) {
    await this.updateSession(sessionId, {
      status: 'paused'
    });
    
    Logger.info('Session paused', { sessionId });
  }
  
  /**
   * Resume session
   */
  async resumeSession(sessionId) {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    if (session.status !== 'paused') {
      throw new Error(`Cannot resume session with status: ${session.status}`);
    }
    
    // Reset any items that were downloading when paused
    session.pendingItems.forEach(item => {
      if (item.status === 'downloading') {
        item.status = 'pending';
      }
    });
    
    await this.updateSession(sessionId, {
      status: 'active',
      pendingItems: session.pendingItems
    });
    
    Logger.info('Session resumed', { sessionId });
    
    return session;
  }
  
  /**
   * Cancel session
   */
  async cancelSession(sessionId) {
    await this.updateSession(sessionId, {
      status: 'cancelled',
      completedAt: Date.now()
    });
    
    Logger.info('Session cancelled', { sessionId });
  }
  
  /**
   * Complete session
   */
  async completeSession(sessionId) {
    const session = await this.getSession(sessionId);
    
    await this.updateSession(sessionId, {
      status: 'completed',
      completedAt: Date.now()
    });
    
    // Update statistics
    await this.updateSessionStats(session);
    
    // Clear current session
    const currentSessionId = await StorageManager.get('currentSession');
    if (currentSessionId === sessionId) {
      await StorageManager.remove('currentSession');
      this.currentSession = null;
    }
    
    Logger.info('Session completed', {
      sessionId,
      completed: session.completedItems.length,
      failed: session.failedItems.length,
      skipped: session.skippedItems.length
    });
  }
  
  /**
   * Mark item as completed
   */
  async markItemCompleted(sessionId, itemIndex, downloadInfo = {}) {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      Logger.warn('Session not found', { sessionId });
      return;
    }
    
    // Find and remove from pending
    const itemIdx = session.pendingItems.findIndex(item => item.index === itemIndex);
    
    if (itemIdx === -1) {
      Logger.warn('Item not found in pending list', { sessionId, itemIndex });
      return;
    }
    
    const item = session.pendingItems.splice(itemIdx, 1)[0];
    
    // Update item
    item.status = 'completed';
    item.completedAt = Date.now();
    item.downloadId = downloadInfo.downloadId;
    item.fileSize = downloadInfo.fileSize || 0;
    item.downloadDuration = downloadInfo.duration || 0;
    
    // Add to completed
    session.completedItems.push(item);
    
    // Update stats
    session.stats.totalBytes += item.fileSize || 0;
    
    // Save session
    await StorageManager.saveSession(session);
    this.sessionCache.set(sessionId, session);
    
    // Add to history
    await StorageManager.addToHistory({
      url: item.url,
      filename: item.filename,
      type: item.type,
      username: session.username,
      fileSize: item.fileSize,
      sessionId: sessionId
    });
    
    // Notify progress
    this.notifyProgress(session);
    
    Logger.debug('Item marked as completed', {
      sessionId,
      itemIndex,
      filename: item.filename
    });
  }
  
  /**
   * Mark item as failed
   */
  async markItemFailed(sessionId, itemIndex, error) {
    const session = await this.getSession(sessionId);
    
    if (!session) return;
    
    const itemIdx = session.pendingItems.findIndex(item => item.index === itemIndex);
    
    if (itemIdx === -1) return;
    
    const item = session.pendingItems[itemIdx];
    
    // Increment retry count
    item.retryCount++;
    item.lastError = error.message || 'Unknown error';
    item.lastAttemptAt = Date.now();
    
    // Check if max retries reached
    const maxRetries = session.settings?.maxRetries || 3;
    
    if (item.retryCount >= maxRetries) {
      // Move to failed
      session.pendingItems.splice(itemIdx, 1);
      item.status = 'failed';
      session.failedItems.push(item);
      
      Logger.warn('Item failed after max retries', {
        sessionId,
        itemIndex,
        retryCount: item.retryCount,
        error: item.lastError
      });
    } else {
      // Keep in pending for retry
      item.status = 'pending';
      
      Logger.debug('Item marked for retry', {
        sessionId,
        itemIndex,
        retryCount: item.retryCount
      });
    }
    
    // Update error stats
    session.stats.errors.push({
      itemIndex,
      error: error.message,
      timestamp: Date.now(),
      retryCount: item.retryCount
    });
    
    // Keep only recent errors
    if (session.stats.errors.length > 50) {
      session.stats.errors = session.stats.errors.slice(-50);
    }
    
    await StorageManager.saveSession(session);
    this.sessionCache.set(sessionId, session);
    
    this.notifyProgress(session);
  }
  
  /**
   * Mark item as skipped
   */
  async markItemSkipped(sessionId, itemIndex, reason = '') {
    const session = await this.getSession(sessionId);
    
    if (!session) return;
    
    const itemIdx = session.pendingItems.findIndex(item => item.index === itemIndex);
    
    if (itemIdx === -1) return;
    
    const item = session.pendingItems.splice(itemIdx, 1)[0];
    
    item.status = 'skipped';
    item.skippedAt = Date.now();
    item.skipReason = reason;
    
    session.skippedItems.push(item);
    
    await StorageManager.saveSession(session);
    this.sessionCache.set(sessionId, session);
    
    Logger.debug('Item skipped', { sessionId, itemIndex, reason });
  }
  
  /**
   * Get next item to download
   */
  async getNextItem(sessionId) {
    const session = await this.getSession(sessionId);
    
    if (!session || session.status !== 'active') {
      return null;
    }
    
    // Find first pending item
    const nextItem = session.pendingItems.find(item => item.status === 'pending');
    
    if (nextItem) {
      nextItem.status = 'downloading';
      nextItem.downloadStartedAt = Date.now();
      
      await StorageManager.saveSession(session);
      this.sessionCache.set(sessionId, session);
    }
    
    return nextItem;
  }
  
  /**
   * Get session progress
   */
  async getProgress(sessionId) {
    const session = await this.getSession(sessionId);
    
    if (!session) return null;
    
    const total = session.totalItems;
    const completed = session.completedItems.length;
    const failed = session.failedItems.length;
    const skipped = session.skippedItems.length;
    const pending = session.pendingItems.length;
    
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Calculate ETA
    let eta = null;
    if (completed > 0 && pending > 0) {
      const elapsed = Date.now() - (session.startedAt || session.createdAt);
      const avgTimePerItem = elapsed / completed;
      const remainingTime = avgTimePerItem * pending;
      eta = remainingTime;
    }
    
    // Calculate speed
    let speed = 0;
    if (session.stats.totalBytes > 0 && session.startedAt) {
      const elapsed = (Date.now() - session.startedAt) / 1000; // seconds
      speed = session.stats.totalBytes / elapsed; // bytes per second
    }
    
    return {
      sessionId,
      total,
      completed,
      failed,
      skipped,
      pending,
      percentage,
      eta,
      speed,
      status: session.status,
      totalBytes: session.stats.totalBytes
    };
  }
  
  /**
   * Get all sessions with filters
   */
  async getAllSessions(filters = {}) {
    const sessions = await StorageManager.getSessions();
    
    let sessionList = Object.values(sessions);
    
    // Apply filters
    if (filters.status) {
      sessionList = sessionList.filter(s => s.status === filters.status);
    }
    
    if (filters.username) {
      sessionList = sessionList.filter(s => 
        s.username.toLowerCase().includes(filters.username.toLowerCase())
      );
    }
    
    if (filters.since) {
      sessionList = sessionList.filter(s => s.createdAt >= filters.since);
    }
    
    // Sort by most recent
    sessionList.sort((a, b) => b.createdAt - a.createdAt);
    
    return sessionList;
  }
  
  /**
   * Delete session
   */
  async deleteSession(sessionId) {
    await StorageManager.deleteSession(sessionId);
    this.sessionCache.delete(sessionId);
    
    Logger.info('Session deleted', { sessionId });
  }
  
  /**
   * Retry failed items
   */
  async retryFailedItems(sessionId) {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Move failed items back to pending
    const retriableItems = session.failedItems.map(item => ({
      ...item,
      status: 'pending',
      retryCount: 0,
      lastError: null
    }));
    
    session.pendingItems.push(...retriableItems);
    session.failedItems = [];
    
    if (session.status === 'completed') {
      session.status = 'active';
    }
    
    await StorageManager.saveSession(session);
    this.sessionCache.set(sessionId, session);
    
    Logger.info('Retrying failed items', {
      sessionId,
      count: retriableItems.length
    });
    
    return session;
  }
  
  /**
   * Export session data
   */
  async exportSession(sessionId) {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    const exportData = {
      sessionId: session.sessionId,
      username: session.username,
      profileUrl: session.profileUrl,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      status: session.status,
      progress: await this.getProgress(sessionId),
      items: {
        completed: session.completedItems.map(item => ({
          filename: item.filename,
          url: item.url,
          type: item.type,
          fileSize: item.fileSize
        })),
        failed: session.failedItems.map(item => ({
          filename: item.filename,
          url: item.url,
          type: item.type,
          error: item.lastError
        }))
      }
    };
    
    return exportData;
  }
  
  /**
   * Update session statistics
   */
  async updateSessionStats(session) {
    const stats = await StorageManager.getStats();
    
    stats.totalDownloads += session.completedItems.length;
    stats.totalImages += session.completedItems.filter(i => i.type === 'image').length;
    stats.totalVideos += session.completedItems.filter(i => i.type === 'video').length;
    stats.totalSize += session.stats.totalBytes;
    stats.sessionsCompleted += 1;
    stats.maxSessionDownloads = Math.max(
      stats.maxSessionDownloads,
      session.completedItems.length
    );
    stats.lastDownload = Date.now();
    
    if (!stats.firstDownload) {
      stats.firstDownload = session.createdAt;
    }
    
    // Check if downloaded at night (between 00:00 and 06:00)
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 6) {
      stats.nightDownloads += 1;
    }
    
    await StorageManager.updateStats(stats);
  }
  
  /**
   * Schedule automatic cleanup
   */
  scheduleCleanup() {
    // Run cleanup every 24 hours
    chrome.alarms.create('session_cleanup', {
      periodInMinutes: 24 * 60
    });
    
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'session_cleanup') {
        this.cleanup();
      }
    });
  }
  
  /**
   * Cleanup old sessions
   */
  async cleanup() {
    const sessions = await StorageManager.getSessions();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    let cleaned = 0;
    
    for (const sessionId in sessions) {
      const session = sessions[sessionId];
      
      // Delete completed sessions older than 7 days
      if (session.status === 'completed' && session.completedAt < sevenDaysAgo) {
        await this.deleteSession(sessionId);
        cleaned++;
      }
      
      // Delete cancelled sessions older than 24 hours
      if (session.status === 'cancelled' && session.lastUpdated < Date.now() - 24 * 60 * 60 * 1000) {
        await this.deleteSession(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      Logger.info('Session cleanup completed', { cleaned });
    }
  }
  
  /**
   * Notify session update to UI
   */
  notifySessionUpdate(session) {
    chrome.runtime.sendMessage({
      type: 'SESSION_UPDATED',
      payload: session
    }).catch(() => {
      // No listeners, that's ok
    });
  }
  
  /**
   * Notify download progress
   */
  async notifyProgress(session) {
    const progress = await this.getProgress(session.sessionId);
    
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_PROGRESS',
      payload: progress
    }).catch(() => {});
  }
}

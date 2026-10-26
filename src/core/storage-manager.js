/**
 * Centralized Storage Management System
 * Handles all data persistence with encryption, caching, and migration
 */

import { Security } from '../utils/security.js';
import { Logger } from './logger.js';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../utils/constants.js';
import { Helpers } from '../utils/helpers.js';

export class StorageManager {
  static cache = new Map();
  static cacheExpiry = new Map();
  static CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Initialize storage system
   */
  static async init() {
    await this.migrate();
    await this.loadDefaults();
    this.setupChangeListener();
    Logger.info('Storage manager initialized');
  }
  
  /**
   * Get item from storage with caching
   */
  static async get(key, options = {}) {
    const {
      useCache = true,
      decrypt = false,
      defaultValue = null
    } = options;
    
    // Check cache first
    if (useCache && this.isCacheValid(key)) {
      return this.cache.get(key);
    }
    
    try {
      const result = await chrome.storage.local.get(key);
      let value = result[key];
      
      if (value === undefined) {
        return defaultValue;
      }
      
      // Decrypt if needed
      if (decrypt && value) {
        value = await Security.decrypt(value);
      }
      
      // Update cache
      if (useCache) {
        this.updateCache(key, value);
      }
      
      return value;
    } catch (error) {
      Logger.error('Storage get failed', { key }, error);
      return defaultValue;
    }
  }
  
  /**
   * Set item in storage
   */
  static async set(key, value, options = {}) {
    const {
      encrypt = false,
      updateCache = true
    } = options;
    
    try {
      let dataToStore = value;
      
      // Encrypt if needed
      if (encrypt && value) {
        dataToStore = await Security.encrypt(value);
      }
      
      await chrome.storage.local.set({ [key]: dataToStore });
      
      // Update cache
      if (updateCache) {
        this.updateCache(key, value);
      }
      
      Logger.debug('Storage set', { key });
      return true;
    } catch (error) {
      Logger.error('Storage set failed', { key }, error);
      throw error;
    }
  }
  
  /**
   * Get multiple items at once
   */
  static async getMultiple(keys, options = {}) {
    try {
      const result = await chrome.storage.local.get(keys);
      
      if (options.decrypt) {
        for (const key of keys) {
          if (result[key]) {
            result[key] = await Security.decrypt(result[key]);
          }
        }
      }
      
      return result;
    } catch (error) {
      Logger.error('Storage getMultiple failed', { keys }, error);
      return {};
    }
  }
  
  /**
   * Set multiple items at once
   */
  static async setMultiple(items, options = {}) {
    try {
      const dataToStore = { ...items };
      
      if (options.encrypt) {
        for (const key in dataToStore) {
          if (dataToStore[key]) {
            dataToStore[key] = await Security.encrypt(dataToStore[key]);
          }
        }
      }
      
      await chrome.storage.local.set(dataToStore);
      
      // Update cache
      for (const key in items) {
        this.updateCache(key, items[key]);
      }
      
      Logger.debug('Storage setMultiple', { keys: Object.keys(items) });
      return true;
    } catch (error) {
      Logger.error('Storage setMultiple failed', { keys: Object.keys(items) }, error);
      throw error;
    }
  }
  
  /**
   * Remove item from storage
   */
  static async remove(key) {
    try {
      await chrome.storage.local.remove(key);
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      
      Logger.debug('Storage remove', { key });
      return true;
    } catch (error) {
      Logger.error('Storage remove failed', { key }, error);
      return false;
    }
  }
  
  /**
   * Clear all storage
   */
  static async clear() {
    try {
      await chrome.storage.local.clear();
      this.cache.clear();
      this.cacheExpiry.clear();
      
      Logger.info('Storage cleared');
      return true;
    } catch (error) {
      Logger.error('Storage clear failed', {}, error);
      return false;
    }
  }
  
  /**
   * Get storage usage
   */
  static async getUsage() {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default
      
      return {
        used: bytesInUse,
        total: quota,
        available: quota - bytesInUse,
        percentage: Math.round((bytesInUse / quota) * 100),
        usedFormatted: Helpers.formatBytes(bytesInUse),
        totalFormatted: Helpers.formatBytes(quota),
        availableFormatted: Helpers.formatBytes(quota - bytesInUse)
      };
    } catch (error) {
      Logger.error('Failed to get storage usage', {}, error);
      return null;
    }
  }
  
  /**
   * Check if storage is nearly full
   */
  static async isStorageNearFull(threshold = 0.9) {
    const usage = await this.getUsage();
    return usage ? usage.percentage >= threshold * 100 : false;
  }
  
  /**
   * Cache management
   */
  static updateCache(key, value) {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }
  
  static isCacheValid(key) {
    if (!this.cache.has(key)) return false;
    
    const expiry = this.cacheExpiry.get(key);
    if (Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return false;
    }
    
    return true;
  }
  
  static invalidateCache(key) {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }
  
  static clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
  
  /**
   * Settings management
   */
  static async getSettings() {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    return settings || DEFAULT_SETTINGS;
  }
  
  static async updateSettings(updates) {
    const currentSettings = await this.getSettings();
    const newSettings = Helpers.deepMerge(currentSettings, updates);
    
    await this.set(STORAGE_KEYS.SETTINGS, newSettings);
    
    // Notify listeners
    this.notifySettingsChange(newSettings);
    
    Logger.info('Settings updated', { updates });
    return newSettings;
  }
  
  static async resetSettings() {
    await this.set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    Logger.info('Settings reset to defaults');
    return DEFAULT_SETTINGS;
  }
  
  /**
   * Credentials management (encrypted)
   */
  static async getCredentials() {
    return await this.get(STORAGE_KEYS.CREDENTIALS, {
      decrypt: true,
      defaultValue: {}
    });
  }
  
  static async setCredentials(credentials) {
    await this.set(STORAGE_KEYS.CREDENTIALS, credentials, {
      encrypt: true,
      updateCache: false // Don't cache sensitive data
    });
    
    Logger.info('Credentials updated (encrypted)');
  }
  
  static async clearCredentials() {
    await this.remove(STORAGE_KEYS.CREDENTIALS);
    Logger.info('Credentials cleared');
  }
  
  /**
   * Session management
   */
  static async getSessions() {
    return await this.get(STORAGE_KEYS.SESSIONS, { defaultValue: {} });
  }
  
  static async getSession(sessionId) {
    const sessions = await this.getSessions();
    return sessions[sessionId] || null;
  }
  
  static async saveSession(session) {
    const sessions = await this.getSessions();
    sessions[session.sessionId] = session;
    
    await this.set(STORAGE_KEYS.SESSIONS, sessions);
    Logger.debug('Session saved', { sessionId: session.sessionId });
  }
  
  static async updateSession(sessionId, updates) {
    const sessions = await this.getSessions();
    
    if (sessions[sessionId]) {
      sessions[sessionId] = {
        ...sessions[sessionId],
        ...updates,
        lastUpdated: Date.now()
      };
      
      await this.set(STORAGE_KEYS.SESSIONS, sessions);
      Logger.debug('Session updated', { sessionId });
    }
  }
  
  static async deleteSession(sessionId) {
    const sessions = await this.getSessions();
    delete sessions[sessionId];
    
    await this.set(STORAGE_KEYS.SESSIONS, sessions);
    Logger.debug('Session deleted', { sessionId });
  }
  
  static async getCurrentSession() {
    const currentSessionId = await this.get(STORAGE_KEYS.CURRENT_SESSION);
    if (!currentSessionId) return null;
    
    return await this.getSession(currentSessionId);
  }
  
  static async setCurrentSession(sessionId) {
    await this.set(STORAGE_KEYS.CURRENT_SESSION, sessionId);
  }
  
  /**
   * Download history management
   */
  static async getHistory(options = {}) {
    const {
      limit = 1000,
      offset = 0,
      filter = null
    } = options;
    
    let history = await this.get(STORAGE_KEYS.HISTORY, { defaultValue: [] });
    
    // Apply filter
    if (filter) {
      history = history.filter(filter);
    }
    
    // Apply pagination
    const total = history.length;
    history = history.slice(offset, offset + limit);
    
    return {
      items: history,
      total,
      hasMore: offset + limit < total
    };
  }
  
  static async addToHistory(item) {
    const history = await this.get(STORAGE_KEYS.HISTORY, { defaultValue: [] });
    
    // Add to beginning
    history.unshift({
      ...item,
      downloadedAt: Date.now(),
      id: Helpers.generateId('hist_')
    });
    
    // Keep only recent items
    const trimmed = history.slice(0, 1000);
    
    await this.set(STORAGE_KEYS.HISTORY, trimmed);
    Logger.debug('Item added to history', { itemId: item.id });
  }
  
  static async searchHistory(query) {
    const history = await this.get(STORAGE_KEYS.HISTORY, { defaultValue: [] });
    
    const lowerQuery = query.toLowerCase();
    return history.filter(item =>
      item.username?.toLowerCase().includes(lowerQuery) ||
      item.filename?.toLowerCase().includes(lowerQuery) ||
      item.caption?.toLowerCase().includes(lowerQuery)
    );
  }
  
  static async isInHistory(url) {
    const history = await this.get(STORAGE_KEYS.HISTORY, { defaultValue: [] });
    return history.some(item => item.url === url);
  }
  
  static async clearHistory() {
    await this.set(STORAGE_KEYS.HISTORY, []);
    Logger.info('History cleared');
  }
  
  /**
   * Statistics management
   */
  static async getStats() {
    return await this.get(STORAGE_KEYS.STATS, {
      defaultValue: {
        totalDownloads: 0,
        totalImages: 0,
        totalVideos: 0,
        totalSize: 0,
        sessionsCompleted: 0,
        maxSessionDownloads: 0,
        smartFilterUses: 0,
        nightDownloads: 0,
        firstDownload: null,
        lastDownload: null
      }
    });
  }
  
  static async updateStats(updates) {
    const stats = await this.getStats();
    const newStats = { ...stats, ...updates };
    
    await this.set(STORAGE_KEYS.STATS, newStats);
    Logger.debug('Stats updated', { updates });
    
    return newStats;
  }
  
  static async incrementStat(key, amount = 1) {
    const stats = await this.getStats();
    stats[key] = (stats[key] || 0) + amount;
    
    await this.set(STORAGE_KEYS.STATS, stats);
    return stats[key];
  }
  
  /**
   * Achievements management
   */
  static async getAchievements() {
    return await this.get(STORAGE_KEYS.ACHIEVEMENTS, {
      defaultValue: {
        unlocked: [],
        progress: {}
      }
    });
  }
  
  static async unlockAchievement(achievementId) {
    const achievements = await this.getAchievements();
    
    if (!achievements.unlocked.includes(achievementId)) {
      achievements.unlocked.push(achievementId);
      achievements.progress[achievementId] = {
        unlockedAt: Date.now()
      };
      
      await this.set(STORAGE_KEYS.ACHIEVEMENTS, achievements);
      Logger.info('Achievement unlocked', { achievementId });
      
      return true;
    }
    
    return false;
  }
  
  static async isAchievementUnlocked(achievementId) {
    const achievements = await this.getAchievements();
    return achievements.unlocked.includes(achievementId);
  }
  
  /**
   * Data migration
   */
  static async migrate() {
    const version = await this.get('_storage_version', { defaultValue: '0.0.0' });
    const currentVersion = chrome.runtime.getManifest().version;
    
    if (Helpers.compareVersions(version, currentVersion) >= 0) {
      return; // Already up to date
    }
    
    Logger.info('Running storage migration', {
      from: version,
      to: currentVersion
    });
    
    // Migration logic for different versions
    if (Helpers.compareVersions(version, '1.0.0') < 0) {
      await this.migrateV1();
    }
    
    if (Helpers.compareVersions(version, '2.0.0') < 0) {
      await this.migrateV2();
    }
    
    // Update version
    await this.set('_storage_version', currentVersion);
    Logger.info('Storage migration complete');
  }
  
  static async migrateV1() {
    // Migrate old settings format
    const oldSettings = await this.get('settings');
    if (oldSettings) {
      const newSettings = {
        ...DEFAULT_SETTINGS,
        ...oldSettings
      };
      await this.set(STORAGE_KEYS.SETTINGS, newSettings);
    }
  }
  
  static async migrateV2() {
    // Encrypt existing credentials
    const credentials = await this.get(STORAGE_KEYS.CREDENTIALS);
    if (credentials && !credentials.iv) { // Not encrypted yet
      await this.setCredentials(credentials);
    }
  }
  
  /**
   * Load default values
   */
  static async loadDefaults() {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    if (!settings) {
      await this.set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
      Logger.info('Default settings loaded');
    }
  }
  
  /**
   * Setup storage change listener
   */
  static setupChangeListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      
      for (const key in changes) {
        const { oldValue, newValue } = changes[key];
        
        // Invalidate cache
        this.invalidateCache(key);
        
        // Log change
        Logger.debug('Storage changed', {
          key,
          hasOldValue: !!oldValue,
          hasNewValue: !!newValue
        });
        
        // Emit event
        this.emitChange(key, newValue, oldValue);
      }
    });
  }
  
  /**
   * Event system for storage changes
   */
  static listeners = new Map();
  
  static onChange(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    
    this.listeners.get(key).push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }
  
  static emitChange(key, newValue, oldValue) {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          Logger.error('Storage change listener error', { key }, error);
        }
      });
    }
  }
  
  static notifySettingsChange(settings) {
    chrome.runtime.sendMessage({
      type: 'SETTINGS_CHANGED',
      payload: settings
    }).catch(() => {
      // No listeners, that's ok
    });
  }
  
  /**
   * Backup and restore
   */
  static async exportData() {
    try {
      const allData = await chrome.storage.local.get(null);
      
      // Remove sensitive data
      const exportData = { ...allData };
      delete exportData[STORAGE_KEYS.CREDENTIALS];
      delete exportData._encryption_key;
      
      return {
        version: chrome.runtime.getManifest().version,
        exportedAt: Date.now(),
        data: exportData
      };
    } catch (error) {
      Logger.error('Export data failed', {}, error);
      throw error;
    }
  }
  
  static async importData(importedData) {
    try {
      if (!importedData.data || !importedData.version) {
        throw new Error('Invalid import data format');
      }
      
      // Validate version compatibility
      const currentVersion = chrome.runtime.getManifest().version;
      if (Helpers.compareVersions(importedData.version, currentVersion) > 0) {
        throw new Error('Import data is from a newer version');
      }
      
      // Clear existing data (except credentials)
      const credentials = await this.getCredentials();
      await this.clear();
      
      // Import data
      await chrome.storage.local.set(importedData.data);
      
      // Restore credentials
      if (Object.keys(credentials).length > 0) {
        await this.setCredentials(credentials);
      }
      
      // Run migration if needed
      await this.migrate();
      
      Logger.info('Data imported successfully');
      return true;
    } catch (error) {
      Logger.error('Import data failed', {}, error);
      throw error;
    }
  }
  
  /**
   * Cleanup old data
   */
  static async cleanup() {
    Logger.info('Starting storage cleanup');
    
    // Clean old sessions (7 days)
    const sessions = await this.getSessions();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    let cleanedSessions = 0;
    for (const sessionId in sessions) {
      const session = sessions[sessionId];
      if (session.status === 'completed' && session.completedAt < sevenDaysAgo) {
        delete sessions[sessionId];
        cleanedSessions++;
      }
    }
    
    if (cleanedSessions > 0) {
      await this.set(STORAGE_KEYS.SESSIONS, sessions);
      Logger.info('Cleaned old sessions', { count: cleanedSessions });
    }
    
    // Clean old history (30 days)
    const history = await this.get(STORAGE_KEYS.HISTORY, { defaultValue: [] });
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const cleanedHistory = history.filter(item => item.downloadedAt > thirtyDaysAgo);
    
    if (cleanedHistory.length < history.length) {
      await this.set(STORAGE_KEYS.HISTORY, cleanedHistory);
      Logger.info('Cleaned old history', {
        removed: history.length - cleanedHistory.length
      });
    }
    
    // Clean old logs (7 days)
    const logs = await this.get('logs', { defaultValue: [] });
    const cleanedLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp).getTime();
      return logDate > sevenDaysAgo;
    });
    
    if (cleanedLogs.length < logs.length) {
      await this.set('logs', cleanedLogs);
      Logger.info('Cleaned old logs', {
        removed: logs.length - cleanedLogs.length
      });
    }
    
    Logger.info('Storage cleanup complete');
  }
}


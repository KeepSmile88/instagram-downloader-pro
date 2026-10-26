/**
 * Achievement System
 * Tracks user progress and unlocks achievements
 */

import { Logger } from '../core/logger.js';
import { StorageManager } from '../core/storage-manager.js';
import { ACHIEVEMENTS } from '../utils/constants.js';

export class AchievementSystem {
  constructor() {
    this.checking = false;
  }
  
  /**
   * Initialize achievement system
   */
  async init() {
    Logger.info('Achievement system initialized');
  }
  
  /**
   * Check all achievements
   */
  async checkAll() {
    if (this.checking) return;
    
    this.checking = true;
    
    try {
      const stats = await StorageManager.getStats();
      const achievements = await StorageManager.getAchievements();
      
      for (const achievementId in ACHIEVEMENTS) {
        const achievement = ACHIEVEMENTS[achievementId];
        
        // Skip if already unlocked
        if (achievements.unlocked.includes(achievementId)) {
          continue;
        }
        
        // Check condition
        if (achievement.condition(stats)) {
          await this.unlock(achievementId);
        }
      }
    } catch (error) {
      Logger.error('Achievement check failed', {}, error);
    } finally {
      this.checking = false;
    }
  }
  
  /**
   * Unlock achievement
   */
  async unlock(achievementId) {
    const unlocked = await StorageManager.unlockAchievement(achievementId);
    
    if (unlocked) {
      const achievement = ACHIEVEMENTS[achievementId];
      
      // Show notification
      this.showUnlockNotification(achievement);
      
      Logger.info('Achievement unlocked', { achievementId });
    }
  }
  
  /**
   * Show unlock notification
   */
  showUnlockNotification(achievement) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🏆 Achievement Unlocked!',
      message: `${achievement.name}\n${achievement.description}`,
      priority: 2
    });
    
    // Send message to UI
    chrome.runtime.sendMessage({
      type: 'ACHIEVEMENT_UNLOCKED',
      payload: { achievement }
    }).catch(() => {});
  }
  
  /**
   * Track event
   */
  async trackEvent(eventType, data = {}) {
    switch (eventType) {
      case 'download_complete':
        await StorageManager.incrementStat('totalDownloads');
        if (data.type === 'image') {
          await StorageManager.incrementStat('totalImages');
        } else if (data.type === 'video') {
          await StorageManager.incrementStat('totalVideos');
        }
        break;
        
      case 'smart_filter_used':
        await StorageManager.incrementStat('smartFilterUses');
        break;
        
      case 'session_completed':
        await StorageManager.incrementStat('sessionsCompleted');
        
        const stats = await StorageManager.getStats();
        if (data.itemCount > stats.maxSessionDownloads) {
          await StorageManager.updateStats({
            maxSessionDownloads: data.itemCount
          });
        }
        break;
    }
    
    // Check achievements after tracking
    await this.checkAll();
  }
}

/**
 * Instagram Profile Scanner
 * Scans and extracts media from Instagram profiles
 */

import { Logger, PerformanceMonitor } from '../core/logger.js';
import { MediaExtractor } from '../core/media-extractor.js';
import { Helpers } from '../utils/helpers.js';

export class ProfileScanner {
  constructor() {
    this.isScanning = false;
    this.mediaLibrary = new Map();
    this.scrollAttempts = 0;
    this.maxScrollAttempts = 100;
    this.lastHeight = 0;
    this.noChangeCount = 0;
    this.observers = [];
  }
  
  /**
   * Start scanning profile
   */
  async scan(options = {}) {
    if (this.isScanning) {
      Logger.warn('Scan already in progress');
      return { success: false, error: 'Scan already in progress' };
    }
    
    this.isScanning = true;
    this.mediaLibrary.clear();
    this.scrollAttempts = 0;
    this.noChangeCount = 0;
    
    PerformanceMonitor.start('profile-scan');
    
    try {
      Logger.info('Starting profile scan', options);
      
      // Initial extraction
      await this.extractVisibleMedia();
      
      // Notify initial progress
      this.notifyProgress();
      
      // Scroll and extract
      await this.scrollAndExtract();
      
      // Final extraction
      await this.extractVisibleMedia();
      
      // Convert to array
      const mediaArray = Array.from(this.mediaLibrary.values());
      
      const duration = PerformanceMonitor.end('profile-scan');
      
      Logger.info('Profile scan completed', {
        totalMedia: mediaArray.length,
        duration: `${(duration / 1000).toFixed(2)}s`,
        scrollAttempts: this.scrollAttempts
      });
      
      return {
        success: true,
        mediaItems: mediaArray,
        stats: {
          total: mediaArray.length,
          images: mediaArray.filter(m => m.type === 'image').length,
          videos: mediaArray.filter(m => m.type === 'video').length,
          duration: duration
        }
      };
    } catch (error) {
      Logger.error('Profile scan failed', {}, error);
      return {
        success: false,
        error: error.message,
        mediaItems: Array.from(this.mediaLibrary.values())
      };
    } finally {
      this.isScanning = false;
      this.cleanup();
    }
  }
  
  /**
   * Extract visible media from page
   */
  async extractVisibleMedia() {
    try {
      // Find all post articles
      const articles = document.querySelectorAll('article[role="presentation"]');
      
      Logger.debug('Extracting from articles', { count: articles.length });
      
      for (const article of articles) {
        const mediaItems = MediaExtractor.extractFromPost(article);
        
        // Add to library (using URL as key to avoid duplicates)
        mediaItems.forEach(item => {
          if (!this.mediaLibrary.has(item.url)) {
            this.mediaLibrary.set(item.url, item);
          }
        });
      }
      
      // Also try extracting from grid (profile page)
      const gridLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      
      for (const link of gridLinks) {
        const img = link.querySelector('img');
        const video = link.querySelector('video');
        
        if (img) {
          const url = img.src || img.dataset.src;
          
          if (url && Helpers.isInstagramMediaUrl(url) && !this.mediaLibrary.has(url)) {
            this.mediaLibrary.set(url, {
              url: url,
              type: video ? 'video' : 'image',
              thumbnail: url,
              filename: `media_${this.mediaLibrary.size}.jpg`,
              postUrl: link.href,
              extractedAt: Date.now()
            });
          }
        }
      }
      
      Logger.debug('Current media count', { count: this.mediaLibrary.size });
    } catch (error) {
      Logger.error('Failed to extract visible media', {}, error);
    }
  }
  
  /**
   * Scroll page and extract new content
   */
  async scrollAndExtract() {
    while (this.scrollAttempts < this.maxScrollAttempts && this.noChangeCount < 3) {
      const beforeCount = this.mediaLibrary.size;
      
      // Scroll down
      window.scrollTo(0, document.body.scrollHeight);
      
      this.scrollAttempts++;
      
      // Wait for content to load
      await Helpers.delay(Helpers.random(1500, 2500));
      
      // Extract new media
      await this.extractVisibleMedia();
      
      const afterCount = this.mediaLibrary.size;
      
      // Check if we found new content
      if (afterCount === beforeCount) {
        this.noChangeCount++;
        Logger.debug('No new content found', {
          attempt: this.scrollAttempts,
          noChangeCount: this.noChangeCount
        });
      } else {
        this.noChangeCount = 0;
        Logger.debug('New content found', {
          before: beforeCount,
          after: afterCount,
          new: afterCount - beforeCount
        });
      }
      
      // Notify progress
      this.notifyProgress();
      
      // Check if reached bottom
      const currentHeight = document.body.scrollHeight;
      if (currentHeight === this.lastHeight) {
        this.noChangeCount++;
      }
      this.lastHeight = currentHeight;
      
      // Stop if no changes for 3 attempts
      if (this.noChangeCount >= 3) {
        Logger.info('Reached end of content or no more items loading');
        break;
      }
    }
    
    if (this.scrollAttempts >= this.maxScrollAttempts) {
      Logger.warn('Max scroll attempts reached', {
        attempts: this.scrollAttempts,
        mediaCount: this.mediaLibrary.size
      });
    }
  }
  
  /**
   * Notify progress to background
   */
  notifyProgress() {
    chrome.runtime.sendMessage({
      type: 'SCAN_PROGRESS',
      payload: {
        found: this.mediaLibrary.size,
        scrollAttempts: this.scrollAttempts,
        isComplete: false
      }
    }).catch(() => {
      // No listener, that's ok
    });
    
    // Also dispatch custom event for page listeners
    window.dispatchEvent(new CustomEvent('igdl:scanProgress', {
      detail: {
        found: this.mediaLibrary.size,
        scrollAttempts: this.scrollAttempts
      }
    }));
  }
  
  /**
   * Stop scanning
   */
  stop() {
    this.isScanning = false;
    this.noChangeCount = 999; // Force stop
    Logger.info('Scan stopped by user');
  }
  
  /**
   * Cleanup
   */
  cleanup() {
    // Disconnect any observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
  
  /**
   * Quick scan (visible content only)
   */
  async quickScan() {
    try {
      Logger.info('Starting quick scan');
      
      await this.extractVisibleMedia();
      
      const mediaArray = Array.from(this.mediaLibrary.values());
      
      Logger.info('Quick scan completed', {
        totalMedia: mediaArray.length
      });
      
      return {
        success: true,
        mediaItems: mediaArray
      };
    } catch (error) {
      Logger.error('Quick scan failed', {}, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Scan single post
   */
  async scanPost(postUrl) {
    try {
      Logger.info('Scanning single post', { postUrl });
      
      // Navigate to post if not already there
      if (window.location.href !== postUrl) {
        window.location.href = postUrl;
        
        // Wait for page load
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve);
          }
        });
      }
      
      // Wait for content
      await Helpers.delay(2000);
      
      // Extract from article
      const article = document.querySelector('article[role="presentation"]');
      
      if (!article) {
        throw new Error('Post article not found');
      }
      
      const mediaItems = MediaExtractor.extractFromPost(article);
      
      Logger.info('Single post scan completed', {
        mediaCount: mediaItems.length
      });
      
      return {
        success: true,
        mediaItems: mediaItems
      };
    } catch (error) {
      Logger.error('Single post scan failed', {}, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Extract from current view (no scrolling)
   */
  extractFromCurrentView() {
    const mediaItems = [];
    
    try {
      // Method 1: From visible articles
      const articles = document.querySelectorAll('article');
      articles.forEach(article => {
        const items = MediaExtractor.extractFromPost(article);
        mediaItems.push(...items);
      });
      
      // Method 2: From shared data
      const sharedDataItems = MediaExtractor.extractFromSharedData();
      mediaItems.push(...sharedDataItems);
      
      // Deduplicate
      const seen = new Set();
      const unique = mediaItems.filter(item => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
      
      Logger.debug('Extracted from current view', {
        total: unique.length
      });
      
      return unique;
    } catch (error) {
      Logger.error('Failed to extract from current view', {}, error);
      return [];
    }
  }
}

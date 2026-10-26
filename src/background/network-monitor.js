/**
 * Network Monitoring System
 * Monitors network conditions and adjusts download behavior
 */

import { Logger } from '../core/logger.js';
import { StorageManager } from '../core/storage-manager.js';

export class NetworkMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.connectionType = 'unknown';
    this.downloadSpeed = 0;
    this.lastSpeedTest = 0;
    this.listeners = new Set();
  }
  
  /**
   * Initialize network monitor
   */
  async init() {
    this.setupListeners();
    await this.detectConnectionType();
    
    // Periodic speed test
    this.scheduleSpeedTests();
    
    Logger.info('Network monitor initialized', {
      online: this.isOnline,
      connectionType: this.connectionType
    });
  }
  
  /**
   * Setup event listeners
   */
  setupListeners() {
    // Online/Offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      Logger.info('Network connection restored');
      this.notifyListeners('online');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      Logger.warn('Network connection lost');
      this.notifyListeners('offline');
    });
    
    // Connection change (if available)
    if (navigator.connection) {
      navigator.connection.addEventListener('change', () => {
        this.detectConnectionType();
      });
    }
  }
  
  /**
   * Detect connection type
   */
  async detectConnectionType() {
    if (navigator.connection) {
      const conn = navigator.connection;
      
      this.connectionType = conn.effectiveType || 'unknown';
      
      Logger.debug('Connection type detected', {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      });
      
      this.notifyListeners('connection-change', {
        type: this.connectionType,
        downlink: conn.downlink,
        rtt: conn.rtt
      });
    }
  }
  
  /**
   * Test download speed
   */
  async testSpeed() {
    if (!this.isOnline) {
      return 0;
    }
    
    try {
      // Use a small image from Instagram CDN
      const testUrl = 'https://www.instagram.com/static/images/ico/favicon.ico/36b3ee2d91ed.png';
      const startTime = Date.now();
      
      const response = await fetch(testUrl + '?_=' + Date.now());
      const blob = await response.blob();
      
      const duration = (Date.now() - startTime) / 1000; // seconds
      const size = blob.size;
      const speed = size / duration; // bytes per second
      
      this.downloadSpeed = speed;
      this.lastSpeedTest = Date.now();
      
      Logger.debug('Speed test completed', {
        speed: `${(speed / 1024).toFixed(2)} KB/s`,
        duration: `${duration.toFixed(2)}s`,
        size: `${size} bytes`
      });
      
      return speed;
    } catch (error) {
      Logger.warn('Speed test failed', {}, error);
      return 0;
    }
  }
  
  /**
   * Schedule periodic speed tests
   */
  scheduleSpeedTests() {
    // Test every 5 minutes
    setInterval(() => {
      if (this.isOnline) {
        this.testSpeed();
      }
    }, 5 * 60 * 1000);
    
    // Initial test
    if (this.isOnline) {
      this.testSpeed();
    }
  }
  
  /**
   * Get optimal download settings based on network
   */
  async getOptimalSettings() {
    const speed = this.downloadSpeed;
    const connectionType = this.connectionType;
    
    // Defaults
    let settings = {
      concurrentDownloads: 3,
      delayMin: 1000,
      delayMax: 3000,
      quality: 'high'
    };
    
    // Adjust based on connection type
    switch (connectionType) {
      case 'slow-2g':
      case '2g':
        settings = {
          concurrentDownloads: 1,
          delayMin: 3000,
          delayMax: 6000,
          quality: 'low'
        };
        break;
        
      case '3g':
        settings = {
          concurrentDownloads: 2,
          delayMin: 2000,
          delayMax: 4000,
          quality: 'medium'
        };
        break;
        
      case '4g':
        settings = {
          concurrentDownloads: 4,
          delayMin: 800,
          delayMax: 2000,
          quality: 'high'
        };
        break;
    }
    
    // Fine-tune based on actual speed
    if (speed > 0) {
      const speedMbps = (speed * 8) / (1024 * 1024); // Convert to Mbps
      
      if (speedMbps < 1) {
        settings.concurrentDownloads = 1;
      } else if (speedMbps < 5) {
        settings.concurrentDownloads = 2;
      } else if (speedMbps < 10) {
        settings.concurrentDownloads = 3;
      } else {
        settings.concurrentDownloads = 5;
      }
    }
    
    Logger.info('Optimal settings calculated', settings);
    
    return settings;
  }
  
  /**
   * Check if should throttle downloads
   */
  shouldThrottle() {
    if (!this.isOnline) return true;
    
    // Throttle on slow connections
    if (['slow-2g', '2g'].includes(this.connectionType)) {
      return true;
    }
    
    // Throttle if save data mode is enabled
    if (navigator.connection?.saveData) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Wait for connection
   */
  async waitForConnection() {
    if (this.isOnline) return true;
    
    Logger.info('Waiting for network connection...');
    
    return new Promise((resolve) => {
      const listener = (event) => {
        if (event === 'online') {
          this.removeListener(listener);
          resolve(true);
        }
      };
      
      this.addListener(listener);
    });
  }
  
  /**
   * Add listener for network events
   */
  addListener(callback) {
    this.listeners.add(callback);
  }
  
  /**
   * Remove listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }
  
  /**
   * Notify all listeners
   */
  notifyListeners(event, data = {}) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        Logger.error('Network listener error', { event }, error);
      }
    });
  }
  
  /**
   * Get network status
   */
  getStatus() {
    return {
      online: this.isOnline,
      connectionType: this.connectionType,
      downloadSpeed: this.downloadSpeed,
      speedFormatted: `${(this.downloadSpeed / 1024).toFixed(2)} KB/s`,
      shouldThrottle: this.shouldThrottle()
    };
  }
}


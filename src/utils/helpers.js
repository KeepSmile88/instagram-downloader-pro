/**
 * Utility Helper Functions
 */

export class Helpers {
  /**
   * Generate unique ID
   */
  static generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Format number with K, M suffixes
   */
  static formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
  
  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  /**
   * Format duration in milliseconds to human readable
   */
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Debounce function
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  /**
   * Throttle function
   */
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  /**
   * Deep clone object
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  
  /**
   * Merge objects deeply
   */
  static deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  /**
   * Wait/delay promise
   */
  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Retry function with exponential backoff
   */
  static async retry(fn, options = {}) {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffFactor = 2,
      onRetry = null
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxAttempts - 1) {
          const delay = Math.min(
            initialDelay * Math.pow(backoffFactor, attempt),
            maxDelay
          );
          
          if (onRetry) {
            onRetry(attempt + 1, delay, error);
          }
          
          await this.delay(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Hash string to number
   */
  static hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename) {
    return filename
      .replace(/[^a-z0-9._-]/gi, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  }
  
  /**
   * Parse Instagram URL
   */
  static parseInstagramUrl(url) {
    const patterns = {
      profile: /instagram\.com\/([^\/\?]+)\/?$/,
      post: /instagram\.com\/p\/([^\/\?]+)/,
      reel: /instagram\.com\/reel\/([^\/\?]+)/,
      story: /instagram\.com\/stories\/([^\/]+)\/([^\/\?]+)/
    };
    
    for (const [type, pattern] of Object.entries(patterns)) {
      const match = url.match(pattern);
      if (match) {
        return {
          type,
          id: match[1],
          secondaryId: match[2] // for stories
        };
      }
    }
    
    return null;
  }
  
  /**
   * Check if URL is Instagram media
   */
  static isInstagramMediaUrl(url) {
    if (!url) return false;
    
    const cdnPatterns = [
      'cdninstagram.com',
      'fbcdn.net'
    ];
    
    return cdnPatterns.some(pattern => url.includes(pattern)) &&
           !url.includes('profile_pic') &&
           !url.includes('150x150');
  }
  
  /**
   * Extract highest quality image from srcset
   */
  static getHighestQualityImage(srcset) {
    if (!srcset) return null;
    
    const sources = srcset.split(',').map(src => {
      const parts = src.trim().split(' ');
      return {
        url: parts[0],
        width: parts[1] ? parseInt(parts[1]) : 0
      };
    });
    
    sources.sort((a, b) => b.width - a.width);
    return sources[0]?.url || null;
  }
  
  /**
   * Get random number in range
   */
  static random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  /**
   * Chunk array into smaller arrays
   */
  static chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Group array by key
   */
  static groupBy(array, key) {
    return array.reduce((result, item) => {
      const group = typeof key === 'function' ? key(item) : item[key];
      (result[group] = result[group] || []).push(item);
      return result;
    }, {});
  }
  
  /**
   * Check if element is visible in viewport
   */
  static isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
  
  /**
   * Scroll element into view smoothly
   */
  static scrollIntoView(element, options = {}) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      ...options
    });
  }
  
  /**
   * Copy text to clipboard
   */
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback method
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      return success;
    }
  }
  
  /**
   * Download JSON as file
   */
  static downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * Download CSV as file
   */
  static downloadCSV(data, filename) {
    const csv = this.arrayToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * Convert array of objects to CSV
   */
  static arrayToCSV(array) {
    if (array.length === 0) return '';
    
    const headers = Object.keys(array[0]);
    const rows = array.map(obj =>
      headers.map(header => {
        const value = obj[header];
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }
  
  /**
   * Validate email
   */
  static isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
  
  /**
   * Validate URL
   */
  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
  
  /**
   * Get file extension from filename
   */
  static getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  }
  
  /**
   * Remove file extension from filename
   */
  static removeFileExtension(filename) {
    return filename.replace(/\.[^/.]+$/, '');
  }
  
  /**
   * Compare versions (semantic versioning)
   */
  static compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }
}


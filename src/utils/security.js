/**
 * Security and Encryption Utilities
 */

export class Security {
  static ENCRYPTION_KEY = null;
  
  /**
   * Initialize or get encryption key
   */
  static async getEncryptionKey() {
    if (this.ENCRYPTION_KEY) {
      return this.ENCRYPTION_KEY;
    }
    
    // Try to get existing key
    const stored = await chrome.storage.local.get('_encryption_key');
    
    if (stored._encryption_key) {
      this.ENCRYPTION_KEY = await this.importKey(stored._encryption_key);
      return this.ENCRYPTION_KEY;
    }
    
    // Generate new key
    const key = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Store key
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    await chrome.storage.local.set({
      _encryption_key: Array.from(new Uint8Array(exportedKey))
    });
    
    this.ENCRYPTION_KEY = key;
    return key;
  }
  
  /**
   * Import key from stored array
   */
  static async importKey(keyArray) {
    const keyBuffer = new Uint8Array(keyArray).buffer;
    
    return await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Encrypt data
   */
  static async encrypt(data) {
    try {
      const key = await this.getEncryptionKey();
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(data));
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBuffer
      );
      
      return {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encryptedData))
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }
  
  /**
   * Decrypt data
   */
  static async decrypt(encryptedData) {
    try {
      const key = await this.getEncryptionKey();
      
      const iv = new Uint8Array(encryptedData.iv);
      const data = new Uint8Array(encryptedData.data);
      
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decryptedData);
      
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }
  
  /**
   * Hash data (SHA-256)
   */
  static async hash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Generate secure random string
   */
  static generateRandomString(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Sanitize HTML to prevent XSS
   */
  static sanitizeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
  
  /**
   * Validate CSRF token
   */
  static async generateCSRFToken() {
    const token = this.generateRandomString(32);
    const hash = await this.hash(token);
    
    await chrome.storage.session.set({ _csrf_token: hash });
    
    return token;
  }
  
  /**
   * Verify CSRF token
   */
  static async verifyCSRFToken(token) {
    const { _csrf_token } = await chrome.storage.session.get('_csrf_token');
    
    if (!_csrf_token) return false;
    
    const hash = await this.hash(token);
    return hash === _csrf_token;
  }
  
  /**
   * Obfuscate sensitive data for logging
   */
  static obfuscate(data, keysToObfuscate = ['password', 'token', 'key', 'secret']) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const obfuscated = Array.isArray(data) ? [] : {};
    
    for (const key in data) {
      if (keysToObfuscate.some(k => key.toLowerCase().includes(k))) {
        obfuscated[key] = '***REDACTED***';
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        obfuscated[key] = this.obfuscate(data[key], keysToObfuscate);
      } else {
        obfuscated[key] = data[key];
      }
    }
    
    return obfuscated;
  }
  
  /**
   * Check if origin is allowed
   */
  static isAllowedOrigin(origin) {
    const allowedOrigins = [
      'https://www.instagram.com',
      'https://instagram.com',
      chrome.runtime.getURL('')
    ];
    
    return allowedOrigins.some(allowed => origin.startsWith(allowed));
  }
  
  /**
   * Validate input against XSS patterns
   */
  static containsXSS(input) {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<embed[^>]*>/gi,
      /<object[^>]*>/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }
  
  /**
   * Rate limiter
   */
  static rateLimiters = new Map();
  
  static async checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    
    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, []);
    }
    
    const requests = this.rateLimiters.get(key);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return {
        allowed: false,
        retryAfter: windowMs - (now - validRequests[0])
      };
    }
    
    validRequests.push(now);
    this.rateLimiters.set(key, validRequests);
    
    return { allowed: true };
  }
}

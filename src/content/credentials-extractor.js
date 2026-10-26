/**
 * Instagram Credentials Extractor
 * Extracts authentication tokens and user data from Instagram
 */

import { Logger } from '../core/logger.js';
import { Security } from '../utils/security.js';

export class CredentialsExtractor {
  /**
   * Extract all available credentials
   */
  static async extractAll() {
    const credentials = {};
    
    try {
      // Method 1: From cookies
      const cookieCredentials = await this.extractFromCookies();
      Object.assign(credentials, cookieCredentials);
      
      // Method 2: From localStorage
      const localStorageCredentials = this.extractFromLocalStorage();
      Object.assign(credentials, localStorageCredentials);
      
      // Method 3: From page scripts
      const scriptCredentials = this.extractFromScripts();
      Object.assign(credentials, scriptCredentials);
      
      // Method 4: From window object
      const windowCredentials = this.extractFromWindow();
      Object.assign(credentials, windowCredentials);
      
      // Extract user info
      const userInfo = this.extractUserInfo();
      Object.assign(credentials, userInfo);
      
      Logger.info('Credentials extracted', {
        methods: Object.keys(credentials).length,
        hasUserId: !!credentials.userId,
        hasSessionId: !!credentials.sessionId
      });
      
      return credentials;
    } catch (error) {
      Logger.error('Credentials extraction failed', {}, error);
      return credentials;
    }
  }
  
  /**
   * Extract from cookies
   */
  static async extractFromCookies() {
    const credentials = {};
    
    try {
      const cookies = await chrome.runtime.sendMessage({
        type: 'GET_COOKIES'
      });
      
      if (!cookies) return credentials;
      
      // Important Instagram cookies
      const cookieMap = {
        'sessionid': 'sessionId',
        'ds_user_id': 'userId',
        'csrftoken': 'csrfToken',
        'mid': 'machineId',
        'ig_did': 'deviceId',
        'rur': 'region'
      };
      
      cookies.forEach(cookie => {
        if (cookieMap[cookie.name]) {
          credentials[cookieMap[cookie.name]] = cookie.value;
        }
      });
      
      Logger.debug('Extracted credentials from cookies', {
        count: Object.keys(credentials).length
      });
    } catch (error) {
      Logger.warn('Failed to extract from cookies', {}, error);
    }
    
    return credentials;
  }
  
  /**
   * Extract from localStorage
   */
  static extractFromLocalStorage() {
    const credentials = {};
    
    try {
      // Instagram stores some data in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.includes('instagram')) {
          try {
            const value = localStorage.getItem(key);
            const parsed = JSON.parse(value);
            
            // Look for user data
            if (parsed.user || parsed.userId) {
              credentials.localStorageUser = parsed;
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
      
      Logger.debug('Extracted credentials from localStorage', {
        hasData: Object.keys(credentials).length > 0
      });
    } catch (error) {
      Logger.warn('Failed to extract from localStorage', {}, error);
    }
    
    return credentials;
  }
  
  /**
   * Extract from page scripts
   */
  static extractFromScripts() {
    const credentials = {};
    
    try {
      // Look for embedded JSON data in scripts
      const scripts = document.querySelectorAll('script[type="application/json"]');
      
      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          
          // Look for user or config data
          if (data.config) {
            credentials.config = data.config;
          }
          
          if (data.viewer) {
            credentials.viewer = data.viewer;
          }
        } catch (e) {
          // Not valid JSON, skip
        }
      });
      
      Logger.debug('Extracted credentials from scripts', {
        hasConfig: !!credentials.config,
        hasViewer: !!credentials.viewer
      });
    } catch (error) {
      Logger.warn('Failed to extract from scripts', {}, error);
    }
    
    return credentials;
  }
  
  /**
   * Extract from window object
   */
  static extractFromWindow() {
    const credentials = {};
    
    try {
      // Instagram exposes some data on window object
      if (window._sharedData) {
        credentials.sharedData = {
          config: window._sharedData.config,
          country_code: window._sharedData.country_code,
          language_code: window._sharedData.language_code
        };
        
        if (window._sharedData.config?.viewer) {
          credentials.viewerId = window._sharedData.config.viewer.id;
          credentials.viewerUsername = window._sharedData.config.viewer.username;
        }
      }
      
      Logger.debug('Extracted credentials from window', {
        hasSharedData: !!credentials.sharedData
      });
    } catch (error) {
      Logger.warn('Failed to extract from window', {}, error);
    }
    
    return credentials;
  }
  
  /**
   * Extract current user info
   */
  static extractUserInfo() {
    const userInfo = {};
    
    try {
      // Method 1: From meta tags
      const usernameMetaTag = document.querySelector('meta[property="og:title"]');
      if (usernameMetaTag) {
        const content = usernameMetaTag.getAttribute('content');
        const match = content.match(/@([^\s]+)/);
        if (match) {
          userInfo.currentUsername = match[1];
        }
      }
      
      // Method 2: From URL
      const urlMatch = window.location.pathname.match(/^\/([^\/]+)/);
      if (urlMatch && !['explore', 'p', 'reel', 'reels', 'tv'].includes(urlMatch[1])) {
        userInfo.profileUsername = urlMatch[1];
      }
      
      // Method 3: From profile link
      const profileLinks = document.querySelectorAll('a[href^="/"][href*="/"]');
      profileLinks.forEach(link => {
        const href = link.getAttribute('href');
        const match = href.match(/^\/([^\/\?]+)/);
        
        if (match && link.querySelector('img[alt*="profile"]')) {
          userInfo.loggedInUsername = match[1];
        }
      });
      
      Logger.debug('Extracted user info', userInfo);
    } catch (error) {
      Logger.warn('Failed to extract user info', {}, error);
    }
    
    return userInfo;
  }
  
  /**
   * Validate credentials
   */
  static validate(credentials) {
    const required = ['sessionId', 'csrfToken'];
    const missing = required.filter(key => !credentials[key]);
    
    if (missing.length > 0) {
      Logger.warn('Missing required credentials', { missing });
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if user is logged in
   */
  static isLoggedIn() {
    // Check for session cookie
    const cookies = document.cookie.split(';');
    const hasSessionId = cookies.some(cookie => 
      cookie.trim().startsWith('sessionid=')
    );
    
    // Check for user indicator in DOM
    const hasUserIndicator = document.querySelector('[aria-label*="profile" i]') !== null;
    
    return hasSessionId || hasUserIndicator;
  }
}


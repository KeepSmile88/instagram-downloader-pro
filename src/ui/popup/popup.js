/**
 * Popup Script
 * Main logic for extension popup
 */

import { Notification } from '../components/notification.js';
import { Modal } from '../components/modal.js';
import { Helpers } from '../../utils/helpers.js';

class PopupApp {
  constructor() {
    this.sessions = [];
    this.activeDownloads = [];
    this.settings = {};
    this.updateInterval = null;
  }
  
  /**
   * Initialize popup
   */
  async init() {
    try {
      // Load version
      this.loadVersion();
      
      // Load data
      await this.loadSettings();
      await this.loadSessions();
      await this.loadActiveDownloads();
      
      // Setup UI
      this.setupSettingsControls();
      this.setupEventListeners();
      
      // Start auto-update
      this.startAutoUpdate();
      
      // Listen for messages
      this.setupMessageListener();
      
      console.log('Popup initialized');
    } catch (error) {
      console.error('Popup initialization failed:', error);
      Notification.error('Failed to initialize popup', {
        title: 'Error'
      });
    }
  }
  
  /**
   * Load extension version
   */
  loadVersion() {
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version').textContent = manifest.version;
  }
  
  /**
   * Load settings
   */
  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS'
      });
      
      if (response.settings) {
        this.settings = response.settings;
        this.updateSettingsUI();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
  
  /**
   * Load recent sessions
   */
  async loadSessions() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SESSIONS',
        payload: { filters: {} }
      });
      
      if (response.sessions) {
        this.sessions = response.sessions.slice(0, 5); // Show only recent 5
        this.renderSessions();
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }
  
  /**
   * Load active downloads
   */
  async loadActiveDownloads() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SESSIONS',
        payload: { filters: { status: 'active' } }
      });
      
      if (response.sessions) {
        this.activeDownloads = response.sessions;
        this.renderActiveDownloads();
      }
    } catch (error) {
      console.error('Failed to load active downloads:', error);
    }
  }
  
  /**
   * Update settings UI
   */
  updateSettingsUI() {
    const delayMin = this.settings.delayMin || 1000;
    const delayMax = this.settings.delayMax || 3000;
    const concurrent = this.settings.concurrentDownloads || 3;
    
    document.getElementById('delay-min').value = delayMin;
    document.getElementById('delay-max').value = delayMax;
    document.getElementById('concurrent').value = concurrent;
    
    this.updateDelayDisplay(delayMin, delayMax);
    document.getElementById('concurrent-value').textContent = concurrent;
  }
  
  /**
   * Update delay display
   */
  updateDelayDisplay(min, max) {
    const minSec = (min / 1000).toFixed(1);
    const maxSec = (max / 1000).toFixed(1);
    document.getElementById('delay-value').textContent = `${minSec}s - ${maxSec}s`;
  }
  
  /**
   * Render sessions list
   */
  renderSessions() {
    const container = document.getElementById('sessions-list');
    
    if (this.sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="8" y="8" width="32" height="32" rx="4"/>
            <path d="M16 24h16M24 16v16"/>
          </svg>
          <p>No recent downloads</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.sessions.map(session => this.createSessionHTML(session)).join('');
    
    // Add click listeners
    container.querySelectorAll('.session-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.showSessionDetails(this.sessions[index]);
      });
    });
  }
  
  /**
   * Create session HTML
   */
  createSessionHTML(session) {
    const badgeClass = session.status === 'completed' ? 'completed' : 
                       session.status === 'failed' ? 'failed' : '';
    
    const timeAgo = this.getTimeAgo(session.createdAt);
    const itemsText = `${session.progress?.completed || 0}/${session.progress?.total || 0} items`;
    
    return `
      <div class="session-item" data-session-id="${session.sessionId}">
        <div class="session-info">
          <div class="session-username">@${session.username}</div>
          <div class="session-meta">${itemsText} • ${timeAgo}</div>
        </div>
        <div class="session-badge ${badgeClass}">
          ${session.status}
        </div>
      </div>
    `;
  }
  
  /**
   * Render active downloads
   */
  renderActiveDownloads() {
    const section = document.getElementById('active-downloads-section');
    const container = document.getElementById('active-downloads-list');
    
    if (this.activeDownloads.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    container.innerHTML = this.activeDownloads.map(download => 
      this.createDownloadHTML(download)
    ).join('');
  }
  
  /**
   * Create download HTML
   */
  createDownloadHTML(download) {
    const progress = download.progress || { completed: 0, total: 0, percentage: 0 };
    
    return `
      <div class="download-item">
        <div class="download-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2v13m0 0l4-4m-4 4l-4-4m11 8v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"/>
          </svg>
        </div>
        <div class="download-info">
          <div class="download-username">@${download.username}</div>
          <div class="download-progress-text">
            ${progress.completed}/${progress.total} items (${progress.percentage}%)
          </div>
          <div class="download-progress-bar">
            <div class="download-progress-fill" style="width: ${progress.percentage}%"></div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Setup settings controls
   */
  setupSettingsControls() {
    // Delay min slider
    const delayMinSlider = document.getElementById('delay-min');
    delayMinSlider.addEventListener('input', (e) => {
      const min = parseInt(e.target.value);
      const max = parseInt(document.getElementById('delay-max').value);
      
      // Ensure min < max
      if (min >= max) {
        document.getElementById('delay-max').value = min + 500;
      }
      
      this.updateDelayDisplay(
        parseInt(document.getElementById('delay-min').value),
        parseInt(document.getElementById('delay-max').value)
      );
    });
    
    // Delay max slider
    const delayMaxSlider = document.getElementById('delay-max');
    delayMaxSlider.addEventListener('input', (e) => {
      const max = parseInt(e.target.value);
      const min = parseInt(document.getElementById('delay-min').value);
      
      // Ensure max > min
      if (max <= min) {
        document.getElementById('delay-min').value = max - 500;
      }
      
      this.updateDelayDisplay(
        parseInt(document.getElementById('delay-min').value),
        parseInt(document.getElementById('delay-max').value)
      );
    });
    
    // Concurrent slider
    const concurrentSlider = document.getElementById('concurrent');
    concurrentSlider.addEventListener('input', (e) => {
      document.getElementById('concurrent-value').textContent = e.target.value;
    });
    
    // Save on change (debounced)
    const saveSettings = Helpers.debounce(() => {
      this.saveSettings();
    }, 500);
    
    delayMinSlider.addEventListener('change', saveSettings);
    delayMaxSlider.addEventListener('change', saveSettings);
    concurrentSlider.addEventListener('change', saveSettings);
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Open Instagram button
    document.getElementById('open-instagram').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.instagram.com' });
      window.close();
    });
    
    // Open settings button
    document.getElementById('open-settings').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
    
    // View all sessions
    document.getElementById('view-all-sessions').addEventListener('click', () => {
      this.showAllSessions();
    });
    
    // Footer links
    document.getElementById('view-stats').addEventListener('click', (e) => {
      e.preventDefault();
      this.showStats();
    });
    
    document.getElementById('view-help').addEventListener('click', (e) => {
      e.preventDefault();
      this.showHelp();
    });
    
    document.getElementById('view-about').addEventListener('click', (e) => {
      e.preventDefault();
      this.showAbout();
    });
  }
  
  /**
   * Save settings
   */
  async saveSettings() {
    try {
      const settings = {
        delayMin: parseInt(document.getElementById('delay-min').value),
        delayMax: parseInt(document.getElementById('delay-max').value),
        concurrentDownloads: parseInt(document.getElementById('concurrent').value)
      };
      
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { settings }
      });
      
      // Show subtle feedback
      const saveIndicator = document.createElement('div');
      saveIndicator.textContent = '✓ Saved';
      saveIndicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #10b981;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        z-index: 999999;
        animation: fadeInOut 2s;
      `;
      
      document.body.appendChild(saveIndicator);
      
      setTimeout(() => {
        saveIndicator.remove();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      Notification.error('Failed to save settings');
    }
  }
  
  /**
   * Show session details
   */
  async showSessionDetails(session) {
    const progress = session.progress || { completed: 0, failed: 0, pending: 0, total: 0 };
    
    const content = document.createElement('div');
    content.style.cssText = 'line-height: 1.6;';
    
    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">@${session.username}</div>
        <div style="font-size: 13px; color: #6b7280;">
          Created: ${new Date(session.createdAt).toLocaleString()}
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
        <div style="padding: 12px; background: #f9fafb; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #10b981;">${progress.completed}</div>
          <div style="font-size: 12px; color: #6b7280;">Completed</div>
        </div>
        <div style="padding: 12px; background: #f9fafb; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${progress.failed}</div>
          <div style="font-size: 12px; color: #6b7280;">Failed</div>
        </div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Progress</div>
        <div style="height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); width: ${progress.percentage}%;"></div>
        </div>
      </div>
      
      <div style="font-size: 13px; color: #6b7280;">
        Status: <span style="font-weight: 600; color: #1f2937;">${session.status}</span>
      </div>
    `;
    
    const actions = [];
    
    // Add retry button if there are failed items
    if (progress.failed > 0 && session.status !== 'active') {
      actions.push({
        text: 'Retry Failed',
        className: 'primary',
        handler: async (modal) => {
          try {
            await chrome.runtime.sendMessage({
              type: 'RETRY_FAILED',
              payload: { sessionId: session.sessionId }
            });
            
            Notification.success('Retrying failed items...');
            modal.close();
            await this.loadSessions();
            await this.loadActiveDownloads();
          } catch (error) {
            Notification.error('Failed to retry downloads');
          }
        },
        closeOnClick: false
      });
    }
    
    // Add resume button if paused
    if (session.status === 'paused') {
      actions.push({
        text: 'Resume',
        className: 'primary',
        handler: async (modal) => {
          try {
            await chrome.runtime.sendMessage({
              type: 'RESUME_DOWNLOAD',
              payload: { sessionId: session.sessionId }
            });
            
            Notification.success('Download resumed');
            modal.close();
            await this.loadActiveDownloads();
          } catch (error) {
            Notification.error('Failed to resume download');
          }
        }
      });
    }
    
    // Add delete button
    actions.push({
      text: 'Delete',
      className: 'danger',
      handler: async (modal) => {
        const confirmed = await Modal.confirm({
          title: 'Delete Session',
          message: 'Are you sure you want to delete this session? This action cannot be undone.',
          danger: true,
          confirmText: 'Delete'
        });
        
        if (confirmed) {
          try {
            await chrome.runtime.sendMessage({
              type: 'DELETE_SESSION',
              payload: { sessionId: session.sessionId }
            });
            
            Notification.success('Session deleted');
            modal.close();
            await this.loadSessions();
          } catch (error) {
            Notification.error('Failed to delete session');
          }
        }
      },
      closeOnClick: false
    });
    
    actions.push({
      text: 'Close',
      className: 'secondary'
    });
    
    Modal.show({
      title: 'Session Details',
      content: content,
      size: 'medium',
      actions: actions
    });
  }
  
  /**
   * Show all sessions
   */
  async showAllSessions() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SESSIONS',
        payload: { filters: {} }
      });
      
      const sessions = response.sessions || [];
      
      const content = document.createElement('div');
      
      if (sessions.length === 0) {
        content.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #9ca3af;">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 16px;">
              <rect x="12" y="12" width="40" height="40" rx="4"/>
              <path d="M24 32h16M32 24v16"/>
            </svg>
            <p>No download sessions yet</p>
          </div>
        `;
      } else {
        content.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto;">
            ${sessions.map(session => this.createSessionHTML(session)).join('')}
          </div>
        `;
        
        // Add click listeners
        setTimeout(() => {
          content.querySelectorAll('.session-item').forEach((item, index) => {
            item.addEventListener('click', () => {
              this.showSessionDetails(sessions[index]);
            });
          });
        }, 0);
      }
      
      Modal.show({
        title: 'All Sessions',
        content: content,
        size: 'medium',
        actions: [
          {
            text: 'Close',
            className: 'secondary'
          }
        ]
      });
    } catch (error) {
      console.error('Failed to load all sessions:', error);
      Notification.error('Failed to load sessions');
    }
  }
  
  /**
   * Show statistics
   */
  async showStats() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATS'
      });
      
      const stats = response.stats || {};
      
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
          <div style="padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">${stats.totalDownloads || 0}</div>
            <div style="font-size: 13px; opacity: 0.9;">Total Downloads</div>
          </div>
          
          <div style="padding: 20px; background: #f9fafb; border-radius: 12px; text-align: center;">
            <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px; color: #10b981;">${stats.totalImages || 0}</div>
            <div style="font-size: 13px; color: #6b7280;">Images</div>
          </div>
          
          <div style="padding: 20px; background: #f9fafb; border-radius: 12px; text-align: center;">
            <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px; color: #3b82f6;">${stats.totalVideos || 0}</div>
            <div style="font-size: 13px; color: #6b7280;">Videos</div>
          </div>
          
          <div style="padding: 20px; background: #f9fafb; border-radius: 12px; text-align: center;">
            <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px; color: #f59e0b;">${stats.sessionsCompleted || 0}</div>
            <div style="font-size: 13px; color: #6b7280;">Sessions</div>
          </div>
        </div>
        
        <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 12px;">
          <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">Storage Used</div>
          <div style="font-size: 20px; font-weight: 700; color: #1f2937;">${Helpers.formatBytes(stats.totalSize || 0)}</div>
        </div>
        
        ${stats.firstDownload ? `
          <div style="margin-top: 16px; font-size: 12px; color: #6b7280; text-align: center;">
            Member since ${new Date(stats.firstDownload).toLocaleDateString()}
          </div>
        ` : ''}
      `;
      
      Modal.show({
        title: 'Download Statistics',
        content: content,
        size: 'medium',
        actions: [
          {
            text: 'Close',
            className: 'secondary'
          }
        ]
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      Notification.error('Failed to load statistics');
    }
  }
  
  /**
   * Show help
   */
  showHelp() {
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="line-height: 1.8;">
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">How to Use</h3>
        
        <ol style="padding-left: 20px; margin-bottom: 20px;">
          <li style="margin-bottom: 8px;">Visit any Instagram profile</li>
          <li style="margin-bottom: 8px;">Click the "Scan & Download All" button</li>
          <li style="margin-bottom: 8px;">Wait for scanning to complete</li>
          <li style="margin-bottom: 8px;">Select items to download in the preview</li>
          <li>Click download and wait for completion</li>
        </ol>
        
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Keyboard Shortcuts</h3>
        
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 6px;">
            <span style="font-size: 13px; color: #6b7280;">Start Scan</span>
            <kbd style="padding: 2px 6px; background: white; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 12px;">Ctrl+Shift+S</kbd>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 6px;">
            <span style="font-size: 13px; color: #6b7280;">Stop Scan</span>
            <kbd style="padding: 2px 6px; background: white; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 12px;">Esc</kbd>
          </div>
        </div>
        
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Tips</h3>
        
        <ul style="padding-left: 20px;">
          <li style="margin-bottom: 8px;">Increase delay if downloads are being blocked</li>
          <li style="margin-bottom: 8px;">Lower concurrent downloads on slow connections</li>
          <li>Downloads automatically resume after browser restart</li>
        </ul>
      </div>
    `;
    
    Modal.show({
      title: 'Help & Tips',
      content: content,
      size: 'medium',
      actions: [
        {
          text: 'Close',
          className: 'secondary'
        }
      ]
    });
  }
  
  /**
   * Show about
   */
  showAbout() {
    const manifest = chrome.runtime.getManifest();
    
    const content = document.createElement('div');
    content.style.textAlign = 'center';
    content.innerHTML = `
      <div style="margin-bottom: 20px;">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="url(#gradient)" style="margin-bottom: 12px;">
          <defs>
            <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#667eea"/>
              <stop offset="100%" style="stop-color:#764ba2"/>
            </linearGradient>
          </defs>
          <path d="M32 4a12 12 0 00-12 12v4h-4a4 4 0 00-4 4v32a4 4 0 004 4h32a4 4 0 004-4V24a4 4 0 00-4-4h-4v-4a12 12 0 00-12-12zm0 4a8 8 0 018 8v4H24v-4a8 8 0 018-8zm0 20a6 6 0 110 12 6 6 0 010-12z"/>
        </svg>
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">Instagram Downloader Pro</h2>
        <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Version ${manifest.version}</div>
      </div>
      
      <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
        Professional Instagram media downloader with advanced features including resume capability, smart filters, and beautiful UI.
      </p>
      
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #6b7280;">
        <div>Made with ❤️ by the community</div>
        <div>© ${new Date().getFullYear()} All rights reserved</div>
      </div>
    `;
    
    Modal.show({
      title: '',
      content: content,
      size: 'small',
      showClose: true,
      actions: []
    });
  }
  
  /**
   * Start auto-update
   */
  startAutoUpdate() {
    // Update every 2 seconds
    this.updateInterval = setInterval(() => {
      this.loadActiveDownloads();
    }, 2000);
  }
  
  /**
   * Setup message listener
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'DOWNLOAD_PROGRESS') {
        // Refresh active downloads
        this.loadActiveDownloads();
      } else if (message.type === 'SESSION_UPDATED') {
        // Refresh sessions
        this.loadSessions();
      }
    });
  }
  
  /**
   * Get time ago string
   */
  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  }
  
  /**
   * Cleanup
   */
  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

// Initialize app
const app = new PopupApp();
app.init();

// Cleanup on unload
window.addEventListener('unload', () => {
  app.cleanup();
});

// Add fade-in animation style
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-10px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }
`;
document.head.appendChild(style);


/**
 * Options Page Script
 * Settings and configuration management
 */

import { Notification } from '../components/notification.js';
import { Modal } from '../components/modal.js';
import { Helpers } from '../../utils/helpers.js';

class OptionsApp {
  constructor() {
    this.currentSection = 'general';
    this.settings = {};
    this.stats = {};
    this.hasUnsavedChanges = false;
  }
  
  /**
   * Initialize options app
   */
  async init() {
    try {
      console.log('Options app initializing...');
      
      // Load version
      this.loadVersion();
      
      // Load data
      await this.loadSettings();
      await this.loadStats();
      await this.loadStorageInfo();
      
      // Setup UI
      this.setupNavigation();
      this.setupEventListeners();
      this.updateAllUI();
      
      // Mark when changes are made
      this.trackChanges();
      
      // Warn before leaving with unsaved changes
      window.addEventListener('beforeunload', (e) => {
        if (this.hasUnsavedChanges) {
          e.preventDefault();
          e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
          return e.returnValue;
        }
      });
      
      console.log('Options app initialized');
    } catch (error) {
      console.error('Options initialization failed:', error);
      Notification.error('Failed to initialize settings page');
    }
  }
  
  /**
   * Load extension version
   */
  loadVersion() {
    const manifest = chrome.runtime.getManifest();
    document.getElementById('app-version').textContent = `v${manifest.version}`;
    document.getElementById('about-version').textContent = manifest.version;
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
        console.log('Settings loaded:', this.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      throw error;
    }
  }
  
  /**
   * Load statistics
   */
  async loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATS'
      });
      
      if (response.stats) {
        this.stats = response.stats;
        this.updateStatsUI();
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }
  
  /**
   * Load storage info
   */
  async loadStorageInfo() {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      
      const usedKB = Math.round(usage / 1024);
      const totalKB = Math.round(quota / 1024);
      const percentage = Math.round((usage / quota) * 100);
      
      document.getElementById('storage-used').textContent = usedKB;
      document.getElementById('storage-total').textContent = totalKB;
      document.getElementById('storage-fill').style.width = `${percentage}%`;
      
      // Change color if storage is high
      if (percentage > 80) {
        document.getElementById('storage-fill').style.background = 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)';
      }
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  }
  
  /**
   * Setup navigation
   */
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        this.showSection(section);
      });
    });
  }
  
  /**
   * Show specific section
   */
  showSection(sectionId) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionId);
    });
    
    // Update sections
    document.querySelectorAll('.settings-section').forEach(section => {
      section.classList.toggle('active', section.dataset.section === sectionId);
    });
    
    // Update header
    const titles = {
      general: { title: 'General Settings', desc: 'Configure basic extension behavior' },
      downloads: { title: 'Download Settings', desc: 'Customize download behavior and preferences' },
      filters: { title: 'Filter Settings', desc: 'Configure media filtering options' },
      privacy: { title: 'Privacy Settings', desc: 'Manage your privacy and data collection' },
      advanced: { title: 'Advanced Settings', desc: 'Expert configuration options' },
      data: { title: 'Data Management', desc: 'Manage extension data and statistics' },
      about: { title: 'About', desc: 'Information about this extension' }
    };
    
    const info = titles[sectionId] || titles.general;
    document.getElementById('section-title').textContent = info.title;
    document.getElementById('section-description').textContent = info.desc;
    
    this.currentSection = sectionId;
    
    // Scroll to top
    document.querySelector('.settings-content').scrollTop = 0;
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Save button
    document.getElementById('save-settings-btn').addEventListener('click', () => {
      this.saveSettings();
    });
    
    // Export settings
    document.getElementById('export-settings-btn').addEventListener('click', () => {
      this.exportSettings();
    });
    
    // Reset all
    document.getElementById('reset-all-btn').addEventListener('click', () => {
      this.resetAllSettings();
    });
    
    // General section
    document.getElementById('language-select').addEventListener('change', (e) => {
      this.settings.language = e.target.value;
    });
    
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.settings.theme = e.target.value;
      });
    });
    
    document.getElementById('notifications-toggle').addEventListener('change', (e) => {
      this.settings.notifications = e.target.checked;
    });
    
    document.getElementById('sounds-toggle').addEventListener('change', (e) => {
      this.settings.sounds = e.target.checked;
    });
    
    document.getElementById('auto-update-toggle').addEventListener('change', (e) => {
      this.settings.autoUpdate = e.target.checked;
    });
    
    // Downloads section
    this.setupDelaySliders();
    this.setupConcurrentSlider();
    this.setupRetriesSlider();
    
    document.getElementById('download-path').addEventListener('change', (e) => {
      this.settings.downloadPath = e.target.value;
    });
    
    document.getElementById('organize-folders-toggle').addEventListener('change', (e) => {
      this.settings.organizeFolders = e.target.checked;
    });
    
    document.getElementById('add-metadata-toggle').addEventListener('change', (e) => {
      this.settings.addMetadata = e.target.checked;
    });
    
    document.getElementById('auto-resume-toggle').addEventListener('change', (e) => {
      this.settings.autoResume = e.target.checked;
    });
    
    // Filters section
    document.getElementById('filter-images').addEventListener('change', (e) => {
      this.settings.filterImages = e.target.checked;
    });
    
    document.getElementById('filter-videos').addEventListener('change', (e) => {
      this.settings.filterVideos = e.target.checked;
    });
    
    document.getElementById('min-resolution-select').addEventListener('change', (e) => {
      this.settings.minResolution = parseInt(e.target.value);
    });
    
    this.setupMinFileSizeSlider();
    
    document.getElementById('skip-duplicates-toggle').addEventListener('change', (e) => {
      this.settings.skipDuplicates = e.target.checked;
    });
    
    // Privacy section
    document.getElementById('keep-history-toggle').addEventListener('change', (e) => {
      this.settings.keepHistory = e.target.checked;
    });
    
    document.getElementById('history-retention-select').addEventListener('change', (e) => {
      this.settings.historyRetention = parseInt(e.target.value);
    });
    
    document.getElementById('analytics-toggle').addEventListener('change', (e) => {
      this.settings.analytics = e.target.checked;
    });
    
    document.getElementById('crash-reports-toggle').addEventListener('change', (e) => {
      this.settings.crashReports = e.target.checked;
    });
    
    // Advanced section
    this.setupTimeoutSlider();
    
    document.getElementById('user-agent-input').addEventListener('change', (e) => {
      this.settings.userAgent = e.target.value;
    });
    
    document.getElementById('debug-mode-toggle').addEventListener('change', (e) => {
      this.settings.debugMode = e.target.checked;
    });
    
    document.getElementById('experimental-toggle').addEventListener('change', (e) => {
      this.settings.experimental = e.target.checked;
    });
    
    // Data section
    document.getElementById('export-data-btn').addEventListener('click', () => {
      this.exportAllData();
    });
    
    document.getElementById('import-data-btn').addEventListener('click', () => {
      this.importData();
    });
    
    document.getElementById('clear-history-btn').addEventListener('click', () => {
      this.clearHistory();
    });
    
    document.getElementById('clear-all-data-btn').addEventListener('click', () => {
      this.clearAllData();
    });
    
    // About section links
    document.getElementById('changelog-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openChangelog();
    });
    
    document.getElementById('docs-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openDocs();
    });
    
    document.getElementById('github-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openGitHub();
    });
    
    document.getElementById('support-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openSupport();
    });
  }
  
  /**
   * Setup delay sliders
   */
  setupDelaySliders() {
    const minSlider = document.getElementById('delay-min');
    const maxSlider = document.getElementById('delay-max');
    const minValue = document.getElementById('delay-min-value');
    const maxValue = document.getElementById('delay-max-value');
    
    minSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      minValue.textContent = (value / 1000).toFixed(1);
      this.settings.delayMin = value;
      
      // Ensure max >= min
      if (parseInt(maxSlider.value) < value) {
        maxSlider.value = value + 500;
        maxValue.textContent = ((value + 500) / 1000).toFixed(1);
        this.settings.delayMax = value + 500;
      }
    });
    
    maxSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      maxValue.textContent = (value / 1000).toFixed(1);
      this.settings.delayMax = value;
      
      // Ensure min <= max
      if (parseInt(minSlider.value) > value) {
        minSlider.value = value - 500;
        minValue.textContent = ((value - 500) / 1000).toFixed(1);
        this.settings.delayMin = value - 500;
      }
    });
  }
  
  /**
   * Setup concurrent downloads slider
   */
  setupConcurrentSlider() {
    const slider = document.getElementById('concurrent-downloads');
    const value = document.getElementById('concurrent-value');
    
    slider.addEventListener('input', (e) => {
      value.textContent = e.target.value;
      this.settings.concurrentDownloads = parseInt(e.target.value);
    });
  }
  
  /**
   * Setup retries slider
   */
  setupRetriesSlider() {
    const slider = document.getElementById('max-retries');
    const value = document.getElementById('retries-value');
    
    slider.addEventListener('input', (e) => {
      value.textContent = e.target.value;
      this.settings.maxRetries = parseInt(e.target.value);
    });
  }
  
  /**
   * Setup min file size slider
   */
  setupMinFileSizeSlider() {
    const slider = document.getElementById('min-file-size');
    const value = document.getElementById('min-size-value');
    
    slider.addEventListener('input', (e) => {
      value.textContent = e.target.value;
      this.settings.minFileSize = parseFloat(e.target.value);
    });
  }
  
  /**
   * Setup timeout slider
   */
  setupTimeoutSlider() {
    const slider = document.getElementById('request-timeout');
    const value = document.getElementById('timeout-value');
    
    slider.addEventListener('input', (e) => {
      value.textContent = e.target.value;
      this.settings.requestTimeout = parseInt(e.target.value);
    });
  }
  
  /**
   * Update all UI elements with current settings
   */
  updateAllUI() {
    // General
    document.getElementById('language-select').value = this.settings.language || 'en';
    
    const theme = this.settings.theme || 'light';
    document.querySelector(`input[name="theme"][value="${theme}"]`).checked = true;
    
    document.getElementById('notifications-toggle').checked = this.settings.notifications !== false;
    document.getElementById('sounds-toggle').checked = this.settings.sounds || false;
    document.getElementById('auto-update-toggle').checked = this.settings.autoUpdate !== false;
    
    // Downloads
    document.getElementById('delay-min').value = this.settings.delayMin || 1000;
    document.getElementById('delay-min-value').textContent = ((this.settings.delayMin || 1000) / 1000).toFixed(1);
    
    document.getElementById('delay-max').value = this.settings.delayMax || 3000;
    document.getElementById('delay-max-value').textContent = ((this.settings.delayMax || 3000) / 1000).toFixed(1);
    
    document.getElementById('concurrent-downloads').value = this.settings.concurrentDownloads || 3;
    document.getElementById('concurrent-value').textContent = this.settings.concurrentDownloads || 3;
    
    document.getElementById('max-retries').value = this.settings.maxRetries || 3;
    document.getElementById('retries-value').textContent = this.settings.maxRetries || 3;
    
    document.getElementById('download-path').value = this.settings.downloadPath || 'Downloads/Instagram';
    document.getElementById('organize-folders-toggle').checked = this.settings.organizeFolders !== false;
    document.getElementById('add-metadata-toggle').checked = this.settings.addMetadata !== false;
    document.getElementById('auto-resume-toggle').checked = this.settings.autoResume !== false;
    
    // Filters
    document.getElementById('filter-images').checked = this.settings.filterImages !== false;
    document.getElementById('filter-videos').checked = this.settings.filterVideos !== false;
    document.getElementById('min-resolution-select').value = this.settings.minResolution || 1080;
    
    document.getElementById('min-file-size').value = this.settings.minFileSize || 0;
    document.getElementById('min-size-value').textContent = this.settings.minFileSize || 0;
    
    document.getElementById('skip-duplicates-toggle').checked = this.settings.skipDuplicates !== false;
    
    // Privacy
    document.getElementById('keep-history-toggle').checked = this.settings.keepHistory !== false;
    document.getElementById('history-retention-select').value = this.settings.historyRetention || 30;
    document.getElementById('analytics-toggle').checked = this.settings.analytics || false;
    document.getElementById('crash-reports-toggle').checked = this.settings.crashReports || false;
    
    // Advanced
    document.getElementById('request-timeout').value = this.settings.requestTimeout || 30;
    document.getElementById('timeout-value').textContent = this.settings.requestTimeout || 30;
    
    document.getElementById('user-agent-input').value = this.settings.userAgent || '';
    document.getElementById('debug-mode-toggle').checked = this.settings.debugMode || false;
    document.getElementById('experimental-toggle').checked = this.settings.experimental || false;
  }
  
  /**
   * Update stats UI
   */
  updateStatsUI() {
    document.getElementById('total-downloads').textContent = this.stats.totalDownloads || 0;
    document.getElementById('total-images').textContent = this.stats.totalImages || 0;
    document.getElementById('total-videos').textContent = this.stats.totalVideos || 0;
    document.getElementById('total-size').textContent = Helpers.formatBytes(this.stats.totalSize || 0);
  }
  
  /**
   * Track changes
   */
  trackChanges() {
    // Listen to all input changes
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        this.hasUnsavedChanges = true;
        this.updateSaveButton();
      });
    });
  }
  
  /**
   * Update save button state
   */
  updateSaveButton() {
    const btn = document.getElementById('save-settings-btn');
    
    if (this.hasUnsavedChanges) {
      btn.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.3)';
    } else {
      btn.style.boxShadow = '';
    }
  }
  
  /**
   * Save settings
   */
  async saveSettings() {
    try {
      const btn = document.getElementById('save-settings-btn');
      const originalText = btn.innerHTML;
      
      // Show loading
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" style="animation: spin 1s linear infinite;">
          <path d="M9 2v4m0 8v4M2 9h4m8 0h4M4.22 4.22l2.83 2.83m5.66 5.66l2.83 2.83M4.22 13.78l2.83-2.83m5.66-5.66l2.83-2.83"/>
        </svg>
        Saving...
      `;
      btn.disabled = true;
      
      // Save to background
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { settings: this.settings }
      });
      
      // Success
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
          <path d="M0 9l6 6 12-12-2-2-10 10-4-4-2 2z"/>
        </svg>
        Saved!
      `;
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);
      
      this.hasUnsavedChanges = false;
      this.updateSaveButton();
      
      Notification.success('Settings saved successfully!', {
        title: 'Success',
        duration: 3000
      });
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      Notification.error('Failed to save settings', {
        title: 'Error'
      });
      
      const btn = document.getElementById('save-settings-btn');
      btn.disabled = false;
    }
  }
  
  /**
   * Export settings
   */
  async exportSettings() {
    try {
      const data = {
        settings: this.settings,
        exportedAt: Date.now(),
        version: chrome.runtime.getManifest().version
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `igdl_settings_${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      Notification.success('Settings exported successfully', {
        duration: 3000
      });
      
    } catch (error) {
      console.error('Failed to export settings:', error);
      Notification.error('Failed to export settings');
    }
  }
  
  /**
   * Reset all settings
   */
  async resetAllSettings() {
    const confirmed = await Modal.confirm({
      title: 'Reset All Settings?',
      message: 'This will reset all settings to their default values. This action cannot be undone.',
      confirmText: 'Reset All',
      cancelText: 'Cancel',
      danger: true
    });
    
    if (!confirmed) return;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'RESET_SETTINGS'
      });
      
      // Reload settings
      await this.loadSettings();
      this.updateAllUI();
      
      Notification.success('All settings reset to defaults', {
        title: 'Reset Complete',
        duration: 3000
      });
      
    } catch (error) {
      console.error('Failed to reset settings:', error);
      Notification.error('Failed to reset settings');
    }
  }
  
  /**
   * Export all data
   */
  async exportAllData() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATA'
      });
      
      Notification.success('Data export started', {
        title: 'Export',
        duration: 3000
      });
      
    } catch (error) {
      console.error('Failed to export data:', error);
      Notification.error('Failed to export data');
    }
  }
  
  /**
   * Import data
   */
  async importData() {
    const input = document.getElementById('import-file-input');
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        const confirmed = await Modal.confirm({
          title: 'Import Data?',
          message: 'This will overwrite your current data. Are you sure?',
          confirmText: 'Import',
          cancelText: 'Cancel'
        });
        
        if (!confirmed) return;
        
        await chrome.runtime.sendMessage({
          type: 'IMPORT_DATA',
          payload: { data }
        });
        
        Notification.success('Data imported successfully!', {
          title: 'Import Complete',
          duration: 3000
        });
        
        // Reload
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
      } catch (error) {
        console.error('Failed to import data:', error);
        Notification.error('Failed to import data. Invalid file format.');
      }
    };
    
    input.click();
  }
  
  /**
   * Clear history
   */
  async clearHistory() {
    const confirmed = await Modal.confirm({
      title: 'Clear Download History?',
      message: 'This will permanently delete your download history. This action cannot be undone.',
      confirmText: 'Clear History',
      cancelText: 'Cancel',
      danger: true
    });
    
    if (!confirmed) return;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_HISTORY'
      });
      
      Notification.success('Download history cleared', {
        title: 'Success',
        duration: 3000
      });
      
      // Reload stats
      await this.loadStats();
      
    } catch (error) {
      console.error('Failed to clear history:', error);
      Notification.error('Failed to clear history');
    }
  }
  
  /**
   * Clear all data
   */
  async clearAllData() {
    const confirmed = await Modal.confirm({
      title: 'Clear All Extension Data?',
      message: 'This will delete ALL extension data including settings, history, and statistics. This action cannot be undone.',
      confirmText: 'Delete Everything',
      cancelText: 'Cancel',
      danger: true
    });
    
    if (!confirmed) return;
    
    // Double confirmation
    const doubleConfirmed = await Modal.confirm({
      title: 'Are You Absolutely Sure?',
      message: 'This is your last chance. All data will be permanently deleted.',
      confirmText: 'Yes, Delete Everything',
      cancelText: 'No, Keep My Data',
      danger: true
    });
    
    if (!doubleConfirmed) return;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_DATA'
      });
      
      Notification.success('All data cleared successfully', {
        title: 'Complete',
        duration: 3000
      });
      
      // Reload after delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to clear data:', error);
      Notification.error('Failed to clear data');
    }
  }
  
  /**
   * Open changelog
   */
  openChangelog() {
    chrome.tabs.create({
      url: 'https://github.com/yourusername/ig-downloader/releases'
    });
  }
  
  /**
   * Open documentation
   */
  openDocs() {
    chrome.tabs.create({
      url: 'https://github.com/yourusername/ig-downloader/wiki'
    });
  }
  
  /**
   * Open GitHub
   */
  openGitHub() {
    chrome.tabs.create({
      url: 'https://github.com/yourusername/ig-downloader'
    });
  }
  
  /**
   * Open support
   */
  openSupport() {
    chrome.tabs.create({
      url: 'https://github.com/yourusername/ig-downloader/issues'
    });
  }
}

// Add spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Initialize app
const app = new OptionsApp();
app.init();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    app.saveSettings();
  }
});

console.log('Options page script loaded');

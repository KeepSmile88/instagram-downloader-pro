/**
 * Preview Page Script
 * Media preview and selection interface
 */

import { Notification } from '../components/notification.js';
import { Modal } from '../components/modal.js';
import { ProgressToast } from '../components/progress-toast.js';
import { Helpers } from '../../utils/helpers.js';

class PreviewApp {
  constructor() {
    this.sessionId = null;
    this.session = null;
    this.mediaItems = [];
    this.filteredItems = [];
    this.selectedItems = new Set();
    this.currentFilter = 'all';
    this.currentView = 'grid';
    this.currentSort = 'index';
    this.searchQuery = '';
    this.lightboxIndex = -1;
    this.contextMenuTarget = null;
    this.progressToast = null;
  }
  
  /**
   * Initialize preview app
   */
  async init() {
    try {
      // Get session ID from URL
      const params = new URLSearchParams(window.location.search);
      this.sessionId = params.get('session');
      
      if (!this.sessionId) {
        throw new Error('No session ID provided');
      }
      
      // Load session data
      await this.loadSession();
      
      // Setup UI
      this.setupEventListeners();
      this.renderMedia();
      this.updateCounts();
      
      console.log('Preview app initialized', {
        sessionId: this.sessionId,
        mediaCount: this.mediaItems.length
      });
    } catch (error) {
      console.error('Preview initialization failed:', error);
      this.showError(error.message);
    }
  }
  
  /**
   * Load session data
   */
  async loadSession() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SESSION',
        payload: { sessionId: this.sessionId }
      });
      
      if (!response.session) {
        throw new Error('Session not found');
      }
      
      this.session = response.session;
      this.mediaItems = response.session.pendingItems || [];
      this.filteredItems = [...this.mediaItems];
      
      // Update header
      document.getElementById('profile-username').textContent = `@${this.session.username}`;
      document.getElementById('profile-url').textContent = this.session.profileUrl || '-';
      
      // Select all by default
      this.mediaItems.forEach((item, index) => {
        this.selectedItems.add(index);
      });
      
    } catch (error) {
      console.error('Failed to load session:', error);
      throw error;
    }
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Select all / Deselect all
    document.getElementById('toggle-select-all').addEventListener('click', () => {
      this.toggleSelectAll();
    });
    
    // Filter buttons
    document.querySelectorAll('.btn-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setFilter(e.currentTarget.dataset.filter);
      });
    });
    
    // View toggle
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setView(e.currentTarget.dataset.view);
      });
    });
    
    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.applyFilters();
    });
    
    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      this.applySort();
    });
    
    // Download button
    document.getElementById('download-btn').addEventListener('click', () => {
      this.startDownload();
    });
    
    // Cancel button
    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.cancel();
    });
    
    // Context menu
    document.addEventListener('contextmenu', (e) => {
      const mediaItem = e.target.closest('.media-item');
      if (mediaItem) {
        e.preventDefault();
        this.showContextMenu(e, mediaItem);
      }
    });
    
    // Close context menu on click outside
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });
    
    // Context menu actions
    document.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleContextAction(action);
      });
    });
    
    // Lightbox
    document.getElementById('lightbox-close').addEventListener('click', () => {
      this.closeLightbox();
    });
    
    document.getElementById('lightbox-prev').addEventListener('click', () => {
      this.navigateLightbox(-1);
    });
    
    document.getElementById('lightbox-next').addEventListener('click', () => {
      this.navigateLightbox(1);
    });
    
    document.getElementById('lightbox-download').addEventListener('click', () => {
      this.downloadCurrentLightbox();
    });
    
    document.getElementById('lightbox-toggle-select').addEventListener('click', () => {
      this.toggleSelectCurrentLightbox();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });
  }
  
  /**
   * Render media grid
   */
  renderMedia() {
    const grid = document.getElementById('media-grid');
    grid.className = `media-grid ${this.currentView === 'list' ? 'list-view' : ''}`;
    
    if (this.filteredItems.length === 0) {
      grid.innerHTML = `
        <div class="loading-state">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="12" y="12" width="40" height="40" rx="4"/>
            <path d="M24 32h16M32 24v16"/>
          </svg>
          <p>No items to display</p>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = this.filteredItems.map((item, index) => 
      this.createMediaItemHTML(item, index)
    ).join('');
    
    // Add event listeners
    grid.querySelectorAll('.media-item').forEach((el, index) => {
      const item = this.filteredItems[index];
      const itemIndex = this.mediaItems.indexOf(item);
      
      // Click to preview
      el.addEventListener('click', (e) => {
        if (!e.target.closest('.media-select-checkbox')) {
          this.openLightbox(itemIndex);
        }
      });
      
      // Checkbox
      const checkbox = el.querySelector('.media-select-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSelect(itemIndex);
      });
    });
  }
  
  /**
   * Create media item HTML
   */
  createMediaItemHTML(item, index) {
    const itemIndex = this.mediaItems.indexOf(item);
    const isSelected = this.selectedItems.has(itemIndex);
    const isVideo = item.type === 'video';
    
    return `
      <div class="media-item ${isSelected ? 'selected' : ''}" data-index="${itemIndex}">
        <div class="media-thumbnail">
          <img src="${item.thumbnail || item.url}" alt="${item.filename}" loading="lazy">
          
          ${isVideo ? `
            <div class="media-type-badge">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 2v8l8-4-8-4z"/>
              </svg>
              VIDEO
            </div>
          ` : ''}
          
          <div class="media-select-checkbox">
            ${isSelected ? `
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
              </svg>
            ` : ''}
          </div>
        </div>
        
        <div class="media-info">
          <div class="media-filename" title="${item.filename}">${item.filename}</div>
          <div class="media-meta">${isVideo ? 'Video' : 'Image'} • #${itemIndex + 1}</div>
        </div>
      </div>
    `;
  }
  
  /**
   * Toggle select item
   */
  toggleSelect(index) {
    if (this.selectedItems.has(index)) {
      this.selectedItems.delete(index);
    } else {
      this.selectedItems.add(index);
    }
    
    this.updateUI();
  }
  
  /**
   * Toggle select all
   */
  toggleSelectAll() {
    if (this.selectedItems.size === this.filteredItems.length) {
      // Deselect all visible
      this.filteredItems.forEach(item => {
        const index = this.mediaItems.indexOf(item);
        this.selectedItems.delete(index);
      });
    } else {
      // Select all visible
      this.filteredItems.forEach(item => {
        const index = this.mediaItems.indexOf(item);
        this.selectedItems.add(index);
      });
    }
    
    this.updateUI();
  }
  
  /**
   * Set filter
   */
  setFilter(filter) {
    this.currentFilter = filter;
    
    // Update button states
    document.querySelectorAll('.btn-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    this.applyFilters();
  }
  
  /**
   * Apply filters
   */
  applyFilters() {
    this.filteredItems = this.mediaItems.filter(item => {
      // Type filter
      if (this.currentFilter !== 'all' && item.type !== this.currentFilter) {
        return false;
      }
      
      // Search filter
      if (this.searchQuery) {
        const filename = item.filename.toLowerCase();
        const index = (this.mediaItems.indexOf(item) + 1).toString();
        
        if (!filename.includes(this.searchQuery) && !index.includes(this.searchQuery)) {
          return false;
        }
      }
      
      return true;
    });
    
    this.applySort();
  }
  
  /**
   * Apply sort
   */
  applySort() {
    this.filteredItems.sort((a, b) => {
      switch (this.currentSort) {
        case 'type':
          return a.type.localeCompare(b.type);
          
        case 'size':
          return (b.fileSize || 0) - (a.fileSize || 0);
          
        case 'index':
        default:
          return this.mediaItems.indexOf(a) - this.mediaItems.indexOf(b);
      }
    });
    
    this.renderMedia();
    this.updateCounts();
  }
  
  /**
   * Set view mode
   */
  setView(view) {
    this.currentView = view;
    
    // Update button states
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    this.renderMedia();
  }
  
  /**
   * Update counts and UI
   */
  updateCounts() {
    const totalImages = this.mediaItems.filter(item => item.type === 'image').length;
    const totalVideos = this.mediaItems.filter(item => item.type === 'video').length;
    
    document.getElementById('count-all').textContent = this.mediaItems.length;
    document.getElementById('count-images').textContent = totalImages;
    document.getElementById('count-videos').textContent = totalVideos;
    document.getElementById('total-count').textContent = this.mediaItems.length;
    document.getElementById('selected-count').textContent = this.selectedItems.size;
    document.getElementById('download-count').textContent = this.selectedItems.size;
    
    // Enable/disable download button
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.disabled = this.selectedItems.size === 0;
    
    // Update select all button
    const selectAllBtn = document.getElementById('toggle-select-all');
    if (this.selectedItems.size === this.filteredItems.length && this.filteredItems.length > 0) {
      selectAllBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M0 3a3 3 0 013-3h14a3 3 0 013 3v14a3 3 0 01-3 3H3a3 3 0 01-3-3V3z"/>
        </svg>
        <span>Deselect All</span>
      `;
    } else {
      selectAllBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M0 3a3 3 0 013-3h14a3 3 0 013 3v14a3 3 0 01-3 3H3a3 3 0 01-3-3V3zm3-1a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1V3a1 1 0 00-1-1H3z"/>
        </svg>
        <span>Select All</span>
      `;
    }
  }
  
  /**
   * Update UI after selection change
   */
  updateUI() {
    // Re-render to update checkbox states
    this.renderMedia();
    this.updateCounts();
  }
  
  /**
   * Show context menu
   */
  showContextMenu(event, mediaItem) {
    const menu = document.getElementById('context-menu');
    const itemIndex = parseInt(mediaItem.dataset.index);
    
    this.contextMenuTarget = itemIndex;
    
    menu.style.display = 'block';
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
  }
  
  /**
   * Hide context menu
   */
  hideContextMenu() {
    const menu = document.getElementById('context-menu');
    menu.style.display = 'none';
    this.contextMenuTarget = null;
  }
  
  /**
   * Handle context menu action
   */
  async handleContextAction(action) {
    if (this.contextMenuTarget === null) return;
    
    const item = this.mediaItems[this.contextMenuTarget];
    
    switch (action) {
      case 'preview':
        this.openLightbox(this.contextMenuTarget);
        break;
        
      case 'download-single':
        await this.downloadSingle(item);
        break;
        
      case 'copy-url':
        await this.copyUrl(item.url);
        break;
        
      case 'select-similar':
        this.selectSimilar(item.type);
        break;
    }
    
    this.hideContextMenu();
  }
  
  /**
   * Open lightbox
   */
  openLightbox(index) {
    this.lightboxIndex = index;
    const item = this.mediaItems[index];
    
    const lightbox = document.getElementById('lightbox');
    const image = document.getElementById('lightbox-image');
    const video = document.getElementById('lightbox-video');
    
    document.getElementById('lightbox-filename').textContent = item.filename;
    document.getElementById('lightbox-meta').textContent = `${item.type} • #${index + 1} of ${this.mediaItems.length}`;
    
    if (item.type === 'video') {
      image.style.display = 'none';
      video.style.display = 'block';
      video.src = item.url;
    } else {
      video.style.display = 'none';
      image.style.display = 'block';
      image.src = item.url;
    }
    
    lightbox.style.display = 'flex';
    
    this.updateLightboxSelectButton();
  }
  
  /**
   * Close lightbox
   */
  closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.style.display = 'none';
    
    const video = document.getElementById('lightbox-video');
    video.pause();
    video.src = '';
    
    this.lightboxIndex = -1;
  }
  
  /**
   * Navigate lightbox
   */
  navigateLightbox(direction) {
    let newIndex = this.lightboxIndex + direction;
    
    if (newIndex < 0) {
      newIndex = this.mediaItems.length - 1;
    } else if (newIndex >= this.mediaItems.length) {
      newIndex = 0;
    }
    
    this.openLightbox(newIndex);
  }
  
  /**
   * Download current lightbox item
   */
  async downloadSingle(item) {
    try {
      const link = document.createElement('a');
      link.href = item.url;
      link.download = item.filename;
      link.click();
      
      Notification.success('Download started', {
        title: 'Success'
      });
    } catch (error) {
      console.error('Download failed:', error);
      Notification.error('Failed to download item');
    }
  }
  
  /**
   * Download current lightbox item
   */
  downloadCurrentLightbox() {
    if (this.lightboxIndex >= 0) {
      const item = this.mediaItems[this.lightboxIndex];
      this.downloadSingle(item);
    }
  }
  
  /**
   * Toggle select current lightbox item
   */
  toggleSelectCurrentLightbox() {
    if (this.lightboxIndex >= 0) {
      this.toggleSelect(this.lightboxIndex);
      this.updateLightboxSelectButton();
    }
  }
  
  /**
   * Update lightbox select button
   */
  updateLightboxSelectButton() {
    const btn = document.getElementById('lightbox-toggle-select');
    const isSelected = this.selectedItems.has(this.lightboxIndex);
    
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M0 3a3 3 0 013-3h14a3 3 0 013 3v14a3 3 0 01-3 3H3a3 3 0 01-3-3V3z${isSelected ? 'M6.5 10.5l2 2 5-5' : 'm3-1a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1V3a1 1 0 00-1-1H3z'}"/>
      </svg>
      ${isSelected ? 'Deselect' : 'Select'}
    `;
  }
  
  /**
   * Copy URL to clipboard
   */
  async copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      Notification.success('URL copied to clipboard', {
        duration: 2000
      });
    } catch (error) {
      console.error('Failed to copy URL:', error);
      Notification.error('Failed to copy URL');
    }
  }
  
  /**
   * Select all similar items
   */
  selectSimilar(type) {
    this.mediaItems.forEach((item, index) => {
      if (item.type === type) {
        this.selectedItems.add(index);
      }
    });
    
    this.updateUI();
    
    Notification.success(`Selected all ${type}s`, {
      duration: 2000
    });
  }
  
  /**
   * Handle keyboard shortcuts
   */
  handleKeyboard(e) {
    // Escape - close lightbox
    if (e.key === 'Escape' && this.lightboxIndex >= 0) {
      this.closeLightbox();
    }
    
    // Arrow keys - navigate lightbox
    if (this.lightboxIndex >= 0) {
      if (e.key === 'ArrowLeft') {
        this.navigateLightbox(-1);
      } else if (e.key === 'ArrowRight') {
        this.navigateLightbox(1);
      }
    }
    
    // Ctrl/Cmd + A - select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      this.toggleSelectAll();
    }
    
    // Space - toggle select current lightbox item
    if (e.key === ' ' && this.lightboxIndex >= 0) {
      e.preventDefault();
      this.toggleSelectCurrentLightbox();
    }
  }
  
  /**
   * Start download
   */
  async startDownload() {
    if (this.selectedItems.size === 0) {
      Notification.warning('Please select at least one item');
      return;
    }
    
    const confirmed = await Modal.confirm({
      title: 'Start Download?',
      message: `You are about to download ${this.selectedItems.size} item${this.selectedItems.size > 1 ? 's' : ''}. This may take some time depending on your settings.`,
      confirmText: 'Start Download',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    try {
      // Update session with selected items
      const selectedMediaItems = Array.from(this.selectedItems).map(index => 
        this.mediaItems[index]
      );
      
      // Get download settings
      const organizeFolders = document.getElementById('organize-folders').checked;
      const addMetadata = document.getElementById('add-metadata').checked;
      
      // Start download
      const response = await chrome.runtime.sendMessage({
        type: 'START_DOWNLOAD',
        payload: {
          sessionId: this.sessionId,
          mediaItems: selectedMediaItems,
          settings: {
            organizeFolders,
            addMetadata
          }
        }
      });
      
      if (response.success) {
        // Show progress toast
        this.progressToast = new ProgressToast(this.sessionId);
        this.progressToast.show();
        
        // Show success notification
        Notification.success('Download started!', {
          title: 'Success',
          duration: 3000
        });
        
        // Close window after delay
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        throw new Error(response.error || 'Failed to start download');
      }
    } catch (error) {
      console.error('Failed to start download:', error);
      Notification.error(error.message || 'Failed to start download', {
        title: 'Error'
      });
    }
  }
  
  /**
   * Cancel and close
   */
  async cancel() {
    const confirmed = await Modal.confirm({
      title: 'Cancel?',
      message: 'Are you sure you want to cancel? Your selection will be lost.',
      confirmText: 'Yes, Cancel',
      cancelText: 'No, Continue',
      danger: true
    });
    
    if (confirmed) {
      // Delete session
      await chrome.runtime.sendMessage({
        type: 'DELETE_SESSION',
        payload: { sessionId: this.sessionId }
      });
      
      window.close();
    }
  }
  
  /**
   * Show error
   */
  showError(message) {
    const grid = document.getElementById('media-grid');
    grid.innerHTML = `
      <div class="loading-state">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="32" cy="32" r="28"/>
          <path d="M32 20v16m0 4v4"/>
        </svg>
        <p style="color: #ef4444;">${message}</p>
        <button class="btn btn-secondary" onclick="window.close()" style="margin-top: 16px;">
          Close Window
        </button>
      </div>
    `;
  }
  
  /**
   * Cleanup on unload
   */
  cleanup() {
    if (this.progressToast) {
      this.progressToast.hide();
    }
    
    console.log('Preview app cleaned up');
  }
  
}

// Initialize app
const app = new PreviewApp();

// Add lastFailNotification tracker
app.lastFailNotification = 0;

app.init();

window.addEventListener('beforeunload', () => {
  app.cleanup();
});

// Handle messages
// Handle messages (替换原来的简单版本)
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log('Preview received message:', message.type);
  
  // switch (message.type) {
    // case 'DOWNLOAD_PROGRESS':
      // // Update progress if toast is active
      // if (app.progressToast) {
        // app.progressToast.update();
      // }
      // break;
      
    // case 'DOWNLOAD_COMPLETE':
      // // Show completion notification
      // Notification.success('Download completed successfully!', {
        // title: 'Success',
        // duration: 5000
      // });
      
      // // Hide progress toast
      // if (app.progressToast) {
        // app.progressToast.showCompleted();
      // }
      
      // // Auto-close window after delay
      // setTimeout(() => {
        // window.close();
      // }, 3000);
      // break;
      
    // case 'DOWNLOAD_FAILED':
      // // Show error notification
      // Notification.error(message.payload?.error || 'Download failed', {
        // title: 'Download Failed',
        // persistent: true
      // });
      
      // // Hide progress toast
      // if (app.progressToast) {
        // app.progressToast.hide();
      // }
      // break;
      
    // case 'DOWNLOAD_PAUSED':
      // Notification.info('Download paused', {
        // title: 'Paused',
        // duration: 3000
      // });
      // break;
      
    // case 'DOWNLOAD_RESUMED':
      // Notification.info('Download resumed', {
        // title: 'Resumed',
        // duration: 3000
      // });
      
      // // Restart progress updates
      // if (app.progressToast) {
        // app.progressToast.startUpdates();
      // }
      // break;
      
    // case 'RATE_LIMIT_HIT':
      // Notification.warning('Rate limit detected. Waiting before retrying...', {
        // title: 'Rate Limit',
        // duration: 5000
      // });
      // break;
      
    // case 'ITEM_DOWNLOADED':
      // // Individual item completed
      // const { item, progress } = message.payload || {};
      
      // if (progress && progress.completed % 10 === 0) {
        // // Show progress every 10 items
        // Notification.info(`Downloaded ${progress.completed}/${progress.total} items`, {
          // title: 'Progress Update',
          // duration: 2000
        // });
      // }
      // break;
      
    // case 'ITEM_FAILED':
      // // Individual item failed
      // const failedItem = message.payload?.item;
      // const error = message.payload?.error;
      
      // console.warn('Item download failed:', {
        // filename: failedItem?.filename,
        // error: error
      // });
      
      // // Show notification for failed items (throttled)
      // if (!app.lastFailNotification || Date.now() - app.lastFailNotification > 5000) {
        // Notification.warning(`Failed to download: ${failedItem?.filename}`, {
          // title: 'Item Failed',
          // duration: 3000
        // });
        // app.lastFailNotification = Date.now();
      // }
      // break;
      
    // case 'SESSION_UPDATED':
      // // Session data changed
      // if (message.payload?.sessionId === app.sessionId) {
        // app.loadSession().catch(err => {
          // console.error('Failed to reload session:', err);
        // });
      // }
      // break;
      
    // case 'NETWORK_ERROR':
      // Notification.error('Network error detected. Downloads will retry automatically.', {
        // title: 'Network Error',
        // duration: 4000
      // });
      // break;
      
    // case 'STORAGE_WARNING':
      // Notification.warning('Browser storage is running low. Consider clearing old data.', {
        // title: 'Storage Warning',
        // persistent: true
      // });
      // break;
      
    // default:
      // console.log('Unhandled message type:', message.type);
  // }
  
  // // Send response
  // sendResponse({ received: true });
  
  // // Keep channel open
  // return true;
// });

// Add to PreviewApp class: track last notification time
// (在 PreviewApp constructor 中添加)
// this.lastFailNotification = 0;

// Handle visibility change (pause updates when hidden)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('Preview page hidden');
  } else {
    console.log('Preview page visible');
    // Refresh data when page becomes visible
    if (app.sessionId) {
      app.loadSession().catch(err => {
        console.error('Failed to reload session:', err);
      });
    }
  }
});

// Enhanced message listener with better error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Preview received message:', message.type, message.payload);
  
  try {
    switch (message.type) {
      case 'DOWNLOAD_PROGRESS':
        // Update progress if toast is active
        if (app.progressToast) {
          app.progressToast.update();
        }
        sendResponse({ received: true });
        break;
        
      case 'DOWNLOAD_COMPLETE':
        // Show completion notification
        Notification.success('Download completed successfully! 🎉', {
          title: 'All Done',
          duration: 5000,
          actions: [
            {
              text: 'View Downloads',
              handler: () => {
                chrome.downloads.showDefaultFolder();
              }
            }
          ]
        });
        
        // Show completion in toast
        if (app.progressToast) {
          app.progressToast.showCompleted();
        }
        
        // Auto-close window after delay
        setTimeout(() => {
          window.close();
        }, 3000);
        
        sendResponse({ received: true });
        break;
        
      case 'DOWNLOAD_FAILED':
        // Show error notification
        const errorMsg = message.payload?.error || 'Download failed';
        Notification.error(errorMsg, {
          title: 'Download Failed',
          persistent: true,
          actions: [
            {
              text: 'View Logs',
              handler: () => {
                chrome.runtime.openOptionsPage();
              }
            }
          ]
        });
        
        // Hide progress toast
        if (app.progressToast) {
          app.progressToast.hide();
        }
        
        sendResponse({ received: true });
        break;
        
      case 'DOWNLOAD_PAUSED':
        Notification.info('Download paused', {
          title: 'Paused',
          duration: 3000,
          icon: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          `
        });
        sendResponse({ received: true });
        break;
        
      case 'DOWNLOAD_RESUMED':
        Notification.info('Download resumed', {
          title: 'Resumed',
          duration: 3000,
          icon: `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          `
        });
        
        // Restart progress updates
        if (app.progressToast) {
          app.progressToast.startUpdates();
        }
        
        sendResponse({ received: true });
        break;
        
      case 'RATE_LIMIT_HIT':
        const retryAfter = message.payload?.retryAfter || 60;
        Notification.warning(
          `Rate limit detected. Waiting ${retryAfter}s before retrying...`, 
          {
            title: 'Rate Limit',
            duration: 5000
          }
        );
        sendResponse({ received: true });
        break;
        
      case 'ITEM_DOWNLOADED':
        // Individual item completed
        const { item, progress } = message.payload || {};
        
        // Show progress milestone notifications
        if (progress && progress.completed % 10 === 0) {
          Notification.info(
            `Downloaded ${progress.completed}/${progress.total} items (${progress.percentage}%)`, 
            {
              title: 'Progress Update',
              duration: 2000,
              progress: progress.percentage
            }
          );
        }
        
        sendResponse({ received: true });
        break;
        
      case 'ITEM_FAILED':
        // Individual item failed
        const failedItem = message.payload?.item;
        const error = message.payload?.error;
        
        console.warn('Item download failed:', {
          filename: failedItem?.filename,
          error: error
        });
        
        // Throttle fail notifications (max 1 per 5 seconds)
        if (!app.lastFailNotification || Date.now() - app.lastFailNotification > 5000) {
          Notification.warning(
            `Failed: ${failedItem?.filename || 'Unknown file'}`, 
            {
              title: 'Item Failed',
              duration: 3000
            }
          );
          app.lastFailNotification = Date.now();
        }
        
        sendResponse({ received: true });
        break;
        
      case 'SESSION_UPDATED':
        // Session data changed
        if (message.payload?.sessionId === app.sessionId) {
          app.loadSession().catch(err => {
            console.error('Failed to reload session:', err);
          });
        }
        sendResponse({ received: true });
        break;
        
      case 'NETWORK_ERROR':
        Notification.error(
          'Network error detected. Downloads will retry automatically.', 
          {
            title: 'Network Error',
            duration: 4000,
            icon: `
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>
              </svg>
            `
          }
        );
        sendResponse({ received: true });
        break;
        
      case 'STORAGE_WARNING':
        Notification.warning(
          'Browser storage is running low. Consider clearing old data.', 
          {
            title: 'Storage Warning',
            persistent: true,
            actions: [
              {
                text: 'Clear Data',
                handler: () => {
                  chrome.runtime.openOptionsPage();
                }
              }
            ]
          }
        );
        sendResponse({ received: true });
        break;
        
      case 'UPDATE_SELECTION':
        // Update selection from external source
        if (message.payload?.selectedIndices) {
          app.selectedItems = new Set(message.payload.selectedIndices);
          app.updateUI();
        }
        sendResponse({ received: true });
        break;
        
      default:
        console.log('Unhandled message type:', message.type);
        sendResponse({ received: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ received: false, error: error.message });
  }
  
  // Keep channel open for async responses
  return true;
});

// Listen for keyboard shortcuts globally
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + D - Start download
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    document.getElementById('download-btn').click();
  }
  
  // Ctrl/Cmd + F - Focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    document.getElementById('search-input').focus();
  }
  
  // Ctrl/Cmd + I - Toggle view mode
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault();
    const currentView = app.currentView;
    app.setView(currentView === 'grid' ? 'list' : 'grid');
  }
});

// Performance monitoring
if (window.performance) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      console.log('Preview page loaded in:', pageLoadTime, 'ms');
    }, 0);
  });
}

// Error boundary for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error in preview:', event.error);
  
  Notification.error('An unexpected error occurred', {
    title: 'Error',
    duration: 4000
  });
});

// Error boundary for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in preview:', event.reason);
  
  Notification.error('An unexpected error occurred', {
    title: 'Error',
    duration: 4000
  });
});

console.log('Preview page script loaded and ready');

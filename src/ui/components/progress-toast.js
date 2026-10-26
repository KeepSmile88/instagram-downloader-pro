/**
 * Progress Toast Component
 * Floating progress indicator for downloads
 */

export class ProgressToast {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.element = null;
    this.updateInterval = null;
    this.isMinimized = false;
    this.startTime = Date.now();
    this.itemsCompleted = 0;
    this.speedHistory = [];
  }
  
  /**
   * Show toast
   */
  show() {
    if (this.element) return;
    
    this.element = this.create();
    document.body.appendChild(this.element);
    
    // Start updates
    this.startUpdates();
    
    // Animate in
    requestAnimationFrame(() => {
      this.element.classList.add('toast-enter');
    });
  }
  
  /**
   * Create toast element
   */
  create() {
    const toast = document.createElement('div');
    toast.className = 'progress-toast';
    toast.innerHTML = `
      <div class="toast-header">
        <div class="toast-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8 11V7l5 4-5 4v-4z"/>
          </svg>
        </div>
        <div class="toast-title">Downloading...</div>
        <div class="toast-controls">
          <button class="toast-btn toast-minimize" title="Minimize">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 8h12"/>
            </svg>
          </button>
          <button class="toast-btn toast-close" title="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="toast-body">
        <div class="toast-stats">
          <div class="toast-stat">
            <span class="toast-stat-value" id="toast-current">0</span>
            <span class="toast-stat-label">/ <span id="toast-total">0</span></span>
          </div>
          <div class="toast-stat">
            <span class="toast-stat-value" id="toast-percentage">0%</span>
          </div>
        </div>
        
        <div class="toast-progress">
          <div class="toast-progress-bar" id="toast-progress-bar"></div>
        </div>
        
        <div class="toast-details">
          <div class="toast-detail">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 0a7 7 0 110 14A7 7 0 017 0zM7 3v4l3 2"/>
            </svg>
            <span id="toast-eta">Calculating...</span>
          </div>
          <div class="toast-detail">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1v6l4 2"/>
            </svg>
            <span id="toast-speed">0 items/min</span>
          </div>
        </div>
      </div>
      
      <div class="toast-actions">
        <button class="toast-action-btn toast-pause" id="toast-pause">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3h2v10H5zM9 3h2v10H9z"/>
          </svg>
          Pause
        </button>
        <button class="toast-action-btn toast-cancel" id="toast-cancel">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 110 14A7 7 0 018 1zM5 7v2h6V7H5z"/>
          </svg>
          Cancel
        </button>
      </div>
    `;
    
    this.injectStyles();
    this.setupEventListeners(toast);
    
    return toast;
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners(toast) {
    // Minimize button
    toast.querySelector('.toast-minimize').addEventListener('click', () => {
      this.toggleMinimize();
    });
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.hide();
    });
    
    // Pause button
    toast.querySelector('#toast-pause').addEventListener('click', () => {
      this.togglePause();
    });
    
    // Cancel button
    toast.querySelector('#toast-cancel').addEventListener('click', () => {
      this.cancel();
    });
  }
  
  /**
   * Start periodic updates
   */
  startUpdates() {
    this.updateInterval = setInterval(() => {
      this.update();
    }, 1000);
  }
  
  /**
   * Update progress
   */
  async update() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PROGRESS',
        payload: { sessionId: this.sessionId }
      });
      
      if (response.progress) {
        this.renderProgress(response.progress);
      }
      
      // Stop if completed
      if (response.progress?.status === 'completed') {
        this.showCompleted();
        this.stopUpdates();
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }
  
  /**
   * Render progress data
   */
  renderProgress(progress) {
    if (!this.element) return;
    
    // Update numbers
    this.element.querySelector('#toast-current').textContent = progress.completed;
    this.element.querySelector('#toast-total').textContent = progress.total;
    this.element.querySelector('#toast-percentage').textContent = `${progress.percentage}%`;
    
    // Update progress bar
    this.element.querySelector('#toast-progress-bar').style.width = `${progress.percentage}%`;
    
    // Calculate speed
    const elapsed = (Date.now() - this.startTime) / 1000 / 60; // minutes
    const speed = elapsed > 0 ? (progress.completed / elapsed).toFixed(1) : 0;
    this.element.querySelector('#toast-speed').textContent = `${speed} items/min`;
    
    // Calculate ETA
    if (progress.pending > 0 && speed > 0) {
      const remainingMinutes = progress.pending / speed;
      const eta = this.formatETA(remainingMinutes);
      this.element.querySelector('#toast-eta').textContent = eta;
    } else {
      this.element.querySelector('#toast-eta').textContent = 'Calculating...';
    }
    
    // Track completed for speed calculation
    if (progress.completed > this.itemsCompleted) {
      this.itemsCompleted = progress.completed;
    }
  }
  
  /**
   * Format ETA
   */
  formatETA(minutes) {
    if (minutes < 1) return 'Less than 1 min';
    if (minutes < 60) return `${Math.ceil(minutes)} min remaining`;
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.ceil(minutes % 60);
    return `${hours}h ${mins}m remaining`;
  }
  
  /**
   * Toggle minimize
   */
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    
    if (this.isMinimized) {
      this.element.classList.add('toast-minimized');
      this.element.querySelector('.toast-minimize svg').innerHTML = `
        <path d="M4 8h8M8 4v8"/>
      `;
    } else {
      this.element.classList.remove('toast-minimized');
      this.element.querySelector('.toast-minimize svg').innerHTML = `
        <path d="M2 8h12"/>
      `;
    }
  }
  
  /**
   * Toggle pause
   */
  async togglePause() {
    const pauseBtn = this.element.querySelector('#toast-pause');
    const isPaused = pauseBtn.classList.contains('paused');
    
    if (isPaused) {
      // Resume
      await chrome.runtime.sendMessage({
        type: 'RESUME_DOWNLOAD',
        payload: { sessionId: this.sessionId }
      });
      
      pauseBtn.classList.remove('paused');
      pauseBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5 3h2v10H5zM9 3h2v10H9z"/>
        </svg>
        Pause
      `;
      
      this.startUpdates();
    } else {
      // Pause
      await chrome.runtime.sendMessage({
        type: 'PAUSE_DOWNLOAD',
        payload: { sessionId: this.sessionId }
      });
      
      pauseBtn.classList.add('paused');
      pauseBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5 3l8 5-8 5V3z"/>
        </svg>
        Resume
      `;
      
      this.stopUpdates();
    }
  }
  
  /**
   * Cancel download
   */
  async cancel() {
    const confirmed = confirm('Are you sure you want to cancel this download?');
    
    if (confirmed) {
      await chrome.runtime.sendMessage({
        type: 'CANCEL_DOWNLOAD',
        payload: { sessionId: this.sessionId }
      });
      
      this.hide();
    }
  }
  
  /**
   * Show completed state
   */
  showCompleted() {
    if (!this.element) return;
    
    this.element.classList.add('toast-completed');
    
    this.element.querySelector('.toast-title').textContent = 'Download Complete!';
    this.element.querySelector('.toast-icon').innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M7 10l2 2 4-4"/>
        <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
    
    // Hide action buttons
    this.element.querySelector('.toast-actions').style.display = 'none';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hide();
    }, 5000);
  }
  
  /**
   * Stop updates
   */
  stopUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Hide toast
   */
  hide() {
    if (!this.element) return;
    
    this.stopUpdates();
    
    this.element.classList.remove('toast-enter');
    this.element.classList.add('toast-exit');
    
    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.remove();
      }
      this.element = null;
    }, 300);
  }
  
  /**
   * Inject styles
   */
  injectStyles() {
    if (document.getElementById('progress-toast-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'progress-toast-styles';
    style.textContent = `
      .progress-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        width: 360px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        opacity: 0;
        transform: translateY(100px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .progress-toast.toast-enter {
        opacity: 1;
        transform: translateY(0);
      }
      
      .progress-toast.toast-exit {
        opacity: 0;
        transform: translateY(100px);
      }
      
      .progress-toast.toast-minimized .toast-body,
      .progress-toast.toast-minimized .toast-actions {
        display: none;
      }
      
      .progress-toast.toast-completed {
        border: 2px solid #10b981;
      }
      
      .toast-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .toast-icon {
        flex-shrink: 0;
      }
      
      .toast-title {
        flex: 1;
        font-weight: 600;
        font-size: 14px;
      }
      
      .toast-controls {
        display: flex;
        gap: 4px;
      }
      
      .toast-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .toast-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .toast-body {
        padding: 16px;
      }
      
      .toast-stats {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      
      .toast-stat-value {
        font-size: 24px;
        font-weight: 700;
        color: #1f2937;
      }
      
      .toast-stat-label {
        font-size: 14px;
        color: #6b7280;
      }
      
      .toast-progress {
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      
      .toast-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        transition: width 0.3s ease;
      }
      
      .toast-details {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: #6b7280;
      }
      
      .toast-detail {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .toast-actions {
        display: flex;
        gap: 8px;
        padding: 0 16px 16px;
      }
      
      .toast-action-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .toast-pause {
        background: #f3f4f6;
        color: #374151;
      }
      
      .toast-pause:hover {
        background: #e5e7eb;
      }
      
      .toast-pause.paused {
        background: #dbeafe;
        color: #1e40af;
      }
      
      .toast-cancel {
        background: #fee2e2;
        color: #991b1b;
      }
      
      .toast-cancel:hover {
        background: #fecaca;
      }
    `;
    
    document.head.appendChild(style);
  }
}


/**
 * Onboarding Script
 * First-time user experience and setup
 */

class OnboardingApp {
  constructor() {
    this.currentSlide = 0;
    this.totalSlides = 4;
    this.settings = {
      delayMin: 1000,
      delayMax: 3000,
      concurrentDownloads: 3,
      organizeFolders: true,
      addMetadata: true,
      notifications: true,
      autoResume: true
    };
  }
  
  /**
   * Initialize onboarding
   */
  async init() {
    try {
      console.log('Onboarding initialized');
      
      // Setup event listeners
      this.setupNavigation();
      this.setupSettings();
      this.setupFinalActions();
      
      // Load any existing settings
      await this.loadExistingSettings();
      
      // Show first slide with animation
      this.showSlide(0);
      
    } catch (error) {
      console.error('Onboarding initialization failed:', error);
    }
  }
  
  /**
   * Load existing settings if any
   */
  async loadExistingSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS'
      });
      
      if (response.settings) {
        this.settings = { ...this.settings, ...response.settings };
        this.updateSettingsUI();
      }
    } catch (error) {
      console.log('No existing settings to load');
    }
  }
  
  /**
   * Setup navigation
   */
  setupNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.addEventListener('click', () => {
      this.previousSlide();
    });
    
    nextBtn.addEventListener('click', () => {
      this.nextSlide();
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        this.nextSlide();
      } else if (e.key === 'ArrowLeft') {
        this.previousSlide();
      }
    });
    
    // Progress step clicks
    document.querySelectorAll('.progress-step').forEach((step, index) => {
      step.addEventListener('click', () => {
        this.goToSlide(index);
      });
    });
  }
  
  /**
   * Setup settings controls
   */
  setupSettings() {
    // Delay slider
    const delaySlider = document.getElementById('delay-setting');
    const delayValue = document.getElementById('delay-value');
    
    delaySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      delayValue.textContent = (value / 1000).toFixed(1);
      this.settings.delayMin = Math.max(500, value - 500);
      this.settings.delayMax = value;
    });
    
    // Concurrent downloads slider
    const concurrentSlider = document.getElementById('concurrent-setting');
    const concurrentValue = document.getElementById('concurrent-value');
    
    concurrentSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      concurrentValue.textContent = value;
      this.settings.concurrentDownloads = value;
    });
    
    // Organization radio buttons
    document.querySelectorAll('input[name="organization"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.settings.organizeFolders = e.target.value === 'folders';
      });
    });
    
    // Checkboxes
    document.getElementById('metadata-setting').addEventListener('change', (e) => {
      this.settings.addMetadata = e.target.checked;
    });
    
    document.getElementById('notifications-setting').addEventListener('change', (e) => {
      this.settings.notifications = e.target.checked;
    });
    
    document.getElementById('auto-resume-setting').addEventListener('change', (e) => {
      this.settings.autoResume = e.target.checked;
    });
  }
  
  /**
   * Update settings UI with current values
   */
  updateSettingsUI() {
    // Delay
    const avgDelay = (this.settings.delayMin + this.settings.delayMax) / 2;
    document.getElementById('delay-setting').value = avgDelay;
    document.getElementById('delay-value').textContent = (avgDelay / 1000).toFixed(1);
    
    // Concurrent
    document.getElementById('concurrent-setting').value = this.settings.concurrentDownloads;
    document.getElementById('concurrent-value').textContent = this.settings.concurrentDownloads;
    
    // Organization
    const orgValue = this.settings.organizeFolders ? 'folders' : 'flat';
    document.querySelector(`input[name="organization"][value="${orgValue}"]`).checked = true;
    
    // Checkboxes
    document.getElementById('metadata-setting').checked = this.settings.addMetadata;
    document.getElementById('notifications-setting').checked = this.settings.notifications;
    document.getElementById('auto-resume-setting').checked = this.settings.autoResume;
  }
  
  /**
   * Setup final action buttons
   */
  setupFinalActions() {
    // Open Instagram button
    document.getElementById('open-instagram').addEventListener('click', async () => {
      await this.saveSettings();
      await this.completeOnboarding();
      
      // Open Instagram in new tab
      chrome.tabs.create({ url: 'https://www.instagram.com' });
      
      // Close onboarding
      window.close();
    });
    
    // Open settings button
    document.getElementById('open-settings').addEventListener('click', async () => {
      await this.saveSettings();
      await this.completeOnboarding();
      
      // Open settings page
      chrome.runtime.openOptionsPage();
      
      // Close onboarding
      window.close();
    });
  }
  
  /**
   * Show specific slide
   */
  showSlide(index) {
    if (index < 0 || index >= this.totalSlides) return;
    
    const slides = document.querySelectorAll('.slide');
    const steps = document.querySelectorAll('.progress-step');
    
    // Update slides
    slides.forEach((slide, i) => {
      slide.classList.remove('active', 'prev');
      
      if (i === index) {
        slide.classList.add('active');
      } else if (i < index) {
        slide.classList.add('prev');
      }
    });
    
    // Update progress steps
    steps.forEach((step, i) => {
      step.classList.remove('active', 'completed');
      
      if (i === index) {
        step.classList.add('active');
      } else if (i < index) {
        step.classList.add('completed');
      }
    });
    
    this.currentSlide = index;
    this.updateNavigation();
  }
  
  /**
   * Go to specific slide
   */
  goToSlide(index) {
    // Prevent skipping ahead past settings
    if (index > this.currentSlide + 1 && index >= 2) {
      return;
    }
    
    this.showSlide(index);
  }
  
  /**
   * Next slide
   */
  nextSlide() {
    if (this.currentSlide < this.totalSlides - 1) {
      this.showSlide(this.currentSlide + 1);
      
      // Save settings when leaving settings slide
      if (this.currentSlide === 3) {
        this.saveSettings();
      }
    } else {
      // On last slide, complete onboarding
      this.completeOnboarding();
    }
  }
  
  /**
   * Previous slide
   */
  previousSlide() {
    if (this.currentSlide > 0) {
      this.showSlide(this.currentSlide - 1);
    }
  }
  
  /**
   * Update navigation buttons
   */
  updateNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // Previous button
    if (this.currentSlide === 0) {
      prevBtn.style.visibility = 'hidden';
    } else {
      prevBtn.style.visibility = 'visible';
    }
    
    // Next button
    if (this.currentSlide === this.totalSlides - 1) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'flex';
      nextBtn.innerHTML = `
        Next
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 4l8 8-8 8-2-2 6-6-6-6 2-2z"/>
        </svg>
      `;
    }
  }
  
  /**
   * Save settings
   */
  async saveSettings() {
    try {
      console.log('Saving onboarding settings:', this.settings);
      
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: {
          settings: {
            delayMin: this.settings.delayMin,
            delayMax: this.settings.delayMax,
            concurrentDownloads: this.settings.concurrentDownloads,
            organizeFolders: this.settings.organizeFolders,
            addMetadata: this.settings.addMetadata,
            notifications: this.settings.notifications,
            autoResume: this.settings.autoResume,
            firstTime: false
          }
        }
      });
      
      console.log('Settings saved successfully');
      
      // Show success feedback
      this.showSaveSuccess();
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showSaveError();
    }
  }
  
  /**
   * Show save success feedback
   */
  showSaveSuccess() {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(16, 185, 129, 0.95);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideInRight 0.3s ease;
    `;
    
    feedback.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M0 10l5 5 10-10 2 2-12 12-7-7 2-2z"/>
      </svg>
      Settings Saved!
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      feedback.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }
  
  /**
   * Show save error feedback
   */
  showSaveError() {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(239, 68, 68, 0.95);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideInRight 0.3s ease;
    `;
    
    feedback.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 0a10 10 0 100 20 10 10 0 000-20zm1 15H9v-2h2v2zm0-4H9V5h2v6z"/>
      </svg>
      Failed to save settings
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      feedback.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => feedback.remove(), 300);
    }, 3000);
  }
  
  /**
   * Complete onboarding
   */
  async completeOnboarding() {
    try {
      // Mark onboarding as complete
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: {
          settings: {
            onboardingComplete: true,
            firstTime: false
          }
        }
      });
      
      console.log('Onboarding completed');
      
      // Track completion event
      this.trackCompletion();
      
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  }
  
  /**
   * Track completion
   */
  trackCompletion() {
    // You can add analytics tracking here
    console.log('Onboarding completion tracked', {
      timestamp: Date.now(),
      settings: this.settings
    });
  }
  
  /**
   * Skip onboarding
   */
  async skip() {
    const confirmed = confirm('Are you sure you want to skip the setup? You can always access settings later.');
    
    if (confirmed) {
      await this.completeOnboarding();
      window.close();
    }
  }
}

// Initialize app
const app = new OnboardingApp();
app.init();

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
  
  /* Smooth transitions */
  .slide {
    will-change: transform, opacity;
  }
  
  .progress-step {
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .progress-step:hover {
    transform: scale(1.1);
  }
  
  .progress-step.completed {
    cursor: pointer;
  }
  
  /* Feature card hover effects */
  .feature-card {
    will-change: transform;
  }
  
  /* Step card animations */
  .step-card {
    will-change: transform;
  }
  
  /* Tip card animations */
  .tip-card {
    will-change: transform;
  }
  
  /* Button hover effects */
  .btn {
    will-change: transform;
  }
  
  /* Loading animation for settings save */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  /* Slide entrance animations */
  .slide.active .slide-content > * {
    animation: fadeInUp 0.5s ease backwards;
  }
  
  .slide.active .slide-content > *:nth-child(1) {
    animation-delay: 0.1s;
  }
  
  .slide.active .slide-content > *:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .slide.active .slide-content > *:nth-child(3) {
    animation-delay: 0.3s;
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Tooltip for progress steps */
  .progress-step::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: -30px;
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s;
  }
  
  .progress-step:hover::after {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`;
document.head.appendChild(style);

// Add escape key handler
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    app.skip();
  }
});

// Prevent accidental navigation away
window.addEventListener('beforeunload', (e) => {
  if (app.currentSlide < app.totalSlides - 1) {
    e.preventDefault();
    e.returnValue = 'Are you sure you want to leave? Your progress will be lost.';
    return e.returnValue;
  }
});

// Log when page is ready
window.addEventListener('load', () => {
  console.log('Onboarding page fully loaded');
  
  // Add entrance animation to page
  document.body.style.animation = 'fadeIn 0.5s ease';
});

// Add page entrance animation
const pageStyle = document.createElement('style');
pageStyle.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;
document.head.appendChild(pageStyle);

console.log('Onboarding script loaded');


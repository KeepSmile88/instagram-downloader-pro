/**
 * Theme Management
 * Handle light/dark/auto theme switching
 */

export class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.systemPreference = null;
    this.listeners = [];
  }
  
  /**
   * Initialize theme manager
   */
  async init() {
    // Load saved theme preference
    const saved = await this.loadTheme();
    
    // Setup system preference listener
    this.setupSystemPreferenceListener();
    
    // Apply theme
    this.applyTheme(saved || 'auto');
    
    console.log('Theme manager initialized:', this.currentTheme);
  }
  
  /**
   * Load theme from storage
   */
  async loadTheme() {
    try {
      const result = await chrome.storage.local.get('theme');
      return result.theme;
    } catch (error) {
      console.error('Failed to load theme:', error);
      return null;
    }
  }
  
  /**
   * Save theme to storage
   */
  async saveTheme(theme) {
    try {
      await chrome.storage.local.set({ theme });
      console.log('Theme saved:', theme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }
  
  /**
   * Setup system preference listener
   */
  setupSystemPreferenceListener() {
    if (!window.matchMedia) return;
    
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    this.systemPreference = darkModeQuery.matches ? 'dark' : 'light';
    
    darkModeQuery.addEventListener('change', (e) => {
      this.systemPreference = e.matches ? 'dark' : 'light';
      
      // Re-apply if in auto mode
      if (this.currentTheme === 'auto') {
        this.applyTheme('auto');
      }
    });
  }
  
  /**
   * Apply theme
   */
  applyTheme(theme) {
    this.currentTheme = theme;
    
    let effectiveTheme = theme;
    
    // Resolve auto theme
    if (theme === 'auto') {
      effectiveTheme = this.systemPreference || 'light';
    }
    
    // Apply to document
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    
    // Save preference
    this.saveTheme(theme);
    
    // Notify listeners
    this.notifyListeners(effectiveTheme);
    
    console.log('Theme applied:', theme, '(effective:', effectiveTheme + ')');
  }
  
  /**
   * Set theme
   */
  setTheme(theme) {
    if (!['light', 'dark', 'auto'].includes(theme)) {
      console.error('Invalid theme:', theme);
      return;
    }
    
    this.applyTheme(theme);
  }
  
  /**
   * Toggle between light and dark
   */
  toggleTheme() {
    const current = this.getEffectiveTheme();
    const next = current === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }
  
  /**
   * Get current theme
   */
  getTheme() {
    return this.currentTheme;
  }
  
  /**
   * Get effective theme (resolved auto)
   */
  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return this.systemPreference || 'light';
    }
    return this.currentTheme;
  }
  
  /**
   * Check if dark mode
   */
  isDark() {
    return this.getEffectiveTheme() === 'dark';
  }
  
  /**
   * Check if light mode
   */
  isLight() {
    return this.getEffectiveTheme() === 'light';
  }
  
  /**
   * Add theme change listener
   */
  addListener(callback) {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Notify all listeners
   */
  notifyListeners(theme) {
    this.listeners.forEach(callback => {
      try {
        callback(theme);
      } catch (error) {
        console.error('Theme listener error:', error);
      }
    });
  }
  
  /**
   * Get theme colors for current theme
   */
  getColors() {
    const isDark = this.isDark();
    
    return {
      primary: getComputedStyle(document.documentElement)
        .getPropertyValue('--primary').trim(),
      secondary: getComputedStyle(document.documentElement)
        .getPropertyValue('--secondary').trim(),
      success: getComputedStyle(document.documentElement)
        .getPropertyValue('--success').trim(),
      warning: getComputedStyle(document.documentElement)
        .getPropertyValue('--warning').trim(),
      danger: getComputedStyle(document.documentElement)
        .getPropertyValue('--danger').trim(),
      info: getComputedStyle(document.documentElement)
        .getPropertyValue('--info').trim(),
      textPrimary: getComputedStyle(document.documentElement)
        .getPropertyValue('--text-primary').trim(),
      textSecondary: getComputedStyle(document.documentElement)
        .getPropertyValue('--text-secondary').trim(),
      bgPrimary: getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-primary').trim(),
      bgSecondary: getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-secondary').trim(),
      border: getComputedStyle(document.documentElement)
        .getPropertyValue('--border').trim()
    };
  }
  
  /**
   * Generate CSS custom properties object
   */
  getCSSProperties() {
    const style = getComputedStyle(document.documentElement);
    const properties = {};
    
    // Get all CSS custom properties
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      if (prop.startsWith('--')) {
        properties[prop] = style.getPropertyValue(prop).trim();
      }
    }
    
    return properties;
  }
}

// Create singleton instance
export const themeManager = new ThemeManager();

// Export for direct use
export default themeManager;

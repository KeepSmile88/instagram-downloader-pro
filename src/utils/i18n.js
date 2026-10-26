/**
 * Internationalization System
 */

export class I18n {
  static locale = 'en';
  static messages = {};
  static fallbackLocale = 'en';
  
  /**
   * Initialize i18n system
   */
  static async init() {
    // Detect user's language
    this.locale = this.detectLocale();
    
    // Load messages
    await this.loadMessages(this.locale);
    
    // Load fallback if needed
    if (this.locale !== this.fallbackLocale) {
      await this.loadMessages(this.fallbackLocale);
    }
  }
  
  /**
   * Detect user's locale
   */
  static detectLocale() {
    // From settings
    const stored = localStorage.getItem('igdl_locale');
    if (stored) return stored;
    
    // From browser
    const browserLocale = navigator.language || navigator.userLanguage;
    return browserLocale.split('-')[0]; // en-US -> en
  }
  
  /**
   * Load messages for locale
   */
  static async loadMessages(locale) {
    try {
      const response = await fetch(
        chrome.runtime.getURL(`_locales/${locale}/messages.json`)
      );
      
      if (response.ok) {
        const messages = await response.json();
        this.messages[locale] = messages;
      }
    } catch (error) {
      console.warn(`Failed to load messages for ${locale}:`, error);
    }
  }
  
  /**
   * Translate key with substitutions
   */
  static t(key, substitutions = {}) {
    // Try current locale
    let message = this.messages[this.locale]?.[key]?.message;
    
    // Fallback to default locale
    if (!message && this.locale !== this.fallbackLocale) {
      message = this.messages[this.fallbackLocale]?.[key]?.message;
    }
    
    // If still not found, return key
    if (!message) {
      console.warn(`Translation not found: ${key}`);
      return key;
    }
    
    // Replace substitutions
    return this.substitute(message, substitutions);
  }
  
  /**
   * Replace placeholders in message
   */
  static substitute(message, substitutions) {
    return message.replace(/\{(\w+)\}/g, (match, key) => {
      return substitutions[key] !== undefined ? substitutions[key] : match;
    });
  }
  
  /**
   * Change locale
   */
  static async setLocale(locale) {
    this.locale = locale;
    await this.loadMessages(locale);
    localStorage.setItem('igdl_locale', locale);
    
    // Trigger re-render if needed
    document.dispatchEvent(new CustomEvent('localeChanged', {
      detail: { locale }
    }));
  }
  
  /**
   * Get supported locales
   */
  static getSupportedLocales() {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
      { code: 'it', name: 'Italiano' },
      { code: 'pt', name: 'Português' },
      { code: 'ru', name: 'Русский' },
      { code: 'zh', name: '中文' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' }
    ];
  }
  
  /**
   * Format number according to locale
   */
  static formatNumber(number) {
    return new Intl.NumberFormat(this.locale).format(number);
  }
  
  /**
   * Format date according to locale
   */
  static formatDate(date, options = {}) {
    return new Intl.DateTimeFormat(this.locale, options).format(date);
  }
  
  /**
   * Format relative time
   */
  static formatRelativeTime(date) {
    const now = Date.now();
    const diff = now - date;
    
    const units = [
      { unit: 'year', ms: 31536000000 },
      { unit: 'month', ms: 2592000000 },
      { unit: 'week', ms: 604800000 },
      { unit: 'day', ms: 86400000 },
      { unit: 'hour', ms: 3600000 },
      { unit: 'minute', ms: 60000 },
      { unit: 'second', ms: 1000 }
    ];
    
    for (const { unit, ms } of units) {
      if (diff >= ms) {
        const value = Math.floor(diff / ms);
        return new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' })
          .format(-value, unit);
      }
    }
    
    return new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' })
      .format(0, 'second');
  }
}

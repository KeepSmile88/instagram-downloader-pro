/**
 * Advanced Logging System
 */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

export class Logger {
  static currentLevel = LogLevel.INFO;
  static maxLogs = 1000;
  static logBuffer = [];
  
  static setLevel(level) {
    this.currentLevel = level;
  }
  
  static async log(level, message, context = {}, error = null) {
    if (level < this.currentLevel) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      level: Object.keys(LogLevel)[level],
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : null,
      userAgent: navigator.userAgent,
      url: window.location?.href,
      extensionVersion: chrome.runtime.getManifest().version
    };
    
    // Console output (development)
    this.consoleOutput(entry);
    
    // Buffer for storage
    this.logBuffer.push(entry);
    
    // Persist periodically
    if (this.logBuffer.length >= 10) {
      await this.persistLogs();
    }
    
    // Report critical errors
    if (level >= LogLevel.ERROR) {
      await this.reportError(entry);
    }
  }
  
  static consoleOutput(entry) {
    const style = this.getConsoleStyle(entry.level);
    const method = entry.level === 'ERROR' ? 'error' : 
                   entry.level === 'WARN' ? 'warn' : 'log';
    
    console[method](
      `%c[${entry.level}] ${entry.message}`,
      style,
      entry.context
    );
    
    if (entry.error) {
      console.error(entry.error);
    }
  }
  
  static getConsoleStyle(level) {
    const styles = {
      DEBUG: 'color: #888',
      INFO: 'color: #2196F3',
      WARN: 'color: #FF9800; font-weight: bold',
      ERROR: 'color: #F44336; font-weight: bold'
    };
    return styles[level] || '';
  }
  
  static async persistLogs() {
    if (this.logBuffer.length === 0) return;
    
    try {
      const { logs = [] } = await chrome.storage.local.get('logs');
      const newLogs = [...logs, ...this.logBuffer];
      
      // Keep only recent logs
      const trimmedLogs = newLogs.slice(-this.maxLogs);
      
      await chrome.storage.local.set({ logs: trimmedLogs });
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }
  
  static async reportError(entry) {
    // In production, send to error tracking service
    // For now, just store locally
    try {
      const { errors = [] } = await chrome.storage.local.get('errors');
      errors.push(entry);
      
      await chrome.storage.local.set({ 
        errors: errors.slice(-100) // Keep last 100 errors
      });
    } catch (error) {
      console.error('Failed to report error:', error);
    }
  }
  
  static async getLogs(filters = {}) {
    const { logs = [] } = await chrome.storage.local.get('logs');
    
    let filtered = logs;
    
    if (filters.level) {
      filtered = filtered.filter(log => log.level === filters.level);
    }
    
    if (filters.since) {
      filtered = filtered.filter(log => 
        new Date(log.timestamp) >= new Date(filters.since)
      );
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(search) ||
        JSON.stringify(log.context).toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }
  
  static async clearLogs() {
    await chrome.storage.local.remove('logs');
    this.logBuffer = [];
  }
  
  static async exportLogs() {
    const logs = await this.getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url,
      filename: `igdl_logs_${Date.now()}.json`,
      saveAs: true
    });
  }
  
  // Convenience methods
  static debug(message, context) {
    return this.log(LogLevel.DEBUG, message, context);
  }
  
  static info(message, context) {
    return this.log(LogLevel.INFO, message, context);
  }
  
  static warn(message, context) {
    return this.log(LogLevel.WARN, message, context);
  }
  
  static error(message, context, error) {
    return this.log(LogLevel.ERROR, message, context, error);
  }
}

// Performance monitoring
export class PerformanceMonitor {
  static traces = new Map();
  
  static start(name) {
    this.traces.set(name, {
      startTime: performance.now(),
      startMark: `${name}-start`
    });
    performance.mark(`${name}-start`);
  }
  
  static end(name) {
    const trace = this.traces.get(name);
    if (!trace) {
      Logger.warn('Performance trace not found', { name });
      return;
    }
    
    performance.mark(`${name}-end`);
    performance.measure(name, trace.startMark, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    const duration = measure.duration;
    
    Logger.info(`Performance: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
      startTime: trace.startTime
    });
    
    // Cleanup
    this.traces.delete(name);
    performance.clearMarks();
    performance.clearMeasures();
    
    return duration;
  }
  
  static async(name, fn) {
    return async (...args) => {
      this.start(name);
      try {
        const result = await fn(...args);
        this.end(name);
        return result;
      } catch (error) {
        this.end(name);
        throw error;
      }
    };
  }
}


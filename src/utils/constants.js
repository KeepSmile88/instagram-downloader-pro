/**
 * Application Constants
 */

export const APP_CONFIG = {
  NAME: 'Instagram Downloader Pro',
  VERSION: '2.0.0',
  STORAGE_KEY_PREFIX: 'igdl_',
  MAX_CONCURRENT_DOWNLOADS: 5,
  MAX_RETRY_ATTEMPTS: 3,
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  SESSION_CLEANUP_DAYS: 7
};

export const STORAGE_KEYS = {
  CREDENTIALS: 'credentials',
  SETTINGS: 'settings',
  SESSIONS: 'downloadSessions',
  CURRENT_SESSION: 'currentSession',
  HISTORY: 'downloadHistory',
  ACHIEVEMENTS: 'achievements',
  FIRST_TIME: 'firstTime',
  STATS: 'stats'
};

export const DEFAULT_SETTINGS = {
  delayMin: 1000,
  delayMax: 3000,
  concurrentDownloads: 3,
  quality: 'high',
  autoResume: true,
  notifications: true,
  theme: 'light',
  language: 'en',
  namingTemplate: '{username}_{date}_{index}',
  organizeByDate: false,
  organizeByType: true,
  markDownloaded: true
};

export const SELECTORS = {
  version: '2026.01',
  article: {
    primary: 'article[role="presentation"]',
    fallback: ['article', 'div[class*="Post"]']
  },
  image: {
    primary: 'img[srcset]',
    fallback: ['img[src*="cdninstagram"]', 'img[src*="fbcdn"]']
  },
  video: {
    primary: 'video[src]',
    fallback: ['video source']
  },
  likes: {
    primary: 'section span[class*="like"]',
    fallback: ['button[aria-label*="like"]']
  },
  comments: {
    primary: 'a[href*="/comments/"]',
    fallback: ['span[class*="comment"]']
  }
};

export const ERROR_CODES = {
  NETWORK_ERROR: 'E001',
  AUTH_ERROR: 'E002',
  RATE_LIMIT: 'E003',
  STORAGE_FULL: 'E004',
  PARSE_ERROR: 'E005',
  DOWNLOAD_FAILED: 'E006',
  UNKNOWN_ERROR: 'E999'
};

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  LOADING: 'loading'
};

export const ACHIEVEMENTS = {
  FIRST_DOWNLOAD: {
    id: 'first_download',
    name: 'First Download! 🎉',
    description: 'Downloaded your first Instagram post',
    icon: '🎉',
    condition: (stats) => stats.totalDownloads >= 1
  },
  SPEED_DEMON: {
    id: 'speed_demon',
    name: 'Speed Demon ⚡',
    description: 'Downloaded 100 items in one session',
    icon: '⚡',
    condition: (stats) => stats.maxSessionDownloads >= 100
  },
  COLLECTOR: {
    id: 'collector',
    name: 'Collector 📦',
    description: 'Downloaded over 1,000 items total',
    icon: '📦',
    condition: (stats) => stats.totalDownloads >= 1000
  },
  EFFICIENCY_EXPERT: {
    id: 'efficiency_expert',
    name: 'Efficiency Expert 🎯',
    description: 'Used smart filters 10 times',
    icon: '🎯',
    condition: (stats) => stats.smartFilterUses >= 10
  },
  NIGHT_OWL: {
    id: 'night_owl',
    name: 'Night Owl 🦉',
    description: 'Downloaded content after midnight',
    icon: '🦉',
    condition: (stats) => stats.nightDownloads >= 1
  }
};

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: 'auto'
};

export const PRESETS = {
  BALANCED: {
    id: 'balanced',
    name: 'Balanced ⚖️',
    description: 'Good balance between speed and safety',
    settings: {
      delayMin: 1000,
      delayMax: 3000,
      concurrentDownloads: 3,
      quality: 'high'
    }
  },
  FAST: {
    id: 'fast',
    name: 'Fast ⚡',
    description: 'Download as fast as possible (higher risk)',
    settings: {
      delayMin: 500,
      delayMax: 1500,
      concurrentDownloads: 5,
      quality: 'medium'
    }
  },
  SAFE: {
    id: 'safe',
    name: 'Safe 🛡️',
    description: 'Maximum safety, slower speed',
    settings: {
      delayMin: 2000,
      delayMax: 5000,
      concurrentDownloads: 1,
      quality: 'high'
    }
  }
};


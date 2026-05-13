// ============================================================
// store.js — persistent storage (localStorage for dev, IPC for Electron)
// ============================================================

const Store = {
  async get(key) {
    // Try Electron IPC first
    if (window.electronAPI && window.electronAPI.getStoreValue) {
      try {
        return await window.electronAPI.getStoreValue(key);
      } catch (e) {
        // fallback to localStorage
      }
    }
    // Fallback: localStorage
    try {
      const val = localStorage.getItem('fld_' + key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      return null;
    }
  },

  async set(key, value) {
    if (window.electronAPI && window.electronAPI.setStoreValue) {
      try {
        await window.electronAPI.setStoreValue(key, value);
        return;
      } catch (e) {
        // fallback
      }
    }
    // Fallback: localStorage
    try {
      localStorage.setItem('fld_' + key, JSON.stringify(value));
    } catch (e) {
      // storage full or unavailable
    }
  },

  /** Load stats, returning defaults for missing keys */
  async loadStats() {
    const stored = await this.get('stats');
    if (stored) {
      // Merge with defaults to ensure all keys exist
      return { ...DEFAULT_STATS, ...stored };
    }
    return { ...DEFAULT_STATS };
  },

  /** Save stats */
  async saveStats(stats) {
    await this.set('stats', stats);
  },

  /** Load settings with defaults */
  async loadSettings() {
    const stored = await this.get('settings');
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...stored };
    }
    return { ...DEFAULT_SETTINGS };
  },

  /** Save settings */
  async saveSettings(settings) {
    await this.set('settings', settings);
  },

  /** Load unlocked achievements */
  async loadAchievements() {
    const stored = await this.get('achievements');
    return stored || {};  // { achievementId: "ISO-date-string" }
  },

  /** Save unlocked achievements */
  async saveAchievements(achievements) {
    await this.set('achievements', achievements);
  }
};

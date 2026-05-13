// ============================================================
// achievements.js — achievement tracking & unlocking
// ============================================================

class AchievementManager {
  constructor() {
    this.unlocked = {};      // { id: "ISO-date" }
    this.newlyUnlocked = []; // queue for toast display
    this.onUnlock = null;    // callback (achievement) => void
  }

  /** Load unlocked achievements from store */
  async init() {
    this.unlocked = await Store.loadAchievements();
  }

  /** Check all achievements against current stats */
  checkAll(stats) {
    this.newlyUnlocked = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.unlocked[ach.id]) continue; // already unlocked
      try {
        if (ach.check(stats)) {
          this.unlocked[ach.id] = new Date().toISOString();
          this.newlyUnlocked.push(ach);
        }
      } catch (e) {
        // ignore check errors
      }
    }
    // Save and notify
    if (this.newlyUnlocked.length > 0) {
      Store.saveAchievements(this.unlocked);
      if (this.onUnlock) {
        this.newlyUnlocked.forEach(ach => this.onUnlock(ach));
      }
    }
    return this.newlyUnlocked;
  }

  /** Get all achievements with unlocked status */
  getAll() {
    return ACHIEVEMENTS.map(ach => ({
      ...ach,
      unlocked: !!this.unlocked[ach.id],
      unlockedAt: this.unlocked[ach.id] || null,
      // Hidden achievements only show if unlocked
      visible: !ach.hidden || !!this.unlocked[ach.id]
    }));
  }

  /** Get achievements grouped by category */
  getGrouped() {
    const all = this.getAll();
    const groups = {};
    for (const ach of all) {
      if (!groups[ach.cat]) groups[ach.cat] = [];
      groups[ach.cat].push(ach);
    }
    return groups;
  }

  /** Get counts */
  getCounts() {
    const all = this.getAll();
    const unlocked = all.filter(a => a.unlocked).length;
    return { unlocked, total: all.length };
  }

  /** Reset all achievements (for testing) */
  async resetAll() {
    this.unlocked = {};
    await Store.saveAchievements(this.unlocked);
  }
}

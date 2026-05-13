// ============================================================
// sound.js — synthesized sound effects (Web Audio API)
// ============================================================

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.sfxVolume = 0.7;
    this.bgmVolume = 0.5;
    this.bgmPlaying = false;
    this._bgmTimer = null;
    this._bgmNoteIndex = 0;
    this._bgmTrackIndex = 0;
    this._bgmBar = 0;
    this.bgmAudio = null;
    this._bgmCurrentTrack = -1;
    this.bgmTracks = [
      '../assets/audio/bgm-kuia.mp3',
      '../assets/audio/funky-menu-loop.mp3',
      '../assets/audio/once-upon-a-time-loop.mp3',
      '../assets/audio/city-loop.mp3',
      '../assets/audio/gasmask-love-loop.mp3',
      '../assets/audio/main-menu-music.mp3'
    ];
  }

  /** Initialize AudioContext (must be called from user gesture) */
  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio not available');
      }
    }
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio();
      this.bgmAudio.loop = false;
      this.bgmAudio.preload = 'auto';
      this.bgmAudio.volume = this.bgmVolume;
      this.bgmAudio.addEventListener('ended', () => {
        if (this.bgmPlaying && !this.muted) this._playRandomBGMTrack();
      });
    }
  }

  _ensureCtx() {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  // ── Building blocks ─────────────────────────────────────

  _tone(freq, duration, type = 'sine', vol = 0.3, delay = 0) {
    if (!this._ensureCtx() || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  _noise(duration, vol = 0.2, delay = 0) {
    if (!this._ensureCtx() || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(vol * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(now);
  }

  /** Thump sound - low frequency impact */
  _thump(vol = 0.4, delay = 0) {
    if (!this._ensureCtx() || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    gain.gain.setValueAtTime(vol * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // ── Public sound API ────────────────────────────────────

  play(name) {
    switch (name) {
      case 'deal':
        // Card dealing: quick shuffle-like sound
        this._noise(0.08, 0.15);
        this._tone(900, 0.06, 'triangle', 0.12, 0.02);
        break;

      case 'playcard':
        // Card hitting table: low thud + crisp click
        this._thump(0.5);
        this._noise(0.04, 0.15, 0.01);
        this._tone(600, 0.04, 'square', 0.08, 0.005);
        break;

      case 'bomb':
        // Bomb: deep explosion + screen shake (visual handled by UI)
        this._noise(0.5, 0.6);
        this._tone(40, 0.5, 'sawtooth', 0.5);
        this._tone(80, 0.3, 'sawtooth', 0.3, 0.1);
        setTimeout(() => {
          this._noise(0.3, 0.3);
          this._tone(25, 0.4, 'sine', 0.4);
        }, 200);
        break;

      case 'rocket':
        // Rocket: ascending whoosh + climax
        this._tone(150, 0.2, 'sine', 0.3);
        setTimeout(() => {
          this._tone(300, 0.2, 'sine', 0.3);
          this._noise(0.25, 0.2);
        }, 120);
        setTimeout(() => {
          this._tone(600, 0.2, 'sine', 0.35);
          this._tone(900, 0.3, 'sine', 0.35);
          this._noise(0.35, 0.3);
        }, 240);
        break;

      case 'win':
        // Victory: ascending major triad fanfare
        this._tone(523, 0.2, 'triangle', 0.35);   // C5
        setTimeout(() => this._tone(659, 0.2, 'triangle', 0.35), 150); // E5
        setTimeout(() => this._tone(784, 0.35, 'triangle', 0.4), 300);  // G5
        setTimeout(() => this._tone(1047, 0.5, 'triangle', 0.45), 500); // C6
        break;

      case 'lose':
        // Defeat: descending minor
        this._tone(392, 0.3, 'triangle', 0.3);    // G4
        setTimeout(() => this._tone(330, 0.3, 'triangle', 0.3), 250);  // E4
        setTimeout(() => this._tone(262, 0.5, 'triangle', 0.3), 500);  // C4
        break;

      case 'button':
        // Soft click
        this._tone(800, 0.03, 'square', 0.08);
        break;

      case 'bid':
        // Confident tone for bidding
        this._tone(440, 0.12, 'triangle', 0.2);
        setTimeout(() => this._tone(554, 0.12, 'triangle', 0.2), 80);
        break;

      case 'nobid':
        // Low "nah" tone
        this._tone(250, 0.12, 'triangle', 0.12);
        break;

      case 'pass':
        // Distinct "bup" sound for passing
        this._tone(200, 0.1, 'triangle', 0.15);
        this._tone(180, 0.08, 'sine', 0.1, 0.04);
        break;

      case 'newround':
        // New round chime
        this._tone(660, 0.08, 'triangle', 0.15);
        setTimeout(() => this._tone(880, 0.12, 'triangle', 0.15), 70);
        break;

      case 'achievement':
        // Achievement unlock: ascending sparkle
        this._tone(880, 0.1, 'sine', 0.2);
        setTimeout(() => this._tone(1100, 0.1, 'sine', 0.2), 80);
        setTimeout(() => this._tone(1320, 0.2, 'sine', 0.25), 160);
        break;
    }
  }

  // ── Background Music ────────────────────────────────────

  /** Start playing imported BGM audio. */
  playBGM() {
    if (this.bgmPlaying || this.muted) return;
    this.init();
    if (!this.bgmAudio) return;
    this.bgmPlaying = true;
    this._playRandomBGMTrack();
  }

  _pickRandomBGMTrack() {
    if (this.bgmTracks.length <= 1) return 0;
    let next = this._bgmCurrentTrack;
    while (next === this._bgmCurrentTrack) {
      next = Math.floor(Math.random() * this.bgmTracks.length);
    }
    return next;
  }

  _playRandomBGMTrack() {
    if (!this.bgmAudio || this.muted) return;
    const next = this._pickRandomBGMTrack();
    this._bgmCurrentTrack = next;
    this.bgmAudio.src = this.bgmTracks[next];
    this.bgmAudio.currentTime = 0;
    this.bgmAudio.volume = this.bgmVolume;
    const playPromise = this.bgmAudio.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        this.bgmPlaying = false;
      });
    }
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
  }

  setVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  setBGMVolume(vol) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmAudio) this.bgmAudio.volume = this.bgmVolume;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopBGM();
    } else if (!this.bgmPlaying) {
      this.playBGM();
    }
    return this.muted;
  }
}

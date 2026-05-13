// ============================================================
// ui.js — DOM rendering, event handling, animations
// ============================================================

class UIManager {
  constructor() {
    this.game = null;
    this.sound = null;
    this.achievements = null;
    this.selectedCards = new Set(); // card ids
    this._pendingDelayTimer = null;
    this._pendingDelayResolve = null;
    this._processingAI = false;
    this._bound = false;
    this._controlsLocked = false;
    this._titleVisible = true;
    this._dragCardId = null;
    this._suppressNextCardClick = false;
    this._dragPlaceholder = null;
    this._dragInsert = null;
  }

  /** Initialize with game, sound, achievement instances */
  init(game, sound, achievements) {
    this.game = game;
    this.sound = sound;
    this.achievements = achievements;

    // Wire up game callbacks
    game.onPhaseChange = (phase) => this._onPhaseChange(phase);
    game.onBid = (playerIdx, bid) => this._onBid(playerIdx, bid);
    game.onPlay = (playerIdx, play) => this._onPlay(playerIdx, play);
    game.onPass = (playerIdx) => this._onPass(playerIdx);
    game.onGameOver = (result) => this._onGameOver(result);
    game.onNewRound = (playerIdx) => this._onNewRound(playerIdx);
    game.onTurnChange = (playerIdx) => this._onTurnChange(playerIdx);
    game.onStatsChange = (stats) => this._checkAchievements(stats);

    // Achievements unlock callback
    achievements.onUnlock = (ach) => this._showAchievementToast(ach);

    this._bindEvents();
    // Don't render yet — game hasn't started. startNewGame() will refresh.
  }

  // ── Event Binding ──────────────────────────────────────

  _bindEvents() {
    if (this._bound) return;
    this._bound = true;

    // Control buttons
    const playBtn = document.getElementById('btn-play');
    const passBtn = document.getElementById('btn-pass');
    const hintBtn = document.getElementById('btn-hint');
    const sortBtn = document.getElementById('btn-sort-hand');

    if (playBtn) playBtn.addEventListener('click', () => this._onPlayClick());
    if (passBtn) passBtn.addEventListener('click', () => this._onPassClick());
    if (hintBtn) hintBtn.addEventListener('click', () => this._onHintClick());
    if (sortBtn) sortBtn.addEventListener('click', () => this._onSortHandClick());

    // Bid buttons
    for (let pts = 0; pts <= 3; pts++) {
      const label = pts === 0 ? '不叫' : `${pts}分`;
      const btn = document.getElementById(`btn-bid-${pts}`);
      if (btn) btn.addEventListener('click', () => this._onBidClick(pts));
    }

    // Nav buttons
    const btnSettings = document.getElementById('btn-settings');
    const btnAchievements = document.getElementById('btn-achievements');
    const btnNewGame = document.getElementById('btn-new-game');
    if (btnSettings) btnSettings.addEventListener('click', () => this._toggleModal('settings-modal', true));
    if (btnAchievements) btnAchievements.addEventListener('click', () => this._toggleModal('achievements-modal', true));
    if (btnNewGame) btnNewGame.addEventListener('click', () => this._restartGame());

    const titleStart = document.getElementById('title-start');
    const titleSettings = document.getElementById('title-settings');
    const titleAchievements = document.getElementById('title-achievements');
    const titleExit = document.getElementById('title-exit');
    if (titleStart) titleStart.addEventListener('click', () => this.startNewGame());
    if (titleSettings) titleSettings.addEventListener('click', () => this._toggleModal('settings-modal', true));
    if (titleAchievements) titleAchievements.addEventListener('click', () => this._toggleModal('achievements-modal', true));
    if (titleExit) titleExit.addEventListener('click', () => this._exitGame());

    // Modal close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) this._toggleModal(modal.id, false);
      });
    });

    // Modal background clicks
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this._toggleModal(modal.id, false);
      });
    });

    // Settings controls
    const diffSelect = document.getElementById('setting-difficulty');
    const sfxSlider = document.getElementById('setting-sfx');
    const bgmSlider = document.getElementById('setting-bgm');
    const muteBtn = document.getElementById('btn-mute');
    const toggleFullscreenBtn = document.getElementById('btn-toggle-fullscreen');
    const settingsExitGameBtn = document.getElementById('btn-settings-exit-game');

    if (diffSelect) diffSelect.addEventListener('change', () => {
      this.game.difficulty = parseInt(diffSelect.value);
      this.game.settings.difficulty = this.game.difficulty;
      Store.saveSettings(this.game.settings);
    });

    if (sfxSlider) sfxSlider.addEventListener('input', () => {
      const v = parseFloat(sfxSlider.value);
      this.sound.setVolume(v);
      this.game.settings.sfxVolume = v;
      Store.saveSettings(this.game.settings);
    });

    if (bgmSlider) bgmSlider.addEventListener('input', () => {
      const v = parseFloat(bgmSlider.value);
      this.sound.setBGMVolume(v);
      this.game.settings.bgmVolume = v;
      Store.saveSettings(this.game.settings);
    });

    if (muteBtn) muteBtn.addEventListener('click', () => {
      const muted = this.sound.toggleMute();
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });

    if (toggleFullscreenBtn) toggleFullscreenBtn.addEventListener('click', () => this._toggleFullscreen());
    if (settingsExitGameBtn) settingsExitGameBtn.addEventListener('click', () => this._exitGame());

    // Game over restart button
    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) restartBtn.addEventListener('click', () => this._restartGame());
  }

  /** Load settings into controls */
  async _loadSettingsUI() {
    const settings = this.game.settings;
    const diffSelect = document.getElementById('setting-difficulty');
    const sfxSlider = document.getElementById('setting-sfx');
    const bgmSlider = document.getElementById('setting-bgm');

    if (diffSelect) diffSelect.value = settings.difficulty;
    if (sfxSlider) sfxSlider.value = settings.sfxVolume;
    if (bgmSlider) bgmSlider.value = settings.bgmVolume;
    if (this.sound) {
      this.sound.setVolume(settings.sfxVolume);
      this.sound.setBGMVolume(settings.bgmVolume);
    }
  }

  showTitleScreen() {
    const title = document.getElementById('title-screen');
    if (title) {
      title.classList.remove('hidden');
      title.setAttribute('aria-hidden', 'false');
    }
    this._titleVisible = true;
    this._renderTopBar();
  }

  _hideTitleScreen() {
    const title = document.getElementById('title-screen');
    if (title) {
      title.classList.add('hidden');
      title.setAttribute('aria-hidden', 'true');
    }
    this._titleVisible = false;
  }

  _exitGame() {
    this.sound.init();
    this.sound.play('button');
    if (window.electronAPI?.quitApp) {
      window.electronAPI.quitApp();
      return;
    }
    window.close();
  }

  _setFullscreen(fullscreen) {
    this.sound.play('button');
    if (window.electronAPI?.setFullscreen) {
      window.electronAPI.setFullscreen(fullscreen);
    }
  }

  async _toggleFullscreen() {
    this.sound.play('button');
    if (window.electronAPI?.isFullscreen && window.electronAPI?.setFullscreen) {
      const fullscreen = await window.electronAPI.isFullscreen();
      await window.electronAPI.setFullscreen(!fullscreen);
    }
  }

  // ── Full Render ────────────────────────────────────────

  _renderTable() {
    this._renderHumanHand();
    this._renderAIPlayers();
    this._renderPlayZone();
    this._renderLandlordCards();
    this._renderControls();
    this._renderTopBar();
  }

  _renderTopBar() {
    const phaseLabel = document.getElementById('phase-label');
    const newGameBtn = document.getElementById('btn-new-game');
    if (phaseLabel) {
      const state = this.game.getState();
      const map = {
        [GamePhase.INIT]: '准备开始',
        [GamePhase.DEALING]: '发牌中...',
        [GamePhase.BIDDING]: '叫地主阶段',
        [GamePhase.PLAYING]: '出牌阶段',
        [GamePhase.FINISHED]: '游戏结束'
      };
      phaseLabel.textContent = map[state.phase] || '';
      // Show restart button during active game phases
      const showRestart = !this._titleVisible && (
        state.phase === GamePhase.BIDDING ||
        state.phase === GamePhase.PLAYING ||
        state.phase === GamePhase.FINISHED
      );
      if (newGameBtn) {
        newGameBtn.style.display = showRestart ? '' : 'none';
      }
    }
  }

  // ── Human Hand ─────────────────────────────────────────

  _renderHumanHand() {
    const hand = document.getElementById('human-hand');
    if (!hand) return;
    if (!this.game || this.game.players.length === 0) return;

    hand.innerHTML = '';
    const cards = this.game.getHumanHand();
    const animate = this._justDealt;
    if (animate) this._justDealt = false;

    cards.forEach((card, index) => {
      const el = this._createCardElement(card, true);

      // Only animate on initial deal, not on every refresh
      if (animate) {
        el.style.setProperty('--deal-from-y', '-200px');
        el.style.setProperty('--deal-from-x', `${(index - cards.length / 2) * 30}px`);
        el.style.animationDelay = `${index * 0.03}s`;
        el.classList.add('dealing');
      }

      if (this.selectedCards.has(card.id)) {
        el.classList.add('selected');
      }

      el.draggable = true;
      el.addEventListener('click', () => this._onCardClick(card.id, el));
      el.addEventListener('contextmenu', (e) => this._onCardRightClick(e, card.id, el));
      el.addEventListener('dragstart', (e) => this._onCardDragStart(e, card.id, el));
      el.addEventListener('dragover', (e) => this._onCardDragOver(e, card.id, el));
      el.addEventListener('drop', (e) => this._onCardDrop(e, card.id, el));
      el.addEventListener('dragend', () => this._onCardDragEnd());
      hand.appendChild(el);
    });

    hand.ondragover = (e) => this._onHandDragOver(e);
    hand.ondrop = (e) => this._onHandDrop(e);

    // Update human score display
    const scoreEl = document.getElementById('human-score');
    if (scoreEl) {
      scoreEl.textContent = `积分: ${this.game.players[0].score}`;
    }
  }

  _createCardElement(card, faceUp) {
    if (!faceUp) {
      const el = document.createElement('div');
      el.className = 'card-back';
      return el;
    }

    const el = document.createElement('div');
    el.className = 'card';
    el.classList.add(card.color === 'red' ? 'red' : 'black');
    if (card.isJoker) {
      el.classList.add(card.rank === 17 ? 'joker-red' : 'joker-black');
    }

    el.dataset.cardId = card.id;

    // Corner displays
    const suitName = card.suit ? SUIT_SYMBOLS[card.suit] : '';
    const rankName = card.rankName;

    const tl = document.createElement('div');
    tl.className = 'corner top-left';
    tl.innerHTML = `<span class="rank-display">${rankName}</span><span class="suit-display">${suitName}</span>`;
    el.appendChild(tl);

    const br = document.createElement('div');
    br.className = 'corner bottom-right';
    br.innerHTML = `<span class="rank-display">${rankName}</span><span class="suit-display">${suitName}</span>`;
    el.appendChild(br);

    // Center suit
    if (!card.isJoker && suitName) {
      const cs = document.createElement('span');
      cs.className = 'center-suit';
      cs.textContent = suitName;
      el.appendChild(cs);
    }

    // Joker icon
    if (card.isJoker) {
      const ji = document.createElement('span');
      ji.className = 'joker-icon';
      ji.textContent = card.rank === 17 ? '🃏' : '🂠';
      el.appendChild(ji);
      // Also add text label for joker
      const label = document.createElement('div');
      label.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:14px;font-weight:bold;font-family:"Microsoft YaHei",sans-serif;';
      label.textContent = card.rankName;
      if (card.rank === 17) label.style.color = '#c0392b';
      el.appendChild(label);
    }

    return el;
  }

  // ── AI Players ─────────────────────────────────────────

  _renderAIPlayers() {
    if (!this.game || this.game.players.length === 0) return;
    for (let i = 1; i <= 2; i++) {
      this._renderAIPlayer(i);
    }
  }

  _renderAIPlayer(idx) {
    const containerId = `ai-area-${idx}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    const player = this.game.players[idx];

    // Name and badge
    const nameEl = container.querySelector('.player-name');
    if (nameEl) nameEl.textContent = player.name;

    const badgeEl = container.querySelector('.player-badge');
    if (badgeEl) {
      if (player.isLandlord) {
        badgeEl.textContent = '地主';
        badgeEl.className = 'player-badge landlord';
      } else {
        badgeEl.textContent = '农民';
        badgeEl.className = 'player-badge farmer';
      }
      badgeEl.style.display = (this.game.phase === GamePhase.PLAYING || this.game.phase === GamePhase.FINISHED) ? 'inline' : 'none';
    }

    // Score
    const scoreEl = container.querySelector('.player-score');
    if (scoreEl) scoreEl.textContent = `积分: ${player.score}`;

    // Card backs
    const cardsEl = container.querySelector('.player-cards-area');
    if (cardsEl) {
      cardsEl.innerHTML = '';
      for (let c = 0; c < player.cardCount; c++) {
        const mini = document.createElement('div');
        mini.className = 'mini-card-back';
        cardsEl.appendChild(mini);
      }
    }

    // Card count
    const countEl = container.querySelector('.player-card-count');
    if (countEl) countEl.textContent = `剩余: ${player.cardCount}张`;

    // Turn indicator
    const indicator = container.querySelector('.turn-indicator');
    if (indicator) {
      indicator.style.display = (this.game.currentPlayerIndex === idx && this.game.phase === GamePhase.PLAYING) ? 'block' : 'none';
    }
  }

  // ── Play Zone ──────────────────────────────────────────

  _renderPlayZone() {
    const state = this.game.getState();

    // Clear all play slots
    for (let i = 0; i < 3; i++) {
      const slot = document.getElementById(`play-slot-${i}`);
      if (slot) {
        slot.innerHTML = '';
        const label = slot.querySelector('.play-slot-label');
        if (!label) {
          const lbl = document.createElement('div');
          lbl.className = 'play-slot-label';
          lbl.textContent = ['你', '电脑A', '电脑B'][i];
          slot.appendChild(lbl);
        }
      }
    }

    // Show last play
    if (state.lastPlay && state.lastPlayPlayerIndex >= 0) {
      const slot = document.getElementById(`play-slot-${state.lastPlayPlayerIndex}`);
      if (slot && state.lastPlay.cards) {
        state.lastPlay.cards.forEach(card => {
          const el = this._createCardElement(card, true);
          el.style.width = '60px';
          el.style.height = '86px';
          const rankDisplay = el.querySelector('.corner .rank-display');
          const suitDisplay = el.querySelector('.corner .suit-display');
          const centerSuit = el.querySelector('.center-suit');
          if (rankDisplay) rankDisplay.style.fontSize = '13px';
          if (suitDisplay) suitDisplay.style.fontSize = '9px';
          if (centerSuit) centerSuit.style.fontSize = '28px';
          slot.appendChild(el);
        });

        // Show hand type description
        const desc = document.createElement('div');
        desc.style.cssText = 'position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);color:#e8d9a0;font-size:11px;white-space:nowrap;';
        desc.textContent = playDescription(state.lastPlay);
        slot.appendChild(desc);
      }
    }

    // Clear pass text elements
    document.querySelectorAll('.pass-text').forEach(el => el.remove());
  }

  _renderLandlordCards() {
    const zone = document.getElementById('landlord-cards');
    if (!zone) return;

    zone.innerHTML = '';
    const state = this.game.getState();

    if (state.landlordCards && (state.phase === GamePhase.PLAYING || state.phase === GamePhase.FINISHED)) {
      state.landlordCards.forEach(card => {
        const el = this._createCardElement(card, true);
        zone.appendChild(el);
      });
    } else if (state.phase === GamePhase.BIDDING) {
      // Show face-down landlord cards
      for (let i = 0; i < 3; i++) {
        const el = document.createElement('div');
        el.className = 'card-back';
        el.style.width = '55px';
        el.style.height = '78px';
        zone.appendChild(el);
      }
    }
  }

  // ── Controls ───────────────────────────────────────────

  _getHumanPlayableCandidates(state = this.game.getState()) {
    const hand = this.game.getHumanHand();
    if (!state.lastPlay || state.lastPlayPlayerIndex === 0) {
      return findAllValidPlays(hand);
    }
    return findBeatingPlays(hand, state.lastPlay);
  }

  _renderControls() {
    const state = this.game.getState();
    const bidControls = document.getElementById('bid-controls');
    const playControls = document.getElementById('play-controls');

    if (!bidControls || !playControls) return;

    // Hide all first
    bidControls.style.display = 'none';
    playControls.style.display = 'none';

    if (state.phase === GamePhase.BIDDING && state.isHumanTurn) {
      bidControls.style.display = 'flex';
      const canBid0 = state.currentBid === 0;
      const canBid1 = state.currentBid < 1;
      const canBid2 = state.currentBid < 2;
      const canBid3 = state.currentBid < 3;

      document.getElementById('btn-bid-0').disabled = !canBid0;
      document.getElementById('btn-bid-1').disabled = !canBid1;
      document.getElementById('btn-bid-2').disabled = !canBid2;
      // 3分 is always allowed if no one bid 3 yet
      document.getElementById('btn-bid-3').disabled = false;
    }

    if (state.phase === GamePhase.PLAYING && state.isHumanTurn) {
      playControls.style.display = 'flex';
      const passBtn = document.getElementById('btn-pass');
      const playBtn = document.getElementById('btn-play');
      const hintBtn = document.getElementById('btn-hint');
      const sortBtn = document.getElementById('btn-sort-hand');
      const canPass = !!(state.lastPlay && state.lastPlayPlayerIndex !== 0);
      const hasPlayableCards = this._getHumanPlayableCandidates(state).length > 0;
      const onlyPass = canPass && !hasPlayableCards;

      if (sortBtn) {
        sortBtn.style.display = '';
        sortBtn.disabled = this._controlsLocked;
      }
      if (passBtn) {
        passBtn.style.display = '';
        passBtn.disabled = !canPass;
      }
      if (playBtn) {
        playBtn.style.display = onlyPass ? 'none' : '';
        playBtn.disabled = onlyPass || this.selectedCards.size === 0;
      }
      if (hintBtn) {
        hintBtn.style.display = onlyPass ? 'none' : '';
        hintBtn.disabled = onlyPass;
      }
    }
  }

  /** Update all UI elements for current state */
  _refreshAll() {
    this._renderTable();
    this._renderTopBar();
  }

  // ── Card Selection ─────────────────────────────────────

  _onCardClick(cardId, el) {
    if (this._suppressNextCardClick) {
      this._suppressNextCardClick = false;
      return;
    }
    if (this.game.phase !== GamePhase.PLAYING) return;
    if (this.game.currentPlayerIndex !== 0) return;
    if (this._controlsLocked) return;

    this.sound.play('button');

    if (this.selectedCards.has(cardId)) {
      this.selectedCards.delete(cardId);
      el.classList.remove('selected');
    } else {
      this.selectedCards.add(cardId);
      el.classList.add('selected');
    }

    // Update play button state
    document.getElementById('btn-play').disabled = this.selectedCards.size === 0;
  }

  _onCardRightClick(e, cardId, el) {
    e.preventDefault();
    if (!this.selectedCards.has(cardId)) return;
    this.selectedCards.delete(cardId);
    el.classList.remove('selected');
    this.sound.play('button');
    const playBtn = document.getElementById('btn-play');
    if (playBtn) playBtn.disabled = this.selectedCards.size === 0;
  }

  _onCardDragStart(e, cardId, el) {
    if (!this.game || this.game.players.length === 0 || this._controlsLocked) {
      e.preventDefault();
      return;
    }
    this._dragCardId = cardId;
    this._suppressNextCardClick = true;
    el.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(cardId));
      this._setCardDragImage(e, el);
    }
  }

  _setCardDragImage(e, el) {
    const ghost = el.cloneNode(true);
    const rect = el.getBoundingClientRect();
    ghost.classList.add('drag-ghost');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, rect.width / 2, rect.height / 2);
    setTimeout(() => ghost.remove(), 0);
  }

  _onCardDragOver(e, targetCardId, targetEl) {
    if (this._dragCardId === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (targetCardId === this._dragCardId) return;
    const rect = targetEl.getBoundingClientRect();
    const insertAfter = e.clientX > rect.left + rect.width / 2;
    this._showDragPlaceholder(targetCardId, insertAfter);
  }

  _onHandDragOver(e) {
    if (this._dragCardId === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const cardEl = e.target.closest?.('.card:not(.drag-placeholder)');
    if (!cardEl && e.target.id === 'human-hand') {
      this._showDragPlaceholder(null, true);
    }
  }

  _onCardDrop(e, targetCardId, targetEl) {
    e.preventDefault();
    e.stopPropagation();
    if (this._dragCardId === null || this._dragCardId === targetCardId) return;
    const insert = this._dragInsert || {};
    this._reorderHumanCard(this._dragCardId, insert.targetCardId ?? targetCardId, insert.insertAfter ?? false);
  }

  _onHandDrop(e) {
    e.preventDefault();
    if (this._dragCardId === null) return;
    const target = e.target.closest?.('.card');
    if (target && !target.classList.contains('drag-placeholder')) return;
    if (this._dragInsert?.targetCardId !== undefined && this._dragInsert.targetCardId !== null) {
      this._reorderHumanCard(this._dragCardId, this._dragInsert.targetCardId, this._dragInsert.insertAfter);
    } else {
      this._moveHumanCardToEnd(this._dragCardId);
    }
  }

  _onCardDragEnd() {
    document.querySelectorAll('#human-hand .card.dragging').forEach(el => el.classList.remove('dragging'));
    this._removeDragPlaceholder();
    this._dragCardId = null;
    this._dragInsert = null;
    setTimeout(() => { this._suppressNextCardClick = false; }, 0);
  }

  _showDragPlaceholder(targetCardId, insertAfter) {
    if (this._dragCardId === null) return;
    const hand = document.getElementById('human-hand');
    if (!hand) return;
    const sameSpot = this._dragInsert &&
      this._dragInsert.targetCardId === targetCardId &&
      this._dragInsert.insertAfter === insertAfter;
    if (sameSpot && this._dragPlaceholder?.parentNode) return;

    this._removeDragPlaceholder();

    const draggedCard = this.game.getHumanHand().find(c => c.id === this._dragCardId);
    if (!draggedCard) return;
    const placeholder = this._createCardElement(draggedCard, true);
    placeholder.classList.add('drag-placeholder');
    placeholder.draggable = false;
    this._dragPlaceholder = placeholder;
    this._dragInsert = { targetCardId, insertAfter };

    if (targetCardId === null) {
      hand.appendChild(placeholder);
      return;
    }

    const targetEl = hand.querySelector(`.card[data-card-id="${targetCardId}"]:not(.drag-placeholder)`);
    if (!targetEl) {
      hand.appendChild(placeholder);
      return;
    }
    if (insertAfter) {
      targetEl.after(placeholder);
    } else {
      targetEl.before(placeholder);
    }
  }

  _removeDragPlaceholder() {
    if (this._dragPlaceholder?.parentNode) {
      this._dragPlaceholder.remove();
    }
    this._dragPlaceholder = null;
  }

  _reorderHumanCard(cardId, targetCardId, insertAfter) {
    const cards = this.game.getHumanHand();
    const fromIndex = cards.findIndex(c => c.id === cardId);
    const targetIndex = cards.findIndex(c => c.id === targetCardId);
    if (fromIndex < 0 || targetIndex < 0) return;

    const [card] = cards.splice(fromIndex, 1);
    let insertIndex = cards.findIndex(c => c.id === targetCardId);
    if (insertIndex < 0) insertIndex = cards.length;
    if (insertAfter) insertIndex++;
    cards.splice(insertIndex, 0, card);
    this._renderHumanHand();
  }

  _moveHumanCardToEnd(cardId) {
    const cards = this.game.getHumanHand();
    const fromIndex = cards.findIndex(c => c.id === cardId);
    if (fromIndex < 0 || fromIndex === cards.length - 1) return;
    const [card] = cards.splice(fromIndex, 1);
    cards.push(card);
    this._renderHumanHand();
  }

  _onSortHandClick() {
    if (!this.game || this.game.players.length === 0 || this._controlsLocked) return;
    this.sound.play('button');
    this.game.players[0].sortHand();
    this._renderHumanHand();
  }

  // ── Play Controls ──────────────────────────────────────

  _onPlayClick() {
    if (this._controlsLocked) return;
    if (this.selectedCards.size === 0) return;

    this.sound.play('button');

    // Get selected cards in sorted order
    const humanHand = this.game.getHumanHand();
    const selectedIds = this.selectedCards;
    const cards = humanHand.filter(c => selectedIds.has(c.id));

    const result = this.game.handlePlay(0, cards);
    if (!result.ok) {
      this._showMessage(result.error || '无效出牌');
      return;
    }

    this.selectedCards.clear();
    this._lockControls();
    this._refreshAll();

    if (!result.gameOver) {
      this._scheduleAITurn();
    } else {
      this._unlockControls();
    }
  }

  _onPassClick() {
    if (this._controlsLocked) return;
    this.sound.play('button');

    const result = this.game.handlePass(0);
    if (!result.ok) {
      this._showMessage(result.error || '不能不出');
      return;
    }

    this.selectedCards.clear();
    this._lockControls();
    this._refreshAll();

    this._scheduleAITurn();
  }

  _onHintClick() {
    if (this._controlsLocked) return;
    this.sound.play('button');

    const hand = this.game.getHumanHand();
    const state = this.game.getState();
    const lastPlay = this.game.lastPlay;
    const following = !!(lastPlay && this.game.lastPlayPlayerIndex !== 0);

    if (following && this._shouldSuggestPass(state)) {
      this.selectedCards.clear();
      this._renderHumanHand();
      const playBtn = document.getElementById('btn-play');
      if (playBtn) playBtn.disabled = true;
      this._showMessage('队友在压制，建议不出');
      return;
    }

    const candidates = following ? findBeatingPlays(hand, lastPlay) : findAllValidPlays(hand);

    if (candidates.length === 0) {
      this._showMessage('没有可出的牌，不出吧');
      return;
    }

    const hint = this._chooseSmartHint(candidates, hand, state, following);

    // Select these cards
    this.selectedCards.clear();
    hint.cards.forEach(c => this.selectedCards.add(c.id));

    this._renderHumanHand();
    document.getElementById('btn-play').disabled = false;
    this._showMessage(`提示: ${playDescription(hint)}`);
  }

  _shouldSuggestPass(state) {
    if (!state.lastPlay || state.lastPlayPlayerIndex <= 0) return false;
    const human = state.players[0];
    const lastPlayer = state.players[state.lastPlayPlayerIndex];
    if (!human || !lastPlayer) return false;
    const landlord = state.players[state.landlordIndex];
    const landlordDanger = landlord && landlord.cardCount <= 2;
    return !landlordDanger && !human.isLandlord && !lastPlayer.isLandlord && state.landlordIndex !== 0;
  }

  _chooseSmartHint(candidates, hand, state, following) {
    const groups = groupByRank(hand);
    const scored = candidates.map(play => ({
      ...play,
      hintScore: this._scoreHintPlay(play, hand, groups, state, following)
    }));
    scored.sort((a, b) => b.hintScore - a.hintScore || a.rank - b.rank || b.cards.length - a.cards.length);
    return scored[0];
  }

  _scoreHintPlay(play, hand, groups, state, following) {
    const remaining = hand.length - play.cards.length;
    if (remaining === 0) return 100000 + play.cards.length * 100;

    const typeWeight = {
      [HandType.AIRPLANE_PAIRS]: 190,
      [HandType.AIRPLANE_SINGLES]: 175,
      [HandType.AIRPLANE]: 165,
      [HandType.DOUBLE_STRAIGHT]: 145,
      [HandType.STRAIGHT]: 135,
      [HandType.THREE_TWO]: 105,
      [HandType.THREE_ONE]: 82,
      [HandType.THREE]: 58,
      [HandType.PAIR]: 28,
      [HandType.SINGLE]: 8,
      [HandType.BOMB]: -260,
      [HandType.ROCKET]: -330
    };

    let score = (typeWeight[play.type] || 0) + play.cards.length * 24 - play.rank * 2.2;
    const highCardCount = play.cards.filter(c => c.rank >= 15).length;
    score -= highCardCount * 42;

    for (const card of play.cards) {
      const groupSize = groups.get(card.rank)?.length || 0;
      if (groupSize === 4 && play.type !== HandType.BOMB) score -= 190;
      else if (groupSize >= 3 && play.cards.filter(c => c.rank === card.rank).length < Math.min(groupSize, 3)) score -= 34;
      else if (groupSize === 2 && play.cards.filter(c => c.rank === card.rank).length === 1) score -= 22;
    }

    if (following) {
      score += 220;
      score -= play.cards.length * 8;
      score -= play.rank * 3.5;

      const opponentAlmostOut = state.players.some((p, i) => i !== 0 && p.isLandlord !== state.players[0].isLandlord && p.cardCount <= 2);
      if (play.type === HandType.BOMB || play.type === HandType.ROCKET) {
        score += opponentAlmostOut ? 420 : -260;
      }
      if (state.lastPlay?.type === HandType.BOMB && play.type === HandType.ROCKET) score += 160;
    } else {
      if (play.type === HandType.SINGLE && hand.length > 6) score -= 32;
      if ((play.type === HandType.BOMB || play.type === HandType.ROCKET) && remaining > 0) score -= 300;
      if (remaining <= 2) score += 160 - remaining * 30;
    }

    return score;
  }

  _onBidClick(points) {
    if (this._controlsLocked) return;
    this.sound.play(points > 0 ? 'bid' : 'nobid');

    this.game.handleBid(0, points);
    this._lockControls();
    this._refreshAll();

    // If bidding continues, schedule AI
    if (this.game.phase === GamePhase.BIDDING) {
      this._scheduleAITurn();
    } else if (this.game.phase === GamePhase.PLAYING) {
      this._scheduleAITurn();
    }
  }

  // ── AI Turn Scheduling ─────────────────────────────────

  /** Process all pending AI turns in sequence, then unlock for human */
  _scheduleAITurn() {
    // Prevent multiple concurrent AI loops
    if (this._processingAI) return;
    this._processingAI = true;
    this._processAITurns();
  }

  async _processAITurns() {
    let iterations = 0;
    const MAX_ITERATIONS = 30; // safety cap: 3 players × ~10 turns each
    try {
      while (this._processingAI && iterations < MAX_ITERATIONS) {
        iterations++;
        const action = this.game.autoPlayIfAI();
        if (!action) {
          // Human's turn — unlock and stop
          this._unlockControls();
          break;
        }

        // Show "thinking" indicator
        const state = this.game.getState();
        const aiName = state.players[state.currentPlayerIndex]?.name || '电脑';
        this._showMessage(`${aiName} 思考中...`, 600);
        this._refreshAll();

        // Dramatic pause
        await this._delay(900);

        // Re-check: game might have ended or state changed since delay
        const recheck = this.game.autoPlayIfAI();
        if (!recheck) {
          this._unlockControls();
          break;
        }

        // Execute AI action
        if (recheck === 'bid') {
          const bid = this.game.executeAIBid();
          this.sound.play(bid > 0 ? 'bid' : 'nobid');
        } else {
          const lastPlayerBefore = this.game.currentPlayerIndex;
          const play = this.game.executeAIPlay();
          const lastPlayerAfter = this.game.currentPlayerIndex;

          if (play) {
            this.sound.play('playcard');
            // Flash the slot of the player who just played
            this._flashPlayZone(lastPlayerBefore);
            if (play.type === HandType.BOMB) {
              this._bombEffect();
              this.sound.play('bomb');
            } else if (play.type === HandType.ROCKET) {
              this._rocketEffect();
              this.sound.play('rocket');
            }
          } else {
            this.sound.play('pass');
            this._showPassIndicator(lastPlayerBefore);
          }
        }

        this._refreshAll();

        // Game over check
        if (this.game.phase === GamePhase.FINISHED) {
          this._unlockControls();
          break;
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        console.warn('AI turn loop hit max iterations, unlocking');
        this._unlockControls();
      }
    } catch (e) {
      console.error('AI turn error:', e);
      this._unlockControls();
      this._showMessage('AI出错，请继续', 2000);
    } finally {
      this._processingAI = false;
    }
  }

  _delay(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this._pendingDelayResolve = null;
        this._pendingDelayTimer = null;
        resolve();
      }, ms);
      this._pendingDelayResolve = resolve;
      this._pendingDelayTimer = timer;
    });
  }

  _lockControls() {
    this._controlsLocked = true;
    // Safety watchdog: auto-unlock after 10 seconds if stuck
    if (this._safetyTimer) clearTimeout(this._safetyTimer);
    this._safetyTimer = setTimeout(() => {
      console.warn('Safety unlock triggered - game may have frozen. Phase:', this.game?.phase, 'CurrentPlayer:', this.game?.currentPlayerIndex);
      this._controlsLocked = false;
      this._processingAI = false;
      this._refreshAll();
    }, 10000);
  }

  _unlockControls() {
    this._controlsLocked = false;
    if (this._safetyTimer) { clearTimeout(this._safetyTimer); this._safetyTimer = null; }
    // Resolve pending delay promise to prevent it from hanging
    if (this._pendingDelayResolve) {
      this._pendingDelayResolve();
      this._pendingDelayResolve = null;
      this._pendingDelayTimer = null;
    }
    this._refreshAll();
  }

  // ── Callback Handlers ──────────────────────────────────

  _onPhaseChange(phase) {
    this._renderTopBar();
    if (phase === GamePhase.PLAYING) {
      this._renderLandlordCards();
      // Show AI hands as card backs
      for (let i = 1; i <= 2; i++) this._renderAIPlayer(i);
      this._renderControls();
    }
    if (phase === GamePhase.FINISHED) {
      this._unlockControls();
    }
  }

  _onBid(playerIdx, bid) {
    const state = this.game.getState();
    this._renderTopBar();
    this._renderControls();

    // Show bid message
    const name = playerIdx === 0 ? '你' : this.game.players[playerIdx].name;
    const bidText = bid === 0 ? '不叫' : `${bid}分！`;
    this._showMessage(`${name}: ${bidText}`);

    // If landlord assigned, show it
    if (this.game.phase === GamePhase.PLAYING) {
      const landlord = this.game.players[this.game.landlordIndex];
      setTimeout(() => {
        this._showMessage(`${landlord.name} 是地主！`);
        this._renderAIPlayers();
        this._renderLandlordCards();
        this._renderHumanHand();
        this._renderControls();
      }, 600);
    }
  }

  _onPlay(playerIdx, play) {
    this._renderPlayZone();
    // Update the player who just played
    if (playerIdx !== 0) {
      this._renderAIPlayer(playerIdx);
    } else {
      this._renderHumanHand();
    }

    // Show description
    const name = playerIdx === 0 ? '你' : this.game.players[playerIdx].name;
    this._showMessage(`${name}: ${playDescription(play)}`);
  }

  _onPass(playerIdx) {
    // Update play zone
    this._renderPlayZone();

    const name = playerIdx === 0 ? '你' : this.game.players[playerIdx].name;

    // Show pass text on the play slot
    const slot = document.getElementById(`play-slot-${playerIdx}`);
    if (slot) {
      const passEl = document.createElement('div');
      passEl.className = 'pass-text';
      passEl.textContent = '不出';
      passEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.8);font-size:16px;font-weight:bold;letter-spacing:3px;pointer-events:none;animation:pass-fade 1.2s ease-out forwards;';
      slot.appendChild(passEl);
      setTimeout(() => passEl.remove(), 1200);
    }

    this._showMessage(`${name}: 不出`);
  }

  _onGameOver(result) {
    // Update display
    this._renderPlayZone();
    this._renderLandlordCards();

    // Show landlord cards face up
    if (this.game.landlordCards) {
      const zone = document.getElementById('landlord-cards');
      if (zone) {
        zone.innerHTML = '';
        this.game.landlordCards.forEach(card => {
          zone.appendChild(this._createCardElement(card, true));
        });
      }
    }

    // Play sound
    if (result.playerWon) {
      this.sound.play('win');
      this._springParticles();
    } else {
      this.sound.play('lose');
    }

    // Show modal
    const modal = document.getElementById('game-over-modal');
    const content = document.getElementById('game-over-content');
    if (!modal || !content) return;

    const title = document.getElementById('result-title');
    const detail = document.getElementById('result-detail');
    const score = document.getElementById('result-score');

    if (title) {
      title.textContent = result.playerWon ? '🎉 你赢了！' : '😞 你输了';
    }

    const details = [];
    details.push(result.landlordWon ? '地主获胜' : '农民获胜');
    if (result.isSpring) details.push('春天！');
    if (result.isAntiSpring) details.push('反春天！');
    if (result.bombs > 0) details.push(`炸弹 ×${result.bombs}`);
    if (result.multiplier > 1) details.push(`倍数: ×${result.multiplier}`);

    if (detail) detail.textContent = details.join(' | ');

    if (score) {
      const sign = result.playerWon ? '+' : '';
      score.textContent = `${sign}${result.playerWon ? result.scoreChange * (result.landlordWon ? 2 : 1) : '-' + result.scoreChange}`;
      score.className = 'result-score ' + (result.playerWon ? 'positive' : 'negative');
    }

    modal.classList.add('show');
    if (result.playerWon) {
      content.classList.add('win-celebration');
    }
  }

  _onNewRound(playerIdx) {
    const name = playerIdx === 0 ? '你' : this.game.players[playerIdx].name;
    this._showMessage(`新一轮 — ${name} 出牌`, 2000);
    this._renderPlayZone();
    this._renderControls();
    this.sound.play('newround');
  }

  _onTurnChange(playerIdx) {
    this._renderAIPlayers();
    this._renderControls();

    // Highlight active player area
    document.querySelectorAll('.player-area').forEach(el => el.classList.remove('active-turn'));
    const activeArea = document.getElementById(playerIdx === 0 ? 'human-area' : `ai-area-${playerIdx}`);
    if (activeArea) activeArea.classList.add('active-turn');
  }

  // ── Effects ────────────────────────────────────────────

  _bombEffect() {
    // Screen shake
    const table = document.getElementById('table');
    if (table) {
      table.classList.add('bomb-shake');
      setTimeout(() => table.classList.remove('bomb-shake'), 500);
    }

    // Red flash overlay
    const overlay = document.createElement('div');
    overlay.className = 'bomb-flash-overlay';
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 600);
  }

  _rocketEffect() {
    // Gold flash
    const overlay = document.createElement('div');
    overlay.className = 'rocket-flash-overlay';
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 800);

    // Animate rocket cards
    const slot = document.getElementById(`play-slot-${this.game.lastPlayPlayerIndex}`);
    if (slot) {
      slot.querySelectorAll('.card').forEach(card => {
        card.classList.add('rocket-launch');
      });
    }
  }

  _springParticles() {
    const colors = ['#ffd700', '#ff6b6b', '#48dbfb', '#ff9ff3', '#feca57', '#54a0ff'];
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = 'spring-particle';
      particle.style.left = `${40 + Math.random() * 20}%`;
      particle.style.top = `${30 + Math.random() * 40}%`;
      particle.style.setProperty('--px', `${(Math.random() - 0.5) * 300}px`);
      particle.style.setProperty('--py', `${(Math.random() - 0.5) * 300}px`);
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.animationDelay = `${Math.random() * 0.3}s`;
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 1800);
    }
  }

  // ── Messages ───────────────────────────────────────────

  _showMessage(text, duration = 1500) {
    const toast = document.getElementById('message-toast');
    if (!toast) return;

    // Clear existing timeout
    if (this._msgTimer) clearTimeout(this._msgTimer);

    toast.textContent = text;
    toast.classList.add('show');
    this._msgTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  /** Flash a play slot to draw attention */
  _flashPlayZone(playerIndex) {
    const slot = document.getElementById(`play-slot-${playerIndex}`);
    if (!slot) return;
    slot.style.transition = 'none';
    slot.style.boxShadow = '0 0 20px rgba(255,215,0,0.7)';
    slot.style.borderRadius = '8px';
    slot.style.background = 'rgba(255,215,0,0.08)';
    setTimeout(() => {
      slot.style.transition = 'all 0.6s ease-out';
      slot.style.boxShadow = 'none';
      slot.style.background = 'transparent';
    }, 100);
  }

  /** Show a prominent pass indicator in the play zone */
  _showPassIndicator(playerIndex) {
    const slot = document.getElementById(`play-slot-${playerIndex}`);
    if (!slot) return;
    // Remove any existing pass text
    slot.querySelectorAll('.pass-text').forEach(el => el.remove());
    const passEl = document.createElement('div');
    passEl.className = 'pass-text';
    passEl.textContent = '不出';
    passEl.style.cssText = `
      position:absolute; top:50%; left:50%;
      transform:translate(-50%,-50%);
      color:#ff6666; font-size:22px; font-weight:bold;
      letter-spacing:4px; pointer-events:none;
      animation: pass-fade 1.5s ease-out forwards;
      z-index:5;
    `;
    slot.appendChild(passEl);
    setTimeout(() => passEl.remove(), 1600);
  }

  // ── Achievement Toast ──────────────────────────────────

  _showAchievementToast(ach) {
    this.sound.play('achievement');
    const container = document.getElementById('achieve-toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'achieve-toast';
    el.innerHTML = `
      <span class="ach-icon">${ach.icon}</span>
      <div class="ach-info">
        <div class="ach-name">🏆 成就解锁！${ach.name}</div>
        <div class="ach-desc">${ach.desc}</div>
      </div>
    `;
    container.appendChild(el);

    // Auto-remove after animation
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 3200);
  }

  _checkAchievements(stats) {
    if (this.achievements) {
      this.achievements.checkAll(stats);
    }
  }

  // ── Modal Toggle ───────────────────────────────────────

  _toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (show) {
      if (id === 'achievements-modal') this._renderAchievementsPanel();
      modal.classList.toggle('title-page-modal', this._titleVisible);
      modal.classList.add('show');
    } else {
      modal.classList.remove('show');
      modal.classList.remove('title-page-modal');
    }
  }

  _renderAchievementsPanel() {
    const container = document.getElementById('achievements-list');
    if (!container || !this.achievements) return;

    const grouped = this.achievements.getGrouped();
    const catNames = {
      beginner: '入门',
      play: '出牌',
      victory: '胜利',
      score: '积分',
      hidden: '隐藏'
    };

    container.innerHTML = '';
    for (const [cat, items] of Object.entries(grouped)) {
      if (!items.length) continue;

      const title = document.createElement('h4');
      title.className = 'achieve-category';
      title.textContent = catNames[cat] || cat;
      container.appendChild(title);

      for (const ach of items) {
        if (!ach.visible) continue;
        const div = document.createElement('div');
        div.className = 'achieve-item' + (ach.unlocked ? '' : ' locked');
        div.innerHTML = `
          <span class="ach-icon">${ach.icon}</span>
          <span class="ach-name">${ach.hidden && !ach.unlocked ? '???' : ach.name}</span>
          <span class="ach-desc">${ach.hidden && !ach.unlocked ? '隐藏成就' : ach.desc}</span>
          <span class="ach-status">${ach.unlocked ? '✅' : '🔒'}</span>
        `;
        container.appendChild(div);
      }
    }
  }

  // ── Restart ────────────────────────────────────────────

  _restartGame() {
    this.sound.init();
    // Force-reset all state in case previous game left things locked
    this._controlsLocked = false;
    this._processingAI = false;
    if (this._safetyTimer) { clearTimeout(this._safetyTimer); this._safetyTimer = null; }
    if (this._pendingDelayTimer) { clearTimeout(this._pendingDelayTimer); }
    this._pendingDelayResolve = null;
    this._pendingDelayTimer = null;

    const modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.remove('show');
    const content = document.getElementById('game-over-content');
    if (content) content.classList.remove('win-celebration');
    this.selectedCards.clear();
    this._hideTitleScreen();
    this._justDealt = true;
    this.game.start();
    this._refreshAll();
    this.sound.play('deal');

    // Trigger first AI turn if needed
    this._scheduleAITurn();
  }

  // ── Start Game ─────────────────────────────────────────

  /** Called after all initialization is done to show ready state and start */
  startNewGame() {
    this.sound.init();
    this._hideTitleScreen();
    this._justDealt = true;
    this.game.start();
    this._refreshAll();
    this.sound.play('deal');
    this.sound.playBGM();

    // Trigger AI if not human's turn
    this._scheduleAITurn();
  }
}

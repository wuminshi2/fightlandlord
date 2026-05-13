// ============================================================
// game.js — Game state machine & turn controller
// ============================================================

class Game {
  constructor() {
    this.phase = GamePhase.INIT;
    this.players = [];
    this.landlordCards = [];
    this.landlordIndex = -1;
    this.currentPlayerIndex = 0;
    this.lastPlay = null;         // { type, rank, length, cards }
    this.lastPlayPlayerIndex = -1;
    this.consecutivePasses = 0;
    this.bidHistory = [];         // [{ playerIndex, bid }]
    this.currentBid = 0;          // highest bid so far
    this.bidStartIndex = 0;
    this.bidRound = 0;
    this.bidPassCount = 0;
    this.difficulty = Difficulty.MEDIUM;
    this.stats = { ...DEFAULT_STATS };
    this.settings = { ...DEFAULT_SETTINGS };
    this.gameOverResult = null;   // set when game ends

    // These are set after dealing, for spring/anti-spring detection
    this._landlordPlayedFirstCard = false;
    this._farmerEverPlayed = false;

    // Callbacks (set by UI)
    this.onPhaseChange = null;
    this.onBid = null;
    this.onPlay = null;
    this.onPass = null;
    this.onGameOver = null;
    this.onNewRound = null;
    this.onTurnChange = null;
    this.onStatsChange = null;
  }

  // ── Initialization ─────────────────────────────────────

  async init(settings) {
    if (settings) {
      this.difficulty = settings.difficulty ?? Difficulty.MEDIUM;
      this.settings = { ...DEFAULT_SETTINGS, ...settings };
    }
    this.stats = await Store.loadStats();
  }

  /** Create players for a new game */
  _createPlayers() {
    this.players = [
      new Player(0, '你', PlayerType.HUMAN),
      new Player(1, '电脑A', PlayerType.AI),
      new Player(2, '电脑B', PlayerType.AI)
    ];
    this.players[0].score = this.stats.totalScore || 0;
  }

  // ── Game Flow ──────────────────────────────────────────

  /** Start a new game: create deck, shuffle, deal */
  start() {
    this._createPlayers();
    this.landlordCards = [];
    this.landlordIndex = -1;
    this.lastPlay = null;
    this.lastPlayPlayerIndex = -1;
    this.consecutivePasses = 0;
    this.bidHistory = [];
    this.currentBid = 0;
    this.bidRound = 0;
    this.bidPassCount = 0;
    this.gameOverResult = null;
    this._landlordPlayedFirstCard = false;
    this._farmerEverPlayed = false;

    // Reset per-game stats
    this.stats.currentGameBombs = 0;
    this.stats.currentConsecutiveLeads = 0;
    this.stats.playerWasLandlord = false;
    this.stats.playerBidPoints = 0;
    this.stats.isSpring = false;
    this.stats.isAntiSpring = false;

    // Deal
    const deck = createDeck();
    const { hands, landlordCards } = dealCards(deck);

    for (let i = 0; i < 3; i++) {
      this.players[i].cards = hands[i];
      this.players[i].sortHand();
      this.players[i].isLandlord = false;
      this.players[i].bidPoints = 0;
    }

    this.landlordCards = landlordCards;
    this.stats.playerCardsAtStart = 17;

    // Random start player for bidding (0 = human)
    this.bidStartIndex = Math.floor(Math.random() * 3);
    this.currentPlayerIndex = this.bidStartIndex;

    this._setPhase(GamePhase.BIDDING);
  }

  _setPhase(phase) {
    this.phase = phase;
    this._emit('onPhaseChange', phase);
  }

  _emit(callbackName, ...args) {
    const callback = this[callbackName];
    if (!callback) return;
    try {
      callback(...args);
    } catch (e) {
      console.error(`${callbackName} callback failed:`, e);
    }
  }

  // ── Bidding Phase ──────────────────────────────────────

  /** Get current bidding state for UI */
  getBiddingState() {
    return {
      currentBid: this.currentBid,
      bidHistory: [...this.bidHistory],
      currentPlayerIndex: this.currentPlayerIndex,
      isHumanTurn: this.currentPlayerIndex === 0 && this.phase === GamePhase.BIDDING
    };
  }

  /** Handle a bid from any player */
  handleBid(playerIndex, points) {
    if (this.phase !== GamePhase.BIDDING) return false;
    if (playerIndex !== this.currentPlayerIndex) return false;

    const player = this.players[playerIndex];

    if (points === 0) {
      // Pass
      this.bidHistory.push({ playerIndex, bid: 0 });
      this.bidPassCount++;
      player.bidPoints = 0;

      this._emit('onBid', playerIndex, 0);

      // If all 3 passed, re-deal
      if (this.bidPassCount >= 3) {
        this.start(); // re-deal
        return true;
      }
    } else {
      // Bid: must be higher than current
      if (points <= this.currentBid || points > 3) return false;

      this.currentBid = points;
      this.bidPassCount = 0;
      this.bidHistory.push({ playerIndex, bid: points });
      player.bidPoints = points;

      this._emit('onBid', playerIndex, points);

      // If bid is 3, immediately assign landlord
      if (points === 3) {
        this._assignLandlord(playerIndex);
        return true;
      }
    }

    // Move to next player (clockwise)
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 3;
    this.bidRound++;

    // After 1 full round (everyone had a chance since last bid), check if bidding is done
    // If currentBid > 0 and we've come back to the highest bidder, assign landlord
    if (this.currentBid > 0) {
      const highestBidder = this.bidHistory
        .filter(b => b.bid > 0)
        .sort((a, b) => b.bid - a.bid)[0];
      if (this.currentPlayerIndex === highestBidder.playerIndex) {
        // Back to highest bidder, they become landlord
        this._assignLandlord(highestBidder.playerIndex);
        return true;
      }
    }

    // Notify UI of turn change
    this._emit('onTurnChange', this.currentPlayerIndex);
    return true;
  }

  _assignLandlord(playerIndex) {
    this.landlordIndex = playerIndex;
    const landlord = this.players[playerIndex];
    landlord.isLandlord = true;
    landlord.addCards(this.landlordCards);
    landlord.sortHand();

    if (playerIndex === 0) {
      this.stats.playerWasLandlord = true;
      this.stats.landlordGames++;
      this.stats.playerBidPoints = this.currentBid;
      this.stats.playerCardsAtStart = 20;
    }

    // Landlord plays first
    this.currentPlayerIndex = this.landlordIndex;
    this.lastPlay = null;
    this.lastPlayPlayerIndex = -1;
    this.consecutivePasses = 0;

    this._setPhase(GamePhase.PLAYING);
    this._emit('onTurnChange', this.currentPlayerIndex);
  }

  // ── Playing Phase ──────────────────────────────────────

  /** Handle a play from a player */
  handlePlay(playerIndex, cards) {
    if (this.phase !== GamePhase.PLAYING) return { ok: false, error: '不在出牌阶段' };
    if (playerIndex !== this.currentPlayerIndex) return { ok: false, error: '不是你的回合' };

    // If no cards selected, treat as pass
    if (!cards || cards.length === 0) {
      return this.handlePass(playerIndex);
    }

    const player = this.players[playerIndex];

    // Validate cards are in hand
    if (!validatePlayerCards(player, cards)) {
      return { ok: false, error: '你没有这些牌' };
    }

    // Detect hand type
    const handType = detectHandType(cards);
    if (!handType) {
      return { ok: false, error: '无效牌型' };
    }

    // Check if it beats the last play
    if (this.lastPlay && this.lastPlayPlayerIndex !== playerIndex) {
      if (!canBeat(handType, this.lastPlay)) {
        return { ok: false, error: '打不过上家的牌' };
      }
    }

    // Remove cards from hand
    player.removeCards(cards);

    // Track stats
    if (handType.type === HandType.BOMB || handType.type === HandType.ROCKET) {
      this.stats.currentGameBombs++;
      if (playerIndex === 0) {
        this.stats.totalBombs++;
        if (handType.type === HandType.ROCKET) this.stats.rocketsPlayed++;
      }
    }
    if (handType.type === HandType.STRAIGHT && handType.length >= 10 && playerIndex === 0) {
      this.stats.longStraights++;
    }
    if ((handType.type === HandType.AIRPLANE ||
         handType.type === HandType.AIRPLANE_SINGLES ||
         handType.type === HandType.AIRPLANE_PAIRS) && playerIndex === 0) {
      this.stats.airplanesPlayed++;
    }

    // Track consecutive leads
    if (this.lastPlayPlayerIndex === playerIndex || !this.lastPlay) {
      this.stats.currentConsecutiveLeads++;
      if (playerIndex === 0 && this.stats.currentConsecutiveLeads > this.stats.mostConsecutiveLeads) {
        this.stats.mostConsecutiveLeads = this.stats.currentConsecutiveLeads;
      }
    }

    // Update game state
    this.lastPlay = { ...handType, cards: [...cards] };
    this.lastPlayPlayerIndex = playerIndex;
    this.consecutivePasses = 0;

    // Track spring/anti-spring
    if (playerIndex === this.landlordIndex) {
      this._landlordPlayedFirstCard = true;
    }
    if (playerIndex !== this.landlordIndex) {
      this._farmerEverPlayed = true;
    }

    this._emit('onPlay', playerIndex, { cards: [...cards], ...handType });

    // Check win
    if (player.cardCount === 0) {
      // Track last card kill
      if (playerIndex === 0 && handType.rank >= 15) {
        this.stats.lastCardKills++;
      }
      this._endGame(playerIndex);
      return { ok: true, gameOver: true };
    }

    // Next turn
    this._nextTurn();
    return { ok: true };
  }

  /** Handle pass */
  handlePass(playerIndex) {
    if (this.phase !== GamePhase.PLAYING) return { ok: false, error: '不在出牌阶段' };
    if (playerIndex !== this.currentPlayerIndex) return { ok: false, error: '不是你的回合' };

    // Can't pass if no last play or you were the last to play
    if (!this.lastPlay || this.lastPlayPlayerIndex === playerIndex) {
      return { ok: false, error: '你必须出牌' };
    }

    this.consecutivePasses++;
    this._emit('onPass', playerIndex);

    // Two consecutive passes → new round
    if (this.consecutivePasses >= 2) {
      this.lastPlay = null;
      this.lastPlayPlayerIndex = this._findLastPlayedPlayer();
      this.currentPlayerIndex = this.lastPlayPlayerIndex;
      this.consecutivePasses = 0;
      this.stats.currentConsecutiveLeads = 0; // reset
      this._emit('onNewRound', this.currentPlayerIndex);
    } else {
      this._nextTurn();
    }

    return { ok: true };
  }

  _findLastPlayedPlayer() {
    // Find player who made the last valid play (not pass)
    // This is the lastPlayPlayerIndex
    return this.lastPlayPlayerIndex;
  }

  _nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 3;
    this._emit('onTurnChange', this.currentPlayerIndex);
  }

  // ── Game End ───────────────────────────────────────────

  _endGame(winnerIndex) {
    this._setPhase(GamePhase.FINISHED);

    const landlordWon = (winnerIndex === this.landlordIndex);
    const playerWon = (winnerIndex === 0);
    const bidPoints = this.currentBid || 1;

    // Spring detection
    if (landlordWon && !this._farmerEverPlayed) {
      this.stats.isSpring = true;
      if (winnerIndex === 0) this.stats.springs++;
    }
    if (!landlordWon && !this._landlordPlayedFirstCard) {
      this.stats.isAntiSpring = true;
      if (this.landlordIndex === 0) this.stats.antiSprings++;
    }

    // God hand detection
    if (this.landlordIndex === 0 && this.stats.currentGameBombs >= 3) {
      this.stats.godHands++;
    }

    // Perfect bid
    if (this.landlordIndex === 0 && this.currentBid === 3 && playerWon) {
      this.stats.perfectBids++;
    }

    // Comeback
    if (playerWon && this.players[0].cardCount <= 2 && this.players[0].cardCount > 0) {
      // Wait, if they won they have 0 cards. Comeback is when they were close to losing.
      // Tracked at checkGameOver time based on opponent card counts
    }

    // Calculate score
    const baseScore = bidPoints;
    let multiplier = 1;
    if (this.stats.isSpring || this.stats.isAntiSpring) multiplier = 2;
    // Bomb multiplier (rocket = 2x, each bomb = 2x) - simplified: just use bombs count
    if (this.stats.currentGameBombs > 0) multiplier *= Math.pow(2, this.stats.currentGameBombs);

    const scoreChange = baseScore * multiplier;

    if (landlordWon) {
      this.players[this.landlordIndex].score += scoreChange * 2;
      for (let i = 0; i < 3; i++) {
        if (i !== this.landlordIndex) this.players[i].score -= scoreChange;
      }
    } else {
      for (let i = 0; i < 3; i++) {
        if (i !== this.landlordIndex) this.players[i].score += scoreChange;
      }
      this.players[this.landlordIndex].score -= scoreChange * 2;
    }

    // Update stats
    this.stats.totalGames++;
    if (playerWon) {
      this.stats.totalWins++;
      this.stats.winStreak++;
      if (this.stats.winStreak > this.stats.bestWinStreak) {
        this.stats.bestWinStreak = this.stats.winStreak;
      }
      if (this.stats.playerWasLandlord) this.stats.landlordWins++;
      else this.stats.farmerWins++;
    } else {
      this.stats.totalLosses++;
      this.stats.winStreak = 0;
    }
    this.stats.totalScore = this.players[0].score;
    if (this.stats.currentGameBombs > this.stats.mostBombsInGame) {
      this.stats.mostBombsInGame = this.stats.currentGameBombs;
    }

    // Comeback: if player won and had opponents with few cards remaining
    if (playerWon && winnerIndex === 0) {
      const opponents = this.players.filter(p => p.id !== 0);
      if (opponents.some(p => p.cardCount <= 2)) {
        this.stats.comebacks++;
      }
    } else if (!playerWon && winnerIndex !== 0 && winnerIndex === this.landlordIndex) {
      // Human lost, AI landlord won with human having few cards - not a comeback
    }

    // Save stats
    Store.saveStats(this.stats);

    this.gameOverResult = {
      winnerIndex,
      landlordIndex: this.landlordIndex,
      landlordWon,
      playerWon,
      scoreChange,
      multiplier,
      bidPoints,
      isSpring: this.stats.isSpring,
      isAntiSpring: this.stats.isAntiSpring,
      bombs: this.stats.currentGameBombs
    };

    // Trigger stats change for achievements
    this._emit('onStatsChange', this.stats);
    this._emit('onGameOver', this.gameOverResult);
  }

  // ── AI Auto-Play ───────────────────────────────────────

  /** Check if current turn is AI; if so, trigger AI move after delay */
  autoPlayIfAI() {
    if (this.phase === GamePhase.BIDDING && this.currentPlayerIndex !== 0) {
      return 'bid';
    }
    if (this.phase === GamePhase.PLAYING && this.currentPlayerIndex !== 0) {
      return 'play';
    }
    return null;
  }

  /** Execute AI bid */
  executeAIBid() {
    const idx = this.currentPlayerIndex;
    const player = this.players[idx];
    const bid = aiChooseBid(player.cards, this.difficulty, this.currentBid);
    const result = this.handleBid(idx, bid);
    if (!result) {
      console.warn('AI bid failed, retrying with pass:', bid);
      this.handleBid(idx, 0);
    }
    return bid;
  }

  /** Execute AI play. Returns the play or null (pass). */
  executeAIPlay() {
    const idx = this.currentPlayerIndex;
    const player = this.players[idx];

    const context = {
      difficulty: this.difficulty,
      handCounts: this.players.map(p => p.cardCount),
      playerIndex: idx,
      isLandlord: player.isLandlord,
      landlordIndex: this.landlordIndex,
      lastPlayPlayerIndex: this.lastPlayPlayerIndex
    };

    const play = aiChoosePlay(player.cards, this.lastPlay, context);

    if (play) {
      const result = this.handlePlay(idx, play.cards);
      if (!result.ok) {
        console.warn('AI produced invalid play, falling back to pass:', playDescription(play), result.error);
        // Fallback: try passing instead
        const passResult = this.handlePass(idx);
        if (!passResult.ok) {
          console.error('AI pass also failed:', passResult.error);
        }
        return null;
      }
      return play;
    } else {
      const result = this.handlePass(idx);
      if (!result.ok) {
        console.error('AI pass failed:', result.error, 'phase:', this.phase, 'currentIdx:', this.currentPlayerIndex);
        // Desperate recovery: skip turn if pass is invalid
        if (this.phase === GamePhase.PLAYING && this.currentPlayerIndex === idx) {
          this._nextTurn();
        }
      }
      return null;
    }
  }

  // ── Human helpers ──────────────────────────────────────

  /** Get the human player's hand */
  getHumanHand() {
    return this.players[0].cards;
  }

  /** Get the human player */
  getHumanPlayer() {
    return this.players[0];
  }

  /** Get current state for UI */
  getState() {
    return {
      phase: this.phase,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        cardCount: p.cardCount,
        isLandlord: p.isLandlord,
        score: p.score,
        // Show cards only for human
        cards: p.id === 0 ? p.cards : null
      })),
      landlordCards: this.phase === GamePhase.FINISHED || this.phase === GamePhase.PLAYING
        ? this.landlordCards : null,
      landlordIndex: this.landlordIndex,
      currentPlayerIndex: this.currentPlayerIndex,
      lastPlay: this.lastPlay,
      lastPlayPlayerIndex: this.lastPlayPlayerIndex,
      currentBid: this.currentBid,
      bidHistory: [...this.bidHistory],
      isHumanTurn: this.currentPlayerIndex === 0 && this.phase !== GamePhase.FINISHED,
      gameOverResult: this.gameOverResult,
      stats: { ...this.stats },
      settings: { ...this.settings }
    };
  }
}

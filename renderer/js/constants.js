// ============================================================
// constants.js — card definitions, enums, achievement data
// ============================================================

// ── Suits ───────────────────────────────────────────────────
const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'];
const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' };
const SUIT_COLORS  = { spades: 'black', hearts: 'red', clubs: 'black', diamonds: 'red' };

// ── Rank display ────────────────────────────────────────────
const RANK_NAMES = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const JOKER_NAMES = { 16: '小王', 17: '大王' };

// rank value: 3→3 ... 15→2, 16→小王, 17→大王 (higher = bigger)
function getRankValue(id) {
  if (id === 52) return 16;
  if (id === 53) return 17;
  return (id % 13) + 3;
}

function getSuit(id) {
  if (id >= 52) return null;
  return SUITS[Math.floor(id / 13)];
}

function getRankName(rankValue) {
  if (rankValue <= 15) return RANK_NAMES[rankValue - 3];
  return JOKER_NAMES[rankValue];
}

function createCard(id) {
  const rank = getRankValue(id);
  const suit = getSuit(id);
  const rankName = getRankName(rank);
  const suitSymbol = suit ? SUIT_SYMBOLS[suit] : '';
  const color = suit ? SUIT_COLORS[suit] : (id === 53 ? 'red' : 'black');
  return {
    id,
    suit,
    rank,
    rankName,
    suitSymbol,
    color,
    isJoker: id >= 52
  };
}

// ── Hand Type Enum ──────────────────────────────────────────
const HandType = Object.freeze({
  SINGLE:           'single',
  PAIR:             'pair',
  THREE:            'three',
  THREE_ONE:        'three_one',
  THREE_TWO:        'three_two',
  STRAIGHT:         'straight',
  DOUBLE_STRAIGHT:  'double_straight',
  AIRPLANE:         'airplane',
  AIRPLANE_SINGLES: 'airplane_singles',
  AIRPLANE_PAIRS:   'airplane_pairs',
  BOMB:             'bomb',
  ROCKET:           'rocket'
});

// Map for display names and sort order of hand types
const HAND_TYPE_DISPLAY = {
  [HandType.SINGLE]: '单张',
  [HandType.PAIR]: '对子',
  [HandType.THREE]: '三张',
  [HandType.THREE_ONE]: '三带一',
  [HandType.THREE_TWO]: '三带二',
  [HandType.STRAIGHT]: '顺子',
  [HandType.DOUBLE_STRAIGHT]: '连对',
  [HandType.AIRPLANE]: '飞机',
  [HandType.AIRPLANE_SINGLES]: '飞机带单',
  [HandType.AIRPLANE_PAIRS]: '飞机带对',
  [HandType.BOMB]: '炸弹',
  [HandType.ROCKET]: '火箭'
};

// ── Game Phase Enum ─────────────────────────────────────────
const GamePhase = Object.freeze({
  INIT:     'init',
  DEALING:  'dealing',
  BIDDING:  'bidding',
  PLAYING:  'playing',
  FINISHED: 'finished'
});

// ── Player Type Enum ────────────────────────────────────────
const PlayerType = Object.freeze({
  HUMAN: 'human',
  AI:    'ai'
});

// ── Difficulty ──────────────────────────────────────────────
const Difficulty = Object.freeze({
  EASY:   0,
  MEDIUM: 1,
  HARD:   2
});

const DIFFICULTY_NAMES = ['简单', '中等', '困难'];

// ── Achievements Data ───────────────────────────────────────
const ACHIEVEMENTS = [
  // Beginner
  { id: 'first_game', name: '初次登场', desc: '完成第一局游戏', icon: '🎮', cat: 'beginner', hidden: false, check: s => s.totalGames >= 1 },
  { id: 'first_win', name: '初战告捷', desc: '赢得第一局游戏', icon: '🏆', cat: 'beginner', hidden: false, check: s => s.totalWins >= 1 },
  { id: 'first_landlord', name: '敢叫地主', desc: '第一次成为地主', icon: '👑', cat: 'beginner', hidden: false, check: s => s.landlordGames >= 1 },
  { id: 'first_farmer_win', name: '农民起义', desc: '作为农民第一次获胜', icon: '🌾', cat: 'beginner', hidden: false, check: s => s.farmerWins >= 1 },
  { id: 'first_bomb', name: '炸裂开场', desc: '第一次打出炸弹', icon: '💣', cat: 'beginner', hidden: false, check: s => s.totalBombs >= 1 },

  // Play
  { id: 'rocket_launch', name: '火箭升空', desc: '打出火箭（双王）', icon: '🚀', cat: 'play', hidden: false, check: s => s.rocketsPlayed >= 1 },
  { id: 'long_straight', name: '长龙在天', desc: '打出10张以上顺子', icon: '🐉', cat: 'play', hidden: false, check: s => s.longStraights >= 1 },
  { id: 'airplane_ace', name: '王牌飞行员', desc: '打出飞机带翅膀', icon: '✈️', cat: 'play', hidden: false, check: s => s.airplanesPlayed >= 1 },
  { id: 'four_bombs', name: '火药桶', desc: '单局打出3个以上炸弹', icon: '🧨', cat: 'play', hidden: false, check: s => s.mostBombsInGame >= 3 },
  { id: 'last_card_2', name: '绝杀', desc: '用2或王作为最后一张牌获胜', icon: '⚔️', cat: 'play', hidden: false, check: s => s.lastCardKills >= 1 },

  // Victory
  { id: 'spring', name: '春暖花开', desc: '打出春天（地主一回合出完）', icon: '🌸', cat: 'victory', hidden: false, check: s => s.springs >= 1 },
  { id: 'anti_spring', name: '倒春寒', desc: '打出反春天', icon: '❄️', cat: 'victory', hidden: false, check: s => s.antiSprings >= 1 },
  { id: 'win_streak_3', name: '三连胜', desc: '连胜3局', icon: '🔥', cat: 'victory', hidden: false, check: s => s.bestWinStreak >= 3 },
  { id: 'win_streak_5', name: '五连胜', desc: '连胜5局', icon: '💪', cat: 'victory', hidden: false, check: s => s.bestWinStreak >= 5 },
  { id: 'win_streak_10', name: '常胜将军', desc: '连胜10局', icon: '⚡', cat: 'victory', hidden: false, check: s => s.bestWinStreak >= 10 },
  { id: 'landlord_master', name: '地主之王', desc: '以地主身份赢20局', icon: '🤴', cat: 'victory', hidden: false, check: s => s.landlordWins >= 20 },
  { id: 'farmer_hero', name: '农民英雄', desc: '以农民身份赢30局', icon: '🦸', cat: 'victory', hidden: false, check: s => s.farmerWins >= 30 },

  // Score
  { id: 'score_100', name: '小有积蓄', desc: '累计积分达100', icon: '💰', cat: 'score', hidden: false, check: s => s.totalScore >= 100 },
  { id: 'score_500', name: '富甲一方', desc: '累计积分达500', icon: '💎', cat: 'score', hidden: false, check: s => s.totalScore >= 500 },
  { id: 'score_1000', name: '腰缠万贯', desc: '累计积分达1000', icon: '👑', cat: 'score', hidden: false, check: s => s.totalScore >= 1000 },
  { id: 'score_5000', name: '富可敌国', desc: '累计积分达5000', icon: '🏰', cat: 'score', hidden: false, check: s => s.totalScore >= 5000 },

  // Hidden
  { id: 'god_hand', name: '天选之人', desc: '手牌含3个以上炸弹', icon: '🌟', cat: 'hidden', hidden: true, check: s => s.godHands >= 1 },
  { id: 'perfect_bid', name: '自信满满', desc: '直接叫3分且最终获胜', icon: '🎯', cat: 'hidden', hidden: true, check: s => s.perfectBids >= 1 },
  { id: 'zero_card_lead', name: '掌控全局', desc: '连续3次获得自由出牌权', icon: '🎪', cat: 'hidden', hidden: true, check: s => s.mostConsecutiveLeads >= 3 },
  { id: 'comeback', name: '绝地反击', desc: '只剩≤2张牌时逆转获胜', icon: '🔄', cat: 'hidden', hidden: true, check: s => s.comebacks >= 1 }
];

// ── Default Settings ────────────────────────────────────────
const DEFAULT_SETTINGS = {
  difficulty: Difficulty.MEDIUM,
  sfxVolume: 0.7,
  bgmVolume: 0.4,
  muted: false
};

// ── Default Stats ───────────────────────────────────────────
const DEFAULT_STATS = {
  totalGames: 0,
  totalWins: 0,
  totalLosses: 0,
  winStreak: 0,
  bestWinStreak: 0,
  landlordGames: 0,
  landlordWins: 0,
  farmerWins: 0,
  totalScore: 0,
  totalBombs: 0,
  rocketsPlayed: 0,
  longStraights: 0,
  airplanesPlayed: 0,
  mostBombsInGame: 0,
  lastCardKills: 0,
  springs: 0,
  antiSprings: 0,
  godHands: 0,
  perfectBids: 0,
  mostConsecutiveLeads: 0,
  comebacks: 0,
  currentGameBombs: 0,
  currentConsecutiveLeads: 0,
  // track per-game state
  playerWasLandlord: false,
  playerBidPoints: 0,
  playerCardsAtStart: 0,
  isSpring: false,
  isAntiSpring: false
};

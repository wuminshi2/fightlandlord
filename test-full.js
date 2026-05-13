// Full integration test
const fs = require('fs');
const vm = require('vm');

function loadScript(filename) {
  const code = fs.readFileSync(filename, 'utf-8');
  const script = new vm.Script(code, { filename });
  script.runInThisContext({ filename });
}

loadScript('renderer/js/constants.js');
loadScript('renderer/js/cardUtils.js');
loadScript('renderer/js/deck.js');
loadScript('renderer/js/player.js');
loadScript('renderer/js/ai.js');
loadScript('renderer/js/game.js');
loadScript('renderer/js/ui.js');

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('  PASS:', msg);
}

// ── Deck tests ──
const deck = createDeck();
assert(deck.length === 54, 'Deck has 54 cards');
const uniqueIds = new Set(deck.map(c => c.id));
assert(uniqueIds.size === 54, 'All card IDs unique');

const shuffled = [...deck];
shuffleDeck(shuffled);
assert(shuffled.length === 54, 'Shuffled deck still 54 cards');
assert(shuffled.some((c, i) => c.id !== deck[i].id), 'Shuffling changes order');

const { hands, landlordCards } = dealCards(deck);
assert(hands[0].length === 17 && hands[1].length === 17 && hands[2].length === 17, 'Each player gets 17');
assert(landlordCards.length === 3, '3 landlord cards');

// ── Player tests ──
const p = new Player(0, 'Test', 'human');
p.addCards([createCard(0), createCard(15), createCard(52)]); // ♠3, ♦3, 小王
assert(p.cardCount === 3, 'Player has 3 cards');
p.sortHand();
assert(p.cards[0].rank >= p.cards[1].rank, 'Cards sorted descending');

p.removeCards([createCard(0)]);
assert(p.cardCount === 2, 'After removal: 2 cards');

p.reset();
assert(p.cardCount === 0, 'Reset clears hand');

// ── AI tests ──
// Weak hand
const weakHand = [];
for (let i = 0; i < 17; i++) weakHand.push(createCard(i)); // Low cards 3-5
const weakBid = aiChooseBid(weakHand, Difficulty.EASY, 0);
console.log('  INFO: Weak hand bid =', weakBid);
assert(weakBid <= 1, 'Weak hand bids low or passes');

// Strong hand (many high cards)
const strongHand = [];
// Add jokers
strongHand.push(createCard(52), createCard(53));
// Add 2s
strongHand.push(createCard(12), createCard(25), createCard(38), createCard(51));
// Add Aces
strongHand.push(createCard(11), createCard(24), createCard(37), createCard(50));
// Add some more
for (let i = 0; i < 7; i++) strongHand.push(createCard(30 + i));
const strongBid = aiChooseBid(strongHand, Difficulty.HARD, 0);
console.log('  INFO: Strong hand bid =', strongBid);
assert(strongBid >= 2, 'Strong hand bids high');

// AI play - free play (leading)
const medHand = [];
// Make a hand with some structure
medHand.push(createCard(0), createCard(13)); // pair of 3s
medHand.push(createCard(1), createCard(14)); // pair of 4s
medHand.push(createCard(2), createCard(15)); // pair of 5s
medHand.push(createCard(3), createCard(16)); // pair of 6s
medHand.push(createCard(52)); // 小王
medHand.push(createCard(12)); // ♠2
medHand.push(createCard(25)); // ♥2
medHand.push(createCard(5), createCard(6), createCard(7), createCard(8)); // some extras

const leadPlay = aiChoosePlay(medHand, null, {
  difficulty: Difficulty.MEDIUM,
  handCounts: [17, 17, 17],
  playerIndex: 1,
  isLandlord: false,
  landlordIndex: 0
});
assert(leadPlay !== null, 'AI finds a leading play');
console.log('  INFO: AI leads with', leadPlay.type, playDescription(leadPlay));

// AI play - following
const lastPlay = detectHandType([createCard(26), createCard(39)]); // pair of 3s
const followPlay = aiChoosePlay(medHand, lastPlay, {
  difficulty: Difficulty.MEDIUM,
  handCounts: [17, 17, 17],
  playerIndex: 1,
  isLandlord: false,
  landlordIndex: 0
});
assert(followPlay !== null, 'AI finds following play');
console.log('  INFO: AI follows with', followPlay.type, playDescription(followPlay));

// AI should pass if no card can beat a high 2
const highSingle = detectHandType([createCard(12)]); // ♠2
const weakAIHand = [createCard(0), createCard(1), createCard(2)]; // 3,4,5
const passPlay = aiChoosePlay(weakAIHand, highSingle, {
  difficulty: Difficulty.HARD,
  handCounts: [17, 17, 3],
  playerIndex: 2,
  isLandlord: false,
  landlordIndex: 0
});
console.log('  INFO: AI with weak hand vs 2 =', passPlay ? 'plays' : 'passes');
// With only 3,4,5 and faced with a 2, should pass (no bombs/rockets to use)
// Actually, EASY might try anyway. MEDIUM/HARD should pass.

// Bombs beat any non-bomb, even when the bomb rank is lower than the last play rank.
const lowBombHand = [createCard(0), createCard(13), createCard(26), createCard(39)]; // four 3s
const bombVsHighSingle = aiChoosePlay(lowBombHand, highSingle, {
  difficulty: Difficulty.HARD,
  handCounts: [17, 4, 17],
  playerIndex: 1,
  isLandlord: false,
  landlordIndex: 0
});
assert(bombVsHighSingle !== null && bombVsHighSingle.type === HandType.BOMB, 'AI uses bomb to beat non-bomb high card');

const rocketPlay = detectHandType([createCard(52), createCard(53)]);
const bombVsRocket = aiChoosePlay(lowBombHand, rocketPlay, {
  difficulty: Difficulty.HARD,
  handCounts: [17, 4, 17],
  playerIndex: 1,
  isLandlord: false,
  landlordIndex: 0
});
assert(bombVsRocket === null, 'AI does not use bomb against rocket');

// UI should render joker/rocket plays without assuming a center suit exists.
class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.textContent = '';
    this._className = '';
  }
  get className() { return this._className; }
  set className(value) { this._className = value || ''; }
  get classList() {
    return {
      add: (...names) => {
        const classes = new Set(this._className.split(/\s+/).filter(Boolean));
        names.forEach(name => classes.add(name));
        this._className = [...classes].join(' ');
      },
      remove: (...names) => {
        const removeSet = new Set(names);
        this._className = this._className.split(/\s+/).filter(c => c && !removeSet.has(c)).join(' ');
      }
    };
  }
  set innerHTML(value) {
    this.children = [];
    this._innerHTML = value;
    const classMatches = String(value || '').matchAll(/class="([^"]+)"/g);
    for (const match of classMatches) {
      const child = new FakeElement('span');
      child.className = match[1];
      this.appendChild(child);
    }
  }
  get innerHTML() { return this._innerHTML || ''; }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter(child => child !== this);
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const className = selector.trim().split(/\s+/).pop().replace('.', '');
    const found = [];
    const visit = (node) => {
      if (node._className.split(/\s+/).includes(className)) found.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return found;
  }
}

const previousDocument = global.document;
const fakeSlots = {
  'play-slot-0': new FakeElement('div'),
  'play-slot-1': new FakeElement('div'),
  'play-slot-2': new FakeElement('div')
};
global.document = {
  createElement: tagName => new FakeElement(tagName),
  getElementById: id => fakeSlots[id] || null,
  querySelectorAll: selector => Object.values(fakeSlots).flatMap(slot => slot.querySelectorAll(selector))
};
const ui = new UIManager();
ui.game = {
  getState: () => ({
    lastPlay: { ...rocketPlay, cards: [createCard(52), createCard(53)] },
    lastPlayPlayerIndex: 1
  })
};
ui._renderPlayZone();
global.document = previousDocument;
assert(fakeSlots['play-slot-1'].children.some(child => child.className.includes('card')), 'UI renders rocket play without crashing');

const callbackGame = new Game();
callbackGame.phase = GamePhase.PLAYING;
callbackGame.stats = { ...DEFAULT_STATS };
callbackGame.players = [
  new Player(0, 'Human', PlayerType.HUMAN),
  new Player(1, 'AI_1', PlayerType.AI),
  new Player(2, 'AI_2', PlayerType.AI)
];
callbackGame.landlordIndex = 0;
callbackGame.players[1].cards = [createCard(52), createCard(0)];
callbackGame.currentPlayerIndex = 1;
callbackGame.onPlay = () => { throw new Error('render failed'); };
const previousConsoleError = console.error;
console.error = () => {};
let callbackResult;
try {
  callbackResult = callbackGame.handlePlay(1, [createCard(52)]);
} finally {
  console.error = previousConsoleError;
}
assert(callbackResult.ok && callbackGame.currentPlayerIndex === 2, 'UI callback errors do not block turn advancement');

const controlEls = {
  'bid-controls': new FakeElement('div'),
  'play-controls': new FakeElement('div'),
  'btn-pass': new FakeElement('button'),
  'btn-play': new FakeElement('button'),
  'btn-hint': new FakeElement('button'),
  'btn-bid-0': new FakeElement('button'),
  'btn-bid-1': new FakeElement('button'),
  'btn-bid-2': new FakeElement('button'),
  'btn-bid-3': new FakeElement('button')
};
global.document = {
  getElementById: id => controlEls[id] || null,
  querySelectorAll: () => []
};
const controlsUI = new UIManager();
controlsUI.game = {
  getState: () => ({
    phase: GamePhase.PLAYING,
    isHumanTurn: true,
    lastPlay: highSingle,
    lastPlayPlayerIndex: 1
  }),
  getHumanHand: () => weakAIHand
};
controlsUI._renderControls();
global.document = previousDocument;
assert(
  controlEls['btn-pass'].style.display === '' &&
  controlEls['btn-pass'].disabled === false &&
  controlEls['btn-play'].style.display === 'none' &&
  controlEls['btn-hint'].style.display === 'none',
  'Only pass is shown when human has no playable cards'
);

const reorderUI = new UIManager();
const reorderCards = [createCard(0), createCard(1), createCard(2)];
reorderUI.game = { getHumanHand: () => reorderCards };
reorderUI._renderHumanHand = () => {};
reorderUI._reorderHumanCard(0, 2, true);
assert(reorderCards.map(c => c.id).join(',') === '1,2,0', 'Dragging cards can reorder the human hand');

const sortUI = new UIManager();
const sortablePlayer = new Player(0, 'Human', PlayerType.HUMAN);
sortablePlayer.cards = [createCard(0), createCard(53), createCard(12)];
sortUI.game = { players: [sortablePlayer] };
sortUI.sound = { play: () => {} };
sortUI._renderHumanHand = () => {};
sortUI._onSortHandClick();
assert(sortablePlayer.cards.map(c => c.rank).join(',') === '17,15,3', 'Sort hand button restores rank-descending order');

const persistedScoreGame = new Game();
persistedScoreGame.stats = { ...DEFAULT_STATS, totalScore: 42 };
persistedScoreGame.start();
assert(persistedScoreGame.players[0].score === 42, 'New games start from persisted cumulative player score');

// ── Simulate a quick game ──
console.log('\n--- Quick Game Simulation ---');
const simDeck = createDeck();
shuffleDeck(simDeck);
const simPlayers = [
  new Player(0, 'Human', 'human'),
  new Player(1, 'AI_1', 'ai'),
  new Player(2, 'AI_2', 'ai')
];
const simHands = [simDeck.slice(0, 17), simDeck.slice(17, 34), simDeck.slice(34, 51)];
simPlayers[0].cards = simHands[0]; simPlayers[0].sortHand();
simPlayers[1].cards = simHands[1]; simPlayers[1].sortHand();
simPlayers[2].cards = simHands[2]; simPlayers[2].sortHand();

// Bidding simulation
let currentBid = 0;
let landlordIdx = -1;
for (let round = 0; round < 3; round++) {
  for (let i = 0; i < 3; i++) {
    const bid = aiChooseBid(simPlayers[i].cards, Difficulty.MEDIUM, currentBid);
    if (bid > currentBid) {
      currentBid = bid;
      landlordIdx = i;
    }
  }
  if (landlordIdx >= 0 && (round >= 1 || currentBid === 3)) break;
}
if (landlordIdx < 0) landlordIdx = 0; // forced
simPlayers[landlordIdx].isLandlord = true;
simPlayers[landlordIdx].addCards(simDeck.slice(51, 54));
console.log('Landlord: Player', landlordIdx, 'Bid:', currentBid);

// Quick play simulation (just a few rounds)
let currentPlayer = landlordIdx;
let lastP = null;
let lastPlayer = -1;
let passes = 0;
let roundCount = 0;

while (roundCount < 10) {
  const player = simPlayers[currentPlayer];
  const play = aiChoosePlay(player.cards, lastP, {
    difficulty: Difficulty.MEDIUM,
    handCounts: simPlayers.map(p => p.cards.length),
    playerIndex: currentPlayer,
    isLandlord: currentPlayer === landlordIdx,
    landlordIndex: landlordIdx,
    lastPlayPlayerIndex: lastPlayer
  });

  if (play) {
    player.removeCards(play.cards);
    lastP = play;
    lastPlayer = currentPlayer;
    passes = 0;
    console.log(`Player ${currentPlayer} plays ${playDescription(play)}, remaining: ${player.cards.length}`);
    if (player.cards.length === 0) {
      console.log(`Player ${currentPlayer} wins!`);
      break;
    }
  } else {
    passes++;
    console.log(`Player ${currentPlayer} passes`);
    if (passes >= 2) {
      lastP = null;
      passes = 0;
      console.log('  -> New round');
    }
  }

  currentPlayer = (currentPlayer + 1) % 3;
  roundCount++;
}

console.log('Simulation complete!');
console.log('\n✓ All integration tests passed!');

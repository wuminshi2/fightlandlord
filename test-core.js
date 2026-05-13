// Quick test of core game logic
// Run: node test-core.js

// We need to mock browser globals for the browser-targeted scripts
// The scripts expect to run in a browser where top-level const creates globals.
// We use a custom loader.

const fs = require('fs');
const vm = require('vm');

function loadScript(filename) {
  const code = fs.readFileSync(filename, 'utf-8');
  const script = new vm.Script(code, { filename });
  script.runInThisContext({ filename });
}

// Load in dependency order
loadScript('renderer/js/constants.js');
loadScript('renderer/js/cardUtils.js');

// ── Tests ──

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('  PASS:', msg);
}

// Card creation
const c3 = createCard(0);
assert(c3.rankName === '3' && c3.suitSymbol === '♠', 'Card 0 is 3♠');

const jokerRed = createCard(53);
assert(jokerRed.rankName === '大王' && jokerRed.rank === 17, 'Card 53 is 大王 rank=17');

const jokerBlack = createCard(52);
assert(jokerBlack.rankName === '小王' && jokerBlack.rank === 16, 'Card 52 is 小王 rank=16');

// detectHandType
const single = [createCard(5)];
assert(detectHandType(single).type === 'single', 'Single detection');

const pair = [createCard(0), createCard(13)]; // ♠3 + ♥3
assert(detectHandType(pair).type === 'pair', 'Pair detection');

const bomb = [createCard(0), createCard(13), createCard(26), createCard(39)]; // 3333
assert(detectHandType(bomb).type === 'bomb', 'Bomb detection');

const rocket = [createCard(52), createCard(53)];
assert(detectHandType(rocket).type === 'rocket', 'Rocket detection');

// Straight: ♠3 ♥4 ♣5 ♦6 ♠7
const straight = [createCard(0), createCard(14), createCard(28), createCard(42), createCard(4)];
const st = detectHandType(straight);
assert(st.type === 'straight' && st.length === 5, 'Straight 5 length=' + st.length);

// Three+One: ♠3 ♥3 ♣3 + ♦5
const threeOne = [createCard(0), createCard(13), createCard(26), createCard(43)];
assert(detectHandType(threeOne).type === 'three_one', 'Three+One detection');

// Three+Two: ♠3 ♥3 ♣3 + ♥4 ♦4
const threeTwo = [createCard(0), createCard(13), createCard(26), createCard(14), createCard(1)];
assert(detectHandType(threeTwo).type === 'three_two', 'Three+Two detection');

// Double straight: ♠3 ♥3 ♠4 ♥4 ♠5 ♥5
const dblStraight = [createCard(0), createCard(13), createCard(1), createCard(14),
                     createCard(2), createCard(15)];
const ds = detectHandType(dblStraight);
assert(ds.type === 'double_straight' && ds.length === 6, 'Double straight 6');

// Airplane: ♠3 ♥3 ♣3 ♠4 ♥4 ♣4
const air = [createCard(0), createCard(13), createCard(26),
             createCard(1), createCard(14), createCard(27)];
assert(detectHandType(air).type === 'airplane', 'Airplane detection');

// Airplane + singles: 333 444 + 5 6
const airSingles = [createCard(0), createCard(13), createCard(26),
                    createCard(1), createCard(14), createCard(27),
                    createCard(2), createCard(16)];
const as = detectHandType(airSingles);
assert(as.type === 'airplane_singles', 'Airplane+Singles detection');

// Airplane + pairs: 333 444 + 55 66
const airPairs = [createCard(0), createCard(13), createCard(26),
                  createCard(1), createCard(14), createCard(27),
                  createCard(2), createCard(15),  // 55
                  createCard(3), createCard(16)];  // 66
const ap = detectHandType(airPairs);
assert(ap.type === 'airplane_pairs', 'Airplane+Pairs detection');

// canBeat tests
const bomb3 = detectHandType([createCard(0), createCard(13), createCard(26), createCard(39)]);
const bomb4 = detectHandType([createCard(1), createCard(14), createCard(27), createCard(40)]);
const rocketH = detectHandType([createCard(52), createCard(53)]);
const single3 = detectHandType([createCard(0)]);
const single4 = detectHandType([createCard(1)]);
const single2 = detectHandType([createCard(12)]); // ♠2

assert(canBeat(bomb4, bomb3) === true, 'Bomb 4 beats bomb 3');
assert(canBeat(bomb3, bomb4) === false, 'Bomb 3 loses to bomb 4');
assert(canBeat(rocketH, bomb4) === true, 'Rocket beats bomb');
assert(canBeat(bomb4, rocketH) === false, 'Bomb loses to rocket');
assert(canBeat(single4, single3) === true, 'Single 4 beats 3');
assert(canBeat(single2, single4) === true, 'Single 2 beats 4');
assert(canBeat(bomb3, single2) === true, 'Bomb beats single');
assert(canBeat(single2, bomb3) === false, 'Single loses to bomb');

// Straight comparison
const straight5_6 = detectHandType([createCard(1), createCard(15), createCard(29), createCard(43), createCard(5)]); // 4-8
const straight3_7 = detectHandType([createCard(0), createCard(14), createCard(28), createCard(42), createCard(4)]); // 3-7
assert(canBeat(straight5_6, straight3_7) === true, 'Straight 4-8 beats 3-7');
assert(canBeat(straight3_7, straight5_6) === false, 'Straight 3-7 loses to 4-8');

// Invalid hands
assert(detectHandType([]) === null, 'Empty hand invalid');
assert(detectHandType([createCard(0), createCard(1)]) === null, '3+4 = invalid');

console.log('\n✓ All ' + 'tests passed!');

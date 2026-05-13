// ============================================================
// cardUtils.js — hand type detection & comparison engine
// ============================================================

/**
 * Group cards by rank value, return Map<rank, Card[]>
 */
function groupByRank(cards) {
  const map = new Map();
  for (const c of cards) {
    if (!map.has(c.rank)) map.set(c.rank, []);
    map.get(c.rank).push(c);
  }
  return map;
}

/**
 * Sort cards by rank descending (then by suit for display)
 */
function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) return b.rank - a.rank;
    const si = SUITS.indexOf(a.suit);
    const sj = SUITS.indexOf(b.suit);
    return si - sj;
  });
}

/**
 * Check if sorted rank array is consecutive (no gaps),
 * and all ranks are <= 14 (no 2 or jokers allowed in straights).
 */
function isConsecutive(ranks) {
  if (ranks.length < 2) return false;
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] > 14) return false; // no 2/jokers in straights
  }
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/**
 * Returns { maxCount, rank } for the highest-count rank group.
 */
function getMostCount(groups) {
  let maxCount = 0, bestRank = 0;
  for (const [rank, cards] of groups) {
    if (cards.length > maxCount || (cards.length === maxCount && rank > bestRank)) {
      maxCount = cards.length;
      bestRank = rank;
    }
  }
  return { maxCount, bestRank };
}

/**
 * Detect hand type for a given array of cards.
 * Returns { type, rank, length } or null if invalid.
 *
 * type  - HandType enum value
 * rank  - primary rank for comparison (highest rank in the main combination)
 * length - card count (used to match same-type hands for straights etc.)
 */
function detectHandType(cards) {
  if (!cards || cards.length === 0) return null;

  const n = cards.length;
  const groups = groupByRank(cards);
  const counts = [...groups.values()].map(g => g.length);
  const ranks = [...groups.keys()].sort((a, b) => a - b);

  // ── Single ──
  if (n === 1) {
    return { type: HandType.SINGLE, rank: cards[0].rank, length: 1 };
  }

  // ── Rocket (双王) ──
  if (n === 2 && cards.every(c => c.isJoker)) {
    return { type: HandType.ROCKET, rank: 17, length: 2 };
  }

  // ── Pair ──
  if (n === 2 && groups.size === 1) {
    return { type: HandType.PAIR, rank: ranks[0], length: 2 };
  }

  // ── Three ──
  if (n === 3 && groups.size === 1) {
    return { type: HandType.THREE, rank: ranks[0], length: 3 };
  }

  // ── Bomb (4 cards same rank) ──
  if (n === 4 && groups.size === 1) {
    return { type: HandType.BOMB, rank: ranks[0], length: 4 };
  }

  // ── Three + One ──
  if (n === 4 && counts.some(c => c === 3)) {
    const trioRank = [...groups.entries()].find(([, g]) => g.length === 3)[0];
    return { type: HandType.THREE_ONE, rank: trioRank, length: 4 };
  }

  // ── Three + Pair ──
  if (n === 5 && counts.some(c => c === 3) && counts.some(c => c === 2)) {
    const trioRank = [...groups.entries()].find(([, g]) => g.length === 3)[0];
    return { type: HandType.THREE_TWO, rank: trioRank, length: 5 };
  }

  // ── Straight (5+, all singles, consecutive, max rank <= 14) ──
  if (n >= 5 && counts.every(c => c === 1) && isConsecutive(ranks)) {
    return { type: HandType.STRAIGHT, rank: Math.max(...ranks), length: n };
  }

  // ── Double Straight (6+, even, all pairs, consecutive, >= 3 pairs) ──
  if (n >= 6 && n % 2 === 0 && counts.every(c => c === 2)) {
    if (ranks.length >= 3 && isConsecutive(ranks)) {
      return { type: HandType.DOUBLE_STRAIGHT, rank: Math.max(...ranks), length: n };
    }
  }

  // ── Airplane variants (6+) ──
  if (n >= 6) {
    // Find all ranks with at least 3 cards
    const trioRanks = [...groups.entries()]
      .filter(([, g]) => g.length >= 3)
      .map(([r]) => r)
      .sort((a, b) => a - b);

    // Find consecutive runs of triples (length >= 2)
    const runs = [];
    let run = [];
    for (let i = 0; i < trioRanks.length; i++) {
      if (run.length === 0 || trioRanks[i] === run[run.length - 1] + 1) {
        run.push(trioRanks[i]);
      } else {
        if (run.length >= 2) runs.push([...run]);
        run = [trioRanks[i]];
      }
    }
    if (run.length >= 2) runs.push([...run]);

    // Try each run (longest first) to see if remaining cards are valid
    runs.sort((a, b) => b.length - a.length);

    for (const runRanks of runs) {
      const k = runRanks.length; // number of triples
      const trioCardCount = k * 3;
      const remaining = n - trioCardCount;

      // For each trio, take exactly 3 cards; if a rank has > 3, extras go to remaining
      // (this handles quad-bombs being used in airplane—uncommon but possible)
      // Actually, standard rules: you can't use a 4-card group as a trio in airplane.
      // The group must be exactly 3 cards. If there are 4, you can use 3 but the 4th is a separate card.
      // Let's check if this is valid:
      const includedRanks = new Set(runRanks);
      let remCount = 0;
      let remAllPairs = true;
      for (const [rank, g] of groups) {
        if (includedRanks.has(rank)) {
          // 3 cards used as trio, extra cards become remaining
          remCount += g.length - 3;
          if (g.length - 3 === 1) remAllPairs = false;
        } else {
          remCount += g.length;
          if (g.length % 2 !== 0) remAllPairs = false;
        }
      }

      if (remCount === 0) {
        return { type: HandType.AIRPLANE, rank: Math.max(...runRanks), length: n };
      }
      if (remCount === k) {
        return { type: HandType.AIRPLANE_SINGLES, rank: Math.max(...runRanks), length: n };
      }
      if (remCount === k * 2 && remAllPairs) {
        return { type: HandType.AIRPLANE_PAIRS, rank: Math.max(...runRanks), length: n };
      }
    }
  }

  return null;
}

/**
 * Check if hand1 can beat hand2.
 * hand1, hand2: { type, rank, length } (output of detectHandType)
 */
function canBeat(hand1, hand2) {
  if (!hand2) return true; // free play

  // Rocket beats everything
  if (hand1.type === HandType.ROCKET) return true;
  if (hand2.type === HandType.ROCKET) return false;

  // Bomb beats non-bomb
  if (hand1.type === HandType.BOMB && hand2.type !== HandType.BOMB) return true;
  if (hand2.type === HandType.BOMB && hand1.type !== HandType.BOMB) return false;

  // Bomb vs Bomb: higher rank
  if (hand1.type === HandType.BOMB && hand2.type === HandType.BOMB) {
    return hand1.rank > hand2.rank;
  }

  // Same type: must have same length and higher rank
  if (hand1.type === hand2.type && hand1.length === hand2.length) {
    return hand1.rank > hand2.rank;
  }

  return false;
}

/**
 * Validate that the player actually holds the cards they're trying to play.
 */
function validatePlayerCards(player, cards) {
  const playerRanks = groupByRank(player.cards);
  const playRanks = groupByRank(cards);
  for (const [rank, needed] of playRanks) {
    if (!playerRanks.has(rank) || playerRanks.get(rank).length < needed.length) {
      return false;
    }
  }
  return true;
}

/**
 * Get description string for a play.
 */
function playDescription(play) {
  if (!play) return '不出';
  if (play.type === HandType.ROCKET) return '火箭';
  if (play.type === HandType.BOMB) return `炸弹(${getRankName(play.rank)})`;
  return `${HAND_TYPE_DISPLAY[play.type]} ${getRankName(play.rank)}`;
}

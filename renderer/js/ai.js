// ============================================================
// ai.js — AI decision making (bidding & playing)
// ============================================================

// ── Hand quality evaluation for bidding ────────────────────

function evaluateHandStrength(cards) {
  let score = 15; // base
  const groups = groupByRank(cards);

  // Count key cards
  let jokerCount = 0;
  let twoCount = 0;
  let aceCount = 0;
  let kingCount = 0;
  let bombCount = 0;

  for (const [rank, g] of groups) {
    const count = g.length;
    if (rank === 16 || rank === 17) jokerCount += count;
    if (rank === 15) twoCount += count;
    if (rank === 14) aceCount += count;
    if (rank === 13) kingCount += count;
    if (count === 4) bombCount++;
  }

  score += jokerCount * 6;
  score += twoCount * 3;
  score += aceCount * 2;
  score += kingCount * 1;
  score += bombCount * 7;

  // Rocket bonus
  if (jokerCount >= 2) score += 5;

  // Check for potential straights / airplanes
  const ranks = [...groups.keys()].sort((a, b) => a - b);
  let consecutiveSingles = 0;
  let consecutivePairs = 0;
  for (let i = 0; i < ranks.length - 1; i++) {
    if (ranks[i] <= 14 && ranks[i + 1] === ranks[i] + 1 && groups.get(ranks[i]).length >= 1 && groups.get(ranks[i + 1]).length >= 1) {
      consecutiveSingles++;
    }
    if (ranks[i] <= 14 && ranks[i + 1] === ranks[i] + 1 && groups.get(ranks[i]).length >= 2 && groups.get(ranks[i + 1]).length >= 2) {
      consecutivePairs++;
    }
  }
  if (consecutiveSingles >= 4) score += 4;  // potential straight
  if (consecutivePairs >= 3) score += 3;    // potential double straight

  return score;
}

/**
 * AI bidding decision.
 * @returns {number} 0 = pass, 1/2/3 = bid points
 */
function aiChooseBid(cards, difficulty, currentBid) {
  const strength = evaluateHandStrength(cards);

  const thresholds = {
    [Difficulty.EASY]:   { pass: 22, bid1: 28, bid2: 35, bid3: 40 },
    [Difficulty.MEDIUM]: { pass: 25, bid1: 32, bid2: 38, bid3: 43 },
    [Difficulty.HARD]:   { pass: 20, bid1: 26, bid2: 32, bid3: 38 }
  };

  const t = thresholds[difficulty];

  let maxBid = 0;
  if (strength >= t.bid3) maxBid = 3;
  else if (strength >= t.bid2) maxBid = 2;
  else if (strength >= t.bid1) maxBid = 1;
  else if (strength >= t.pass) maxBid = 1;
  else maxBid = 0;

  // Must beat current bid
  if (maxBid <= currentBid) return 0;
  return maxBid;
}

// ── Find all plays that beat a given play ──────────────────

/**
 * Find all ways to beat `lastPlay` using `cards`.
 * Returns array of { cards: Card[], type, rank, length }.
 */
function findBeatingPlays(cards, lastPlay) {
  const results = [];
  const groups = groupByRank(cards);
  const sortedRanks = [...groups.keys()].sort((a, b) => a - b);

  // Helper: find a card of any rank for use as kicker (excludes given ranks)
  function findKicker(excludeRanks = new Set()) {
    for (const r of sortedRanks) {
      if (!excludeRanks.has(r)) return groups.get(r)[0];
    }
    return null;
  }

  // Any bomb beats a non-bomb; only bomb-vs-bomb compares rank.
  for (const [rank, g] of groups) {
    if (g.length === 4 && lastPlay.type !== HandType.ROCKET && (lastPlay.type !== HandType.BOMB || rank > lastPlay.rank)) {
      results.push({ cards: [...g], type: HandType.BOMB, rank, length: 4 });
    }
  }

  // Rocket always beats everything except higher rocket (impossible)
  if (cards.some(c => c.rank === 16) && cards.some(c => c.rank === 17) && lastPlay.type !== HandType.ROCKET) {
    const rocket = cards.filter(c => c.rank >= 16);
    results.push({ cards: rocket, type: HandType.ROCKET, rank: 17, length: 2 });
  }

  const targetRank = lastPlay.rank;
  const targetType = lastPlay.type;
  const targetLen  = lastPlay.length;

  switch (targetType) {
    case HandType.SINGLE:
      for (const [rank, g] of groups) {
        if (rank > targetRank && g.length >= 1) {
          results.push({ cards: [g[0]], type: HandType.SINGLE, rank, length: 1 });
        }
      }
      break;

    case HandType.PAIR:
      for (const [rank, g] of groups) {
        if (rank > targetRank && g.length >= 2) {
          results.push({ cards: g.slice(0, 2), type: HandType.PAIR, rank, length: 2 });
        }
      }
      break;

    case HandType.THREE:
      for (const [rank, g] of groups) {
        if (rank > targetRank && g.length >= 3) {
          results.push({ cards: g.slice(0, 3), type: HandType.THREE, rank, length: 3 });
        }
      }
      break;

    case HandType.THREE_ONE:
      for (const [rank, g] of groups) {
        if (rank > targetRank && g.length >= 3) {
          const trio = g.slice(0, 3);
          const kicker = findKicker(new Set([rank]));
          if (kicker) {
            results.push({ cards: [...trio, kicker], type: HandType.THREE_ONE, rank, length: 4 });
          }
        }
      }
      break;

    case HandType.THREE_TWO:
      for (const [rank, g] of groups) {
        if (rank > targetRank && g.length >= 3) {
          const trio = g.slice(0, 3);
          // Find a pair from other ranks
          for (const [r2, g2] of groups) {
            if (r2 !== rank && g2.length >= 2) {
              results.push({ cards: [...trio, ...g2.slice(0, 2)], type: HandType.THREE_TWO, rank, length: 5 });
              break; // Just one option per trio
            }
          }
        }
      }
      break;

    case HandType.STRAIGHT: {
      const straightLen = targetLen;
      // Find all possible straights of this length with rank > targetRank
      for (let startRank = 3; startRank <= 15 - straightLen; startRank++) {
        const straightRanks = [];
        let allExist = true;
        for (let r = startRank; r < startRank + straightLen; r++) {
          if (r > 14 || !groups.has(r)) { allExist = false; break; }
          straightRanks.push(r);
        }
        if (!allExist) continue;
        const straightRank = straightRanks[straightRanks.length - 1];
        if (straightRank <= targetRank) continue;
        const cards = straightRanks.map(r => groups.get(r)[0]);
        results.push({ cards, type: HandType.STRAIGHT, rank: straightRank, length: straightLen });
      }
      break;
    }

    case HandType.DOUBLE_STRAIGHT: {
      const pairCount = targetLen / 2;
      for (let startRank = 3; startRank <= 15 - pairCount; startRank++) {
        let allExist = true;
        const ranks = [];
        for (let r = startRank; r < startRank + pairCount; r++) {
          if (r > 14 || !groups.has(r) || groups.get(r).length < 2) { allExist = false; break; }
          ranks.push(r);
        }
        if (!allExist) continue;
        const topRank = ranks[ranks.length - 1];
        if (topRank <= targetRank) continue;
        const cardPairs = ranks.flatMap(r => groups.get(r).slice(0, 2));
        results.push({ cards: cardPairs, type: HandType.DOUBLE_STRAIGHT, rank: topRank, length: targetLen });
      }
      break;
    }

    case HandType.AIRPLANE:
    case HandType.AIRPLANE_SINGLES:
    case HandType.AIRPLANE_PAIRS: {
      // Determine number of triples from the last play's length info
      // For AIRPLANE: length = trioCount * 3
      // For AIRPLANE_SINGLES: length = trioCount * 4 (3 per trio + 1 per kicker)
      // For AIRPLANE_PAIRS: length = trioCount * 5 (3 per trio + 2 per kicker)
      let trioCount;
      if (targetType === HandType.AIRPLANE) {
        trioCount = targetLen / 3;
      } else if (targetType === HandType.AIRPLANE_SINGLES) {
        trioCount = targetLen / 4;
      } else {
        trioCount = targetLen / 5;
      }

      // Find consecutive triples with higher top rank
      const trioRanks = sortedRanks.filter(r => r <= 14 && groups.get(r).length >= 3);
      for (let i = 0; i <= trioRanks.length - trioCount; i++) {
        const run = trioRanks.slice(i, i + trioCount);
        if (!isConsecutive(run)) continue;
        const topRank = run[run.length - 1];
        if (topRank <= targetRank) continue;

        const trioCards = run.flatMap(r => groups.get(r).slice(0, 3));
        const usedRanks = new Set(run);

        if (targetType === HandType.AIRPLANE) {
          results.push({ cards: trioCards, type: HandType.AIRPLANE, rank: topRank, length: targetLen });
        } else {
          // Need kickers
          const remaining = sortedRanks.filter(r => !usedRanks.has(r));
          if (targetType === HandType.AIRPLANE_SINGLES) {
            const needed = trioCount;
            const kickers = [];
            for (const r of remaining) {
              if (kickers.length >= needed) break;
              kickers.push(groups.get(r)[0]);
            }
            if (kickers.length === needed) {
              results.push({ cards: [...trioCards, ...kickers], type: HandType.AIRPLANE_SINGLES, rank: topRank, length: targetLen });
            }
          } else { // AIRPLANE_PAIRS
            const needed = trioCount;
            const kickers = [];
            for (const r of remaining) {
              if (kickers.length >= needed) break;
              if (groups.get(r).length >= 2) {
                kickers.push(...groups.get(r).slice(0, 2));
              }
            }
            if (kickers.length === needed * 2) {
              results.push({ cards: [...trioCards, ...kickers], type: HandType.AIRPLANE_PAIRS, rank: topRank, length: targetLen });
            }
          }
        }
      }
      break;
    }
  }

  return results;
}

// ── Find all valid leading plays ───────────────────────────

/**
 * Find all valid plays when leading (no last play to beat).
 */
function findAllValidPlays(cards) {
  const results = [];
  const groups = groupByRank(cards);
  const sortedRanks = [...groups.keys()].sort((a, b) => a - b);

  // Singles
  for (const c of cards) {
    results.push({ cards: [c], type: HandType.SINGLE, rank: c.rank, length: 1 });
  }

  // Pairs
  for (const [rank, g] of groups) {
    if (g.length >= 2) {
      results.push({ cards: g.slice(0, 2), type: HandType.PAIR, rank, length: 2 });
    }
  }

  // Triples / Three+One / Three+Two
  for (const [rank, g] of groups) {
    if (g.length >= 3) {
      results.push({ cards: g.slice(0, 3), type: HandType.THREE, rank, length: 3 });

      // Three + One
      const otherRanks = sortedRanks.filter(r => r !== rank);
      if (otherRanks.length > 0 || g.length > 3) {
        let kicker;
        if (g.length > 3) kicker = g[3];
        else kicker = groups.get(otherRanks[0])[0];
        results.push({ cards: [g[0], g[1], g[2], kicker], type: HandType.THREE_ONE, rank, length: 4 });
      }

      // Three + Two
      for (const [r2, g2] of groups) {
        if (r2 !== rank && g2.length >= 2) {
          results.push({ cards: [g[0], g[1], g[2], g2[0], g2[1]], type: HandType.THREE_TWO, rank, length: 5 });
          break;
        }
      }
    }
  }

  // Bombs
  for (const [rank, g] of groups) {
    if (g.length === 4) {
      results.push({ cards: [...g], type: HandType.BOMB, rank, length: 4 });
    }
  }

  // Rocket
  if (cards.some(c => c.rank === 16) && cards.some(c => c.rank === 17)) {
    results.push({
      cards: cards.filter(c => c.isJoker),
      type: HandType.ROCKET,
      rank: 17,
      length: 2
    });
  }

  // Straights (5+)
  for (let len = 5; len <= 12; len++) {
    for (let start = 3; start <= 15 - len; start++) {
      let ok = true;
      for (let r = start; r < start + len; r++) {
        if (r > 14 || !groups.has(r)) { ok = false; break; }
      }
      if (!ok) continue;
      const straightCards = [];
      for (let r = start; r < start + len; r++) {
        straightCards.push(groups.get(r)[0]);
      }
      results.push({
        cards: straightCards,
        type: HandType.STRAIGHT,
        rank: start + len - 1,
        length: len
      });
    }
  }

  // Double Straights (3+ pairs)
  for (let pairCount = 3; pairCount <= 10; pairCount++) {
    for (let start = 3; start <= 15 - pairCount; start++) {
      let ok = true;
      for (let r = start; r < start + pairCount; r++) {
        if (r > 14 || !groups.has(r) || groups.get(r).length < 2) { ok = false; break; }
      }
      if (!ok) continue;
      const pairs = [];
      for (let r = start; r < start + pairCount; r++) {
        pairs.push(...groups.get(r).slice(0, 2));
      }
      results.push({
        cards: pairs,
        type: HandType.DOUBLE_STRAIGHT,
        rank: start + pairCount - 1,
        length: pairCount * 2
      });
    }
  }

  // Airplanes (2+ consecutive triples)
  const trioRanks = sortedRanks.filter(r => r <= 14 && groups.get(r).length >= 3);
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

  for (const runRanks of runs) {
    const k = runRanks.length;
    const trioCards = runRanks.flatMap(r => groups.get(r).slice(0, 3));
    const topRank = runRanks[runRanks.length - 1];

    // Just airplane (no kickers)
    results.push({ cards: trioCards, type: HandType.AIRPLANE, rank: topRank, length: k * 3 });

    // Airplane + Singles
    const otherRanks = sortedRanks.filter(r => !runRanks.includes(r));
    const singles = [];
    for (const r of otherRanks) {
      if (singles.length >= k) break;
      singles.push(groups.get(r)[0]);
    }
    if (singles.length === k) {
      results.push({ cards: [...trioCards, ...singles], type: HandType.AIRPLANE_SINGLES, rank: topRank, length: k * 4 });
    }

    // Airplane + Pairs
    const pairKickers = [];
    for (const r of otherRanks) {
      if (pairKickers.length >= k * 2) break;
      if (groups.get(r).length >= 2) {
        pairKickers.push(...groups.get(r).slice(0, 2));
      }
    }
    if (pairKickers.length === k * 2) {
      results.push({ cards: [...trioCards, ...pairKickers], type: HandType.AIRPLANE_PAIRS, rank: topRank, length: k * 5 });
    }
  }

  return results;
}

// ── Main AI play selection ──────────────────────────────────

/**
 * Score a play option (higher = better).
 * Used for ranking candidate plays.
 */
function scorePlay(play, handSizeAfter, difficulty, context) {
  let score = 0;

  // Prefer playing more cards at once (reduces hand faster)
  score += play.cards.length * 2;

  // Prefer lower rank (save big cards for later)
  score -= play.rank * 0.5;

  // In MEDIUM+, prefer multi-card plays
  if (difficulty >= Difficulty.MEDIUM) {
    if (play.type === HandType.STRAIGHT || play.type === HandType.AIRPLANE_SINGLES) score += 8;
    if (play.type === HandType.DOUBLE_STRAIGHT) score += 6;
    if (play.type === HandType.THREE_ONE || play.type === HandType.THREE_TWO) score += 5;
    if (play.type === HandType.THREE) score += 2;
  }

  // Avoid playing bombs unless necessary
  if (play.type === HandType.BOMB) score -= 20;
  if (play.type === HandType.ROCKET) score -= 30;

  // If about to win, prefer it heavily
  if (handSizeAfter === 0) score += 1000;

  // If opponent is close to winning and we can stop them
  const opponents = context.handCounts.filter((_, i) => i !== context.playerIndex);
  if (opponents.some(c => c <= 2) && handSizeAfter > 0) {
    if (play.type === HandType.BOMB || play.type === HandType.ROCKET) score += 50;
    score += 10;
  }

  return score;
}

/**
 * Main AI play decision.
 * @param {Card[]} hand - AI's current hand
 * @param {Object|null} lastPlay - { type, rank, length } or null for free play
 * @param {Object} context - { difficulty, handCounts:[3], playerIndex, isLandlord, roundPassCount }
 * @returns {Object|null} play { cards, type, rank, length } or null to pass
 */
function aiChoosePlay(hand, lastPlay, context) {
  const difficulty = context.difficulty;

  // Determine candidate plays
  let candidates;
  if (!lastPlay) {
    candidates = findAllValidPlays(hand);
  } else {
    candidates = findBeatingPlays(hand, lastPlay);
  }

  if (candidates.length === 0) return null;

  // Score and sort candidates
  const scored = candidates.map(play => ({
    ...play,
    score: scorePlay(play, hand.length - play.cards.length, difficulty, context)
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // EASY: sometimes pass even when can play (20% chance)
  if (difficulty === Difficulty.EASY && lastPlay && Math.random() < 0.2) {
    return null;
  }

  // MEDIUM: if it's a bomb and hand is still large, maybe save it
  if (difficulty === Difficulty.MEDIUM && lastPlay) {
    const best = scored[0];
    if ((best.type === HandType.BOMB || best.type === HandType.ROCKET) && hand.length > 8) {
      // Check if there's a non-bomb option
      const nonBomb = scored.find(s => s.type !== HandType.BOMB && s.type !== HandType.ROCKET);
      if (nonBomb) return nonBomb;
      if (Math.random() < 0.5) return null;
    }
  }

  // HARD: additional strategic decisions
  if (difficulty === Difficulty.HARD && lastPlay) {
    // If we're a farmer and the last play was by our farmer teammate, consider passing
    if (!context.isLandlord) {
      const lastPlayer = context.lastPlayPlayerIndex;
      if (lastPlayer !== undefined && lastPlayer !== context.playerIndex && lastPlayer !== context.landlordIndex) {
        if (Math.random() < 0.6) return null; // Let teammate lead
      }
    }

    // If opponent has few cards, use strongest available play
    const opponents = context.handCounts.filter((_, i) => i !== context.playerIndex);
    const minOpponent = Math.min(...opponents);
    if (minOpponent <= 3) {
      const bomb = scored.find(s => s.type === HandType.BOMB || s.type === HandType.ROCKET);
      if (bomb && bomb !== scored[0]) return bomb;
    }
  }

  return scored[0] || null;
}

// ============================================================
// deck.js — deck creation, shuffle, dealing
// ============================================================

/**
 * Create a standard 54-card deck (52 + 2 jokers).
 * Cards are returned sorted by id.
 */
function createDeck() {
  const deck = [];
  for (let i = 0; i < 54; i++) {
    deck.push(createCard(i));
  }
  return deck;
}

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

/**
 * Deal cards: 17 to each of 3 players, 3 left as landlord cards.
 * Returns { hands: [[17 cards], [17 cards], [17 cards]], landlordCards: [3 cards] }
 */
function dealCards(deck) {
  const shuffled = [...deck];
  shuffleDeck(shuffled);

  return {
    hands: [
      shuffled.slice(0, 17),
      shuffled.slice(17, 34),
      shuffled.slice(34, 51)
    ],
    landlordCards: shuffled.slice(51, 54)
  };
}

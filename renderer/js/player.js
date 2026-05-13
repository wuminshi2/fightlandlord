// ============================================================
// player.js — Player class (hand management, state)
// ============================================================

class Player {
  /**
   * @param {number} id   - 0 (human), 1 (AI left), 2 (AI right)
   * @param {string} name - display name
   * @param {string} type - PlayerType.HUMAN or PlayerType.AI
   */
  constructor(id, name, type) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.cards = [];
    this.isLandlord = false;
    this.bidPoints = 0;   // 0 = passed, 1/2/3 = bid amount
    this.score = 0;
  }

  /** Add cards and sort hand */
  addCards(cards) {
    this.cards.push(...cards);
    this.sortHand();
  }

  /** Remove specific cards from hand */
  removeCards(cards) {
    const removeIds = new Set(cards.map(c => c.id));
    const before = this.cards.length;
    this.cards = this.cards.filter(c => !removeIds.has(c.id));
    return before - this.cards.length === cards.length;
  }

  /** Sort by rank descending */
  sortHand() {
    this.cards = sortCards(this.cards);
  }

  /** Number of cards left */
  get cardCount() {
    return this.cards.length;
  }

  /** Reset for new game */
  reset() {
    this.cards = [];
    this.isLandlord = false;
    this.bidPoints = 0;
  }
}

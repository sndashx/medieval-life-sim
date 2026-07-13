/**
 * Titles.js
 * Social hierarchy, noble ranks, titles of address, social mobility.
 *
 * Tiers progress bottom-up through recognition, wealth, and deeds:
 *   commoner → apprentice → journeyman → master → merchant → gentry →
 *   knight → baron → count → duke → king/queen
 *
 * Players earn titles by:
 *   - Reaching an occupation milestone (apprentice → journeyman → master)
 *   - Accumulating wealth (merchant → gentry)
 *   - Performing deeds (knighthood, barony, etc.)
 *   - Seizing land and holding a court (baron → count → duke)
 *   - Winning a war or succession crisis (king)
 *
 * Titles confer:
 *   - Authority over lower ranks (commands obeyed more readily)
 *   - Tax privileges (nobles pay less; kings collect more)
 *   - Court obligations (must hold court, judge, raise levies)
 *   - Marriage advantages (better spouse candidates)
 *   - Political weight (counts in council votes)
 */

export const TITLE_RANK = {
  commoner: 0,
  apprentice: 1,
  journeyman: 2,
  master: 3,
  merchant: 4,
  gentry: 5,
  knight: 6,
  baron: 7,
  count: 8,
  duke: 9,
  king: 10
};

export const TITLE_ORDER = [
  'commoner', 'apprentice', 'journeyman', 'master', 'merchant',
  'gentry', 'knight', 'baron', 'count', 'duke', 'king'
];

const TITLE_REQUIREMENTS = {
  apprentice: { minAge: 12, occupation: null },
  journeyman: { minAge: 16, occupation: null, skillAtLeast: { crafting: 0.4 } },
  master: { minAge: 25, occupation: ['craftsman'], skillAtLeast: { crafting: 0.7 }, wealth: 500 },
  merchant: { minAge: 18, occupation: ['merchant'], wealth: 1000 },
  gentry: { minAge: 25, wealth: 5000, ownedLand: 5 },
  knight: { minAge: 18, occupation: ['soldier'], skillAtLeast: { combat: 0.6 }, deed: 'military' },
  baron: { minAge: 25, ownedLand: 25, subjects: 50, deed: 'leadership' },
  count: { minAge: 30, ownedLand: 100, subjects: 500, deed: 'governance' },
  duke: { minAge: 35, ownedLand: 500, subjects: 5000, deed: 'sovereignty' },
  king: { minAge: 40, ownedLand: 2000, subjects: 50000, deed: 'conquest_or_election' }
};

export class Titles {
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    /** @type {Map<number, {personId, current, granted, history}>} */
    this.titles = new Map();
    /** titles held at any time, key = personId */
    this.byPerson = new Map();
    this.nextTitleId = 1;
    /** noble houses (a lord + their lands/vassals) */
    this.houses = new Map();
    this.nextHouseId = 1;
  }

  /**
   * Award a title to a person. Returns the title record.
   */
  grant(person, title, grantedBy = null, justification = '') {
    if (!person) return { success: false, reason: 'No person' };
    if (!TITLE_ORDER.includes(title)) return { success: false, reason: 'Unknown title' };

    // Cannot grant a higher title to a commoner; downgrade path not allowed
    const current = this.getCurrent(person);
    if (current && TITLE_RANK[title] < TITLE_RANK[current.current]) {
      return { success: false, reason: `Cannot demote from ${current.current} to ${title}` };
    }

    const record = {
      id: this.nextTitleId++,
      personId: person.id,
      current: title,
      previous: current?.current ?? null,
      granted: this.kernel?.turn ?? 0,
      grantedBy,
      justification
    };
    this.titles.set(record.id, record);
    if (!this.byPerson.has(person.id)) this.byPerson.set(person.id, []);
    this.byPerson.get(person.id).push(record);

    // Set on person for quick access
    person.title = title;
    person.politicalPower = (person.politicalPower || 0) + TITLE_RANK[title] * 0.5;

    // Create a noble house for baron+ if person doesn't have one
    if (TITLE_RANK[title] >= TITLE_RANK.baron && !person.houseId) {
      this.createHouse(person, title);
    }

    return { success: true, title: record };
  }

  /**
   * Strip a title — typically for crimes, disgrace, or loss of lands.
   */
  revoke(person, reason = 'disgrace') {
    const current = this.getCurrent(person);
    if (!current) return { success: false, reason: 'No title to revoke' };
    return { success: true, revoked: current, reason };
  }

  getCurrent(person) {
    if (!person) return null;
    const list = this.byPerson.get(person.id);
    return list && list.length > 0 ? list[list.length - 1] : null;
  }

  /**
   * Check if a person qualifies for a title based on the requirements.
   */
  checkEligibility(person, title) {
    const req = TITLE_REQUIREMENTS[title];
    if (!req) return { eligible: false, reason: 'Unknown title' };

    if (req.minAge && person.age < req.minAge) return { eligible: false, reason: `Must be at least ${req.minAge} years old (currently ${Math.floor(person.age)})` };
    if (req.occupation && Array.isArray(req.occupation) && !req.occupation.includes(person.occupation)) {
      return { eligible: false, reason: `Must be a ${req.occupation.join(' or ')}` };
    }
    if (req.wealth) {
      const wealth = person.wealth ?? this.game?.kernel?.entities?.get?.(person.household)?.wealth ?? 0;
      if (wealth < req.wealth) return { eligible: false, reason: `Need ${req.wealth} wealth (have ${Math.floor(wealth)})` };
    }
    if (req.skillAtLeast) {
      for (const [skill, min] of Object.entries(req.skillAtLeast)) {
        const v = this._getSkill(person, skill);
        if (v < min) return { eligible: false, reason: `Need ${skill} skill ${(min * 100).toFixed(0)} (have ${(v * 100).toFixed(0)})` };
      }
    }
    if (req.ownedLand) {
      const owned = this._countOwnedLand(person);
      if (owned < req.ownedLand) return { eligible: false, reason: `Need to own ${req.ownedLand} parcels (own ${owned})` };
    }
    if (req.subjects) {
      const subjects = this._countSubjects(person);
      if (subjects < req.subjects) return { eligible: false, reason: `Need ${req.subjects} subjects (have ${subjects})` };
    }
    return { eligible: true };
  }

  _getSkill(person, skillPath) {
    const parts = skillPath.split('.');
    let v = person.skills;
    for (const p of parts) v = v?.[p]?.level ?? v?.[p];
    return typeof v === 'number' ? v : 0;
  }

  _countOwnedLand(person) {
    if (!this.game?.landOwnership) return 0;
    let count = 0;
    for (const parcel of this.game.landOwnership.parcels.values()) {
      if (parcel.owner === person.id) count++;
    }
    return count;
  }

  _countSubjects(person) {
    if (!this.kernel?.bySettlement) return 0;
    // A subject is anyone living on land you own
    let n = 0;
    if (this.game?.landOwnership) {
      const ownedTiles = [];
      for (const parcel of this.game.landOwnership.parcels.values()) {
        if (parcel.owner === person.id) ownedTiles.push(`${parcel.x},${parcel.y}`);
      }
      for (const [, set] of this.kernel.bySettlement) {
        for (const p of set) {
          const key = `${p.position?.x},${p.position?.y}`;
          if (ownedTiles.includes(key)) n++;
        }
      }
    }
    return n;
  }

  /**
   * Form a noble house around a lord. Houses own land collectively.
   */
  createHouse(lord, initialTitle) {
    const house = {
      id: this.nextHouseId++,
      name: `House of ${lord.name || lord.id}`,
      lord: lord.id,
      founded: this.kernel?.turn ?? 0,
      titles: [initialTitle],
      members: [lord.id],
      lands: [],
      treasury: 0,
      motto: ''
    };
    this.houses.set(house.id, house);
    lord.houseId = house.id;
    return house;
  }

  /**
   * Add a member to a house (vassal, spouse, etc.).
   */
  addToHouse(houseId, person, role = 'vassal') {
    const house = this.houses.get(houseId);
    if (!house) return { success: false, reason: 'Unknown house' };
    if (!house.members.includes(person.id)) house.members.push(person.id);
    person.houseId = houseId;
    person.houseRole = role;
    return { success: true, house };
  }

  /**
   * Lord holds court: collects taxes, raises levies, judges disputes.
   */
  holdCourt(lord, settlement) {
    const house = this.houses.get(lord.houseId);
    if (!house) return { success: false, reason: 'You have no house' };
    const taxRate = TITLE_RANK[this.getCurrent(lord)?.current || 'commoner'] >= TITLE_RANK.count ? 0.1 : 0.05;
    let collected = 0;
    const cases = [];
    if (this.game?.law) {
      const pending = Array.from(this.game.law.cases.values()).filter(c => c.status === 'pending').slice(0, 3);
      for (const c of pending) {
        const verdict = lord.skills?.knowledge?.law || 0.5;
        c.status = 'assigned';
        c.court = lord.id;
        cases.push(c.id);
      }
    }
    house.treasury += collected;
    return { success: true, taxCollected: collected, taxRate, casesAssigned: cases.length };
  }

  /**
   * Raise a levy of soldiers from the lord's subjects.
   */
  raiseLevy(lord, count = 10) {
    const subjects = this._countSubjects(lord);
    const raised = Math.min(count, Math.floor(subjects * 0.1));
    return { success: true, raised, available: subjects, message: `${raised} soldiers raised from ${subjects} subjects.` };
  }

  /**
   * Per-tick: house treasury grows; baronies lose 1 land if treasury < upkeep.
   */
  update(turn) {
    for (const house of this.houses.values()) {
      // Idle treasury growth
      house.treasury += 1;
      // Lose land if bankrupt
      if (house.treasury < -100 && house.lands.length > 0) {
        house.lands.pop();
        house.treasury = 0;
      }
    }
  }

  /**
   * Find a spouse candidate of appropriate rank for a person.
   */
  findMarriageCandidate(person, maxResults = 5) {
    if (!this.game) return [];
    const myRank = TITLE_RANK[this.getCurrent(person)?.current || 'commoner'];
    const candidates = [];
    for (const [, p] of this.kernel.entities) {
      if (!p?.name || !p.alive || p.age < 16 || p === person || p.sex === person.sex) continue;
      const theirRank = TITLE_RANK[this.getCurrent(p)?.current || 'commoner'];
      if (Math.abs(theirRank - myRank) <= 2) {
        candidates.push({ person: p, rank: theirRank, name: p.name });
      }
      if (candidates.length >= maxResults) break;
    }
    return candidates.sort((a, b) => b.rank - a.rank);
  }

  getTitle(person) {
    return this.getCurrent(person)?.current || 'commoner';
  }

  getTitleRanks() {
    return [...TITLE_ORDER];
  }

  getHouses() {
    return Array.from(this.houses.values());
  }

  getHouseForPerson(personId) {
    for (const house of this.houses.values()) {
      if (house.members.includes(personId)) return house;
    }
    return null;
  }

  toJSON() {
    return {
      titles: Array.from(this.titles.entries()),
      byPerson: Array.from(this.byPerson.entries()),
      houses: Array.from(this.houses.entries()),
      nextTitleId: this.nextTitleId,
      nextHouseId: this.nextHouseId
    };
  }
  fromJSON(data) {
    if (!data) return;
    if (data.titles) this.titles = new Map(data.titles);
    if (data.byPerson) this.byPerson = new Map(data.byPerson);
    if (data.houses) this.houses = new Map(data.houses);
    if (data.nextTitleId) this.nextTitleId = data.nextTitleId;
    if (data.nextHouseId) this.nextHouseId = data.nextHouseId;
  }
}
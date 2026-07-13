/**
 * Marriage and Family System
 * Handles courtship, proposals, weddings, children, and family relationships
 */

export class MarriageSystem {
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    this.marriages = new Map(); // marriageId -> Marriage
    this.pregnancies = new Map(); // personId -> Pregnancy
    this.proposals = new Map(); // proposalId -> Proposal
    /** adoptionId -> { id, child, parent1, parent2, date, witnesses } */
    this.adoptions = new Map();
    this.nextAdoptionId = 1;
  }

  /**
   * Check if a person can propose to another
   */
  canPropose(proposer, target) {
    // Age requirements
    if (proposer.age < 16 || target.age < 16) {
      return { success: false, reason: 'Both parties must be at least 16 years old' };
    }

    // Already married check
    if (proposer.marriage?.spouse || target.marriage?.spouse) {
      return { success: false, reason: 'One or both parties are already married' };
    }

    // Same person check
    if (proposer.id === target.id) {
      return { success: false, reason: 'Cannot marry yourself' };
    }

    // Kinship check (no close relatives)
    if (this.areCloseRelatives(proposer, target)) {
      return { success: false, reason: 'Cannot marry close relatives' };
    }

    // Relationship affinity check
    const relationship = proposer.relationships?.get(target.id);
    if (!relationship || relationship.affinity < 0.7) {
      return { success: false, reason: 'Relationship affinity must be at least 70%' };
    }

    return { success: true };
  }

  /**
   * Check if two people are close relatives
   */
  areCloseRelatives(person1, person2) {
    // Check if they share parents (siblings)
    if (person1.kinship?.mother === person2.kinship?.mother && person1.kinship?.mother) {
      return true;
    }
    if (person1.kinship?.father === person2.kinship?.father && person1.kinship?.father) {
      return true;
    }

    // Check if one is parent of the other
    if (person1.kinship?.mother === person2.id || person1.kinship?.father === person2.id) {
      return true;
    }
    if (person2.kinship?.mother === person1.id || person2.kinship?.father === person1.id) {
      return true;
    }

    return false;
  }

  /**
   * Create a marriage proposal
   */
  propose(proposer, target) {
    const canPropose = this.canPropose(proposer, target);
    if (!canPropose.success) {
      return canPropose;
    }

    const proposalId = `proposal_${proposer.id}_${target.id}_${this.kernel.turn}`;
    const proposal = {
      id: proposalId,
      proposer: proposer.id,
      target: target.id,
      timestamp: this.kernel.turn,
      status: 'pending'
    };

    this.proposals.set(proposalId, proposal);

    // Calculate acceptance chance based on affinity and other factors
    const relationship = proposer.relationships.get(target.id);
    const baseChance = relationship.affinity;
    
    // Modifiers
    let chance = baseChance;
    
    // Age difference penalty (more than 20 years)
    const ageDiff = Math.abs(proposer.age - target.age);
    if (ageDiff > 20) {
      chance -= 0.2;
    }
    
    // Social status difference
    const statusDiff = this.getStatusDifference(proposer, target);
    if (statusDiff > 2) {
      chance -= 0.15;
    }

    // Wealth consideration
    const proposerHousehold = this.kernel.entities.get(proposer.household);
    if (proposerHousehold && proposerHousehold.wealth < 100) {
      chance -= 0.1;
    }

    // Random factor
    const roll = this.kernel.rng.next();
    const accepted = roll < chance;

    if (accepted) {
      proposal.status = 'accepted';
      return this.marry(proposer, target);
    } else {
      proposal.status = 'rejected';
      // Slight relationship penalty for rejection
      relationship.affinity = Math.max(0, relationship.affinity - 0.1);
      return { 
        success: false, 
        reason: `${target.name} declined the proposal`,
        proposal: proposal
      };
    }
  }

  /**
   * Get social status difference between two people
   */
  getStatusDifference(person1, person2) {
    const statusRank = {
      'noble': 5,
      'merchant': 4,
      'craftsman': 3,
      'peasant': 2,
      'child': 1
    };

    const rank1 = statusRank[person1.occupation] || 2;
    const rank2 = statusRank[person2.occupation] || 2;

    return Math.abs(rank1 - rank2);
  }

  /**
   * Marry two people
   */
  marry(person1, person2) {
    const marriageId = `marriage_${person1.id}_${person2.id}_${this.kernel.turn}`;
    const marriage = {
      id: marriageId,
      spouse1: person1.id,
      spouse2: person2.id,
      marriedDate: this.kernel.turn,
      anniversaries: 0,
      children: []
    };

    this.marriages.set(marriageId, marriage);

    // Update both people
    person1.marriage = {
      spouse: person2.id,
      marriageId: marriageId,
      marriedDate: marriage.marriedDate
    };

    person2.marriage = {
      spouse: person1.id,
      marriageId: marriageId,
      marriedDate: marriage.marriedDate
    };

    // Merge households
    this.mergeHouseholds(person1, person2);

    // Boost relationship affinity
    const rel1 = person1.relationships.get(person2.id);
    const rel2 = person2.relationships.get(person1.id);
    if (rel1) rel1.affinity = Math.min(1, rel1.affinity + 0.2);
    if (rel2) rel2.affinity = Math.min(1, rel2.affinity + 0.2);

    return {
      success: true,
      marriage: marriage,
      message: `${person1.name} and ${person2.name} are now married!`
    };
  }

  /**
   * Merge two households when people marry
   */
  mergeHouseholds(person1, person2) {
    const household1 = this.kernel.entities.get(person1.household);
    const household2 = this.kernel.entities.get(person2.household);

    if (!household1 || !household2) return;

    // Move person2 to person1's household
    household1.addMember(person2.id, 'spouse');
    household2.removeMember(person2.id);

    // Combine resources
    household1.wealth += household2.wealth;
    household1.food += household2.food;

    // Update person2's household reference
    person2.household = household1.id;

    // If household2 is now empty, remove it
    if (household2.members.length === 0) {
      this.kernel.entities.delete(household2.id);
    }
  }

  /**
   * Divorce two people
   */
  divorce(person1, person2) {
    if (!person1.marriage || person1.marriage.spouse !== person2.id) {
      return { success: false, reason: 'Not married to this person' };
    }

    const marriage = this.marriages.get(person1.marriage.marriageId);
    if (!marriage) {
      return { success: false, reason: 'Marriage record not found' };
    }

    // Relationship penalty
    const rel1 = person1.relationships.get(person2.id);
    const rel2 = person2.relationships.get(person1.id);
    if (rel1) rel1.affinity = Math.max(0, rel1.affinity - 0.5);
    if (rel2) rel2.affinity = Math.max(0, rel2.affinity - 0.5);

    // Split household (person2 leaves)
    const household = this.kernel.entities.get(person1.household);
    if (household) {
      household.removeMember(person2.id);
      
      // Create new household for person2
      let newHousehold;
      if (this.game && this.game.createHousehold) {
        newHousehold = this.game.createHousehold(person2.position.x, person2.position.y);
      } else {
        // Fallback: create household entity directly
        const householdTemplate = {
          type: 'household',
          location: { x: person2.position.x, y: person2.position.y }
        };
        newHousehold = this.kernel.createEntity(householdTemplate);
        newHousehold.members = [];
        newHousehold.wealth = 0;
        newHousehold.food = 0;
        newHousehold.addMember = function(personId, role) {
          this.members.push({ id: personId, role: role });
          if (role === 'head') this.head = personId;
        };
        newHousehold.removeMember = function(personId) {
          this.members = this.members.filter(m => m.id !== personId);
        };
      }
      
      newHousehold.addMember(person2.id, 'head');
      person2.household = newHousehold.id;
      
      // Split resources (person2 gets 30%)
      const splitWealth = Math.floor(household.wealth * 0.3);
      const splitFood = Math.floor(household.food * 0.3);
      household.wealth -= splitWealth;
      household.food -= splitFood;
      newHousehold.wealth = splitWealth;
      newHousehold.food = splitFood;
    }

    // Clear marriage data
    delete person1.marriage;
    delete person2.marriage;
    marriage.divorced = true;
    marriage.divorceDate = this.kernel.turn;

    return {
      success: true,
      message: `${person1.name} and ${person2.name} are now divorced`
    };
  }

  /**
   * Check for pregnancy each turn for married couples
   */
  checkPregnancy(person) {
    // Only females can get pregnant
    if (person.sex !== 'female') return;

    // Must be married
    if (!person.marriage) return;

    // Already pregnant
    if (this.pregnancies.has(person.id)) return;

    // Age requirements (16-45)
    if (person.age < 16 || person.age > 45) return;

    // Health requirements
    const health = person.physiology.getHealthStatus();
    if (health.overall < 0.5) return;

    // Base chance per month (about 5-10%)
    const baseChance = 0.08;
    
    // Modifiers
    let chance = baseChance;
    
    // Age modifier (peak fertility 20-35)
    if (person.age >= 20 && person.age <= 35) {
      chance *= 1.2;
    } else if (person.age > 40) {
      chance *= 0.5;
    }

    // Health modifier
    chance *= health.overall;

    // Random check
    if (this.kernel.rng.next() < chance) {
      this.startPregnancy(person);
    }
  }

  /**
   * Start a pregnancy
   *
   * Options:
   *   pregnancyLengthTurns: override the in-game-month duration. Default
   *     is 9 * 30 * 1440 (9 in-game months at 1 min/turn). The T3-6 NPC
   *     reproduction tick passes a shorter value so sims that run a few
   *     thousand turns can actually observe births.
   */
  startPregnancy(mother, options = {}) {
    const spouse = this.kernel.entities.get(mother.marriage.spouse);
    if (!spouse) return;

    const lengthTurns = options.pregnancyLengthTurns ?? (9 * 30 * 1440);

    const pregnancy = {
      mother: mother.id,
      father: spouse.id,
      startDate: this.kernel.turn,
      dueTurn: (this.kernel?.turn ?? 0) + lengthTurns,
      // T3-6: turn-based due date — 9 in-game months = 9 * 30 * 1440 turns.
      // We check this in updatePregnancy when currentTurn is provided so
      // sims that run thousands of turns in <1s of real time still produce
      // births deterministically.
      dueTurn: (this.kernel?.turn ?? 0) + lengthTurns,
      startTurn: this.kernel?.turn ?? 0,
      complications: [],
      health: 1.0
    };

    this.pregnancies.set(mother.id, pregnancy);

    return {
      success: true,
      message: `${mother.name} is pregnant!`,
      pregnancy: pregnancy
    };
  }

  /**
   * Update pregnancy progress. Supports two clock sources:
   *   - pass `currentTime` (ms) → uses wall-clock dueDate
   *   - pass `currentTurn`         → uses pregnancy.dueTurn
   * Marriage.update() forwards kernel.turn, so we use the turn path.
   */
  updatePregnancy(mother, currentTime, currentTurn) {
    const pregnancy = this.pregnancies.get(mother.id);
    if (!pregnancy) return;

    const turnDue = typeof currentTurn === 'number'
      && typeof pregnancy.dueTurn === 'number'
      && currentTurn >= pregnancy.dueTurn;
    const wallDue = typeof currentTime === 'number' && currentTime >= pregnancy.dueDate;

    if (turnDue || wallDue) {
      this.giveBirth(mother);
    } else {
      // Check for complications based on health
      const health = mother.physiology.getHealthStatus(this.kernel);
      if (health.overall < 0.3 && this.kernel.rng.next() < 0.1) {
        pregnancy.complications.push('health_risk');
        pregnancy.health *= 0.9;
      }
    }
  }

  /**
   * Give birth to a child
   */
  giveBirth(mother) {
    const pregnancy = this.pregnancies.get(mother.id);
    if (!pregnancy) return;

    const father = this.kernel.entities.get(pregnancy.father);
    const marriage = this.marriages.get(mother.marriage.marriageId);

    // Determine child's sex
    const childSex = this.kernel.rng.next() < 0.5 ? 'male' : 'female';

    // Generate child name
    const childName = this.generateChildName(childSex, mother, father);

    // Create child entity - use game.createPerson when available for full initialization
    let child;
    if (this.game) {
      child = this.game.createPerson({
        type: 'person',
        name: childName,
        age: 0,
        sex: childSex,
        position: { ...mother.position },
        occupation: 'child',
        genetics: this.inheritGenetics(mother, father)
      }, 'active');
    } else {
      // Fallback to kernel.createEntity (limited initialization)
      const childTemplate = {
        type: 'person',
        name: childName,
        age: 0,
        sex: childSex,
        position: { ...mother.position },
        occupation: 'child',
        genetics: this.inheritGenetics(mother, father)
      };
      child = this.kernel.createEntity(childTemplate);
    }

    // Set kinship
    child.kinship = {
      mother: mother.id,
      father: father.id,
      siblings: []
    };

    // Update parents' kinship
    if (!mother.kinship) mother.kinship = {};
    if (!father.kinship) father.kinship = {};
    
    if (!mother.kinship.children) mother.kinship.children = [];
    if (!father.kinship.children) father.kinship.children = [];
    
    mother.kinship.children.push(child.id);
    father.kinship.children.push(child.id);

    // Add to household
    const household = this.kernel.entities.get(mother.household);
    if (household) {
      household.addMember(child.id, 'child');
      child.household = household.id;
    }

    // Update marriage record
    if (marriage) {
      marriage.children.push(child.id);
    }

    // Update siblings
    if (marriage && marriage.children.length > 1) {
      for (const siblingId of marriage.children) {
        if (siblingId === child.id) continue;
        const sibling = this.kernel.entities.get(siblingId);
        if (sibling && sibling.kinship) {
          if (!sibling.kinship.siblings) sibling.kinship.siblings = [];
          sibling.kinship.siblings.push(child.id);
          child.kinship.siblings.push(siblingId);
        }
      }
    }

    // Remove pregnancy
    this.pregnancies.delete(mother.id);

    // Health impact on mother
    mother.physiology.fatigue = Math.min(1, mother.physiology.fatigue + 0.3);
    mother.needs.satisfy('sleep', -0.5);

    return {
      success: true,
      message: `${mother.name} gave birth to ${childName}!`,
      child: child
    };
  }

  /**
   * Generate a child name based on parents
   */
  generateChildName(sex, mother, father) {
    const r = this.kernel.rng;
    const maleNames = [
      'William', 'John', 'Robert', 'Richard', 'Thomas', 'Henry', 'Edward',
      'Geoffrey', 'Walter', 'Ralph', 'Roger', 'Hugh', 'Peter', 'Simon'
    ];
    const femaleNames = [
      'Alice', 'Emma', 'Margaret', 'Joan', 'Agnes', 'Elizabeth', 'Isabella',
      'Matilda', 'Eleanor', 'Catherine', 'Anne', 'Mary', 'Beatrice', 'Cecily'
    ];
    const names = sex === 'male' ? maleNames : femaleNames;
    return names[r.nextInt(0, names.length - 1)];
  }

  /**
   * Inherit genetic traits from parents
   */
  inheritGenetics(mother, father) {
    const r = this.kernel.rng;
    if (!mother.genetics || !father.genetics) {
      return {
        height: 160 + r.next() * 30,
        baseWeight: 60 + r.next() * 30,
        eyeColor: r.next() < 0.25 ? 'brown' : r.next() < 0.33 ? 'blue' : r.next() < 0.5 ? 'green' : 'hazel',
        hairColor: r.next() < 0.4 ? 'black' : r.next() < 0.5 ? 'brown' : r.next() < 0.5 ? 'blonde' : 'red',
        skinTone: r.next()
      };
    }

    return {
      height: (mother.genetics.height + father.genetics.height) * 0.5 + (r.next() - 0.5) * 10,
      baseWeight: (mother.genetics.baseWeight + father.genetics.baseWeight) * 0.5 + (r.next() - 0.5) * 5,
      eyeColor: r.next() < 0.5 ? mother.genetics.eyeColor : father.genetics.eyeColor,
      hairColor: r.next() < 0.5 ? mother.genetics.hairColor : father.genetics.hairColor,
      skinTone: (mother.genetics.skinTone + father.genetics.skinTone) * 0.5
    };
  }

  /**
   * Get family tree for a person
   */
  getFamilyTree(person) {
    const tree = {
      person: person.id,
      spouse: person.marriage?.spouse || null,
      parents: {
        mother: person.kinship?.mother || null,
        father: person.kinship?.father || null
      },
      children: person.kinship?.children || [],
      siblings: person.kinship?.siblings || []
    };

    return tree;
  }

  /**
   * Update all marriages and pregnancies
   */
  update(currentTime) {
    // Iterate marriages directly instead of scanning every entity — O(M) not O(N)
    for (const [, marriage] of this.marriages) {
      if (marriage.divorced) continue;
      const sp1 = this.kernel.entities.get(marriage.spouse1);
      const sp2 = this.kernel.entities.get(marriage.spouse2);
      if (!sp1 || !sp2) continue;

      // Anniversary
      const yearsSinceMarriage = (currentTime - marriage.marriedDate) / (365 * 24 * 60 * 60 * 1000);
      const anniversaries = Math.floor(yearsSinceMarriage);
      if (anniversaries > marriage.anniversaries) {
        marriage.anniversaries = anniversaries;
        const rel1 = sp1.relationships && sp1.relationships.get(sp2.id);
        const rel2 = sp2.relationships && sp2.relationships.get(sp1.id);
        if (rel1) rel1.affinity = Math.min(1, rel1.affinity + 0.05);
        if (rel2) rel2.affinity = Math.min(1, rel2.affinity + 0.05);
      }

      // Pregnancy check on female spouse
      const female = sp1.sex === 'female' ? sp1 : sp2;
      this.checkPregnancy(female);
    }

    // Update existing pregnancies. Pass the current turn so turn-based
    // pregnancies (T3-6) reach their dueTurn and fire giveBirth.
    const currentTurn = this.kernel.turn;
    for (const [motherId, pregnancy] of this.pregnancies) {
      const mother = this.kernel.entities.get(motherId);
      if (mother) this.updatePregnancy(mother, currentTime, currentTurn);
    }
  }

  toJSON() {
    return {
      marriages: Array.from(this.marriages.entries()),
      proposals: Array.from(this.proposals.entries()),
      pregnancies: Array.from(this.pregnancies.entries()),
      adoptions: Array.from(this.adoptions.entries())
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.marriages) this.marriages = new Map(data.marriages);
    if (data.proposals) this.proposals = new Map(data.proposals);
    if (data.pregnancies) this.pregnancies = new Map(data.pregnancies);
    if (data.adoptions) this.adoptions = new Map(data.adoptions);
  }

  /**
   * Adoption system.
   *
   * Adoptive parent(s) take legal custody of an orphan or child whose
   * biological parents are unavailable. The child inherits the adoptive
   * parents' household and is recorded in the kinship genealogy with
   * adoptive = true.
   */

  /** Find orphans in nearby tiles — children (age < 16) without both parents alive. */
  findOrphansNear(x, y, radius = 10) {
    const ids = this.kernel.queryEntitiesNear ? this.kernel.queryEntitiesNear(x, y, 0, radius) : [];
    const orphans = [];
    for (const id of ids) {
      const person = this.kernel.entities.get(id);
      if (!person || !person.alive) continue;
      if (person.age >= 16) continue;
      const k = this.game?.kinship?.genealogy?.get(id);
      const motherAlive = k?.mother && this.kernel.entities.get(k.mother)?.alive;
      const fatherAlive = k?.father && this.kernel.entities.get(k.father)?.alive;
      if (!motherAlive && !fatherAlive) orphans.push(person);
    }
    return orphans;
  }

  /**
   * Adopt a child. Either a single parent (must be 18+) or a married couple
   * (either partner may initiate; both are recorded as adoptive parents).
   */
  adopt(parent, child, coParent = null) {
    if (!parent || !child) return { success: false, reason: 'Missing parent or child' };
    if (parent.age < 18) return { success: false, reason: 'Adopter must be at least 18 years old' };
    if (child.age >= 16) return { success: false, reason: 'Child is too old to be adopted' };
    if (!child.alive) return { success: false, reason: 'Child is not alive' };

    const childKin = this.game?.kinship?.genealogy?.get(child.id);
    const motherAlive = childKin?.mother && this.kernel.entities.get(childKin.mother)?.alive;
    const fatherAlive = childKin?.father && this.kernel.entities.get(childKin.father)?.alive;
    if (motherAlive || fatherAlive) {
      return { success: false, reason: 'Child still has a living biological parent' };
    }

    let parent2 = coParent;
    if (!parent2 && parent.marriage?.spouse) {
      parent2 = this.kernel.entities.get(parent.marriage.spouse);
    }

    const adoption = {
      id: this.nextAdoptionId++,
      child: child.id,
      parent1: parent.id,
      parent2: parent2?.id ?? null,
      date: this.kernel.turn,
      adoptive: true
    };
    this.adoptions.set(adoption.id, adoption);

    if (this.game?.kinship?.genealogy?.has(child.id)) {
      const entry = this.game.kinship.genealogy.get(child.id);
      entry.adoptiveMother = parent.sex === 'female' ? parent.id : parent2?.id ?? null;
      entry.adoptiveFather = parent.sex === 'male' ? parent.id : parent2?.id ?? null;
      entry.adoptionId = adoption.id;
    }

    const adoptiveHouseholdId = parent.household;
    if (adoptiveHouseholdId) {
      const oldHousehold = child.household ? this.kernel.entities.get(child.household) : null;
      if (oldHousehold) oldHousehold.removeMember(child.id);
      const newHousehold = this.kernel.entities.get(adoptiveHouseholdId);
      if (newHousehold) {
        newHousehold.addMember(child.id, 'child');
        child.household = adoptiveHouseholdId;
      }
    }

    if (!child.adoptions) child.adoptions = [];
    child.adoptions.push(adoption.id);
    child.adoptiveParents = [parent.id, parent2?.id].filter(Boolean);

    return { success: true, adoption };
  }
}

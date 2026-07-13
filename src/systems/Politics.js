/**
 * Politics.js
 * Political institutions, taxation, rebellion mechanics
 * Models governance, legitimacy, resistance, power dynamics
 */

export class Politics {
  constructor(kernel, game) {
    this.kernel = kernel || game?.kernel || null;
    this.governments = new Map();
    this.offices = new Map();
    this.taxes = new Map();
    this.rebellions = new Map();
    this.nextGovId = 1;
    this.nextOfficeId = 1;
    this.nextTaxId = 1;
    this.nextRebellionId = 1;
  }

  establishGovernment(territory, type, ruler) {
    const government = {
      id: this.nextGovId++,
      territory: territory,
      type: type, // monarchy, feudal, republic, theocracy
      ruler: ruler.id,
      established: this.kernel?.turn ?? 0,
      legitimacy: 0.7,
      offices: [],
      laws: [],
      treasury: 0,
      subjects: [],
      stability: 0.8
    };
    
    this.governments.set(government.id, government);
    return government;
  }

  createOffice(governmentId, title, powers, responsibilities) {
    const government = this.governments.get(governmentId);
    if (!government) {
      return { success: false, reason: 'Unknown government' };
    }
    
    const office = {
      id: this.nextOfficeId++,
      government: governmentId,
      title: title,
      holder: null,
      powers: powers,
      responsibilities: responsibilities,
      created: this.kernel?.turn ?? 0,
      authority: this.calculateAuthority(powers)
    };
    
    this.offices.set(office.id, office);
    government.offices.push(office.id);
    
    return {
      success: true,
      office: office
    };
  }

  calculateAuthority(powers) {
    let authority = 0;
    
    if (powers.includes('taxation')) authority += 0.3;
    if (powers.includes('legislation')) authority += 0.3;
    if (powers.includes('military')) authority += 0.2;
    if (powers.includes('judicial')) authority += 0.2;
    
    return Math.min(1, authority);
  }

  appointOfficial(officeId, person) {
    const office = this.offices.get(officeId);
    if (!office) {
      return { success: false, reason: 'Unknown office' };
    }
    
    if (office.holder) {
      return { success: false, reason: 'Office already filled' };
    }
    
    // Check qualifications
    const qualified = this.checkQualifications(person, office);
    if (!qualified.success) {
      return qualified;
    }
    
    office.holder = person.id;
    office.appointed = this.kernel?.turn ?? 0;
    
    // Grant authority
    person.politicalPower = (person.politicalPower || 0) + office.authority;
    
    return {
      success: true,
      office: office
    };
  }

  checkQualifications(person, office) {
    // Simplified qualification check
    if (office.responsibilities.includes('military') && !person.skills?.combat) {
      return { success: false, reason: 'Lacks military experience' };
    }
    
    if (office.responsibilities.includes('judicial') && !person.skills?.knowledge?.law) {
      return { success: false, reason: 'Lacks legal knowledge' };
    }
    
    return { success: true };
  }

  imposeTax(governmentId, name, rate, base, frequency) {
    const government = this.governments.get(governmentId);
    if (!government) {
      return { success: false, reason: 'Unknown government' };
    }
    
    const tax = {
      id: this.nextTaxId++,
      government: governmentId,
      name: name,
      rate: rate, // 0-1
      base: base, // wealth, land, trade, poll
      frequency: frequency, // annual, seasonal, monthly
      imposed: this.kernel?.turn ?? 0,
      collected: 0,
      compliance: 0.7
    };
    
    this.taxes.set(tax.id, tax);
    
    // Taxes affect legitimacy
    if (rate > 0.3) {
      government.legitimacy -= 0.1;
    }
    
    return {
      success: true,
      tax: tax
    };
  }

  collectTax(taxId, subjects) {
    const tax = this.taxes.get(taxId);
    if (!tax) {
      return { success: false, reason: 'Unknown tax' };
    }
    
    const government = this.governments.get(tax.government);
    if (!government) {
      return { success: false, reason: 'Unknown government' };
    }
    
    let totalCollected = 0;
    const collections = [];
    
    for (const subject of subjects) {
      // Calculate tax owed
      let taxBase = 0;
      
      switch (tax.base) {
        case 'wealth':
          taxBase = subject.wealth || 0;
          break;
        case 'land':
          taxBase = subject.landOwned || 0;
          break;
        case 'trade':
          taxBase = subject.tradeIncome || 0;
          break;
        case 'poll':
          taxBase = 1; // Fixed amount per person
          break;
      }
      
      const taxOwed = taxBase * tax.rate;
      
      // Check compliance
      const willPay = this.kernel.random() < tax.compliance;
      
      if (willPay && subject.wealth >= taxOwed) {
        subject.wealth -= taxOwed;
        totalCollected += taxOwed;
        collections.push({
          subject: subject.id,
          amount: taxOwed,
          paid: true
        });
      } else {
        collections.push({
          subject: subject.id,
          amount: taxOwed,
          paid: false,
          reason: willPay ? 'insufficient_funds' : 'refused'
        });
        
        // Non-compliance reduces legitimacy
        if (!willPay) {
          government.legitimacy -= 0.01;
        }
      }
    }
    
    government.treasury += totalCollected;
    tax.collected += totalCollected;
    
    return {
      success: true,
      collected: totalCollected,
      collections: collections
    };
  }

  calculateLegitimacy(governmentId) {
    const government = this.governments.get(governmentId);
    if (!government) return 0;
    
    let legitimacy = government.legitimacy;
    
    // Factors affecting legitimacy
    
    // Stability
    legitimacy += government.stability * 0.2;
    
    // Treasury (ability to provide services)
    if (government.treasury > 1000) {
      legitimacy += 0.1;
    } else if (government.treasury < 100) {
      legitimacy -= 0.1;
    }
    
    // Tax burden
    const avgTaxRate = Array.from(this.taxes.values())
      .filter(t => t.government === governmentId)
      .reduce((sum, t) => sum + t.rate, 0) / this.taxes.size || 0;
    
    if (avgTaxRate > 0.4) {
      legitimacy -= 0.2;
    }
    
    return Math.max(0, Math.min(1, legitimacy));
  }

  checkRebellionRisk(governmentId) {
    const government = this.governments.get(governmentId);
    if (!government) return { risk: 0 };
    
    let risk = 0;
    
    // Low legitimacy increases risk
    const legitimacy = this.calculateLegitimacy(governmentId);
    risk += (1 - legitimacy) * 0.5;
    
    // High taxes increase risk
    const avgTaxRate = Array.from(this.taxes.values())
      .filter(t => t.government === governmentId)
      .reduce((sum, t) => sum + t.rate, 0) / this.taxes.size || 0;
    
    if (avgTaxRate > 0.3) {
      risk += (avgTaxRate - 0.3) * 0.5;
    }
    
    // Low stability increases risk
    risk += (1 - government.stability) * 0.3;
    
    return {
      risk: Math.min(1, risk),
      factors: {
        legitimacy: legitimacy,
        taxBurden: avgTaxRate,
        stability: government.stability
      }
    };
  }

  startRebellion(governmentId, leaders, grievances) {
    const government = this.governments.get(governmentId);
    if (!government) {
      return { success: false, reason: 'Unknown government' };
    }
    
    const rebellion = {
      id: this.nextRebellionId++,
      government: governmentId,
      leaders: leaders.map(l => l.id),
      grievances: grievances,
      started: this.kernel?.turn ?? 0,
      strength: leaders.length * 10,
      support: 0.1,
      status: 'active',
      demands: this.formulateDemands(grievances)
    };
    
    this.rebellions.set(rebellion.id, rebellion);
    
    // Rebellion reduces stability
    government.stability -= 0.3;
    
    return {
      success: true,
      rebellion: rebellion
    };
  }

  formulateDemands(grievances) {
    const demands = [];
    
    if (grievances.includes('high_taxes')) {
      demands.push('reduce_taxes');
    }
    
    if (grievances.includes('tyranny')) {
      demands.push('limit_power');
    }
    
    if (grievances.includes('injustice')) {
      demands.push('reform_laws');
    }
    
    return demands;
  }

  updateRebellion(rebellionId, timeStep) {
    const rebellion = this.rebellions.get(rebellionId);
    if (!rebellion || rebellion.status !== 'active') return;

    const government = this.governments.get(rebellion.government);
    if (!government) return;

    // Rebellion grows or shrinks based on conditions
    const riskFactors = this.checkRebellionRisk(rebellion.government);

    if (riskFactors.risk > 0.5) {
      rebellion.support += 0.05 * timeStep;
      rebellion.strength += 5 * timeStep;
    } else {
      rebellion.support -= 0.03 * timeStep;
      rebellion.strength -= 3 * timeStep;
    }
    
    // Check if rebellion succeeds or fails
    if (rebellion.strength <= 0) {
      rebellion.status = 'suppressed';
      rebellion.ended = this.kernel?.turn ?? 0;
      government.stability += 0.2;
    } else if (rebellion.support > 0.5) {
      rebellion.status = 'successful';
      rebellion.ended = this.kernel?.turn ?? 0;
      // Rebellion succeeds - government changes
      return this.rebellionSuccess(rebellion);
    }
  }

  rebellionSuccess(rebellion) {
    const government = this.governments.get(rebellion.government);
    if (!government) return;
    
    // Implement demands
    for (const demand of rebellion.demands) {
      switch (demand) {
        case 'reduce_taxes':
          for (const tax of this.taxes.values()) {
            if (tax.government === rebellion.government) {
              tax.rate *= 0.7;
            }
          }
          break;
          
        case 'limit_power':
          government.legitimacy += 0.2;
          break;
          
        case 'reform_laws':
          government.legitimacy += 0.1;
          break;
      }
    }
    
    // Change ruler
    if (rebellion.leaders.length > 0) {
      government.ruler = rebellion.leaders[0];
    }
    
    government.stability = 0.5; // Unstable after rebellion
    
    return {
      success: true,
      newRuler: government.ruler
    };
  }

  negotiate(rebellionId, government, concessions) {
    const rebellion = this.rebellions.get(rebellionId);
    if (!rebellion || rebellion.status !== 'active') {
      return { success: false, reason: 'Rebellion not active' };
    }
    
    // Evaluate concessions
    let satisfaction = 0;
    
    for (const concession of concessions) {
      if (rebellion.demands.includes(concession)) {
        satisfaction += 0.3;
      }
    }
    
    if (satisfaction > 0.5) {
      rebellion.status = 'resolved';
      rebellion.ended = this.kernel?.turn ?? 0;
      
      const gov = this.governments.get(rebellion.government);
      if (gov) {
        gov.stability += 0.1;
        gov.legitimacy += 0.1;
      }
      
      return {
        success: true,
        resolved: true
      };
    }
    
    return {
      success: false,
      reason: 'Insufficient concessions',
      satisfaction: satisfaction
    };
  }

  successionCrisis(governmentId, claimants) {
    const government = this.governments.get(governmentId);
    if (!government) {
      return { success: false, reason: 'Unknown government' };
    }
    
    // Evaluate claimants
    const evaluations = claimants.map(claimant => ({
      claimant: claimant.id,
      legitimacy: this.evaluateClaimLegitimacy(claimant, government),
      support: this.calculateSupport(claimant, government)
    }));
    
    // Sort by legitimacy and support
    evaluations.sort((a, b) => (b.legitimacy + b.support) - (a.legitimacy + a.support));
    
    const winner = evaluations[0];
    
    // Succession affects stability
    government.stability -= 0.2;
    
    if (winner.legitimacy < 0.5) {
      government.legitimacy -= 0.2;
    }
    
    government.ruler = winner.claimant;
    
    return {
      success: true,
      newRuler: winner.claimant,
      contested: winner.legitimacy < 0.6
    };
  }

  evaluateClaimLegitimacy(claimant, government) {
    let legitimacy = 0.5;
    
    // Bloodline
    if (claimant.bloodline === government.ruler) {
      legitimacy += 0.3;
    }
    
    // Popular support
    if (claimant.reputation > 0.7) {
      legitimacy += 0.2;
    }
    
    return Math.min(1, legitimacy);
  }

  calculateSupport(claimant, government) {
    // Simplified support calculation
    return claimant.reputation || 0.5;
  }

  getGovernment(id) {
    return this.governments.get(id);
  }

  getOffice(id) {
    return this.offices.get(id);
  }

  getTax(id) {
    return this.taxes.get(id);
  }

  getRebellion(id) {
    return this.rebellions.get(id);
  }

  getActiveRebellions() {
    return Array.from(this.rebellions.values())
      .filter(r => r.status === 'active');
  }

  getTaxesByGovernment(governmentId) {
    return Array.from(this.taxes.values())
      .filter(t => t.government === governmentId);
  }

  getOfficesByGovernment(governmentId) {
    return Array.from(this.offices.values())
      .filter(o => o.government === governmentId);
  }

  // ─── Coup & Espionage ──────────────────────────────────────────────

  /**
   * Coup attempt — overthrow the current ruler. Success depends on the
   * attacker's military power vs. government stability/legitimacy.
   */
  attemptCoup(governmentId, coupLeader, co_conspirators = [], justification = 'overthrow tyranny') {
    const government = this.governments.get(governmentId);
    if (!government) return { success: false, reason: 'Unknown government' };

    const legitimacy = this.calculateLegitimacy(governmentId);
    const stability = government.stability || 0.5;

    // Coup difficulty: high stability/legitimacy = harder
    const defense = (legitimacy + stability) / 2;
    const conspiratorPower = co_conspirators.length + 1; // leader counts as 1
    const attackPower = conspiratorPower * 0.15 + this.kernel.random() * 0.3;
    const success = attackPower > defense;

    const coup = {
      id: this.nextRebellionId++,
      type: 'coup',
      government: governmentId,
      leader: coupLeader.id,
      conspirators: co_conspirators.map(c => c.id),
      justification,
      started: this.kernel?.turn ?? 0,
      success,
      ended: this.kernel?.turn ?? 0
    };
    if (!this.coups) this.coups = [];
    this.coups.push(coup);

    if (success) {
      government.ruler = coupLeader.id;
      government.legitimacy = Math.max(0.2, legitimacy - 0.3); // coups always damage legitimacy
      government.stability = Math.max(0.2, stability - 0.2);
      coupLeader.politicalPower = (coupLeader.politicalPower || 0) + 0.5;
      return {
        success: true,
        coup,
        message: `${coupLeader.name || 'Leader'} seized power in faction ${governmentId}!`
      };
    }
    // Failed coup — conspirators are exiled/imprisoned
    coupLeader.politicalPower = Math.max(0, (coupLeader.politicalPower || 0) - 0.3);
    return {
      success: false,
      coup,
      message: `Coup failed — ${coupLeader.name || 'Leader'} is exiled.`,
      punishment: 'exile'
    };
  }

  /**
   * Espionage — gather intelligence on a foreign power. Returns reputation
   * change and a "secrets" array based on random skill check.
   */
  conductEspionage(agent, targetGovernmentId, operation = 'reconnaissance') {
    const target = this.governments.get(targetGovernmentId);
    if (!target) return { success: false, reason: 'Unknown government' };
    const skill = agent.skills?.mental?.social?.level || 0;
    const chance = 0.4 + (skill / 100) * 0.5 + this.kernel.random() * 0.1;
    const detected = this.kernel.random() > chance;
    const secrets = [];
    if (chance > 0.5) {
      secrets.push(`treasury_${target.treasury || 0}`);
      secrets.push(`legitimacy_${(target.legitimacy || 0).toFixed(2)}`);
      if (target.subjects && target.subjects.length > 0) secrets.push(`subjects_${target.subjects.length}`);
    }
    const spy = {
      id: `spy_${(this.kernel?.turn ?? 0)}_${this.kernel.random().toString(36).slice(2, 6)}`,
      agent: agent.id,
      target: targetGovernmentId,
      operation,
      date: this.kernel?.turn ?? 0,
      detected,
      secrets
    };
    if (!this.espionage) this.espionage = [];
    this.espionage.push(spy);
    return {
      success: secrets.length > 0,
      detected,
      secrets,
      spy,
      message: detected
        ? `${operation} detected by faction ${targetGovernmentId}.`
        : `${operation} succeeded — gathered ${secrets.length} secrets.`
    };
  }

  getCoups(governmentId = null) {
    if (!this.coups) return [];
    return governmentId === null ? this.coups : this.coups.filter(c => c.government === governmentId);
  }

  getEspionage(factionId = null) {
    if (!this.espionage) return [];
    return factionId === null ? this.espionage : this.espionage.filter(e => e.target === factionId);
  }

  // ─── Governance Rituals ────────────────────────────────────────────

  /**
   * Hold an election for a government. Candidates are noble peers and
   * prominent citizens. Returns the winner (highest combined legitimacy
   * and support) and the new ruler.
   */
  holdElection(governmentId, candidates = [], justification = '') {
    const government = this.governments.get(governmentId);
    if (!government) return { success: false, reason: 'Unknown government' };
    if (government.type !== 'republic' && government.type !== 'elective_monarchy') {
      return { success: false, reason: `${government.type} governments are not elected` };
    }
    if (!candidates || candidates.length === 0) {
      return { success: false, reason: 'Need at least one candidate' };
    }
    const evaluations = candidates.map(c => ({
      candidate: c.id,
      legitimacy: this.evaluateClaimLegitimacy(c, government),
      support: this.calculateSupport(c, government),
      reputation: c.reputation || 0.5
    }));
    evaluations.sort((a, b) => (b.legitimacy + b.support + b.reputation) - (a.legitimacy + a.support + a.reputation));
    const winner = evaluations[0];
    const prev = government.ruler;
    government.ruler = winner.candidate;
    government.legitimacy = Math.min(1, government.legitimacy + 0.1);
    if (!this.elections) this.elections = [];
    const election = {
      id: `election_${this.kernel?.turn ?? 0}`,
      government: governmentId,
      previousRuler: prev,
      winner: winner.candidate,
      candidates: candidates.map(c => c.id),
      scores: evaluations,
      justification,
      date: this.kernel?.turn ?? 0
    };
    this.elections.push(election);
    return { success: true, election, winner: winner.candidate };
  }

  /**
   * Coronate a new monarch. Restrains the new ruler to formal obligations
   * (taxation, justice, military) and grants legitimacy bonus.
   */
  coronate(governmentId, monarch, regalia = [], presidedBy = null) {
    const government = this.governments.get(governmentId);
    if (!government) return { success: false, reason: 'Unknown government' };
    if (!monarch || !monarch.id) return { success: false, reason: 'No monarch' };
    if (government.type !== 'monarchy' && government.type !== 'elective_monarchy') {
      return { success: false, reason: 'Coronation requires a monarchy' };
    }
    const prev = government.ruler;
    government.ruler = monarch.id;
    government.legitimacy = Math.min(1, (government.legitimacy || 0) + 0.25);
    government.stability = Math.min(1, (government.stability || 0) + 0.1);
    if (!this.coronations) this.coronations = [];
    const c = {
      id: `coronation_${this.kernel?.turn ?? 0}`,
      government: governmentId,
      previousRuler: prev,
      monarch: monarch.id,
      regalia,
      presidedBy: presidedBy?.id ?? null,
      date: this.kernel?.turn ?? 0
    };
    this.coronations.push(c);
    // Track dynasty
    if (!monarch.dynasty) monarch.dynasty = `House of ${monarch.name || monarch.id}`;
    return { success: true, coronation: c };
  }

  /**
   * Abdicate the throne. The current ruler steps down; legitimacy depends
   * on how the succession is handled.
   */
  abdicate(governmentId, currentRuler, heir = null) {
    const government = this.governments.get(governmentId);
    if (!government) return { success: false, reason: 'Unknown government' };
    if (government.ruler !== currentRuler.id) return { success: false, reason: 'You are not the ruler' };
    let newRuler = null;
    if (heir && heir.id) {
      // Validate heir then transfer
      if (heir.alive && heir.age >= 16) {
        government.ruler = heir.id;
        newRuler = heir.id;
        government.legitimacy = Math.max(0, government.legitimacy - 0.2);
      }
    }
    if (!newRuler) {
      // No heir: regime collapses, government marked abdicated
      government.ruler = null;
      government.stability = 0;
      government.legitimacy = 0;
    }
    if (!this.abdications) this.abdications = [];
    this.abdications.push({ government: governmentId, ruler: currentRuler.id, heir: heir?.id ?? null, date: this.kernel?.turn ?? 0 });
    return { success: true, heir: heir?.id ?? null, newRuler };
  }

  /**
   * Appoint a regent to rule in the monarch's stead (typically because the
   * monarch is a minor, captive, or unfit).
   */
  appointRegent(governmentId, regent, reason = 'minority') {
    const government = this.governments.get(governmentId);
    if (!government) return { success: false, reason: 'Unknown government' };
    if (!regent || !regent.id) return { success: false, reason: 'No regent' };
    government.regent = regent.id;
    government.regencyReason = reason;
    if (!this.regencies) this.regencies = [];
    this.regencies.push({
      id: `regency_${this.kernel?.turn ?? 0}`,
      government: governmentId,
      regent: regent.id,
      reason,
      date: this.kernel?.turn ?? 0
    });
    return { success: true };
  }

  /**
   * Establish or extend a dynasty — record monarch + heirs + lineage.
   */
  recordDynasty(governmentId, monarch) {
    if (!monarch.dynasty) monarch.dynasty = `House of ${monarch.name || monarch.id}`;
    if (!this.dynasties) this.dynasties = new Map();
    if (!this.dynasties.has(monarch.dynasty)) {
      this.dynasties.set(monarch.dynasty, {
        name: monarch.dynasty,
        founder: monarch.id,
        founded: this.kernel?.turn ?? 0,
        monarchs: [],
        motto: ''
      });
    }
    const d = this.dynasties.get(monarch.dynasty);
    d.monarchs.push({ person: monarch.id, government: governmentId, date: this.kernel?.turn ?? 0 });
    return { success: true, dynasty: d };
  }

  getDynasty(name) {
    return this.dynasties?.get(name) || null;
  }

  getElections() {
    return this.elections || [];
  }
  getCoronations() {
    return this.coronations || [];
  }
  getRegencies() {
    return this.regencies || [];
  }

  /**
   * Hold a council/parliament session. Nobles and council members vote on
   * a proposal. Returns the vote tally.
   */
  holdCouncilSession(governmentId, proposal, voters = []) {
    const government = this.governments.get(governmentId);
    if (!government) return { success: false, reason: 'Unknown government' };
    if (!proposal) return { success: false, reason: 'No proposal' };
    const tally = { for: 0, against: 0, abstain: 0 };
    const votes = [];
    for (const v of voters) {
      // Voting weight by title rank
      const rank = v.title ? this._rankForTitle(v.title) : 0;
      const weight = rank + 1;
      // Vote based on: alignment with ruler, self-interest, legitimacy
      const alignment = ((v.reputation || 0.5) - 0.5) * 0.5;
      const support = this.kernel.random() + alignment > 0.4 ? 'for' : (this.kernel.random() < 0.3 ? 'against' : 'abstain');
      tally[support] += weight;
      votes.push({ voter: v.id, vote: support, weight });
    }
    const passed = tally.for > tally.against;
    if (!this.councils) this.councils = [];
    const session = {
      id: `council_${this.kernel?.turn ?? 0}`,
      government: governmentId,
      proposal,
      tally,
      passed,
      votes,
      date: this.kernel?.turn ?? 0
    };
    this.councils.push(session);
    return { success: passed, session };
  }
  _rankForTitle(t) {
    const ranks = { commoner: 0, gentry: 1, knight: 2, baron: 3, count: 4, duke: 5, king: 6 };
    return ranks[t] || 0;
  }

  /**
   * Sign a treaty between two governments. Records terms and binds both sides.
   */
  signTreaty(governmentAId, governmentBId, terms = {}) {
    const a = this.governments.get(governmentAId);
    const b = this.governments.get(governmentBId);
    if (!a || !b) return { success: false, reason: 'Unknown government' };
    if (!this.treaties) this.treaties = new Map();
    const treaty = {
      id: `treaty_${this.kernel?.turn ?? 0}`,
      parties: [governmentAId, governmentBId],
      terms, // { nonAggression, trade, alliance, tribute, marriage }
      signed: this.kernel?.turn ?? 0,
      active: true,
      violations: 0
    };
    this.treaties.set(treaty.id, treaty);
    return { success: true, treaty };
  }

  /**
   * Make a noble a vassal of a higher noble — binds them to military and
   * tax obligations.
   */
  makeVassal(vassalGovernmentId, liegeGovernmentId, obligations = { military: 100, tax: 0.1 }) {
    const vassal = this.governments.get(vassalGovernmentId);
    const liege = this.governments.get(liegeGovernmentId);
    if (!vassal || !liege) return { success: false, reason: 'Unknown government' };
    vassal.liege = liegeGovernmentId;
    vassal.obligations = obligations;
    if (!liege.vassals) liege.vassals = [];
    if (!liege.vassals.includes(vassalGovernmentId)) liege.vassals.push(vassalGovernmentId);
    return { success: true };
  }

  getTreaties() {
    return this.treaties ? Array.from(this.treaties.values()) : [];
  }
  getCouncils() {
    return this.councils || [];
  }

  // ─── Succession ─────────────────────────────────────────────────────

  /**
   * Triggered when a ruler dies. Find eligible heir via Kinship; if none
   * and government is a republic, schedule an election. Marks the
   * government as 'in_crisis' if no path exists.
   *
   * `kernel` and `game` are optional; when provided, we read the
   * kinship heir list and post notifications.
   */
  handleSuccession(governmentId, deadRulerId, opts = {}) {
    const { kernel, game } = opts;
    const government = this.governments.get(governmentId);
    if (!government) return { success: false, reason: 'Unknown government' };
    if (government.ruler !== deadRulerId) return { success: false, reason: 'Not the current ruler' };

    const notify = (msg, type = 'info') => {
      if (game && typeof game.notifyUI === 'function') game.notifyUI(msg, type);
    };

    // 1. Find heir via kinship
    let heirId = null;
    if (kernel && kernel.entities) {
      const kinship = game?.kinship;
      if (kinship && typeof kinship.getEligibleHeirs === 'function') {
        const candidates = kinship.getEligibleHeirs(deadRulerId) || [];
        for (const cid of candidates) {
          const p = kernel.entities.get(cid);
          if (p && p.alive && typeof p.canSucceed === 'function' ? p.canSucceed() : (p && p.alive)) {
            heirId = cid;
            break;
          }
        }
      }
    }

    if (heirId) {
      government.ruler = heirId;
      government.legitimacy = Math.max(0, (government.legitimacy || 0.5) - 0.15);
      government.stability = Math.max(0, (government.stability || 0.5) - 0.1);
      if (!this.abdications) this.abdications = [];
      this.abdications.push({ government: governmentId, ruler: deadRulerId, heir: heirId, kind: 'succession', date: this.kernel?.turn ?? 0 });
      const heir = kernel?.entities?.get?.(heirId);
      notify(`👑 Succession: ${heir?.name || heirId} inherits the ${government.type} throne.`, 'system');
      return { success: true, kind: 'succession', heir: heirId };
    }

    // 2. No heir — mark crisis
    government.ruler = null;
    government.inCrisis = true;
    government.stability = Math.max(0, (government.stability || 0.5) - 0.3);
    government.legitimacy = Math.max(0, (government.legitimacy || 0.5) - 0.2);

    // 3. Republic / elective_monarchy → auto-elect
    if (government.type === 'republic' || government.type === 'elective_monarchy') {
      const candidates = this._gatherCandidates(government, kernel, game);
      if (candidates.length > 0) {
        const result = this.holdElection(governmentId, candidates, 'succession_crisis');
        if (result && result.success) {
          government.inCrisis = false;
          const winner = kernel?.entities?.get?.(result.winner);
          notify(`🗳️  Election held in the ${government.type}: ${winner?.name || result.winner} ascends.`, 'system');
          return { success: true, kind: 'election', winner: result.winner };
        }
      }
    }

    notify(`⚠️  Government ${governmentId} (${government.type}) enters succession crisis — no heir.`, 'warn');
    return { success: false, kind: 'crisis' };
  }

  /**
   * Build a candidate pool from settlement notables for an emergency
   * election. Uses the first settlement in the government's subject list.
   */
  _gatherCandidates(government, kernel, game) {
    if (!kernel || !game) return [];
    const sid = (government.subjects && government.subjects[0]) ?? 0;
    const set = kernel.bySettlement?.get?.(sid);
    if (!set) return [];
    const candidates = [];
    for (const p of set) {
      if (!p || !p.alive) continue;
      if (typeof p.canSucceed === 'function' && !p.canSucceed()) continue;
      candidates.push(p);
      if (candidates.length >= 5) break;
    }
    return candidates;
  }

  /**
   * Iterate governments and fire handleSuccession for any whose ruler
   * matches `deadPersonId`. Called by Game when a person dies.
   */
  onRulerDeath(deadPersonId, opts = {}) {
    const out = [];
    for (const government of this.governments.values()) {
      if (government.ruler === deadPersonId) {
        const r = this.handleSuccession(government.id, deadPersonId, opts);
        out.push({ governmentId: government.id, ...r });
      }
    }
    return out;
  }
}

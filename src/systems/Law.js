/**
 * Law.js
 * Courts, evidence, punishment, legal procedures
 * Models medieval justice system, trials, enforcement
 */

export class Law {
  constructor(kernel, game) {
    this.kernel = kernel || game?.kernel || null;
    this.laws = new Map();
    this.courts = new Map();
    this.cases = new Map();
    this.punishments = new Map();
    this.nextLawId = 1;
    this.nextCourtId = 1;
    this.nextCaseId = 1;
  }

  enactLaw(name, description, jurisdiction, penalty) {
    const law = {
      id: this.nextLawId++,
      name: name,
      description: description,
      jurisdiction: jurisdiction,
      penalty: penalty,
      enacted: this.kernel?.turn ?? 0,
      violations: 0,
      enforced: true
    };
    
    this.laws.set(law.id, law);
    return law;
  }

  establishCourt(location, jurisdiction, type) {
    const court = {
      id: this.nextCourtId++,
      location: location,
      jurisdiction: jurisdiction,
      type: type, // manorial, royal, ecclesiastical, merchant
      judges: [],
      cases: [],
      established: this.kernel?.turn ?? 0,
      authority: this.calculateAuthority(type)
    };
    
    this.courts.set(court.id, court);
    return court;
  }

  calculateAuthority(type) {
    const authorities = {
      manorial: 0.5,
      royal: 1.0,
      ecclesiastical: 0.8,
      merchant: 0.6
    };
    return authorities[type] || 0.5;
  }

  accusation(accuser, accused, lawId, evidence) {
    const law = this.laws.get(lawId);
    if (!law) {
      return { success: false, reason: 'Unknown law' };
    }
    
    const caseRecord = {
      id: this.nextCaseId++,
      accuser: accuser.id,
      accused: accused.id,
      law: lawId,
      evidence: evidence || [],
      filed: this.kernel?.turn ?? 0,
      status: 'pending',
      court: null,
      verdict: null,
      punishment: null
    };
    
    this.cases.set(caseRecord.id, caseRecord);
    
    return {
      success: true,
      case: caseRecord
    };
  }

  assignCourt(caseId, courtId) {
    const caseRecord = this.cases.get(caseId);
    const court = this.courts.get(courtId);
    
    if (!caseRecord || !court) {
      return { success: false, reason: 'Case or court not found' };
    }
    
    caseRecord.court = courtId;
    caseRecord.status = 'assigned';
    court.cases.push(caseId);
    
    return { success: true };
  }

  gatherEvidence(investigator, caseId, evidenceType) {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord) {
      return { success: false, reason: 'Unknown case' };
    }
    
    const skill = investigator.skills?.knowledge?.investigation || 0.3;
    
    // Evidence quality depends on skill
    const quality = skill * (0.5 + this.kernel.random() * 0.5);
    
    const evidence = {
      type: evidenceType, // witness, physical, documentary, circumstantial
      quality: quality,
      gatheredBy: investigator.id,
      timestamp: this.kernel?.turn ?? 0,
      credibility: this.assessCredibility(evidenceType, quality)
    };
    
    caseRecord.evidence.push(evidence);
    
    return {
      success: true,
      evidence: evidence
    };
  }

  assessCredibility(type, quality) {
    const baseCredibility = {
      witness: 0.6,
      physical: 0.8,
      documentary: 0.9,
      circumstantial: 0.4
    };
    
    return (baseCredibility[type] || 0.5) * quality;
  }

  conductTrial(caseId, judge, jury) {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord) {
      return { success: false, reason: 'Unknown case' };
    }
    
    if (caseRecord.status !== 'assigned') {
      return { success: false, reason: 'Case not ready for trial' };
    }
    
    const court = this.courts.get(caseRecord.court);
    if (!court) {
      return { success: false, reason: 'No court assigned' };
    }
    
    // Evaluate evidence
    const evidenceStrength = this.evaluateEvidence(caseRecord.evidence);
    
    // Judge/jury decision
    const judgeSkill = judge.skills?.knowledge?.law || 0.5;
    const verdict = this.determineVerdict(evidenceStrength, judgeSkill, jury);
    
    caseRecord.verdict = verdict;
    caseRecord.status = 'concluded';
    caseRecord.trialDate = this.kernel?.turn ?? 0;
    caseRecord.judge = judge.id;
    
    // Apply punishment if guilty
    if (verdict.guilty) {
      const law = this.laws.get(caseRecord.law);
      const punishment = this.determinePunishment(law, caseRecord.accused, verdict.severity);
      caseRecord.punishment = punishment;
      
      return {
        success: true,
        verdict: verdict,
        punishment: punishment
      };
    }
    
    return {
      success: true,
      verdict: verdict
    };
  }

  evaluateEvidence(evidence) {
    if (evidence.length === 0) return 0;
    
    let totalStrength = 0;
    
    for (const item of evidence) {
      totalStrength += item.credibility;
    }
    
    return Math.min(1, totalStrength / evidence.length);
  }

  determineVerdict(evidenceStrength, judgeSkill, jury) {
    // Base verdict on evidence
    let guiltyProbability = evidenceStrength;
    
    // Judge skill affects accuracy
    const accuracy = judgeSkill;
    
    // Jury influence (if present)
    if (jury && jury.length > 0) {
      const juryBias = (this.kernel.random() - 0.5) * 0.2;
      guiltyProbability += juryBias;
    }
    
    const guilty = this.kernel.random() < guiltyProbability;
    
    return {
      guilty: guilty,
      confidence: accuracy,
      severity: guilty ? evidenceStrength : 0,
      reasoning: guilty ? 'Evidence supports guilt' : 'Insufficient evidence'
    };
  }

  determinePunishment(law, accusedId, severity) {
    const basePunishment = law.penalty;
    
    const punishment = {
      type: basePunishment.type, // fine, imprisonment, corporal, execution, exile
      severity: severity,
      duration: basePunishment.duration * severity,
      amount: basePunishment.amount * severity,
      executed: false,
      executedDate: null
    };
    
    this.punishments.set(accusedId, punishment);
    
    return punishment;
  }

  executePunishment(accusedId, punishmentId) {
    const punishment = this.punishments.get(accusedId);
    if (!punishment) {
      return { success: false, reason: 'No punishment found' };
    }
    
    if (punishment.executed) {
      return { success: false, reason: 'Punishment already executed' };
    }
    
    const accused = { id: accusedId };
    
    switch (punishment.type) {
      case 'fine':
        if (accused.wealth >= punishment.amount) {
          accused.wealth -= punishment.amount;
          punishment.executed = true;
        } else {
          return { success: false, reason: 'Cannot pay fine' };
        }
        break;
        
      case 'imprisonment':
        accused.imprisoned = true;
        accused.imprisonmentEnd = this.kernel?.turn ?? 0 + punishment.duration * 24 * 60 * 60 * 1000;
        punishment.executed = true;
        break;
        
      case 'corporal':
        accused.physiology = accused.physiology || {};
        accused.physiology.pain = (accused.physiology.pain || 0) + punishment.severity * 5;
        punishment.executed = true;
        break;
        
      case 'execution':
        accused.alive = false;
        accused.deathCause = 'execution';
        accused.deathDate = this.kernel?.turn ?? 0;
        punishment.executed = true;
        break;
        
      case 'exile':
        accused.exiled = true;
        accused.exileEnd = this.kernel?.turn ?? 0 + punishment.duration * 24 * 60 * 60 * 1000;
        punishment.executed = true;
        break;
    }
    
    punishment.executedDate = this.kernel?.turn ?? 0;
    
    return {
      success: true,
      punishment: punishment
    };
  }

  appeal(caseId, appellant, grounds) {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord) {
      return { success: false, reason: 'Unknown case' };
    }
    
    if (caseRecord.status !== 'concluded') {
      return { success: false, reason: 'Case not concluded' };
    }
    
    // Check if appeal is allowed
    const court = this.courts.get(caseRecord.court);
    if (!court || court.type === 'royal') {
      return { success: false, reason: 'No higher court available' };
    }
    
    // Create appeal case
    const appeal = {
      originalCase: caseId,
      appellant: appellant.id,
      grounds: grounds,
      filed: this.kernel?.turn ?? 0,
      status: 'pending'
    };
    
    caseRecord.appeal = appeal;
    
    return {
      success: true,
      appeal: appeal
    };
  }

  pardon(caseId, authority) {
    const caseRecord = this.cases.get(caseId);
    if (!caseRecord) {
      return { success: false, reason: 'Unknown case' };
    }
    
    if (!caseRecord.verdict || !caseRecord.verdict.guilty) {
      return { success: false, reason: 'No guilty verdict to pardon' };
    }
    
    // Check authority level
    if (authority.power < 0.8) {
      return { success: false, reason: 'Insufficient authority to pardon' };
    }
    
    caseRecord.pardoned = true;
    caseRecord.pardonDate = this.kernel?.turn ?? 0;
    caseRecord.pardonedBy = authority.id;
    
    // Cancel punishment
    if (caseRecord.punishment) {
      caseRecord.punishment.cancelled = true;
    }
    
    return {
      success: true,
      pardoned: true
    };
  }

  checkViolation(person, lawId) {
    const law = this.laws.get(lawId);
    if (!law) return { violated: false };
    
    // Simplified violation check
    // Would integrate with actual behavior tracking
    
    return { violated: false };
  }

  getLaw(id) {
    return this.laws.get(id);
  }

  getCourt(id) {
    return this.courts.get(id);
  }

  getCase(id) {
    return this.cases.get(id);
  }

  getPunishment(personId) {
    return this.punishments.get(personId);
  }

  getCasesByAccused(accusedId) {
    return Array.from(this.cases.values())
      .filter(c => c.accused === accusedId);
  }

  getCasesByCourt(courtId) {
    return Array.from(this.cases.values())
      .filter(c => c.court === courtId);
  }

  getPendingCases() {
    return Array.from(this.cases.values())
      .filter(c => c.status === 'pending' || c.status === 'assigned');
  }

  getConvictionRate(courtId) {
    const cases = this.getCasesByCourt(courtId);
    if (cases.length === 0) return 0;

    const convictions = cases.filter(c => c.verdict?.guilty).length;
    return convictions / cases.length;
  }

  // ─── Crime & Dynamic Laws ─────────────────────────────────────────

  /**
   * Register a criminal act — creates a case record and links it to the
   * perpetrator. Returns the case id for later prosecution.
   */
  commitCrime(perpetrator, victim, crimeType, evidence = [], stolenItems = []) {
    // Look up or create a law for this crime type
    let law = Array.from(this.laws.values()).find(l => l.name.toLowerCase() === crimeType.toLowerCase());
    if (!law) {
      // Auto-create a law for this crime if none exists (common medieval default)
      const defaultPenalties = {
        theft: { type: 'fine', amount: 50, duration: 0 },
        murder: { type: 'corporal', duration: 0 },
        assault: { type: 'fine', amount: 20, duration: 0 },
        treason: { type: 'execution', duration: 0 },
        fraud: { type: 'fine', amount: 100, duration: 0 },
        vandalism: { type: 'fine', amount: 10, duration: 0 },
        poaching: { type: 'fine', amount: 30, duration: 0 },
        adultery: { type: 'corporal', duration: 0 }
      };
      const penalty = defaultPenalties[crimeType.toLowerCase()] || { type: 'fine', amount: 25, duration: 0 };
      law = this.enactLaw(crimeType, `Auto-enacted: prohibition of ${crimeType}`, victim?.position?.settlementId ?? null, penalty);
    }

    const caseRecord = {
      id: this.nextCaseId++,
      crimeType,
      accuser: victim?.id ?? null,
      accused: perpetrator.id,
      victim: victim?.id ?? null,
      law: law.id,
      evidence,
      stolenItems,
      filed: this.kernel?.turn ?? 0,
      status: 'pending',
      court: null,
      verdict: null,
      punishment: null,
      detected: evidence.length > 0
    };
    this.cases.set(caseRecord.id, caseRecord);

    // Track per-person crime history
    if (!perpetrator.criminalRecord) perpetrator.criminalRecord = [];
    perpetrator.criminalRecord.push({ case: caseRecord.id, date: this.kernel?.turn ?? 0, type: crimeType });

    return { success: true, case: caseRecord, law };
  }

  /**
   * Attempt to steal an item from a victim. Detection depends on victim's
   * perception vs. thief's stealth/social skill.
   */
  attemptTheft(thief, victim, itemIndex = 0) {
    if (!victim || !victim.inventory || !victim.inventory.items || victim.inventory.items.length === 0) {
      return { success: false, reason: 'Victim has nothing to steal' };
    }
    if (itemIndex < 0 || itemIndex >= victim.inventory.items.length) {
      return { success: false, reason: 'Invalid item index' };
    }

    const thiefSkill = thief.skills?.physical?.stealth?.level || thief.skills?.mental?.social?.level || 0;
    const victimPerception = victim.skills?.mental?.awareness?.level || 50;
    const detectionChance = Math.max(0.1, Math.min(0.9, 0.4 + (victimPerception - thiefSkill) / 200));
    const detected = this.kernel.random() < detectionChance;

    if (detected) {
      const crime = this.commitCrime(thief, victim, 'theft', ['witnessed'], [victim.inventory.items[itemIndex]]);
      return {
        success: false,
        detected: true,
        crime,
        message: `Caught trying to steal ${victim.inventory.items[itemIndex].type} from ${victim.name || 'the victim'}!`
      };
    }

    // Successful theft
    const stolen = victim.inventory.items[itemIndex];
    victim.inventory.remove(stolen.type, 1);
    thief.inventory.add(stolen);
    // Anonymous crime (no witness)
    this.commitCrime(thief, victim, 'theft', [], [stolen]);
    return {
      success: true,
      detected: false,
      stolen,
      message: `Stole ${stolen.type} from ${victim.name || 'the victim'} unnoticed.`
    };
  }

  /**
   * Enact a law dynamically in response to a world event.
   * E.g. a wave of thefts triggers an anti-theft statute.
   */
  enactLawFromEvent(event) {
    const templates = {
      'theft_wave': {
        name: 'Anti-Theft Ordinance',
        description: 'Enacted in response to rising theft: increased patrols and harsher penalties.',
        penalty: { type: 'fine', amount: 100, duration: 0 }
      },
      'assault_wave': {
        name: 'Public Safety Act',
        description: 'Enacted after violent assaults: corporal punishment for unprovoked attacks.',
        penalty: { type: 'corporal', duration: 0 }
      },
      'plague_outbreak': {
        name: 'Plague Precautions',
        description: 'Enacted during epidemic: mandatory quarantine and isolation of the sick.',
        penalty: { type: 'imprisonment', duration: 30 }
      },
      'crop_failure': {
        name: 'Grain Hoarding Prohibition',
        description: 'Enacted after famine: ban on hoarding grain during scarcity.',
        penalty: { type: 'fine', amount: 200, duration: 0 }
      },
      'war': {
        name: 'Martial Decree',
        description: 'Enacted during wartime: conscription and curfew laws.',
        penalty: { type: 'imprisonment', duration: 90 }
      },
      'betrayal': {
        name: 'Anti-Treason Edict',
        description: 'Enacted after faction betrayal: capital punishment for traitors.',
        penalty: { type: 'execution', duration: 0 }
      }
    };
    const template = templates[event.type];
    if (!template) return { success: false, reason: 'Unknown event type' };
    const law = this.enactLaw(
      template.name,
      template.description,
      event.settlementId ?? null,
      template.penalty
    );
    return { success: true, law, triggeredBy: event.type };
  }

  getActiveLaws(jurisdiction = null) {
    return Array.from(this.laws.values()).filter(l => {
      if (!l.enforced) return false;
      if (jurisdiction !== null && l.jurisdiction !== jurisdiction) return false;
      return true;
    });
  }

  getCasesByAccused(personId) {
    return Array.from(this.cases.values()).filter(c => c.accused === personId);
  }

  getCasesByAccuser(personId) {
    return Array.from(this.cases.values()).filter(c => c.accuser === personId);
  }

  getCrimeRate(jurisdiction = null, daysBack = 30) {
    const cutoff = this.kernel?.turn ?? 0 - daysBack * 24 * 60 * 60 * 1000;
    const cases = Array.from(this.cases.values()).filter(c => c.filed >= cutoff);
    if (jurisdiction !== null) {
      return cases.filter(c => this.laws.get(c.law)?.jurisdiction === jurisdiction).length;
    }
    return cases.length;
  }
}

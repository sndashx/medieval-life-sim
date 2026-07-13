/**
 * Factions.js
 * Group formation, solidarity, inter-group conflict
 * Models coalitions, loyalty, rivalry, collective action
 */

export class Factions {
  constructor(reputationSystem, statusSystem, kernel, game) {
    this.reputationSystem = reputationSystem;
    this.statusSystem = statusSystem;
    this.kernel = kernel || game?.kernel || null;
    this.factions = new Map();
    this.alliances = new Map();
    this.conflicts = new Map();
    this.nextFactionId = 1;
    this.nextAllianceId = 1;
    this.nextConflictId = 1;
  }

  createFaction(name, founder, purpose, ideology) {
    const faction = {
      id: this.nextFactionId++,
      name: name,
      founder: founder.id,
      leader: founder.id,
      purpose: purpose, // political, economic, religious, military, social
      ideology: ideology,
      founded: this.kernel?.turn ?? 0,
      members: [founder.id],
      cohesion: 0.8,
      resources: 0,
      territory: null,
      reputation: 0.5,
      rivals: [],
      allies: []
    };
    
    this.factions.set(faction.id, faction);
    
    return {
      success: true,
      faction: faction
    };
  }

  join(factionId, person, motivation) {
    const faction = this.factions.get(factionId);
    if (!faction) {
      return { success: false, reason: 'Unknown faction' };
    }
    
    // Check if already member
    if (faction.members.includes(person.id)) {
      return { success: false, reason: 'Already a member' };
    }
    
    // Evaluate fit
    const fit = this.evaluateFit(person, faction);
    
    if (fit < 0.3) {
      return { success: false, reason: 'Poor ideological fit' };
    }
    
    faction.members.push(person.id);
    
    // Track person's faction membership
    if (!person.factions) person.factions = [];
    person.factions.push(factionId);
    
    return {
      success: true,
      fit: fit,
      motivation: motivation
    };
  }

  evaluateFit(person, faction) {
    let fit = 0.5; // Base
    
    // Ideological alignment
    if (person.ideology) {
      const alignment = this.calculateIdeologicalAlignment(person.ideology, faction.ideology);
      fit += alignment * 0.3;
    }
    
    // Social connections
    const connections = faction.members.filter(m => 
      person.relationships && person.relationships.has(m)
    ).length;
    fit += Math.min(0.2, connections * 0.05);
    
    return Math.min(1, fit);
  }

  calculateIdeologicalAlignment(ideology1, ideology2) {
    // Simplified ideological distance
    const dimensions = ['economic', 'social', 'religious', 'political'];
    let totalAlignment = 0;
    
    for (const dim of dimensions) {
      const val1 = ideology1[dim] || 0.5;
      const val2 = ideology2[dim] || 0.5;
      totalAlignment += 1 - Math.abs(val1 - val2);
    }
    
    return totalAlignment / dimensions.length;
  }

  /**
   * Remove a member from a faction without recording a "leave" reason.
   * Used by the death pipeline so a dead person is silently scrubbed
   * from every faction roster. If they were the leader, run the
   * standard succession crisis.
   */
  removeMember(factionId, personId) {
    const faction = this.factions.get(factionId);
    if (!faction) return { success: false, reason: 'Unknown faction' };
    const index = faction.members.indexOf(personId);
    if (index === -1) return { success: false, reason: 'Not a member' };
    faction.members.splice(index, 1);
    if (faction.leader === personId && faction.members.length > 0) {
      return this.successionCrisis(factionId);
    }
    if (faction.members.length === 0) {
      faction.dissolved = true;
      faction.dissolvedDate = this.kernel?.turn ?? 0;
    }
    return { success: true };
  }

  leave(factionId, personId, reason) {
    const faction = this.factions.get(factionId);
    if (!faction) {
      return { success: false, reason: 'Unknown faction' };
    }
    
    const index = faction.members.indexOf(personId);
    if (index === -1) {
      return { success: false, reason: 'Not a member' };
    }
    
    faction.members.splice(index, 1);
    
    // Leaving damages cohesion
    faction.cohesion -= 0.05;
    
    // If leader leaves, succession crisis
    if (faction.leader === personId) {
      return this.successionCrisis(factionId);
    }
    
    return {
      success: true,
      reason: reason
    };
  }

  successionCrisis(factionId) {
    const faction = this.factions.get(factionId);
    if (!faction) return { success: false };
    
    if (faction.members.length === 0) {
      faction.dissolved = true;
      faction.dissolvedDate = this.kernel?.turn ?? 0;
      return {
        success: true,
        dissolved: true
      };
    }
    
    // Select new leader based on status and loyalty
    const candidates = faction.members.map(memberId => ({
      id: memberId,
      status: this.statusSystem.calculateOverallStatus(memberId),
      loyalty: this.kernel.random() // Simplified
    }));
    
    candidates.sort((a, b) => (b.status + b.loyalty) - (a.status + a.loyalty));
    
    faction.leader = candidates[0].id;
    faction.cohesion -= 0.2; // Succession damages cohesion
    
    return {
      success: true,
      newLeader: faction.leader,
      cohesionLoss: 0.2
    };
  }

  calculateCohesion(factionId) {
    const faction = this.factions.get(factionId);
    if (!faction) return 0;
    
    let cohesion = faction.cohesion;
    
    // Size affects cohesion
    if (faction.members.length > 50) {
      cohesion *= 0.9;
    } else if (faction.members.length < 5) {
      cohesion *= 1.1;
    }
    
    // Shared experiences increase cohesion
    // Would integrate with event history
    
    // Conflicts increase cohesion (in-group solidarity)
    if (faction.rivals.length > 0) {
      cohesion += 0.1;
    }
    
    return Math.max(0, Math.min(1, cohesion));
  }

  collectiveAction(factionId, action, target) {
    const faction = this.factions.get(factionId);
    if (!faction) {
      return { success: false, reason: 'Unknown faction' };
    }
    
    // Cohesion determines participation
    const cohesion = this.calculateCohesion(factionId);
    const participants = Math.floor(faction.members.length * cohesion);
    
    if (participants < 3) {
      return { success: false, reason: 'Insufficient participation' };
    }
    
    // Action effectiveness
    const effectiveness = participants * cohesion;
    
    return {
      success: true,
      action: action,
      participants: participants,
      effectiveness: effectiveness
    };
  }

  formAlliance(faction1Id, faction2Id, terms) {
    const faction1 = this.factions.get(faction1Id);
    const faction2 = this.factions.get(faction2Id);
    
    if (!faction1 || !faction2) {
      return { success: false, reason: 'Unknown faction' };
    }
    
    // Check compatibility
    const compatibility = this.calculateIdeologicalAlignment(
      faction1.ideology,
      faction2.ideology
    );
    
    if (compatibility < 0.4) {
      return { success: false, reason: 'Incompatible ideologies' };
    }
    
    const alliance = {
      id: this.nextAllianceId++,
      factions: [faction1Id, faction2Id],
      terms: terms,
      formed: this.kernel?.turn ?? 0,
      strength: compatibility,
      active: true
    };
    
    this.alliances.set(alliance.id, alliance);
    
    faction1.allies.push(faction2Id);
    faction2.allies.push(faction1Id);
    
    return {
      success: true,
      alliance: alliance
    };
  }

  breakAlliance(allianceId, reason) {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) {
      return { success: false, reason: 'Unknown alliance' };
    }
    
    alliance.active = false;
    alliance.broken = this.kernel?.turn ?? 0;
    alliance.breakReason = reason;
    
    // Remove from allies lists
    const faction1 = this.factions.get(alliance.factions[0]);
    const faction2 = this.factions.get(alliance.factions[1]);
    
    if (faction1) {
      const index = faction1.allies.indexOf(alliance.factions[1]);
      if (index > -1) faction1.allies.splice(index, 1);
    }
    
    if (faction2) {
      const index = faction2.allies.indexOf(alliance.factions[0]);
      if (index > -1) faction2.allies.splice(index, 1);
    }
    
    return {
      success: true,
      reason: reason
    };
  }

  startConflict(faction1Id, faction2Id, cause) {
    const faction1 = this.factions.get(faction1Id);
    const faction2 = this.factions.get(faction2Id);
    
    if (!faction1 || !faction2) {
      return { success: false, reason: 'Unknown faction' };
    }
    
    const conflict = {
      id: this.nextConflictId++,
      factions: [faction1Id, faction2Id],
      cause: cause,
      started: this.kernel?.turn ?? 0,
      intensity: 0.5,
      casualties: { [faction1Id]: 0, [faction2Id]: 0 },
      status: 'active',
      victor: null
    };
    
    this.conflicts.set(conflict.id, conflict);
    
    // Add to rivals
    if (!faction1.rivals.includes(faction2Id)) {
      faction1.rivals.push(faction2Id);
    }
    if (!faction2.rivals.includes(faction1Id)) {
      faction2.rivals.push(faction1Id);
    }
    
    // Conflict increases internal cohesion
    faction1.cohesion = Math.min(1, faction1.cohesion + 0.1);
    faction2.cohesion = Math.min(1, faction2.cohesion + 0.1);
    
    return {
      success: true,
      conflict: conflict
    };
  }

  escalateConflict(conflictId) {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict || conflict.status !== 'active') {
      return { success: false, reason: 'Conflict not active' };
    }
    
    conflict.intensity = Math.min(1, conflict.intensity + 0.2);
    
    // Higher intensity = more casualties
    const faction1 = this.factions.get(conflict.factions[0]);
    const faction2 = this.factions.get(conflict.factions[1]);
    
    if (faction1 && faction2) {
      const casualties1 = Math.floor(faction1.members.length * conflict.intensity * 0.05);
      const casualties2 = Math.floor(faction2.members.length * conflict.intensity * 0.05);
      
      conflict.casualties[conflict.factions[0]] += casualties1;
      conflict.casualties[conflict.factions[1]] += casualties2;
      
      faction1.members = faction1.members.slice(0, -casualties1);
      faction2.members = faction2.members.slice(0, -casualties2);
    }
    
    return {
      success: true,
      intensity: conflict.intensity,
      casualties: conflict.casualties
    };
  }

  resolveConflict(conflictId, resolution) {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      return { success: false, reason: 'Unknown conflict' };
    }
    
    conflict.status = 'resolved';
    conflict.ended = this.kernel?.turn ?? 0;
    conflict.resolution = resolution;
    
    const faction1 = this.factions.get(conflict.factions[0]);
    const faction2 = this.factions.get(conflict.factions[1]);
    
    if (resolution.type === 'victory') {
      conflict.victor = resolution.victor;
      
      // Victor gains resources
      const victor = this.factions.get(resolution.victor);
      const loser = this.factions.get(
        resolution.victor === conflict.factions[0] ? conflict.factions[1] : conflict.factions[0]
      );
      
      if (victor && loser) {
        victor.resources += loser.resources * 0.5;
        loser.resources *= 0.5;
        victor.reputation += 0.1;
        loser.reputation -= 0.1;
      }
    } else if (resolution.type === 'negotiated') {
      // Both sides maintain status
      if (faction1) faction1.cohesion += 0.05;
      if (faction2) faction2.cohesion += 0.05;
    }
    
    return {
      success: true,
      resolution: resolution
    };
  }

  defect(personId, fromFactionId, toFactionId) {
    const fromFaction = this.factions.get(fromFactionId);
    const toFaction = this.factions.get(toFactionId);
    
    if (!fromFaction || !toFaction) {
      return { success: false, reason: 'Unknown faction' };
    }
    
    // Leave old faction
    const leaveResult = this.leave(fromFactionId, personId, 'defection');
    if (!leaveResult.success) {
      return leaveResult;
    }
    
    // Join new faction
    const person = { id: personId };
    const joinResult = this.join(toFactionId, person, 'defection');
    
    if (!joinResult.success) {
      return joinResult;
    }
    
    // Defection damages cohesion more
    fromFaction.cohesion -= 0.1;
    
    // Defector's reputation suffers
    return {
      success: true,
      reputationLoss: 0.3,
      cohesionDamage: 0.1
    };
  }

  purge(factionId, targetIds, reason) {
    const faction = this.factions.get(factionId);
    if (!faction) {
      return { success: false, reason: 'Unknown faction' };
    }
    
    const purged = [];
    
    for (const targetId of targetIds) {
      const index = faction.members.indexOf(targetId);
      if (index > -1) {
        faction.members.splice(index, 1);
        purged.push(targetId);
      }
    }
    
    // Purge affects cohesion
    if (purged.length > faction.members.length * 0.1) {
      faction.cohesion -= 0.2; // Large purge damages cohesion
    } else {
      faction.cohesion += 0.1; // Small purge can increase cohesion
    }
    
    return {
      success: true,
      purged: purged.length,
      reason: reason,
      cohesionChange: purged.length > faction.members.length * 0.1 ? -0.2 : 0.1
    };
  }

  merge(faction1Id, faction2Id) {
    const faction1 = this.factions.get(faction1Id);
    const faction2 = this.factions.get(faction2Id);
    
    if (!faction1 || !faction2) {
      return { success: false, reason: 'Unknown faction' };
    }
    
    // Merge members
    faction1.members = [...faction1.members, ...faction2.members];
    faction1.resources += faction2.resources;
    
    // Average cohesion
    faction1.cohesion = (faction1.cohesion + faction2.cohesion) / 2;
    
    // Merge allies and rivals
    faction1.allies = [...new Set([...faction1.allies, ...faction2.allies])];
    faction1.rivals = [...new Set([...faction1.rivals, ...faction2.rivals])];
    
    // Dissolve faction2
    faction2.dissolved = true;
    faction2.dissolvedDate = this.kernel?.turn ?? 0;
    faction2.mergedInto = faction1Id;
    
    return {
      success: true,
      mergedFaction: faction1
    };
  }

  getFaction(id) {
    return this.factions.get(id);
  }

  getAlliance(id) {
    return this.alliances.get(id);
  }

  getConflict(id) {
    return this.conflicts.get(id);
  }

  getFactionsByPurpose(purpose) {
    return Array.from(this.factions.values())
      .filter(f => f.purpose === purpose && !f.dissolved);
  }

  getActiveFactions() {
    return Array.from(this.factions.values())
      .filter(f => !f.dissolved);
  }

  getActiveConflicts() {
    return Array.from(this.conflicts.values())
      .filter(c => c.status === 'active');
  }

  getActiveAlliances() {
    return Array.from(this.alliances.values())
      .filter(a => a.active);
  }

  getFactionsByMember(personId) {
    return Array.from(this.factions.values())
      .filter(f => f.members.includes(personId) && !f.dissolved);
  }

  getLargestFactions(limit = 10) {
    return Array.from(this.factions.values())
      .filter(f => !f.dissolved)
      .sort((a, b) => b.members.length - a.members.length)
      .slice(0, limit);
  }

  // ─── Betrayal & Intrigue ──────────────────────────────────────────

  /**
   * A member betrays the faction — leaks secrets, sabotages from within,
   * or defects. If they're the leader, this can trigger collapse.
   */
  betray(factionId, personId, reason = 'personal', stolenSecrets = []) {
    const faction = this.factions.get(factionId);
    if (!faction) return { success: false, reason: 'Unknown faction' };
    if (!faction.members.includes(personId)) return { success: false, reason: 'Not a member' };

    const isLeader = faction.leader === personId;
    const betrayal = {
      id: `betrayal_${factionId}_${personId}_${this.kernel?.turn ?? 0}`,
      faction: factionId,
      person: personId,
      reason,
      stolenSecrets,
      date: this.kernel?.turn ?? 0,
      isLeader,
      damageToCohesion: isLeader ? 0.4 : 0.15
    };
    if (!this.betrayals) this.betrayals = [];
    this.betrayals.push(betrayal);

    // Remove person from faction
    faction.members = faction.members.filter(m => m !== personId);
    faction.cohesion = Math.max(0, faction.cohesion - betrayal.damageToCohesion);
    faction.reputation = Math.max(0, faction.reputation - 0.1);

    // Leader betrayal triggers succession crisis
    if (isLeader) {
      const crisis = this.successionCrisis(factionId);
      return { success: true, betrayal, successionCrisis: crisis, message: 'Leader betrayal — faction in crisis.' };
    }
    return { success: true, betrayal, message: `Betrayed faction ${factionId} for "${reason}".` };
  }

  /**
   * Scheme against another faction — espionage, sabotage, or political plot.
   * Success depends on social skill, faction cohesion, and target's defenses.
   */
  scheme(schemerId, schemerFactionId, targetFactionId, schemeType = 'espionage') {
    const faction = schemerFactionId ? this.factions.get(schemerFactionId) : null;
    const target = this.factions.get(targetFactionId);
    if (!target) return { success: false, reason: 'Unknown target faction' };

    // Base success chance from cohesion and a small random factor.
    const cohesion = faction ? this.calculateCohesion(schemerFactionId) : 0.4;
    const chance = 0.3 + cohesion * 0.4 + this.kernel.random() * 0.3;
    const detected = this.kernel.random() > chance;

    const scheme = {
      id: `scheme_${(this.kernel?.turn ?? 0)}_${this.kernel.random().toString(36).slice(2, 8)}`,
      schemer: schemerId,
      schemerFaction: schemerFactionId,
      target: targetFactionId,
      type: schemeType,
      date: this.kernel?.turn ?? 0,
      detected,
      success: chance > 0.6
    };
    if (!this.schemes) this.schemes = [];
    this.schemes.push(scheme);

    // Effects on target
    if (scheme.success) {
      target.cohesion = Math.max(0, target.cohesion - 0.1);
      target.reputation = Math.max(0, target.reputation - 0.05);
    }
    if (detected) {
      // Detection raises suspicion; target may retaliate
      target.cohesion += 0.05; // rally-around-the-flag effect
      if (!target.rivals.includes(schemerFactionId)) target.rivals.push(schemerFactionId);
    }

    return {
      success: scheme.success,
      detected,
      scheme,
      message: scheme.success
        ? `${schemeType} against faction ${targetFactionId} succeeded${detected ? ' (but was detected)' : ''}.`
        : `${schemeType} failed${detected ? ' (and was detected)' : ''}.`
    };
  }

  /**
   * Purge members whose loyalty has dropped below threshold.
   * Removes them from the faction and reduces cohesion.
   */
  purge(factionId, personIds, justification = 'disloyalty') {
    const faction = this.factions.get(factionId);
    if (!faction) return { success: false, reason: 'Unknown faction' };
    const purged = [];
    for (const pid of personIds) {
      const idx = faction.members.indexOf(pid);
      if (idx > -1) {
        faction.members.splice(idx, 1);
        purged.push(pid);
      }
    }
    faction.cohesion = Math.max(0, faction.cohesion - 0.05 * purged.length);
    return { success: true, purged, count: purged.length, message: `Purged ${purged.length} members for "${justification}".` };
  }

  /** Convenience alias for startConflict that the UI uses. */
  declareWar(faction1Id, faction2Id, cause = 'Unspecified') {
    return this.startConflict(faction1Id, faction2Id, cause);
  }

  getBetrayals(factionId = null) {
    if (!this.betrayals) return [];
    return factionId === null ? this.betrayals : this.betrayals.filter(b => b.faction === factionId);
  }

  getSchemes(factionId = null) {
    if (!this.schemes) return [];
    return factionId === null ? this.schemes : this.schemes.filter(s => s.schemerFaction === factionId || s.target === factionId);
  }
}

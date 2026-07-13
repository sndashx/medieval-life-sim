/**
 * Reputation.js
 * Reputation claims, propagation, observer-specific views
 * Models how reputation spreads through social networks
 */

export class Reputation {
  constructor(commOrKernel, gameOrComm = null) {
    if (commOrKernel && typeof commOrKernel.rng === 'object' && typeof commOrKernel.turn !== 'undefined') {
      this.kernel = commOrKernel;
      this.game = gameOrComm;
      this.communicationSystem = (gameOrComm && gameOrComm.communication) || null;
    } else if (gameOrComm && typeof gameOrComm.rng === 'object' && typeof gameOrComm.turn !== 'undefined') {
      this.communicationSystem = commOrKernel;
      this.kernel = gameOrComm;
      this.game = null;
    } else {
      this.communicationSystem = commOrKernel;
      this.kernel = null;
      this.game = null;
    }
    this.claims = new Map();
    this.reputations = new Map();
    this.observations = new Map();
    this.nextClaimId = 1;
    this.nextObservationId = 1;
  }

  makeClaim(claimer, subject, trait, value, evidence) {
    const claim = {
      id: this.nextClaimId++,
      claimer: claimer.id,
      subject: subject.id,
      trait: trait, // honest, skilled, brave, cruel, generous, etc.
      value: value, // -1 to 1
      evidence: evidence || null,
      timestamp: this.kernel?.turn ?? 0,
      credibility: this.assessClaimCredibility(claimer, evidence),
      propagated: 0,
      believers: [claimer.id]
    };
    
    this.claims.set(claim.id, claim);
    
    // Update claimer's view of subject
    this.updateReputation(claimer.id, subject.id, trait, value, claim.credibility);
    
    return {
      success: true,
      claim: claim
    };
  }

  assessClaimCredibility(claimer, evidence) {
    let credibility = 0.5; // Base
    
    // Claimer's own reputation affects credibility
    if (claimer.reputation) {
      credibility += claimer.reputation * 0.3;
    }
    
    // Evidence increases credibility
    if (evidence) {
      if (evidence.type === 'witnessed') {
        credibility += 0.3;
      } else if (evidence.type === 'documented') {
        credibility += 0.4;
      } else if (evidence.type === 'hearsay') {
        credibility += 0.1;
      }
    }
    
    return Math.min(1, credibility);
  }

  updateReputation(observerId, subjectId, trait, value, credibility) {
    const key = `${observerId}-${subjectId}`;
    
    if (!this.reputations.has(key)) {
      this.reputations.set(key, {
        observer: observerId,
        subject: subjectId,
        traits: new Map(),
        overall: 0
      });
    }
    
    const reputation = this.reputations.get(key);
    
    // Update trait
    const currentTrait = reputation.traits.get(trait) || { value: 0, confidence: 0 };
    
    // Weighted average based on credibility
    const totalWeight = currentTrait.confidence + credibility;
    const newValue = (currentTrait.value * currentTrait.confidence + value * credibility) / totalWeight;
    
    reputation.traits.set(trait, {
      value: newValue,
      confidence: Math.min(1, totalWeight)
    });
    
    // Recalculate overall reputation
    reputation.overall = this.calculateOverallReputation(reputation.traits);
  }

  calculateOverallReputation(traits) {
    if (traits.size === 0) return 0;
    
    let total = 0;
    let weight = 0;
    
    for (const [trait, data] of traits) {
      total += data.value * data.confidence;
      weight += data.confidence;
    }
    
    return weight > 0 ? total / weight : 0;
  }

  propagateClaim(claimId, from, to, context) {
    const claim = this.claims.get(claimId);
    if (!claim) {
      return { success: false, reason: 'Unknown claim' };
    }
    
    // Check if 'from' believes the claim
    if (!claim.believers.includes(from.id)) {
      return { success: false, reason: 'Propagator does not believe claim' };
    }
    
    // Calculate transmission fidelity
    const fidelity = this.calculateTransmissionFidelity(from, to, context);
    
    // Claim may be distorted in transmission
    const distortedValue = claim.value + (this.kernel.random() - 0.5) * (1 - fidelity) * 0.4;
    const distortedCredibility = claim.credibility * fidelity;
    
    // Receiver evaluates claim
    const acceptance = this.evaluateClaimAcceptance(to, claim, distortedCredibility);
    
    if (acceptance.accepted) {
      claim.believers.push(to.id);
      claim.propagated++;
      
      // Update receiver's view
      this.updateReputation(
        to.id,
        claim.subject,
        claim.trait,
        distortedValue,
        distortedCredibility
      );
      
      return {
        success: true,
        accepted: true,
        distortion: Math.abs(claim.value - distortedValue)
      };
    }
    
    return {
      success: true,
      accepted: false,
      reason: acceptance.reason
    };
  }

  calculateTransmissionFidelity(from, to, context) {
    let fidelity = 0.7; // Base
    
    // Relationship affects fidelity
    if (from.relationships && from.relationships.has(to.id)) {
      const relationship = from.relationships.get(to.id);
      fidelity += relationship.trust * 0.2;
    }
    
    // Communication skill affects fidelity
    const commSkill = from.skills?.social?.communication || 0.5;
    fidelity += commSkill * 0.1;
    
    // Context affects fidelity
    if (context === 'private') {
      fidelity += 0.1;
    } else if (context === 'public') {
      fidelity -= 0.1;
    }
    
    return Math.min(1, fidelity);
  }

  evaluateClaimAcceptance(receiver, claim, credibility) {
    // Receiver's prior beliefs
    const priorReputation = this.getReputation(receiver.id, claim.subject);
    
    // Confirmation bias
    if (priorReputation) {
      const priorTrait = priorReputation.traits.get(claim.trait);
      if (priorTrait) {
        const alignment = Math.abs(priorTrait.value - claim.value);
        if (alignment > 0.5) {
          // Contradicts prior belief
          credibility *= 0.5;
        }
      }
    }
    
    // Skepticism
    const skepticism = receiver.personality?.skepticism || 0.5;
    const threshold = 0.3 + skepticism * 0.4;
    
    if (credibility < threshold) {
      return {
        accepted: false,
        reason: 'Insufficient credibility'
      };
    }
    
    return { accepted: true };
  }

  observeDirectly(observer, subject, trait, context) {
    const observation = {
      id: this.nextObservationId++,
      observer: observer.id,
      subject: subject.id,
      trait: trait,
      context: context,
      timestamp: this.kernel?.turn ?? 0
    };
    
    this.observations.set(observation.id, observation);
    
    // Direct observation is highly credible
    const value = this.assessTraitFromObservation(subject, trait, context);
    const credibility = 0.9;
    
    this.updateReputation(observer.id, subject.id, trait, value, credibility);
    
    return {
      success: true,
      observation: observation,
      value: value
    };
  }

  assessTraitFromObservation(subject, trait, context) {
    // Simplified trait assessment
    // Would integrate with actual behavior tracking
    
    const traitValues = {
      honest: subject.honesty || 0.5,
      skilled: subject.skills?.average || 0.5,
      brave: subject.courage || 0.5,
      cruel: subject.cruelty || 0,
      generous: subject.generosity || 0.5
    };
    
    return (traitValues[trait] || 0.5) * 2 - 1; // Convert to -1 to 1
  }

  getReputation(observerId, subjectId) {
    const key = `${observerId}-${subjectId}`;
    return this.reputations.get(key);
  }

  getPublicReputation(subjectId, community) {
    // Aggregate reputation across community
    const reputations = [];
    
    for (const memberId of community) {
      const rep = this.getReputation(memberId, subjectId);
      if (rep) {
        reputations.push(rep.overall);
      }
    }
    
    if (reputations.length === 0) return 0;
    
    return reputations.reduce((sum, r) => sum + r, 0) / reputations.length;
  }

  getTraitReputation(observerId, subjectId, trait) {
    const reputation = this.getReputation(observerId, subjectId);
    if (!reputation) return null;
    
    return reputation.traits.get(trait);
  }

  compareReputations(subjectId, observer1Id, observer2Id) {
    const rep1 = this.getReputation(observer1Id, subjectId);
    const rep2 = this.getReputation(observer2Id, subjectId);
    
    if (!rep1 || !rep2) return null;
    
    const difference = Math.abs(rep1.overall - rep2.overall);
    
    return {
      observer1: rep1.overall,
      observer2: rep2.overall,
      difference: difference,
      agreement: 1 - difference
    };
  }

  getClaimsBySubject(subjectId) {
    return Array.from(this.claims.values())
      .filter(c => c.subject === subjectId);
  }

  getClaimsByClaimer(claimerId) {
    return Array.from(this.claims.values())
      .filter(c => c.claimer === claimerId);
  }

  getMostPropagatedClaims(limit = 10) {
    return Array.from(this.claims.values())
      .sort((a, b) => b.propagated - a.propagated)
      .slice(0, limit);
  }

  getReputationNetwork(subjectId) {
    const network = {
      subject: subjectId,
      observers: [],
      averageReputation: 0,
      variance: 0
    };
    
    const reputations = [];
    
    for (const [key, rep] of this.reputations) {
      if (rep.subject === subjectId) {
        network.observers.push({
          observer: rep.observer,
          reputation: rep.overall,
          confidence: this.calculateConfidence(rep.traits)
        });
        reputations.push(rep.overall);
      }
    }
    
    if (reputations.length > 0) {
      network.averageReputation = reputations.reduce((sum, r) => sum + r, 0) / reputations.length;
      
      const variance = reputations.reduce((sum, r) => sum + Math.pow(r - network.averageReputation, 2), 0) / reputations.length;
      network.variance = variance;
    }
    
    return network;
  }

  calculateConfidence(traits) {
    if (traits.size === 0) return 0;
    
    let totalConfidence = 0;
    for (const [trait, data] of traits) {
      totalConfidence += data.confidence;
    }
    
    return totalConfidence / traits.size;
  }

  getClaim(id) {
    return this.claims.get(id);
  }

  getObservation(id) {
    return this.observations.get(id);
  }

  toJSON() {
    return {
      claims: Array.from(this.claims.entries()),
      reputations: Array.from(this.reputations.entries()).map(([k, v]) => [k, {
        ...v,
        traits: Array.from(v.traits.entries())
      }]),
      observations: Array.from(this.observations.entries()),
      nextClaimId: this.nextClaimId,
      nextObservationId: this.nextObservationId
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.claims) this.claims = new Map(data.claims);
    if (data.reputations) {
      this.reputations = new Map(
        data.reputations.map(([k, v]) => [k, {
          ...v,
          traits: new Map(v.traits || [])
        }])
      );
    }
    if (data.observations) this.observations = new Map(data.observations);
    if (typeof data.nextClaimId === 'number') this.nextClaimId = data.nextClaimId;
    if (typeof data.nextObservationId === 'number') this.nextObservationId = data.nextObservationId;
  }
}

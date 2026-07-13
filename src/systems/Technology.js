/**
 * Technology.js
 * Technology prerequisites, discovery, adoption, diffusion
 * Models material requirements, knowledge dependencies, innovation
 */

export class Technology {
  constructor(knowledgeSystem, kernel, game) {
    this.knowledgeSystem = knowledgeSystem;
    this.kernel = kernel || game?.kernel || null;
    this.technologies = new Map();
    this.discoveries = new Map();
    this.adoptions = new Map();
    this.nextTechId = 1;
    this.nextDiscoveryId = 1;
  }

  defineTechnology(name, prerequisites, benefits) {
    const tech = {
      id: this.nextTechId++,
      name: name,
      prerequisites: prerequisites,
      benefits: benefits,
      discovered: false,
      discoveredBy: null,
      discoveryDate: null,
      adoptionRate: 0,
      complexity: this.calculateComplexity(prerequisites)
    };
    
    this.technologies.set(tech.id, tech);
    return tech;
  }

  calculateComplexity(prerequisites) {
    let complexity = 0;
    
    // Material complexity
    if (prerequisites.materials) {
      complexity += prerequisites.materials.length * 0.2;
    }
    
    // Knowledge complexity
    if (prerequisites.knowledge) {
      complexity += prerequisites.knowledge.length * 0.3;
    }
    
    // Tool complexity
    if (prerequisites.tools) {
      complexity += prerequisites.tools.length * 0.2;
    }
    
    // Skill complexity
    if (prerequisites.skills) {
      complexity += Object.keys(prerequisites.skills).length * 0.3;
    }
    
    return Math.min(1, complexity);
  }

  checkPrerequisites(person, techId, resources) {
    const tech = this.technologies.get(techId);
    if (!tech) {
      return { met: false, reason: 'Unknown technology' };
    }
    
    const prereqs = tech.prerequisites;
    const missing = [];
    
    // Check materials
    if (prereqs.materials) {
      for (const material of prereqs.materials) {
        if (!resources.materials || !resources.materials[material]) {
          missing.push(`material: ${material}`);
        }
      }
    }
    
    // Check knowledge
    if (prereqs.knowledge) {
      for (const knowledge of prereqs.knowledge) {
        const hasKnowledge = person.knowledge?.has(knowledge);
        if (!hasKnowledge) {
          missing.push(`knowledge: ${knowledge}`);
        }
      }
    }
    
    // Check tools
    if (prereqs.tools) {
      for (const tool of prereqs.tools) {
        if (!resources.tools || !resources.tools[tool]) {
          missing.push(`tool: ${tool}`);
        }
      }
    }
    
    // Check skills
    if (prereqs.skills) {
      for (const [category, skillReqs] of Object.entries(prereqs.skills)) {
        for (const [skill, level] of Object.entries(skillReqs)) {
          const personSkill = person.skills?.[category]?.[skill] || 0;
          if (personSkill < level) {
            missing.push(`skill: ${category}.${skill} (need ${level}, have ${personSkill})`);
          }
        }
      }
    }
    
    return {
      met: missing.length === 0,
      missing: missing
    };
  }

  attemptDiscovery(person, techId, resources, approach) {
    const tech = this.technologies.get(techId);
    if (!tech) {
      return { success: false, reason: 'Unknown technology' };
    }
    
    if (tech.discovered) {
      return { success: false, reason: 'Already discovered' };
    }
    
    // Check prerequisites
    const prereqCheck = this.checkPrerequisites(person, techId, resources);
    if (!prereqCheck.met) {
      return {
        success: false,
        reason: 'Prerequisites not met',
        missing: prereqCheck.missing
      };
    }
    
    // Calculate discovery chance
    const chance = this.calculateDiscoveryChance(person, tech, approach);
    
    if (this.kernel.random() > chance) {
      return {
        success: false,
        reason: 'Discovery attempt failed',
        chance: chance,
        canRetry: true
      };
    }
    
    // Success!
    tech.discovered = true;
    tech.discoveredBy = person.id;
    tech.discoveryDate = this.kernel?.turn ?? 0;
    
    const discovery = {
      id: this.nextDiscoveryId++,
      technology: techId,
      discoverer: person.id,
      date: this.kernel?.turn ?? 0,
      approach: approach,
      resources: resources
    };
    
    this.discoveries.set(discovery.id, discovery);
    
    // Add to person's knowledge
    if (!person.technologies) {
      person.technologies = new Set();
    }
    person.technologies.add(techId);
    
    return {
      success: true,
      discovery: discovery,
      technology: tech
    };
  }

  calculateDiscoveryChance(person, tech, approach) {
    let chance = 0.1; // Base 10%
    
    // Intelligence factor
    const intelligence = person.intelligence || 0.5;
    chance *= (1 + intelligence);
    
    // Relevant skills
    if (tech.prerequisites.skills) {
      let avgSkill = 0;
      let count = 0;
      
      for (const [category, skillReqs] of Object.entries(tech.prerequisites.skills)) {
        for (const [skill, level] of Object.entries(skillReqs)) {
          const personSkill = person.skills?.[category]?.[skill] || 0;
          avgSkill += personSkill;
          count++;
        }
      }
      
      if (count > 0) {
        chance *= (1 + avgSkill / count);
      }
    }
    
    // Approach affects chance
    const approachModifiers = {
      systematic: 1.5,
      trial_and_error: 1.0,
      intuitive: 0.8,
      accidental: 0.3
    };
    
    chance *= approachModifiers[approach] || 1.0;
    
    // Complexity penalty
    chance *= (1 - tech.complexity * 0.5);
    
    return Math.min(0.9, chance);
  }

  learn(person, techId, teacher, hours) {
    const tech = this.technologies.get(techId);
    if (!tech) {
      return { success: false, reason: 'Unknown technology' };
    }
    
    if (!tech.discovered) {
      return { success: false, reason: 'Technology not yet discovered' };
    }
    
    // Check if teacher knows it
    if (teacher && (!teacher.technologies || !teacher.technologies.has(techId))) {
      return { success: false, reason: 'Teacher does not know this technology' };
    }
    
    // Learning rate
    const intelligence = person.intelligence || 0.5;
    const teacherSkill = teacher?.skills?.social?.teaching || 0.5;
    const learningRate = 0.01 * intelligence * teacherSkill;
    
    // Progress toward learning
    if (!person.techProgress) {
      person.techProgress = new Map();
    }
    
    const currentProgress = person.techProgress.get(techId) || 0;
    const requiredHours = tech.complexity * 100;
    const newProgress = currentProgress + hours;
    
    person.techProgress.set(techId, newProgress);
    
    if (newProgress >= requiredHours) {
      // Learned!
      if (!person.technologies) {
        person.technologies = new Set();
      }
      person.technologies.add(techId);
      person.techProgress.delete(techId);
      
      return {
        success: true,
        learned: true,
        hoursSpent: newProgress
      };
    }
    
    return {
      success: true,
      learned: false,
      progress: newProgress / requiredHours,
      hoursRemaining: requiredHours - newProgress
    };
  }

  adopt(person, techId) {
    const tech = this.technologies.get(techId);
    if (!tech) {
      return { success: false, reason: 'Unknown technology' };
    }
    
    if (!tech.discovered) {
      return { success: false, reason: 'Technology not yet discovered' };
    }
    
    // Check if person knows it
    if (!person.technologies || !person.technologies.has(techId)) {
      return { success: false, reason: 'Person does not know this technology' };
    }
    
    // Check adoption barriers
    const barriers = this.checkAdoptionBarriers(person, tech);
    if (barriers.length > 0) {
      return {
        success: false,
        reason: 'Adoption barriers exist',
        barriers: barriers
      };
    }
    
    // Adopt
    if (!person.adoptedTechnologies) {
      person.adoptedTechnologies = new Set();
    }
    person.adoptedTechnologies.add(techId);
    
    // Track adoption
    const adoption = {
      person: person.id,
      technology: techId,
      date: this.kernel?.turn ?? 0
    };
    
    this.adoptions.set(`${person.id}-${techId}`, adoption);
    
    // Update adoption rate
    tech.adoptionRate = this.calculateAdoptionRate(techId);
    
    return {
      success: true,
      adoption: adoption,
      benefits: tech.benefits
    };
  }

  checkAdoptionBarriers(person, tech) {
    const barriers = [];
    
    // Economic barriers
    if (tech.benefits.cost && person.wealth < tech.benefits.cost) {
      barriers.push('insufficient_wealth');
    }
    
    // Social barriers
    if (tech.benefits.statusChange && tech.benefits.statusChange < 0) {
      barriers.push('social_stigma');
    }
    
    // Cultural barriers
    if (person.culture && tech.culturalConflict) {
      barriers.push('cultural_conflict');
    }
    
    // Infrastructure barriers
    if (tech.prerequisites.infrastructure && !person.hasInfrastructure) {
      barriers.push('infrastructure_required');
    }
    
    return barriers;
  }

  calculateAdoptionRate(techId) {
    const adoptionCount = Array.from(this.adoptions.values())
      .filter(a => a.technology === techId)
      .length;
    
    // Simplified - would need total population
    return Math.min(1, adoptionCount / 1000);
  }

  diffuse(kernel, techId, timeStep) {
    const tech = this.technologies.get(techId);
    if (!tech || !tech.discovered) return;
    
    // Technology diffuses through social networks
    const adopters = Array.from(this.adoptions.values())
      .filter(a => a.technology === techId)
      .map(a => a.person);
    
    for (const adopterId of adopters) {
      const adopter = kernel.entities.get(adopterId);
      if (!adopter) continue;
      
      // Find nearby people
      const nearby = kernel.queryEntitiesNear(
        adopter.position.x,
        adopter.position.y,
        adopter.position.z,
        100
      );
      
      for (const entityId of nearby) {
        const entity = kernel.entities.get(entityId);
        if (!entity || !entity.person) continue;
        
        // Check if already knows
        if (entity.technologies?.has(techId)) continue;
        
        // Chance to learn through observation
        const observationChance = 0.01 * timeStep;
        if (this.kernel.random() < observationChance) {
          this.learn(entity, techId, adopter, 10);
        }
      }
    }
  }

  getTechnology(id) {
    return this.technologies.get(id);
  }

  getDiscovery(id) {
    return this.discoveries.get(id);
  }

  getDiscoveredTechnologies() {
    return Array.from(this.technologies.values()).filter(t => t.discovered);
  }

  getTechnologiesKnownBy(personId) {
    const person = { id: personId, technologies: new Set() };
    return Array.from(person.technologies || [])
      .map(id => this.technologies.get(id))
      .filter(t => t);
  }

  getTechnologiesAdoptedBy(personId) {
    return Array.from(this.adoptions.values())
      .filter(a => a.person === personId)
      .map(a => this.technologies.get(a.technology))
      .filter(t => t);
  }

  getAdoptionRate(techId) {
    const tech = this.technologies.get(techId);
    return tech?.adoptionRate || 0;
  }
}

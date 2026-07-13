/**
 * Knowledge.js
 * Observations, hypotheses, experiments, measurements, discovery
 * Models scientific method, evidence accumulation, reproducibility
 */

export class Knowledge {
  constructor(kernel, game) {
    this.kernel = kernel || game?.kernel || null;
    this.observations = new Map();
    this.hypotheses = new Map();
    this.experiments = new Map();
    this.theories = new Map();
    this.measurements = new Map();
    this.nextObservationId = 1;
    this.nextHypothesisId = 1;
    this.nextExperimentId = 1;
    this.nextTheoryId = 1;
  }

  observe(observer, phenomenon, context) {
    // Check observer's perception and attention
    if (!observer.perception) {
      return { success: false, reason: 'Cannot observe without perception' };
    }
    
    // Observation quality depends on skill and tools
    const observationSkill = observer.skills?.knowledge?.observation || 0.3;
    const toolQuality = context.tools ? this.calculateToolQuality(context.tools) : 0.5;
    
    const quality = observationSkill * toolQuality;
    
    const observation = {
      id: this.nextObservationId++,
      observer: observer.id,
      phenomenon: phenomenon,
      context: context,
      timestamp: this.kernel?.turn ?? 0,
      quality: quality,
      measurements: [],
      notes: '',
      confidence: this.calculateConfidence(quality, context),
      reproducible: false,
      reproductionCount: 0
    };
    
    this.observations.set(observation.id, observation);
    
    // Add to observer's knowledge
    if (!observer.knowledge) {
      observer.knowledge = new Map();
    }
    observer.knowledge.set(phenomenon, observation);
    
    return {
      success: true,
      observation: observation,
      quality: quality
    };
  }

  calculateToolQuality(tools) {
    let quality = 0.5;
    
    if (tools.includes('magnifying_glass')) quality += 0.2;
    if (tools.includes('telescope')) quality += 0.3;
    if (tools.includes('microscope')) quality += 0.4;
    if (tools.includes('measuring_device')) quality += 0.2;
    if (tools.includes('thermometer')) quality += 0.2;
    
    return Math.min(1, quality);
  }

  calculateConfidence(quality, context) {
    let confidence = quality;
    
    // Multiple observations increase confidence
    if (context.repetitions) {
      confidence *= (1 + Math.log(context.repetitions) * 0.1);
    }
    
    // Controlled conditions increase confidence
    if (context.controlled) {
      confidence *= 1.2;
    }
    
    return Math.min(1, confidence);
  }

  measure(observer, property, subject, tool) {
    const skill = observer.skills?.knowledge?.measurement || 0.3;
    const toolPrecision = this.getToolPrecision(tool);
    
    // Actual value (hidden from observer in naturalistic mode)
    const actualValue = this.getActualValue(property, subject);
    
    // Measurement error
    const error = (1 - skill * toolPrecision) * actualValue * 0.1;
    const measuredValue = actualValue + (this.kernel.random() - 0.5) * error * 2;
    
    const measurement = {
      property: property,
      subject: subject,
      value: measuredValue,
      unit: this.getUnit(property),
      tool: tool,
      precision: toolPrecision,
      error: error,
      timestamp: this.kernel?.turn ?? 0,
      observer: observer.id
    };
    
    this.measurements.set(`${property}-${subject}`, measurement);
    
    return {
      success: true,
      measurement: measurement,
      displayValue: this.formatMeasurement(measuredValue, this.getUnit(property), toolPrecision)
    };
  }

  getToolPrecision(tool) {
    const precisions = {
      none: 0.1,
      ruler: 0.5,
      balance: 0.7,
      thermometer: 0.6,
      clock: 0.8,
      telescope: 0.7,
      microscope: 0.8
    };
    
    return precisions[tool] || 0.3;
  }

  getActualValue(property, subject) {
    // Simplified - would integrate with actual world state
    const values = {
      temperature: 20,
      mass: 1,
      length: 1,
      time: 60,
      distance: 100
    };
    
    return values[property] || 1;
  }

  getUnit(property) {
    const units = {
      temperature: '°C',
      mass: 'kg',
      length: 'm',
      time: 's',
      distance: 'm',
      volume: 'L'
    };
    
    return units[property] || 'units';
  }

  formatMeasurement(value, unit, precision) {
    const decimals = Math.max(0, Math.ceil(-Math.log10(precision)));
    return `${value.toFixed(decimals)} ${unit}`;
  }

  formHypothesis(researcher, observations, proposition) {
    // Check if researcher has sufficient observations
    if (observations.length < 2) {
      return { success: false, reason: 'Need multiple observations' };
    }
    
    // Check researcher's reasoning skill
    const reasoning = researcher.skills?.knowledge?.reasoning || 0.3;
    
    const hypothesis = {
      id: this.nextHypothesisId++,
      researcher: researcher.id,
      proposition: proposition,
      observations: observations.map(o => o.id),
      timestamp: this.kernel?.turn ?? 0,
      confidence: reasoning * 0.5, // Initial confidence low
      tested: false,
      experiments: [],
      support: 0,
      refutation: 0
    };
    
    this.hypotheses.set(hypothesis.id, hypothesis);
    
    return {
      success: true,
      hypothesis: hypothesis
    };
  }

  designExperiment(researcher, hypothesisId, design) {
    const hypothesis = this.hypotheses.get(hypothesisId);
    if (!hypothesis) {
      return { success: false, reason: 'Unknown hypothesis' };
    }
    
    // Check researcher's experimental design skill
    const designSkill = researcher.skills?.knowledge?.experimentalDesign || 0.2;
    
    // Validate experiment design
    const validation = this.validateExperimentDesign(design);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }
    
    const experiment = {
      id: this.nextExperimentId++,
      researcher: researcher.id,
      hypothesis: hypothesisId,
      design: design,
      timestamp: this.kernel?.turn ?? 0,
      quality: designSkill * validation.quality,
      status: 'designed',
      results: null,
      reproducible: false,
      reproductions: []
    };
    
    this.experiments.set(experiment.id, experiment);
    hypothesis.experiments.push(experiment.id);
    
    return {
      success: true,
      experiment: experiment
    };
  }

  validateExperimentDesign(design) {
    let quality = 0.5;
    const issues = [];
    
    // Check for control group
    if (!design.control) {
      issues.push('No control group');
      quality *= 0.7;
    }
    
    // Check for variables
    if (!design.independent || !design.dependent) {
      issues.push('Variables not defined');
      quality *= 0.6;
    }
    
    // Check for sample size
    if (!design.sampleSize || design.sampleSize < 3) {
      issues.push('Sample size too small');
      quality *= 0.8;
    }
    
    // Check for randomization
    if (design.randomized) {
      quality *= 1.2;
    }
    
    // Check for blinding
    if (design.blinded) {
      quality *= 1.1;
    }
    
    return {
      valid: issues.length === 0,
      quality: Math.min(1, quality),
      issues: issues
    };
  }

  conductExperiment(researcher, experimentId, resources) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return { success: false, reason: 'Unknown experiment' };
    }
    
    if (experiment.status !== 'designed') {
      return { success: false, reason: 'Experiment already conducted' };
    }
    
    // Check resources
    const resourceCheck = this.checkResources(experiment.design, resources);
    if (!resourceCheck.sufficient) {
      return { success: false, reason: resourceCheck.reason };
    }
    
    // Check skill
    const skill = researcher.skills?.knowledge?.experimentation || 0.3;
    
    // Conduct experiment (simplified)
    const hypothesis = this.hypotheses.get(experiment.hypothesis);
    const actualOutcome = this.simulateExperiment(experiment.design, hypothesis);
    
    // Add measurement error
    const error = (1 - skill * experiment.quality) * 0.2;
    const observedOutcome = actualOutcome + (this.kernel.random() - 0.5) * error * 2;
    
    experiment.results = {
      outcome: observedOutcome,
      error: error,
      timestamp: this.kernel?.turn ?? 0,
      conditions: experiment.design,
      data: this.generateExperimentalData(experiment.design, observedOutcome)
    };
    
    experiment.status = 'completed';
    
    // Update hypothesis
    if (Math.abs(observedOutcome - hypothesis.prediction) < error) {
      hypothesis.support++;
      hypothesis.confidence = Math.min(1, hypothesis.confidence + 0.1);
    } else {
      hypothesis.refutation++;
      hypothesis.confidence = Math.max(0, hypothesis.confidence - 0.2);
    }
    
    return {
      success: true,
      results: experiment.results,
      supportsHypothesis: hypothesis.support > hypothesis.refutation
    };
  }

  checkResources(design, resources) {
    const required = design.resources || [];
    
    for (const resource of required) {
      if (!resources[resource.type] || resources[resource.type] < resource.amount) {
        return {
          sufficient: false,
          reason: `Insufficient ${resource.type}`
        };
      }
    }
    
    return { sufficient: true };
  }

  simulateExperiment(design, hypothesis) {
    // Simplified simulation - would integrate with actual world physics
    // Returns whether hypothesis is supported (0-1)
    return this.kernel.random() > 0.5 ? 0.8 : 0.2;
  }

  generateExperimentalData(design, outcome) {
    const data = [];
    const sampleSize = design.sampleSize || 10;
    
    for (let i = 0; i < sampleSize; i++) {
      data.push({
        trial: i + 1,
        value: outcome + (this.kernel.random() - 0.5) * 0.1,
        conditions: design.independent
      });
    }
    
    return data;
  }

  reproduceExperiment(researcher, experimentId) {
    const original = this.experiments.get(experimentId);
    if (!original) {
      return { success: false, reason: 'Unknown experiment' };
    }
    
    if (original.status !== 'completed') {
      return { success: false, reason: 'Original experiment not completed' };
    }
    
    // Attempt reproduction
    const skill = researcher.skills?.knowledge?.experimentation || 0.3;
    const fidelity = skill * original.quality;
    
    // Reproduction succeeds if similar results
    const reproductionOutcome = original.results.outcome + (this.kernel.random() - 0.5) * 0.2;
    const similar = Math.abs(reproductionOutcome - original.results.outcome) < 0.15;
    
    if (similar) {
      original.reproducible = true;
      original.reproductions.push({
        researcher: researcher.id,
        timestamp: this.kernel?.turn ?? 0,
        outcome: reproductionOutcome
      });
    }
    
    return {
      success: true,
      reproducible: similar,
      outcome: reproductionOutcome,
      original: original.results.outcome
    };
  }

  formTheory(researcher, hypotheses, name) {
    // Check if hypotheses are well-supported
    const wellSupported = hypotheses.every(h => {
      const hyp = this.hypotheses.get(h);
      return hyp && hyp.confidence > 0.7 && hyp.support > hyp.refutation;
    });
    
    if (!wellSupported) {
      return { success: false, reason: 'Hypotheses not well-supported' };
    }
    
    const theory = {
      id: this.nextTheoryId++,
      name: name,
      researcher: researcher.id,
      hypotheses: hypotheses,
      timestamp: this.kernel?.turn ?? 0,
      confidence: this.calculateTheoryConfidence(hypotheses),
      predictions: [],
      applications: [],
      accepted: false,
      citations: 0
    };
    
    this.theories.set(theory.id, theory);
    
    return {
      success: true,
      theory: theory
    };
  }

  calculateTheoryConfidence(hypotheses) {
    let totalConfidence = 0;
    let count = 0;
    
    for (const hId of hypotheses) {
      const h = this.hypotheses.get(hId);
      if (h) {
        totalConfidence += h.confidence;
        count++;
      }
    }
    
    return count > 0 ? totalConfidence / count : 0;
  }

  shareKnowledge(from, to, knowledgeId, type = 'observation') {
    let knowledge;
    
    switch (type) {
      case 'observation':
        knowledge = this.observations.get(knowledgeId);
        break;
      case 'hypothesis':
        knowledge = this.hypotheses.get(knowledgeId);
        break;
      case 'experiment':
        knowledge = this.experiments.get(knowledgeId);
        break;
      case 'theory':
        knowledge = this.theories.get(knowledgeId);
        break;
      default:
        return { success: false, reason: 'Unknown knowledge type' };
    }
    
    if (!knowledge) {
      return { success: false, reason: 'Knowledge not found' };
    }
    
    // Check if can communicate
    if (!from.languages || !to.languages) {
      return { success: false, reason: 'Cannot communicate' };
    }
    
    // Transfer knowledge
    if (!to.knowledge) {
      to.knowledge = new Map();
    }
    
    to.knowledge.set(knowledgeId, {
      ...knowledge,
      source: from.id,
      received: this.kernel?.turn ?? 0
    });
    
    return {
      success: true,
      transferred: type
    };
  }

  getObservation(id) {
    return this.observations.get(id);
  }

  getHypothesis(id) {
    return this.hypotheses.get(id);
  }

  getExperiment(id) {
    return this.experiments.get(id);
  }

  getTheory(id) {
    return this.theories.get(id);
  }

  getKnowledgeByPerson(personId) {
    return {
      observations: Array.from(this.observations.values()).filter(o => o.observer === personId),
      hypotheses: Array.from(this.hypotheses.values()).filter(h => h.researcher === personId),
      experiments: Array.from(this.experiments.values()).filter(e => e.researcher === personId),
      theories: Array.from(this.theories.values()).filter(t => t.researcher === personId)
    };
  }
}

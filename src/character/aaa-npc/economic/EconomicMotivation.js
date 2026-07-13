/**
 * EconomicMotivation.js
 * 
 * Implements economic motivation and decision-making for NPCs.
 * Features:
 * - Wealth desire and accumulation
 * - Career progression and aspirations
 * - Economic goal setting (short, medium, long-term)
 * - Risk tolerance and opportunity evaluation
 * - Investment and savings behavior
 * 
 * @module EconomicMotivation
 */

export class EconomicMotivation {
  constructor(personality = {}, initialWealth = 0, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    // Core economic drives (0-1 scale)
    this.wealthDesire = personality.ambition * 0.7 + personality.conscientiousness * 0.3;
    this.statusDesire = personality.ambition * 0.8 + personality.extraversion * 0.2;
    this.securityDesire = personality.neuroticism * 0.6 + personality.conscientiousness * 0.4;
    
    // Current economic state
    this.wealth = {
      liquid: initialWealth,           // Cash on hand
      assets: 0,                       // Property, goods value
      income: 0,                       // Regular income per month
      expenses: 0,                     // Regular expenses per month
      debt: 0,                         // Outstanding debts
      savings: 0,                      // Saved wealth
      investmentValue: 0               // Value of investments
    };
    
    // Career progression
    this.career = {
      occupation: 'peasant',
      experience: 0,
      reputation: 0.5,
      advancement: 0,                  // Progress toward next level (0-1)
      aspirations: [],                 // Desired occupations
      skillRequirements: new Map(),    // Skills needed for advancement
      satisfactionLevel: 0.5           // Job satisfaction (0-1)
    };
    
    // Economic goals
    this.goals = {
      shortTerm: [],    // Immediate needs (< 1 month)
      mediumTerm: [],   // Career advancement, savings (1-12 months)
      longTerm: []      // Wealth accumulation, legacy (> 1 year)
    };
    
    // Risk tolerance (0-1)
    this.riskTolerance = 1 - personality.neuroticism;
    
    // Economic personality traits
    this.traits = {
      frugality: personality.conscientiousness || 0.5,
      generosity: personality.agreeableness || 0.5,
      entrepreneurship: personality.openness * 0.6 + personality.ambition * 0.4,
      patience: personality.conscientiousness || 0.5
    };
    
    // Economic history
    this.transactions = [];
    this.opportunities = [];
    this.investments = [];
    
    // Wealth satisfaction threshold
    this.wealthSatisfactionThreshold = this.calculateWealthThreshold();
  }
  
  /**
   * Calculate wealth satisfaction threshold based on desires
   * @returns {number} Wealth threshold
   */
  calculateWealthThreshold() {
    const baseThreshold = 1000;
    const desireMultiplier = 1 + this.wealthDesire * 2;
    const statusMultiplier = 1 + this.statusDesire;
    
    return baseThreshold * desireMultiplier * statusMultiplier;
  }
  
  /**
   * Evaluate an economic opportunity
   * @param {Object} opportunity - Opportunity details
   * @returns {Object} Evaluation results
   */
  evaluateOpportunity(opportunity) {
    const {
      type,
      reward = 0,
      cost = 0,
      successChance = 0.5,
      timeRequired = 0,
      riskLevel = 0.5,
      statusGain = 0,
      skillRequirements = {}
    } = opportunity;
    
    // Calculate expected value
    const expectedValue = reward * successChance;
    const risk = cost * (1 - successChance);
    const riskAdjusted = expectedValue - (risk * (1 - this.riskTolerance));
    
    // Factor in goal alignment
    const goalAlignment = this.calculateGoalAlignment(opportunity);
    
    // Factor in status gain
    const statusValue = statusGain * this.statusDesire * 100;
    
    // Time value consideration
    const timeValue = timeRequired > 0 ? 1 / (1 + timeRequired * 0.01) : 1;
    
    // Skill match
    const skillMatch = this.calculateSkillMatch(skillRequirements);
    
    // Overall score
    const score = (
      riskAdjusted * 0.4 +
      goalAlignment * 0.3 +
      statusValue * 0.2 +
      skillMatch * 0.1
    ) * timeValue;
    
    return {
      score,
      expectedValue,
      risk,
      riskAdjusted,
      goalAlignment,
      statusValue,
      skillMatch,
      recommendation: score > 0 ? 'accept' : 'reject'
    };
  }
  
  /**
   * Calculate how well opportunity aligns with goals
   * @param {Object} opportunity - Opportunity details
   * @returns {number} Alignment score (0-1)
   */
  calculateGoalAlignment(opportunity) {
    let alignment = 0;
    let goalCount = 0;
    
    // Check short-term goals
    for (const goal of this.goals.shortTerm) {
      if (this.opportunityHelpsGoal(opportunity, goal)) {
        alignment += 1.0;
      }
      goalCount++;
    }
    
    // Check medium-term goals
    for (const goal of this.goals.mediumTerm) {
      if (this.opportunityHelpsGoal(opportunity, goal)) {
        alignment += 0.7;
      }
      goalCount++;
    }
    
    // Check long-term goals
    for (const goal of this.goals.longTerm) {
      if (this.opportunityHelpsGoal(opportunity, goal)) {
        alignment += 0.5;
      }
      goalCount++;
    }
    
    return goalCount > 0 ? alignment / goalCount : 0.5;
  }
  
  /**
   * Check if opportunity helps achieve a goal
   * @param {Object} opportunity - Opportunity details
   * @param {Object} goal - Goal details
   * @returns {boolean} True if helps
   */
  opportunityHelpsGoal(opportunity, goal) {
    if (goal.type === 'wealth' && opportunity.reward > 0) return true;
    if (goal.type === 'career' && opportunity.careerAdvancement) return true;
    if (goal.type === 'status' && opportunity.statusGain > 0) return true;
    if (goal.type === 'skill' && opportunity.skillGain) return true;
    
    return false;
  }
  
  /**
   * Calculate skill match for opportunity
   * @param {Object} requirements - Skill requirements
   * @returns {number} Match score (0-1)
   */
  calculateSkillMatch(requirements) {
    if (Object.keys(requirements).length === 0) return 1.0;
    
    // This would integrate with procedural memory skills
    // For now, return moderate match
    return 0.6;
  }
  
  /**
   * Plan career path
   * @param {Array} availableOccupations - Available occupations
   * @returns {Object} Career plan
   */
  planCareerPath(availableOccupations = []) {
    const currentOccupation = this.career.occupation;
    const possiblePaths = this.getCareerPaths(currentOccupation, availableOccupations);
    
    // Score each path
    const scoredPaths = possiblePaths.map(path => ({
      path,
      score: this.scoreCareerPath(path)
    }));
    
    // Select best path
    scoredPaths.sort((a, b) => b.score - a.score);
    
    if (scoredPaths.length > 0) {
      const bestPath = scoredPaths[0].path;
      this.career.aspirations = [bestPath.target];
      
      return {
        currentOccupation,
        targetOccupation: bestPath.target,
        steps: bestPath.steps,
        estimatedTime: bestPath.estimatedTime,
        score: scoredPaths[0].score
      };
    }
    
    return null;
  }
  
  /**
   * Get possible career paths from current occupation
   * @param {string} current - Current occupation
   * @param {Array} available - Available occupations
   * @returns {Array} Possible paths
   */
  getCareerPaths(current, available) {
    // Simplified career progression tree
    const progressionTree = {
      peasant: ['craftsman', 'merchant', 'soldier'],
      craftsman: ['master_craftsman', 'merchant', 'guild_master'],
      merchant: ['wealthy_merchant', 'guild_master'],
      soldier: ['veteran', 'officer', 'knight'],
      priest: ['bishop', 'abbot']
    };
    
    const nextOccupations = progressionTree[current] || [];
    
    return nextOccupations
      .filter(occ => !available.length || available.includes(occ))
      .map(target => ({
        target,
        steps: this.calculateCareerSteps(current, target),
        estimatedTime: this.estimateCareerTime(current, target),
        incomeIncrease: this.estimateIncomeIncrease(current, target),
        statusIncrease: this.estimateStatusIncrease(current, target),
        jobSecurity: this.estimateJobSecurity(target),
        difficulty: this.estimateCareerDifficulty(current, target)
      }));
  }
  
  /**
   * Score a career path
   * @param {Object} path - Career path
   * @returns {number} Score
   */
  scoreCareerPath(path) {
    let score = 0;
    
    // Wealth potential
    score += path.incomeIncrease * this.wealthDesire * 10;
    
    // Status gain
    score += path.statusIncrease * this.statusDesire * 8;
    
    // Security
    score += path.jobSecurity * this.securityDesire * 6;
    
    // Difficulty penalty
    score -= path.difficulty * (1 - this.career.experience / 100);
    
    // Time penalty (impatience)
    score -= path.estimatedTime * (1 - this.traits.patience) * 0.1;
    
    return score;
  }
  
  /**
   * Calculate steps needed for career transition
   * @param {string} from - Current occupation
   * @param {string} to - Target occupation
   * @returns {Array} Steps
   */
  calculateCareerSteps(from, to) {
    return [
      { type: 'gain_experience', amount: 100 },
      { type: 'build_reputation', amount: 0.7 },
      { type: 'acquire_skills', skills: ['relevant_skill'] }
    ];
  }
  
  /**
   * Estimate time for career transition
   * @param {string} from - Current occupation
   * @param {string} to - Target occupation
   * @returns {number} Time in months
   */
  estimateCareerTime(from, to) {
    const baseTimes = {
      peasant: { craftsman: 12, merchant: 18, soldier: 6 },
      craftsman: { master_craftsman: 24, merchant: 12, guild_master: 36 }
    };
    
    return baseTimes[from]?.[to] || 12;
  }
  
  /**
   * Estimate income increase
   * @param {string} from - Current occupation
   * @param {string} to - Target occupation
   * @returns {number} Income multiplier
   */
  estimateIncomeIncrease(from, to) {
    const incomeMultipliers = {
      peasant: 1,
      craftsman: 2,
      merchant: 3,
      master_craftsman: 4,
      wealthy_merchant: 6,
      knight: 5,
      guild_master: 7
    };
    
    const fromIncome = incomeMultipliers[from] || 1;
    const toIncome = incomeMultipliers[to] || 1;
    
    return (toIncome - fromIncome) / fromIncome;
  }
  
  /**
   * Estimate status increase
   * @param {string} from - Current occupation
   * @param {string} to - Target occupation
   * @returns {number} Status increase (0-1)
   */
  estimateStatusIncrease(from, to) {
    const statusLevels = {
      peasant: 0.1,
      craftsman: 0.3,
      merchant: 0.4,
      soldier: 0.3,
      master_craftsman: 0.5,
      wealthy_merchant: 0.7,
      knight: 0.8,
      guild_master: 0.9
    };
    
    return (statusLevels[to] || 0.5) - (statusLevels[from] || 0.5);
  }
  
  /**
   * Estimate job security
   * @param {string} occupation - Occupation
   * @returns {number} Security (0-1)
   */
  estimateJobSecurity(occupation) {
    const security = {
      peasant: 0.7,
      craftsman: 0.6,
      merchant: 0.5,
      soldier: 0.4,
      priest: 0.8,
      guild_master: 0.9
    };
    
    return security[occupation] || 0.5;
  }
  
  /**
   * Estimate career difficulty
   * @param {string} from - Current occupation
   * @param {string} to - Target occupation
   * @returns {number} Difficulty (0-1)
   */
  estimateCareerDifficulty(from, to) {
    // Larger jumps are harder
    const fromLevel = this.getOccupationLevel(from);
    const toLevel = this.getOccupationLevel(to);
    
    return Math.min(1.0, (toLevel - fromLevel) * 0.2);
  }
  
  /**
   * Get occupation level
   * @param {string} occupation - Occupation
   * @returns {number} Level
   */
  getOccupationLevel(occupation) {
    const levels = {
      peasant: 1,
      craftsman: 2,
      merchant: 2,
      soldier: 2,
      master_craftsman: 3,
      wealthy_merchant: 4,
      knight: 4,
      guild_master: 5
    };
    
    return levels[occupation] || 1;
  }
  
  /**
   * Set economic goals
   * @param {Object} context - Current context
   */
  setGoals(context = {}) {
    this.goals.shortTerm = [];
    this.goals.mediumTerm = [];
    this.goals.longTerm = [];
    
    // Short-term: immediate needs
    if (this.wealth.liquid < this.wealth.expenses * 2) {
      this.goals.shortTerm.push({
        type: 'wealth',
        target: this.wealth.expenses * 2,
        priority: 10,
        reason: 'emergency_fund'
      });
    }
    
    if (this.wealth.debt > 0) {
      this.goals.shortTerm.push({
        type: 'debt',
        target: 0,
        priority: 9,
        reason: 'debt_repayment'
      });
    }
    
    // Medium-term: career and savings
    if (this.career.satisfactionLevel < 0.6) {
      this.goals.mediumTerm.push({
        type: 'career',
        target: 'advancement',
        priority: 7,
        reason: 'career_growth'
      });
    }
    
    if (this.wealth.savings < this.wealthSatisfactionThreshold * 0.5) {
      this.goals.mediumTerm.push({
        type: 'wealth',
        target: this.wealthSatisfactionThreshold * 0.5,
        priority: 6,
        reason: 'savings'
      });
    }
    
    // Long-term: wealth accumulation and legacy
    if (this.wealthDesire > 0.6) {
      this.goals.longTerm.push({
        type: 'wealth',
        target: this.wealthSatisfactionThreshold,
        priority: 5,
        reason: 'wealth_accumulation'
      });
    }
    
    if (this.statusDesire > 0.7) {
      this.goals.longTerm.push({
        type: 'status',
        target: 'high_status_occupation',
        priority: 5,
        reason: 'status_seeking'
      });
    }
    
    // Sort by priority
    this.goals.shortTerm.sort((a, b) => b.priority - a.priority);
    this.goals.mediumTerm.sort((a, b) => b.priority - a.priority);
    this.goals.longTerm.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Make spending decision
   * @param {Object} purchase - Purchase details
   * @returns {Object} Decision
   */
  makeSpendingDecision(purchase) {
    const { cost, necessity = 0.5, luxury = 0, investment = false } = purchase;
    
    // Can afford?
    if (this.wealth.liquid < cost) {
      return { decision: 'reject', reason: 'insufficient_funds' };
    }
    
    // Necessity check
    if (necessity > 0.8) {
      return { decision: 'accept', reason: 'necessity' };
    }
    
    // Frugality check for luxury
    if (luxury > 0.5 && this.traits.frugality > 0.7) {
      return { decision: 'reject', reason: 'frugality' };
    }
    
    // Investment check
    if (investment && this.traits.entrepreneurship > 0.6) {
      return { decision: 'accept', reason: 'investment' };
    }
    
    // Affordability check (don't spend more than 10% of liquid wealth)
    const affordabilityThreshold = this.wealth.liquid * 0.1;
    if (cost > affordabilityThreshold) {
      return { decision: 'reject', reason: 'too_expensive' };
    }
    
    // Default: accept if reasonable
    return { decision: 'accept', reason: 'affordable' };
  }
  
  /**
   * Record transaction
   * @param {Object} transaction - Transaction details
   */
  recordTransaction(transaction) {
    const { type, amount, category, timestamp = (this.kernel?.turn || 0) } = transaction;
    
    this.transactions.push({
      type,
      amount,
      category,
      timestamp
    });
    
    // Update wealth
    if (type === 'income') {
      this.wealth.liquid += amount;
    } else if (type === 'expense') {
      this.wealth.liquid -= amount;
    }
    
    // Prune old transactions
    if (this.transactions.length > 100) {
      this.transactions = this.transactions.slice(-100);
    }
  }
  
  /**
   * Update economic state
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    // Update career advancement
    if (this.career.experience > 0) {
      this.career.advancement += 0.001 * deltaTime;
      if (this.career.advancement >= 1.0) {
        this.career.advancement = 0;
        // Trigger career advancement
      }
    }
    
    // Periodic goal review (every game day)
    const daysPassed = deltaTime / (24 * 60);
    if (daysPassed >= 1) {
      this.setGoals();
    }
  }
  
  /**
   * Get economic summary
   * @returns {Object} Summary
   */
  getSummary() {
    const totalWealth = this.wealth.liquid + this.wealth.assets + this.wealth.savings + this.wealth.investmentValue;
    const netWorth = totalWealth - this.wealth.debt;
    
    return {
      netWorth,
      totalWealth,
      liquid: this.wealth.liquid,
      monthlyIncome: this.wealth.income,
      monthlyExpenses: this.wealth.expenses,
      savings: this.wealth.savings,
      debt: this.wealth.debt,
      career: this.career.occupation,
      careerSatisfaction: this.career.satisfactionLevel,
      wealthSatisfied: netWorth >= this.wealthSatisfactionThreshold,
      activeGoals: {
        shortTerm: this.goals.shortTerm.length,
        mediumTerm: this.goals.mediumTerm.length,
        longTerm: this.goals.longTerm.length
      }
    };
  }
  
  /**
   * Serialize economic motivation
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      wealthDesire: this.wealthDesire,
      statusDesire: this.statusDesire,
      securityDesire: this.securityDesire,
      wealth: this.wealth,
      career: this.career,
      goals: this.goals,
      riskTolerance: this.riskTolerance,
      traits: this.traits,
      transactions: this.transactions.slice(-50),
      wealthSatisfactionThreshold: this.wealthSatisfactionThreshold
    };
  }
  
  /**
   * Deserialize economic motivation
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.wealthDesire = data.wealthDesire || 0.5;
    this.statusDesire = data.statusDesire || 0.5;
    this.securityDesire = data.securityDesire || 0.5;
    this.wealth = data.wealth || {};
    this.career = data.career || {};
    this.goals = data.goals || { shortTerm: [], mediumTerm: [], longTerm: [] };
    this.riskTolerance = data.riskTolerance || 0.5;
    this.traits = data.traits || {};
    this.transactions = data.transactions || [];
    this.wealthSatisfactionThreshold = data.wealthSatisfactionThreshold || 1000;
  }
}

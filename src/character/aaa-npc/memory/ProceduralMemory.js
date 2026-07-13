/**
 * ProceduralMemory.js
 * 
 * Implements procedural memory for skills, habits, and learned behaviors.
 * Features:
 * - Skill acquisition and improvement through practice
 * - Habit formation and automaticity
 * - Muscle memory simulation
 * - Skill decay without practice
 * - Transfer learning between related skills
 * 
 * @module ProceduralMemory
 */

export class ProceduralMemory {
  constructor(kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    // Skills: learned abilities that improve with practice
    this.skills = new Map();
    
    // Habits: automatic behaviors triggered by context
    this.habits = new Map();
    
    // Procedures: step-by-step knowledge of how to do things
    this.procedures = new Map();
    
    // Muscle memory: physical skill automaticity
    this.muscleMemory = new Map();
    
    // Learning rates
    this.learningRate = 0.01;
    this.decayRate = 0.001;
    
    // Automaticity threshold
    this.automaticityThreshold = 0.8;
  }
  
  /**
   * Practice a skill
   * @param {string} skill - Skill name
   * @param {string} category - Skill category
   * @param {number} quality - Practice quality (0-1)
   * @param {number} duration - Practice duration in minutes
   * @returns {Object} Practice results
   */
  practice(skill, category, quality = 0.7, duration = 60) {
    if (!this.skills.has(skill)) {
      this.skills.set(skill, {
        name: skill,
        category,
        level: 0.0,
        experience: 0,
        lastPracticed: (this.kernel?.turn || 0),
        practiceCount: 0,
        automaticity: 0.0,
        plateauLevel: 0.0
      });
    }
    
    const skillData = this.skills.get(skill);
    
    // Calculate learning based on current level (diminishing returns)
    const learningCurve = 1 - skillData.level;
    const effectiveLearning = this.learningRate * quality * learningCurve * duration;
    
    // Update skill level
    const oldLevel = skillData.level;
    skillData.level = Math.min(1.0, skillData.level + effectiveLearning);
    skillData.experience += duration;
    skillData.lastPracticed = (this.kernel?.turn || 0);
    skillData.practiceCount++;
    
    // Update automaticity (how automatic the skill becomes)
    if (skillData.level > 0.5) {
      const automaticityGain = 0.001 * duration * quality;
      skillData.automaticity = Math.min(1.0, skillData.automaticity + automaticityGain);
    }
    
    // Check for plateau
    if (skillData.level - oldLevel < 0.001 && skillData.level > 0.7) {
      skillData.plateauLevel = skillData.level;
    }
    
    // Transfer learning to related skills
    this.transferLearning(skill, category, effectiveLearning * 0.2);
    
    return {
      skill,
      oldLevel,
      newLevel: skillData.level,
      improvement: skillData.level - oldLevel,
      automaticity: skillData.automaticity,
      isAutomatic: skillData.automaticity >= this.automaticityThreshold
    };
  }
  
  /**
   * Transfer learning to related skills
   * @param {string} sourceSkill - Source skill
   * @param {string} category - Skill category
   * @param {number} amount - Transfer amount
   */
  transferLearning(sourceSkill, category, amount) {
    for (const [name, skill] of this.skills) {
      if (name !== sourceSkill && skill.category === category) {
        skill.level = Math.min(1.0, skill.level + amount * 0.5);
      }
    }
  }
  
  /**
   * Get skill level
   * @param {string} skill - Skill name
   * @param {string} category - Skill category
   * @returns {number} Skill level (0-1)
   */
  getSkillLevel(skill, category) {
    const skillData = this.skills.get(skill);
    return skillData ? skillData.level : 0.0;
  }
  
  /**
   * Check if skill is automatic
   * @param {string} skill - Skill name
   * @returns {boolean} True if automatic
   */
  isAutomatic(skill) {
    const skillData = this.skills.get(skill);
    return skillData ? skillData.automaticity >= this.automaticityThreshold : false;
  }
  
  /**
   * Form a habit
   * @param {string} habit - Habit name
   * @param {Object} trigger - Context that triggers habit
   * @param {Object} behavior - Behavior to perform
   * @returns {Object} Habit data
   */
  formHabit(habit, trigger, behavior) {
    if (!this.habits.has(habit)) {
      this.habits.set(habit, {
        name: habit,
        trigger,
        behavior,
        strength: 0.0,
        repetitions: 0,
        lastPerformed: null,
        consistency: 0.0
      });
    }
    
    return this.habits.get(habit);
  }
  
  /**
   * Reinforce a habit
   * @param {string} habit - Habit name
   * @param {number} reward - Reward value (0-1)
   */
  reinforceHabit(habit, reward = 0.5) {
    const habitData = this.habits.get(habit);
    if (!habitData) return;
    
    // Strengthen habit
    const reinforcement = 0.05 * reward;
    habitData.strength = Math.min(1.0, habitData.strength + reinforcement);
    habitData.repetitions++;
    habitData.lastPerformed = (this.kernel?.turn || 0);
    
    // Update consistency
    this.updateHabitConsistency(habitData);
  }
  
  /**
   * Update habit consistency based on performance pattern
   * @param {Object} habitData - Habit data
   */
  updateHabitConsistency(habitData) {
    if (!habitData.lastPerformed) {
      habitData.consistency = 0;
      return;
    }
    
    const timeSinceLast = (this.kernel?.turn || 0) - habitData.lastPerformed;
    const expectedInterval = 24 * 60 * 60 * 1000; // Daily
    
    if (timeSinceLast < expectedInterval * 1.5) {
      habitData.consistency = Math.min(1.0, habitData.consistency + 0.05);
    } else {
      habitData.consistency *= 0.9;
    }
  }
  
  /**
   * Check if context triggers a habit
   * @param {Object} context - Current context
   * @returns {Array} Triggered habits
   */
  checkHabitTriggers(context) {
    const triggered = [];
    
    for (const [name, habit] of this.habits) {
      if (this.contextMatchesTrigger(context, habit.trigger)) {
        // Probability of performing habit based on strength
        if (this.rng.next() < habit.strength) {
          triggered.push({
            habit: name,
            behavior: habit.behavior,
            strength: habit.strength,
            automatic: habit.strength >= this.automaticityThreshold
          });
        }
      }
    }
    
    return triggered;
  }
  
  /**
   * Check if context matches habit trigger
   * @param {Object} context - Current context
   * @param {Object} trigger - Habit trigger
   * @returns {boolean} True if matches
   */
  contextMatchesTrigger(context, trigger) {
    for (const [key, value] of Object.entries(trigger)) {
      if (context[key] !== value) return false;
    }
    return true;
  }
  
  /**
   * Learn a procedure
   * @param {string} name - Procedure name
   * @param {Array} steps - Procedure steps
   * @param {string} category - Procedure category
   */
  learnProcedure(name, steps, category = 'general') {
    this.procedures.set(name, {
      name,
      steps,
      category,
      mastery: 0.0,
      timesPerformed: 0,
      averageTime: null,
      lastPerformed: null
    });
  }
  
  /**
   * Execute a procedure
   * @param {string} name - Procedure name
   * @param {number} performance - Performance quality (0-1)
   * @param {number} time - Time taken
   * @returns {Object} Execution results
   */
  executeProcedure(name, performance = 0.7, time = 60) {
    const procedure = this.procedures.get(name);
    if (!procedure) return null;
    
    // Improve mastery with practice
    const masteryGain = 0.02 * performance;
    procedure.mastery = Math.min(1.0, procedure.mastery + masteryGain);
    procedure.timesPerformed++;
    procedure.lastPerformed = (this.kernel?.turn || 0);
    
    // Update average time
    if (procedure.averageTime === null) {
      procedure.averageTime = time;
    } else {
      procedure.averageTime = (procedure.averageTime * 0.9) + (time * 0.1);
    }
    
    return {
      procedure: name,
      mastery: procedure.mastery,
      efficiency: procedure.averageTime ? time / procedure.averageTime : 1.0,
      automatic: procedure.mastery >= this.automaticityThreshold
    };
  }
  
  /**
   * Get procedure steps
   * @param {string} name - Procedure name
   * @returns {Array|null} Steps or null
   */
  getProcedure(name) {
    const procedure = this.procedures.get(name);
    return procedure ? procedure.steps : null;
  }
  
  /**
   * Develop muscle memory for physical skill
   * @param {string} action - Physical action
   * @param {number} repetitions - Number of repetitions
   * @param {number} quality - Quality of execution (0-1)
   */
  developMuscleMemory(action, repetitions, quality = 0.7) {
    if (!this.muscleMemory.has(action)) {
      this.muscleMemory.set(action, {
        action,
        strength: 0.0,
        precision: 0.0,
        speed: 0.0,
        totalReps: 0
      });
    }
    
    const memory = this.muscleMemory.get(action);
    
    // Improve with repetitions
    const improvement = 0.001 * repetitions * quality;
    memory.strength = Math.min(1.0, memory.strength + improvement);
    memory.precision = Math.min(1.0, memory.precision + improvement * 0.8);
    memory.speed = Math.min(1.0, memory.speed + improvement * 0.6);
    memory.totalReps += repetitions;
  }
  
  /**
   * Get muscle memory for action
   * @param {string} action - Physical action
   * @returns {Object|null} Muscle memory or null
   */
  getMuscleMemory(action) {
    return this.muscleMemory.get(action) || null;
  }
  
  /**
   * Update procedural memory over time
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    const now = (this.kernel?.turn || 0);
    
    // Decay skills without practice
    for (const [name, skill] of this.skills) {
      const timeSincePractice = now - skill.lastPracticed;
      const daysSincePractice = timeSincePractice / (24 * 60 * 60 * 1000);
      
      if (daysSincePractice > 7) {
        const decay = this.decayRate * deltaTime;
        skill.level *= (1 - decay);
        skill.automaticity *= (1 - decay * 0.5);
        
        // Remove if too low
        if (skill.level < 0.05) {
          this.skills.delete(name);
        }
      }
    }
    
    // Decay habits without reinforcement
    for (const [name, habit] of this.habits) {
      if (habit.lastPerformed) {
        const timeSinceLast = now - habit.lastPerformed;
        const daysSinceLast = timeSinceLast / (24 * 60 * 60 * 1000);
        
        if (daysSinceLast > 3) {
          const decay = this.decayRate * deltaTime * 0.5;
          habit.strength *= (1 - decay);
          habit.consistency *= (1 - decay);
          
          // Remove weak habits
          if (habit.strength < 0.1) {
            this.habits.delete(name);
          }
        }
      }
    }
    
    // Decay muscle memory
    for (const [action, memory] of this.muscleMemory) {
      const decay = this.decayRate * deltaTime * 0.3;
      memory.strength *= (1 - decay);
      memory.precision *= (1 - decay);
      memory.speed *= (1 - decay);
      
      if (memory.strength < 0.1) {
        this.muscleMemory.delete(action);
      }
    }
  }
  
  /**
   * Get all skills in category
   * @param {string} category - Category name
   * @returns {Array} Skills
   */
  getSkillsByCategory(category) {
    const skills = [];
    for (const [name, skill] of this.skills) {
      if (skill.category === category) {
        skills.push({ name, ...skill });
      }
    }
    return skills.sort((a, b) => b.level - a.level);
  }
  
  /**
   * Get strongest skills
   * @param {number} count - Number of skills
   * @returns {Array} Top skills
   */
  getTopSkills(count = 5) {
    return Array.from(this.skills.entries())
      .map(([name, skill]) => ({ name, ...skill }))
      .sort((a, b) => b.level - a.level)
      .slice(0, count);
  }
  
  /**
   * Get all automatic behaviors
   * @returns {Array} Automatic skills and habits
   */
  getAutomaticBehaviors() {
    const automatic = [];
    
    // Automatic skills
    for (const [name, skill] of this.skills) {
      if (skill.automaticity >= this.automaticityThreshold) {
        automatic.push({ type: 'skill', name, automaticity: skill.automaticity });
      }
    }
    
    // Strong habits
    for (const [name, habit] of this.habits) {
      if (habit.strength >= this.automaticityThreshold) {
        automatic.push({ type: 'habit', name, strength: habit.strength });
      }
    }
    
    return automatic;
  }
  
  /**
   * Get memory statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalSkills: this.skills.size,
      totalHabits: this.habits.size,
      totalProcedures: this.procedures.size,
      automaticSkills: Array.from(this.skills.values())
        .filter(s => s.automaticity >= this.automaticityThreshold).length,
      strongHabits: Array.from(this.habits.values())
        .filter(h => h.strength >= this.automaticityThreshold).length,
      averageSkillLevel: Array.from(this.skills.values())
        .reduce((sum, s) => sum + s.level, 0) / this.skills.size || 0
    };
  }
  
  /**
   * Serialize procedural memory
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      skills: Array.from(this.skills.entries()),
      habits: Array.from(this.habits.entries()),
      procedures: Array.from(this.procedures.entries()),
      muscleMemory: Array.from(this.muscleMemory.entries())
    };
  }
  
  /**
   * Deserialize procedural memory
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.skills = new Map(data.skills || []);
    this.habits = new Map(data.habits || []);
    this.procedures = new Map(data.procedures || []);
    this.muscleMemory = new Map(data.muscleMemory || []);
  }
}

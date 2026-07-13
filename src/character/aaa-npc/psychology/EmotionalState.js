/**
 * EmotionalState.js
 * 
 * Implements a sophisticated emotional model combining:
 * - Plutchik's Wheel of Emotions (8 primary emotions)
 * - PAD Model (Pleasure-Arousal-Dominance)
 * - Mood tracking (longer-lasting emotional baseline)
 * - Emotional regulation capabilities
 * 
 * @module EmotionalState
 */

export class EmotionalState {
  constructor(personality = {}, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    // Primary emotions (Plutchik's Wheel) - intensity 0-1
    this.joy = 0.5;
    this.trust = 0.5;
    this.fear = 0.0;
    this.surprise = 0.0;
    this.sadness = 0.0;
    this.disgust = 0.0;
    this.anger = 0.0;
    this.anticipation = 0.5;
    
    // PAD dimensional model
    this.arousal = 0.5;      // Calm ←→ Excited
    this.valence = 0.5;      // Negative ←→ Positive
    this.dominance = 0.5;    // Submissive ←→ Dominant
    
    // Mood system (longer-lasting emotional baseline)
    this.mood = {
      baseline: 0.5,
      current: 0.5,
      volatility: personality.neuroticism || 0.3,
      lastUpdate: (this.kernel?.turn || 0)
    };
    
    // Emotional regulation capabilities
    this.regulation = {
      suppressionStrength: (personality.conscientiousness || 0.5) * 0.8,
      reappraisalSkill: (personality.openness || 0.5) * 0.7,
      emotionalIntelligence: (personality.agreeableness || 0.5) * 0.6 + 
                             (personality.extraversion || 0.5) * 0.4
    };
    
    // Emotional history for pattern detection
    this.emotionalHistory = [];
    this.maxHistorySize = 100;
    
    // Thresholds for emotional expression
    this.expressionThreshold = 0.6;
    
    // Emotional contagion susceptibility
    this.contagionSusceptibility = personality.agreeableness || 0.5;
  }
  
  /**
   * Update emotional state - called each game tick
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    this.decay(deltaTime);
    this.updateMood(deltaTime);
    this.updatePAD();
    this.recordHistory();
  }
  
  /**
   * Emotions naturally decay toward mood baseline
   * @param {number} deltaTime - Time in minutes
   */
  decay(deltaTime) {
    const decayRate = 0.01 * deltaTime;
    const emotions = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];
    
    for (const emotion of emotions) {
      const target = this.mood.current;
      this[emotion] = this[emotion] * (1 - decayRate) + target * decayRate;
      this[emotion] = this.clamp(this[emotion], 0, 1);
    }
  }
  
  /**
   * React to an event with emotional response
   * @param {Object} event - Event that triggers emotion
   * @param {Object} personality - Personality traits
   * @returns {Object} Emotional response details
   */
  react(event, personality = {}) {
    const response = this.calculateEmotionalResponse(event, personality);
    this.applyEmotionalChange(response);
    this.updateMood();
    
    return {
      dominantEmotion: this.getDominantEmotion(),
      intensity: this.getEmotionalIntensity(),
      valence: this.valence,
      expressed: this.shouldExpress()
    };
  }
  
  /**
   * Calculate emotional response to an event
   * @param {Object} event - Event details
   * @param {Object} personality - Personality traits
   * @returns {Object} Emotion changes
   */
  calculateEmotionalResponse(event, personality) {
    const response = {};
    const intensity = event.intensity || 0.5;
    const personalityMod = this.getPersonalityModifier(event.type, personality);
    
    // Map event types to emotional responses
    switch (event.type) {
      case 'achievement':
        response.joy = intensity * personalityMod * 0.8;
        response.anticipation = intensity * 0.3;
        break;
        
      case 'loss':
        response.sadness = intensity * personalityMod * 0.9;
        response.anger = intensity * 0.3;
        break;
        
      case 'threat':
        response.fear = intensity * personalityMod * 0.8;
        response.anger = intensity * (personality.courage || 0.5) * 0.4;
        break;
        
      case 'betrayal':
        response.anger = intensity * personalityMod * 0.9;
        response.sadness = intensity * 0.5;
        response.disgust = intensity * 0.4;
        break;
        
      case 'social_success':
        response.joy = intensity * personalityMod * 0.7;
        response.trust = intensity * 0.4;
        break;
        
      case 'social_rejection':
        response.sadness = intensity * personalityMod * 0.8;
        response.anger = intensity * 0.3;
        break;
        
      case 'unexpected':
        response.surprise = intensity * 0.9;
        response.fear = intensity * (personality.neuroticism || 0.5) * 0.3;
        break;
        
      case 'injustice':
        response.anger = intensity * personalityMod * 0.8;
        response.disgust = intensity * 0.5;
        break;
        
      case 'kindness_received':
        response.joy = intensity * 0.6;
        response.trust = intensity * personalityMod * 0.7;
        break;
        
      case 'disgust_trigger':
        response.disgust = intensity * 0.9;
        response.fear = intensity * 0.3;
        break;
        
      default:
        // Generic positive/negative response
        if (event.valence > 0) {
          response.joy = intensity * event.valence * 0.5;
        } else {
          response.sadness = intensity * Math.abs(event.valence) * 0.5;
        }
    }
    
    return response;
  }
  
  /**
   * Apply emotional changes with regulation
   * @param {Object} changes - Emotion changes to apply
   */
  applyEmotionalChange(changes) {
    for (const [emotion, change] of Object.entries(changes)) {
      if (this[emotion] !== undefined) {
        // Apply emotional regulation
        const regulated = this.regulateEmotion(emotion, change);
        this[emotion] = this.clamp(this[emotion] + regulated, 0, 1);
      }
    }
  }
  
  /**
   * Regulate emotional response based on capabilities
   * @param {string} emotion - Emotion being regulated
   * @param {number} change - Raw emotional change
   * @returns {number} Regulated change
   */
  regulateEmotion(emotion, change) {
    // Negative emotions can be suppressed
    const negativeEmotions = ['fear', 'sadness', 'anger', 'disgust'];
    
    if (negativeEmotions.includes(emotion) && change > 0) {
      // Suppression reduces intensity
      const suppression = this.regulation.suppressionStrength;
      change *= (1 - suppression * 0.5);
      
      // Reappraisal can transform negative to less negative
      if (this.rng.next() < this.regulation.reappraisalSkill) {
        change *= 0.7;
      }
    }
    
    return change;
  }
  
  /**
   * Update mood based on recent emotional state
   */
  updateMood(deltaTime = 1) {
    const currentEmotionalAverage = this.getEmotionalAverage();
    const moodChangeRate = 0.001 * deltaTime * this.mood.volatility;
    
    this.mood.current += (currentEmotionalAverage - this.mood.current) * moodChangeRate;
    this.mood.current = this.clamp(this.mood.current, 0, 1);
    this.mood.lastUpdate = (this.kernel?.turn || 0);
  }
  
  /**
   * Update PAD dimensions based on emotions
   */
  updatePAD() {
    // Arousal: high for strong emotions
    const emotionIntensity = this.getEmotionalIntensity();
    this.arousal = emotionIntensity;
    
    // Valence: positive vs negative emotions
    const positive = (this.joy + this.trust + this.anticipation) / 3;
    const negative = (this.fear + this.sadness + this.anger + this.disgust) / 4;
    this.valence = (positive - negative + 1) / 2;
    
    // Dominance: anger and joy increase, fear and sadness decrease
    const dominant = (this.anger + this.joy) / 2;
    const submissive = (this.fear + this.sadness) / 2;
    this.dominance = (dominant - submissive + 1) / 2;
  }
  
  /**
   * Get dominant emotion
   * @returns {string} Name of dominant emotion
   */
  getDominantEmotion() {
    const emotions = {
      joy: this.joy,
      trust: this.trust,
      fear: this.fear,
      surprise: this.surprise,
      sadness: this.sadness,
      disgust: this.disgust,
      anger: this.anger,
      anticipation: this.anticipation
    };
    
    return Object.entries(emotions)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }
  
  /**
   * Get overall emotional intensity
   * @returns {number} Intensity 0-1
   */
  getEmotionalIntensity() {
    const emotions = [this.joy, this.trust, this.fear, this.surprise, 
                     this.sadness, this.disgust, this.anger, this.anticipation];
    const sum = emotions.reduce((a, b) => a + Math.abs(b - 0.5), 0);
    return Math.min(1, sum / 4);
  }
  
  /**
   * Get average emotional state
   * @returns {number} Average 0-1
   */
  getEmotionalAverage() {
    const emotions = [this.joy, this.trust, this.fear, this.surprise, 
                     this.sadness, this.disgust, this.anger, this.anticipation];
    return emotions.reduce((a, b) => a + b, 0) / emotions.length;
  }
  
  /**
   * Check if emotion should be expressed
   * @returns {boolean} True if emotion is strong enough to express
   */
  shouldExpress() {
    return this.getEmotionalIntensity() > this.expressionThreshold;
  }
  
  /**
   * Experience emotional contagion from another person
   * @param {EmotionalState} otherEmotion - Another person's emotional state
   * @param {number} proximity - How close/connected (0-1)
   */
  experienceContagion(otherEmotion, proximity = 0.5) {
    const contagionStrength = this.contagionSusceptibility * proximity * 0.1;
    
    const emotions = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];
    for (const emotion of emotions) {
      const difference = otherEmotion[emotion] - this[emotion];
      this[emotion] += difference * contagionStrength;
      this[emotion] = this.clamp(this[emotion], 0, 1);
    }
  }
  
  /**
   * Record emotional state in history
   */
  recordHistory() {
    this.emotionalHistory.push({
      timestamp: (this.kernel?.turn || 0),
      dominant: this.getDominantEmotion(),
      intensity: this.getEmotionalIntensity(),
      valence: this.valence,
      arousal: this.arousal
    });
    
    if (this.emotionalHistory.length > this.maxHistorySize) {
      this.emotionalHistory.shift();
    }
  }
  
  /**
   * Get personality modifier for event type
   * @param {string} eventType - Type of event
   * @param {Object} personality - Personality traits
   * @returns {number} Modifier 0.5-1.5
   */
  getPersonalityModifier(eventType, personality) {
    const mods = {
      achievement: personality.ambition || 1.0,
      loss: personality.neuroticism || 1.0,
      threat: personality.neuroticism || 1.0,
      betrayal: personality.agreeableness ? (2 - personality.agreeableness) : 1.0,
      social_success: personality.extraversion || 1.0,
      social_rejection: personality.neuroticism || 1.0,
      kindness_received: personality.agreeableness || 1.0
    };
    
    return mods[eventType] || 1.0;
  }
  
  /**
   * Get emotional state summary
   * @returns {Object} Summary of current state
   */
  getSummary() {
    return {
      dominant: this.getDominantEmotion(),
      intensity: this.getEmotionalIntensity(),
      mood: this.mood.current,
      valence: this.valence,
      arousal: this.arousal,
      dominance: this.dominance,
      expressed: this.shouldExpress()
    };
  }
  
  /**
   * Serialize emotional state
   * @returns {Object} Serialized state
   */
  serialize() {
    return {
      emotions: {
        joy: this.joy,
        trust: this.trust,
        fear: this.fear,
        surprise: this.surprise,
        sadness: this.sadness,
        disgust: this.disgust,
        anger: this.anger,
        anticipation: this.anticipation
      },
      pad: {
        arousal: this.arousal,
        valence: this.valence,
        dominance: this.dominance
      },
      mood: this.mood,
      regulation: this.regulation
    };
  }
  
  /**
   * Deserialize emotional state
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    if (data.emotions) {
      Object.assign(this, data.emotions);
    }
    if (data.pad) {
      this.arousal = data.pad.arousal;
      this.valence = data.pad.valence;
      this.dominance = data.pad.dominance;
    }
    if (data.mood) {
      this.mood = { ...this.mood, ...data.mood };
    }
    if (data.regulation) {
      this.regulation = { ...this.regulation, ...data.regulation };
    }
  }
  
  /**
   * Clamp value between min and max
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

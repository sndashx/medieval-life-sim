/**
 * TimeManagement.js
 * Contextual time acceleration, simulation speed control
 * Models variable time flow based on activity and importance
 */

export class TimeManagement {
  constructor() {
    this.timeScale = 1.0; // Real-time multiplier
    this.contexts = new Map();
    this.schedules = new Map();
    this.events = new Map();
    this.nextContextId = 1;
    this.nextEventId = 1;
    this.currentTime = 0;
    this.paused = false;
  }

  defineContext(name, baseSpeed, conditions) {
    const context = {
      id: this.nextContextId++,
      name: name,
      baseSpeed: baseSpeed, // Time multiplier for this context
      conditions: conditions, // When this context applies
      priority: conditions.priority || 0.5,
      active: false
    };
    
    this.contexts.set(context.id, context);
    return context;
  }

  evaluateContext(worldState) {
    let activeContext = null;
    let highestPriority = -1;
    
    for (const context of this.contexts.values()) {
      if (this.checkConditions(context.conditions, worldState)) {
        if (context.priority > highestPriority) {
          highestPriority = context.priority;
          activeContext = context;
        }
      }
    }
    
    return activeContext;
  }

  checkConditions(conditions, worldState) {
    // Check if conditions are met
    if (conditions.playerPresent !== undefined) {
      if (conditions.playerPresent !== worldState.playerPresent) {
        return false;
      }
    }
    
    if (conditions.combatActive !== undefined) {
      if (conditions.combatActive !== worldState.combatActive) {
        return false;
      }
    }
    
    if (conditions.dialogueActive !== undefined) {
      if (conditions.dialogueActive !== worldState.dialogueActive) {
        return false;
      }
    }
    
    if (conditions.importantEvent !== undefined) {
      if (conditions.importantEvent !== worldState.importantEvent) {
        return false;
      }
    }
    
    return true;
  }

  setTimeScale(scale) {
    this.timeScale = Math.max(0, Math.min(1000, scale));
    
    return {
      success: true,
      timeScale: this.timeScale
    };
  }

  pause() {
    this.paused = true;
    return { success: true, paused: true };
  }

  resume() {
    this.paused = false;
    return { success: true, paused: false };
  }

  advance(deltaTime, worldState) {
    if (this.paused) {
      return {
        elapsed: 0,
        currentTime: this.currentTime
      };
    }
    
    // Evaluate context
    const context = this.evaluateContext(worldState);
    
    // Calculate effective time scale
    let effectiveScale = this.timeScale;
    if (context) {
      effectiveScale *= context.baseSpeed;
    }
    
    // Advance time
    const elapsed = deltaTime * effectiveScale;
    this.currentTime += elapsed;
    
    // Check for scheduled events
    const triggeredEvents = this.checkScheduledEvents(this.currentTime);
    
    return {
      elapsed: elapsed,
      currentTime: this.currentTime,
      timeScale: effectiveScale,
      context: context?.name,
      triggeredEvents: triggeredEvents
    };
  }

  scheduleEvent(name, triggerTime, callback) {
    const event = {
      id: this.nextEventId++,
      name: name,
      triggerTime: triggerTime,
      callback: callback,
      triggered: false
    };
    
    this.events.set(event.id, event);
    
    return {
      success: true,
      event: event
    };
  }

  checkScheduledEvents(currentTime) {
    const triggered = [];
    
    for (const event of this.events.values()) {
      if (!event.triggered && currentTime >= event.triggerTime) {
        event.triggered = true;
        event.actualTriggerTime = currentTime;
        triggered.push(event);
        
        // Execute callback if provided
        if (event.callback) {
          event.callback(event);
        }
      }
    }
    
    return triggered;
  }

  skipToTime(targetTime) {
    if (targetTime <= this.currentTime) {
      return {
        success: false,
        reason: 'Target time is in the past'
      };
    }
    
    const skipped = targetTime - this.currentTime;
    this.currentTime = targetTime;
    
    // Trigger all events in skipped period
    const triggeredEvents = this.checkScheduledEvents(this.currentTime);
    
    return {
      success: true,
      skipped: skipped,
      currentTime: this.currentTime,
      triggeredEvents: triggeredEvents
    };
  }

  skipToNextEvent() {
    // Find next scheduled event
    let nextEvent = null;
    let nextTime = Infinity;
    
    for (const event of this.events.values()) {
      if (!event.triggered && event.triggerTime < nextTime) {
        nextTime = event.triggerTime;
        nextEvent = event;
      }
    }
    
    if (!nextEvent) {
      return {
        success: false,
        reason: 'No scheduled events'
      };
    }
    
    return this.skipToTime(nextTime);
  }

  setContextualSpeed(worldState) {
    const context = this.evaluateContext(worldState);
    
    if (context) {
      this.timeScale = context.baseSpeed;
      return {
        success: true,
        context: context.name,
        speed: context.baseSpeed
      };
    }
    
    return {
      success: false,
      reason: 'No matching context'
    };
  }

  calculateOptimalSpeed(worldState) {
    // Calculate optimal speed based on activity
    let speed = 1.0;
    
    // Slow down for important events
    if (worldState.importantEvent) {
      speed *= 0.1;
    }
    
    // Slow down for combat
    if (worldState.combatActive) {
      speed *= 0.25;
    }
    
    // Slow down for dialogue
    if (worldState.dialogueActive) {
      speed *= 0.5;
    }
    
    // Speed up when player not present
    if (!worldState.playerPresent) {
      speed *= 10;
    }
    
    // Speed up during idle periods
    if (worldState.idle) {
      speed *= 5;
    }
    
    return speed;
  }

  getTimeOfDay() {
    const dayLength = 24 * 60 * 60; // seconds
    const timeInDay = this.currentTime % dayLength;
    const hours = Math.floor(timeInDay / 3600);
    const minutes = Math.floor((timeInDay % 3600) / 60);
    
    return {
      hours: hours,
      minutes: minutes,
      period: hours < 12 ? 'AM' : 'PM',
      formatted: `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
    };
  }

  getDayOfYear() {
    const dayLength = 24 * 60 * 60;
    return Math.floor(this.currentTime / dayLength) % 365;
  }

  getSeason() {
    const day = this.getDayOfYear();
    
    if (day < 91) return 'winter';
    if (day < 182) return 'spring';
    if (day < 274) return 'summer';
    return 'autumn';
  }

  getYear() {
    const dayLength = 24 * 60 * 60;
    return Math.floor(this.currentTime / (dayLength * 365));
  }

  formatTime(seconds) {
    const years = Math.floor(seconds / (365 * 24 * 60 * 60));
    seconds %= (365 * 24 * 60 * 60);
    
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds %= (24 * 60 * 60);
    
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    
    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    
    return parts.join(' ');
  }

  createTimeWindow(duration, callback) {
    const startTime = this.currentTime;
    const endTime = startTime + duration;
    
    return {
      start: startTime,
      end: endTime,
      duration: duration,
      check: () => this.currentTime >= endTime,
      remaining: () => Math.max(0, endTime - this.currentTime),
      callback: callback
    };
  }

  waitFor(duration) {
    const targetTime = this.currentTime + duration;
    return this.skipToTime(targetTime);
  }

  getContext(id) {
    return this.contexts.get(id);
  }

  getEvent(id) {
    return this.events.get(id);
  }

  getCurrentTime() {
    return this.currentTime;
  }

  getTimeScale() {
    return this.timeScale;
  }

  isPaused() {
    return this.paused;
  }

  getUpcomingEvents(count = 10) {
    return Array.from(this.events.values())
      .filter(e => !e.triggered)
      .sort((a, b) => a.triggerTime - b.triggerTime)
      .slice(0, count);
  }

  getRecentEvents(count = 10) {
    return Array.from(this.events.values())
      .filter(e => e.triggered)
      .sort((a, b) => b.actualTriggerTime - a.actualTriggerTime)
      .slice(0, count);
  }

  clearTriggeredEvents() {
    for (const [id, event] of this.events) {
      if (event.triggered) {
        this.events.delete(id);
      }
    }
    
    return { success: true };
  }

  reset() {
    this.currentTime = 0;
    this.timeScale = 1.0;
    this.paused = false;
    this.events.clear();
    
    return { success: true };
  }
}

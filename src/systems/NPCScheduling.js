/**
 * NPCScheduling.js
 * Daily routines, cooperation, mistakes, interruptions
 * Models realistic NPC behavior with imperfections
 */

export class NPCScheduling {
  constructor(kernel = null) {
    this.kernel = kernel;
    this.schedules = new Map();
    this.tasks = new Map();
    this.cooperations = new Map();
    this.interruptions = new Map();
    this.nextScheduleId = 1;
    this.nextTaskId = 1;
    this.nextCooperationId = 1;
  }

  createSchedule(npcId, routineType) {
    const schedule = {
      id: this.nextScheduleId++,
      npc: npcId,
      type: routineType, // daily, weekly, seasonal
      tasks: [],
      flexibility: 0.3, // How much schedule can vary
      adherence: 0.7, // How well NPC follows schedule
      created: this.kernel?.turn ?? 0
    };
    
    // Generate default routine based on type
    this.generateRoutine(schedule, routineType);
    
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  generateRoutine(schedule, type) {
    if (type === 'daily') {
      schedule.tasks = [
        { time: 6, duration: 1, activity: 'wake_up', priority: 1.0 },
        { time: 7, duration: 1, activity: 'breakfast', priority: 0.9 },
        { time: 8, duration: 4, activity: 'work', priority: 0.8 },
        { time: 12, duration: 1, activity: 'lunch', priority: 0.9 },
        { time: 13, duration: 4, activity: 'work', priority: 0.8 },
        { time: 17, duration: 1, activity: 'dinner', priority: 0.9 },
        { time: 18, duration: 2, activity: 'leisure', priority: 0.5 },
        { time: 20, duration: 2, activity: 'social', priority: 0.6 },
        { time: 22, duration: 8, activity: 'sleep', priority: 1.0 }
      ];
    }
  }

  scheduleTask(npcId, task, timeSlot) {
    const schedule = Array.from(this.schedules.values())
      .find(s => s.npc === npcId);
    
    if (!schedule) {
      return { success: false, reason: 'No schedule found for NPC' };
    }
    
    // Check for conflicts
    const conflict = this.checkConflict(schedule, timeSlot);
    if (conflict) {
      return { success: false, reason: 'Time slot conflict', conflict: conflict };
    }
    
    const scheduledTask = {
      id: this.nextTaskId++,
      npc: npcId,
      task: task,
      scheduledTime: timeSlot.start,
      duration: timeSlot.duration,
      priority: task.priority || 0.5,
      status: 'scheduled',
      attempts: 0,
      completed: false
    };
    
    this.tasks.set(scheduledTask.id, scheduledTask);
    schedule.tasks.push(scheduledTask);
    
    return {
      success: true,
      task: scheduledTask
    };
  }

  checkConflict(schedule, timeSlot) {
    for (const task of schedule.tasks) {
      const taskEnd = task.time + task.duration;
      const slotEnd = timeSlot.start + timeSlot.duration;
      
      // Check overlap
      if (task.time < slotEnd && taskEnd > timeSlot.start) {
        return task;
      }
    }
    return null;
  }

  executeTask(taskId, npc, context) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, reason: 'Unknown task' };
    }
    
    if (task.status !== 'scheduled' && task.status !== 'in_progress') {
      return { success: false, reason: 'Task not ready for execution' };
    }
    
    task.status = 'in_progress';
    task.startedAt = this.kernel?.turn ?? 0;
    task.attempts++;
    
    // Calculate success probability
    const successChance = this.calculateSuccessChance(task, npc, context);
    
    // Check for mistakes
    const mistake = this.checkForMistake(npc, task, context);
    
    if (mistake.occurred) {
      task.status = 'failed';
      task.mistake = mistake;
      task.completedAt = this.kernel?.turn ?? 0;
      
      return {
        success: false,
        mistake: mistake,
        canRetry: mistake.recoverable
      };
    }
    
    // Execute task
    const success = this.kernel.random() < successChance;
    
    if (success) {
      task.status = 'completed';
      task.completed = true;
      task.completedAt = this.kernel?.turn ?? 0;
      
      return {
        success: true,
        duration: this.kernel?.turn ?? 0 - task.startedAt,
        quality: this.assessQuality(npc, task)
      };
    } else {
      task.status = 'failed';
      task.completedAt = this.kernel?.turn ?? 0;
      
      return {
        success: false,
        reason: 'Task execution failed',
        canRetry: task.attempts < 3
      };
    }
  }

  calculateSuccessChance(task, npc, context) {
    let chance = 0.7; // Base
    
    // Skill affects success
    const relevantSkill = this.getRelevantSkill(npc, task.task.activity);
    chance += relevantSkill * 0.2;
    
    // Fatigue reduces success
    if (npc.physiology?.fatigue > 0.7) {
      chance *= 0.7;
    }
    
    // Distractions reduce success
    if (context.distractions > 0.5) {
      chance *= 0.8;
    }
    
    // Experience with task
    if (task.attempts > 0) {
      chance += Math.min(0.1, task.attempts * 0.03);
    }
    
    return Math.min(0.95, chance);
  }

  getRelevantSkill(npc, activity) {
    const skillMap = {
      work: npc.skills?.crafting?.primary || 0.5,
      social: npc.skills?.social?.communication || 0.5,
      combat: npc.skills?.combat?.melee || 0.5,
      study: npc.skills?.knowledge?.learning || 0.5
    };
    
    return skillMap[activity] || 0.5;
  }

  checkForMistake(npc, task, context) {
    // Mistake probability
    let mistakeProbability = 0.1; // Base 10%
    
    // Fatigue increases mistakes
    if (npc.physiology?.fatigue > 0.7) {
      mistakeProbability += 0.2;
    }
    
    // Stress increases mistakes
    if (npc.needs?.stress > 0.7) {
      mistakeProbability += 0.15;
    }
    
    // Complexity increases mistakes
    if (task.task.complexity > 0.7) {
      mistakeProbability += 0.1;
    }
    
    // Distractions increase mistakes
    mistakeProbability += context.distractions * 0.2;
    
    if (this.kernel.random() < mistakeProbability) {
      return {
        occurred: true,
        type: this.selectMistakeType(),
        severity: this.kernel.random() * 0.5 + 0.3,
        recoverable: this.kernel.random() > 0.3
      };
    }
    
    return { occurred: false };
  }

  selectMistakeType() {
    const types = [
      'forgot_step',
      'wrong_tool',
      'incorrect_measurement',
      'timing_error',
      'communication_failure',
      'dropped_item',
      'misunderstood_instruction'
    ];
    return types[Math.floor(this.kernel.random() * types.length)];
  }

  assessQuality(npc, task) {
    let quality = 0.7; // Base
    
    const skill = this.getRelevantSkill(npc, task.task.activity);
    quality += skill * 0.2;
    
    // Fatigue reduces quality
    if (npc.physiology?.fatigue > 0.5) {
      quality -= npc.physiology.fatigue * 0.2;
    }
    
    return Math.max(0.1, Math.min(1, quality));
  }

  interrupt(taskId, reason, urgency) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, reason: 'Unknown task' };
    }
    
    if (task.status !== 'in_progress') {
      return { success: false, reason: 'Task not in progress' };
    }
    
    const interruption = {
      task: taskId,
      reason: reason,
      urgency: urgency,
      timestamp: this.kernel?.turn ?? 0
    };
    
    // High priority tasks resist interruption
    if (task.priority > urgency) {
      return {
        success: false,
        reason: 'Task priority too high',
        resisted: true
      };
    }
    
    task.status = 'interrupted';
    task.interruption = interruption;
    
    this.interruptions.set(taskId, interruption);
    
    return {
      success: true,
      interruption: interruption,
      canResume: true
    };
  }

  resumeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, reason: 'Unknown task' };
    }
    
    if (task.status !== 'interrupted') {
      return { success: false, reason: 'Task not interrupted' };
    }
    
    task.status = 'in_progress';
    delete task.interruption;
    
    return {
      success: true,
      resumed: true
    };
  }

  requestCooperation(initiatorId, partnerId, task, role) {
    const cooperation = {
      id: this.nextCooperationId++,
      initiator: initiatorId,
      partner: partnerId,
      task: task,
      role: role, // leader, helper, equal
      requested: this.kernel?.turn ?? 0,
      status: 'pending',
      coordination: 0.5
    };
    
    this.cooperations.set(cooperation.id, cooperation);
    
    return {
      success: true,
      cooperation: cooperation
    };
  }

  acceptCooperation(cooperationId, partner) {
    const cooperation = this.cooperations.get(cooperationId);
    if (!cooperation) {
      return { success: false, reason: 'Unknown cooperation' };
    }
    
    if (cooperation.partner !== partner.id) {
      return { success: false, reason: 'Not the intended partner' };
    }
    
    cooperation.status = 'active';
    cooperation.accepted = this.kernel?.turn ?? 0;
    
    return {
      success: true,
      cooperation: cooperation
    };
  }

  coordinateTask(cooperationId, npc1, npc2, context) {
    const cooperation = this.cooperations.get(cooperationId);
    if (!cooperation || cooperation.status !== 'active') {
      return { success: false, reason: 'Cooperation not active' };
    }
    
    // Calculate coordination quality
    const coordination = this.calculateCoordination(npc1, npc2, cooperation);
    cooperation.coordination = coordination;
    
    // Execute cooperative task
    const baseSuccess = (this.calculateSuccessChance(cooperation.task, npc1, context) +
                        this.calculateSuccessChance(cooperation.task, npc2, context)) / 2;
    
    // Coordination affects success
    const cooperativeSuccess = baseSuccess * (0.7 + coordination * 0.3);
    
    const success = this.kernel.random() < cooperativeSuccess;
    
    if (success) {
      cooperation.status = 'completed';
      cooperation.completed = this.kernel?.turn ?? 0;
      
      return {
        success: true,
        coordination: coordination,
        efficiency: 1 + coordination * 0.5 // Cooperation bonus
      };
    }
    
    return {
      success: false,
      coordination: coordination,
      reason: 'Coordination failure'
    };
  }

  calculateCoordination(npc1, npc2, cooperation) {
    let coordination = 0.5; // Base
    
    // Relationship affects coordination
    if (npc1.relationships?.has(npc2.id)) {
      const relationship = npc1.relationships.get(npc2.id);
      coordination += relationship.trust * 0.3;
    }
    
    // Communication skill affects coordination
    const comm1 = npc1.skills?.social?.communication || 0.5;
    const comm2 = npc2.skills?.social?.communication || 0.5;
    coordination += (comm1 + comm2) / 2 * 0.2;
    
    return Math.min(1, coordination);
  }

  adaptSchedule(scheduleId, changes) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return { success: false, reason: 'Unknown schedule' };
    }
    
    // Apply changes within flexibility bounds
    for (const change of changes) {
      const task = schedule.tasks.find(t => t.activity === change.activity);
      if (task) {
        const maxShift = schedule.flexibility * 2; // hours
        const timeShift = Math.min(maxShift, Math.abs(change.timeShift));
        
        task.time += Math.sign(change.timeShift) * timeShift;
      }
    }
    
    return {
      success: true,
      adapted: true
    };
  }

  getSchedule(id) {
    return this.schedules.get(id);
  }

  getTask(id) {
    return this.tasks.get(id);
  }

  getCooperation(id) {
    return this.cooperations.get(id);
  }

  getScheduleByNPC(npcId) {
    return Array.from(this.schedules.values())
      .find(s => s.npc === npcId);
  }

  getActiveTasksByNPC(npcId) {
    return Array.from(this.tasks.values())
      .filter(t => t.npc === npcId && t.status === 'in_progress');
  }

  getPendingCooperations(npcId) {
    return Array.from(this.cooperations.values())
      .filter(c => (c.initiator === npcId || c.partner === npcId) && c.status === 'pending');
  }

  getTaskCompletionRate(npcId) {
    const tasks = Array.from(this.tasks.values())
      .filter(t => t.npc === npcId);
    
    if (tasks.length === 0) return 0;
    
    const completed = tasks.filter(t => t.completed).length;
    return completed / tasks.length;
  }

  getMistakeRate(npcId) {
    const tasks = Array.from(this.tasks.values())
      .filter(t => t.npc === npcId && t.status === 'failed');

    const totalTasks = Array.from(this.tasks.values())
      .filter(t => t.npc === npcId).length;

    if (totalTasks === 0) return 0;

    const mistakes = tasks.filter(t => t.mistake).length;
    return mistakes / totalTasks;
  }

  toJSON() {
    return {
      schedules: Array.from(this.schedules.entries()),
      tasks: Array.from(this.tasks.entries()),
      cooperations: Array.from(this.cooperations.entries()),
      interruptions: Array.from(this.interruptions.entries()),
      nextScheduleId: this.nextScheduleId,
      nextTaskId: this.nextTaskId,
      nextCooperationId: this.nextCooperationId
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.schedules) this.schedules = new Map(data.schedules);
    if (data.tasks) this.tasks = new Map(data.tasks);
    if (data.cooperations) this.cooperations = new Map(data.cooperations);
    if (data.interruptions) this.interruptions = new Map(data.interruptions);
    if (typeof data.nextScheduleId === 'number') this.nextScheduleId = data.nextScheduleId;
    if (typeof data.nextTaskId === 'number') this.nextTaskId = data.nextTaskId;
    if (typeof data.nextCooperationId === 'number') this.nextCooperationId = data.nextCooperationId;
  }
}

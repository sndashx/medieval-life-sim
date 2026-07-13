/**
 * Education.js
 * Teaching, learning, institutions, knowledge transmission
 * Models apprenticeship, schools, literacy, skill development
 */

export class Education {
  constructor(kernel, game) {
    this.kernel = kernel || game?.kernel || null;
    this.institutions = new Map();
    this.apprenticeships = new Map();
    this.curricula = new Map();
    this.teachers = new Map();
    this.students = new Map();
    this.nextInstitutionId = 1;
    this.nextApprenticeshipId = 1;
  }

  createInstitution(name, type, location, curriculum) {
    const institution = {
      id: this.nextInstitutionId++,
      name: name,
      type: type, // school, university, monastery, guild_hall
      location: location,
      curriculum: curriculum,
      teachers: [],
      students: [],
      resources: {
        books: 0,
        equipment: 0,
        funding: 0
      },
      reputation: 0.5,
      founded: this.kernel?.turn ?? 0
    };
    
    this.institutions.set(institution.id, institution);
    return institution;
  }

  createCurriculum(subjects, duration, prerequisites) {
    return {
      subjects: subjects,
      duration: duration, // years
      prerequisites: prerequisites || [],
      assessments: this.generateAssessments(subjects),
      certification: true
    };
  }

  generateAssessments(subjects) {
    return subjects.map(subject => ({
      subject: subject,
      type: 'examination',
      passingScore: 0.6,
      weight: 1.0 / subjects.length
    }));
  }

  enroll(student, institutionId) {
    const institution = this.institutions.get(institutionId);
    if (!institution) {
      return { success: false, reason: 'Institution not found' };
    }
    
    // Check prerequisites
    const meetsPrereqs = this.checkPrerequisites(student, institution.curriculum.prerequisites);
    if (!meetsPrereqs.success) {
      return { success: false, reason: meetsPrereqs.reason };
    }
    
    // Check capacity
    if (institution.students.length >= institution.capacity) {
      return { success: false, reason: 'Institution at capacity' };
    }
    
    const enrollment = {
      studentId: student.id,
      institutionId: institutionId,
      enrolled: this.kernel?.turn ?? 0,
      progress: 0,
      grades: new Map(),
      attendance: 1.0
    };
    
    institution.students.push(student.id);
    this.students.set(student.id, enrollment);
    
    return {
      success: true,
      enrollment: enrollment
    };
  }

  checkPrerequisites(student, prerequisites) {
    for (const prereq of prerequisites) {
      const skill = student.skills?.[prereq.category]?.[prereq.skill] || 0;
      if (skill < prereq.level) {
        return {
          success: false,
          reason: `Insufficient ${prereq.skill} (need ${prereq.level}, have ${skill})`
        };
      }
    }
    return { success: true };
  }

  teach(teacher, students, subject, hours) {
    // Check teacher qualification
    const teacherSkill = teacher.skills?.knowledge?.[subject] || 0;
    const teachingSkill = teacher.skills?.social?.teaching || 0.3;
    
    if (teacherSkill < 0.5) {
      return { success: false, reason: 'Teacher not qualified' };
    }
    
    const effectiveness = teacherSkill * teachingSkill;
    const results = [];
    
    for (const student of students) {
      const learning = this.learn(student, subject, hours, effectiveness);
      results.push({
        student: student.id,
        learning: learning
      });
    }
    
    return {
      success: true,
      effectiveness: effectiveness,
      results: results
    };
  }

  learn(student, subject, hours, teacherEffectiveness = 0.5) {
    // Learning rate depends on intelligence, prior knowledge, and teacher
    const intelligence = student.intelligence || 0.5;
    const priorKnowledge = student.skills?.knowledge?.[subject] || 0;
    const motivation = student.motivation || 0.5;
    
    // Learning curve: faster at beginning, slower as expertise increases
    const learningRate = 0.01 * intelligence * teacherEffectiveness * motivation;
    const diminishingReturns = Math.exp(-priorKnowledge * 2);
    
    const gain = hours * learningRate * diminishingReturns;
    
    // Update skill
    if (!student.skills) student.skills = { knowledge: {} };
    if (!student.skills.knowledge) student.skills.knowledge = {};
    
    const newLevel = Math.min(1, priorKnowledge + gain);
    student.skills.knowledge[subject] = newLevel;
    
    // Update enrollment progress
    const enrollment = this.students.get(student.id);
    if (enrollment) {
      enrollment.progress += gain;
    }
    
    return {
      subject: subject,
      priorLevel: priorKnowledge,
      newLevel: newLevel,
      gain: gain,
      hoursStudied: hours
    };
  }

  createApprenticeship(master, apprentice, craft, duration) {
    // Check master qualification
    const masterSkill = master.skills?.crafting?.[craft] || 0;
    if (masterSkill < 0.6) {
      return { success: false, reason: 'Master not qualified' };
    }
    
    const apprenticeship = {
      id: this.nextApprenticeshipId++,
      master: master.id,
      apprentice: apprentice.id,
      craft: craft,
      duration: duration, // years
      started: this.kernel?.turn ?? 0,
      progress: 0,
      completed: false
    };
    
    this.apprenticeships.set(apprenticeship.id, apprenticeship);
    
    return {
      success: true,
      apprenticeship: apprenticeship
    };
  }

  updateApprenticeship(apprenticeshipId, hoursWorked) {
    const apprenticeship = this.apprenticeships.get(apprenticeshipId);
    if (!apprenticeship) {
      return { success: false, reason: 'Apprenticeship not found' };
    }
    
    if (apprenticeship.completed) {
      return { success: false, reason: 'Apprenticeship already completed' };
    }
    
    // Get master and apprentice
    const master = { id: apprenticeship.master, skills: { crafting: {} } };
    const apprentice = { id: apprenticeship.apprentice, skills: { crafting: {} } };
    
    master.skills.crafting[apprenticeship.craft] = 0.8; // Assume master skill
    
    // Learning through practice
    const masterSkill = master.skills.crafting[apprenticeship.craft];
    const learning = this.learn(apprentice, apprenticeship.craft, hoursWorked, masterSkill);
    
    // Update progress
    const totalHours = apprenticeship.duration * 365 * 8; // years * days * hours
    apprenticeship.progress += hoursWorked / totalHours;
    
    if (apprenticeship.progress >= 1.0) {
      apprenticeship.completed = true;
      apprenticeship.completedDate = this.kernel?.turn ?? 0;
    }
    
    return {
      success: true,
      progress: apprenticeship.progress,
      learning: learning,
      completed: apprenticeship.completed
    };
  }

  assess(student, subject) {
    const skill = student.skills?.knowledge?.[subject] || 0;
    
    // Add some randomness for test performance
    const performance = skill + (this.kernel.random() - 0.5) * 0.2;
    const score = Math.max(0, Math.min(1, performance));
    
    const grade = this.calculateGrade(score);
    
    // Update enrollment
    const enrollment = this.students.get(student.id);
    if (enrollment) {
      enrollment.grades.set(subject, {
        score: score,
        grade: grade,
        date: this.kernel?.turn ?? 0
      });
    }
    
    return {
      subject: subject,
      score: score,
      grade: grade,
      passed: score >= 0.6
    };
  }

  calculateGrade(score) {
    if (score >= 0.9) return 'A';
    if (score >= 0.8) return 'B';
    if (score >= 0.7) return 'C';
    if (score >= 0.6) return 'D';
    return 'F';
  }

  graduate(studentId) {
    const enrollment = this.students.get(studentId);
    if (!enrollment) {
      return { success: false, reason: 'Student not enrolled' };
    }
    
    const institution = this.institutions.get(enrollment.institutionId);
    if (!institution) {
      return { success: false, reason: 'Institution not found' };
    }
    
    // Check if completed curriculum
    const curriculum = institution.curriculum;
    const allPassed = curriculum.subjects.every(subject => {
      const grade = enrollment.grades.get(subject);
      return grade && grade.score >= 0.6;
    });
    
    if (!allPassed) {
      return { success: false, reason: 'Not all subjects passed' };
    }
    
    // Award certification
    const certification = {
      institution: institution.name,
      subjects: curriculum.subjects,
      date: this.kernel?.turn ?? 0,
      studentId: studentId
    };
    
    // Remove from institution
    const index = institution.students.indexOf(studentId);
    if (index > -1) {
      institution.students.splice(index, 1);
    }
    
    this.students.delete(studentId);
    
    return {
      success: true,
      certification: certification
    };
  }

  teachLiteracy(teacher, student, language, hours) {
    const teachingSkill = teacher.skills?.social?.teaching || 0.3;
    const teacherLiteracy = teacher.skills?.knowledge?.literacy || 0;
    const teacherLanguage = teacher.languages?.get(language) || 0;
    
    if (teacherLiteracy < 0.5 || teacherLanguage < 0.7) {
      return { success: false, reason: 'Teacher not qualified' };
    }
    
    const effectiveness = teachingSkill * teacherLiteracy * teacherLanguage;
    
    // Student learning
    const intelligence = student.intelligence || 0.5;
    const studentLanguage = student.languages?.get(language) || 0;
    
    if (studentLanguage < 0.5) {
      return { success: false, reason: 'Student must know spoken language first' };
    }
    
    const currentLiteracy = student.skills?.knowledge?.literacy || 0;
    const learningRate = 0.005 * intelligence * effectiveness;
    const gain = hours * learningRate * Math.exp(-currentLiteracy * 2);
    
    if (!student.skills) student.skills = { knowledge: {} };
    if (!student.skills.knowledge) student.skills.knowledge = {};
    
    student.skills.knowledge.literacy = Math.min(1, currentLiteracy + gain);
    
    return {
      success: true,
      newLevel: student.skills.knowledge.literacy,
      gain: gain
    };
  }

  selfStudy(student, subject, hours, resources) {
    // Self-study is less effective than instruction
    const intelligence = student.intelligence || 0.5;
    const motivation = student.motivation || 0.5;
    const resourceQuality = this.assessResourceQuality(resources);
    
    const effectiveness = 0.3 * intelligence * motivation * resourceQuality;
    
    return this.learn(student, subject, hours, effectiveness);
  }

  assessResourceQuality(resources) {
    let quality = 0.3; // Base quality
    
    if (resources.books) quality += 0.3;
    if (resources.teacher) quality += 0.4;
    if (resources.equipment) quality += 0.2;
    if (resources.library) quality += 0.2;
    
    return Math.min(1, quality);
  }

  getInstitution(id) {
    return this.institutions.get(id);
  }

  getApprenticeship(id) {
    return this.apprenticeships.get(id);
  }

  getStudentEnrollment(studentId) {
    return this.students.get(studentId);
  }

  getInstitutionsByType(type) {
    return Array.from(this.institutions.values()).filter(i => i.type === type);
  }

  getTeachingLoad(teacherId) {
    let studentCount = 0;
    
    for (const institution of this.institutions.values()) {
      if (institution.teachers.includes(teacherId)) {
        studentCount += institution.students.length;
      }
    }
    
    return studentCount;
  }
}

/**
 * Production.js
 * Production costs, defects, byproducts, efficiency
 * Models realistic manufacturing, quality control, waste
 */

export class Production {
  constructor(kernel, game) {
    this.kernel = kernel || game?.kernel || null;
    this.processes = new Map();
    this.products = new Map();
    this.defects = new Map();
    this.nextProcessId = 1;
    this.nextProductId = 1;
  }

  defineProcess(name, inputs, outputs, requirements) {
    const process = {
      id: this.nextProcessId++,
      name: name,
      inputs: inputs, // { material: amount }
      outputs: outputs, // { product: amount, probability }
      byproducts: this.calculateByproducts(inputs, outputs),
      requirements: requirements, // { skill, tools, time }
      defectRate: this.calculateBaseDefectRate(requirements),
      efficiency: 1.0
    };
    
    this.processes.set(process.id, process);
    return process;
  }

  calculateByproducts(inputs, outputs) {
    // Mass conservation - what goes in must come out
    const byproducts = [];
    
    // Simplified: assume 10-30% becomes waste/byproduct
    const wasteRate = 0.1 + this.kernel.random() * 0.2;
    
    for (const [material, amount] of Object.entries(inputs)) {
      byproducts.push({
        material: `${material}_waste`,
        amount: amount * wasteRate,
        usable: this.kernel.random() > 0.5
      });
    }
    
    return byproducts;
  }

  calculateBaseDefectRate(requirements) {
    // More complex processes have higher defect rates
    let rate = 0.05; // Base 5%
    
    if (requirements.skill > 0.7) rate += 0.1;
    if (requirements.tools && requirements.tools.length > 3) rate += 0.05;
    if (requirements.time > 60) rate += 0.05;
    
    return Math.min(0.5, rate);
  }

  produce(processId, worker, materials, tools) {
    const process = this.processes.get(processId);
    if (!process) {
      return { success: false, reason: 'Unknown process' };
    }
    
    // Check inputs
    for (const [material, required] of Object.entries(process.inputs)) {
      if (!materials[material] || materials[material] < required) {
        return {
          success: false,
          reason: `Insufficient ${material} (need ${required}, have ${materials[material] || 0})`
        };
      }
    }
    
    // Check tools
    if (process.requirements.tools) {
      for (const tool of process.requirements.tools) {
        if (!tools.includes(tool)) {
          return { success: false, reason: `Missing tool: ${tool}` };
        }
      }
    }
    
    // Check skill
    const workerSkill = worker.skills?.crafting?.[process.name] || 0.3;
    if (workerSkill < process.requirements.skill) {
      return {
        success: false,
        reason: `Insufficient skill (need ${process.requirements.skill}, have ${workerSkill})`
      };
    }
    
    // Calculate production quality
    const quality = this.calculateQuality(process, worker, tools);
    
    // Check for defects
    const defectCheck = this.checkDefects(process, quality);
    
    // Consume inputs
    for (const [material, amount] of Object.entries(process.inputs)) {
      materials[material] -= amount;
    }
    
    // Generate outputs
    const outputs = [];
    const byproducts = [];
    
    if (!defectCheck.defective) {
      for (const [product, spec] of Object.entries(process.outputs)) {
        if (this.kernel.random() < spec.probability) {
          outputs.push({
            product: product,
            amount: spec.amount * quality,
            quality: quality
          });
        }
      }
    } else {
      // Defective product
      outputs.push({
        product: 'defective',
        amount: 1,
        quality: 0,
        defect: defectCheck.defect
      });
    }
    
    // Generate byproducts
    for (const byproduct of process.byproducts) {
      byproducts.push({
        material: byproduct.material,
        amount: byproduct.amount,
        usable: byproduct.usable
      });
    }
    
    const product = {
      id: this.nextProductId++,
      process: processId,
      worker: worker.id,
      outputs: outputs,
      byproducts: byproducts,
      quality: quality,
      defective: defectCheck.defective,
      timestamp: this.kernel?.turn ?? 0,
      cost: this.calculateCost(process, worker)
    };
    
    this.products.set(product.id, product);
    
    return {
      success: true,
      product: product,
      time: process.requirements.time
    };
  }

  calculateQuality(process, worker, tools) {
    let quality = 0.5; // Base
    
    // Worker skill
    const skill = worker.skills?.crafting?.[process.name] || 0.3;
    quality += skill * 0.3;
    
    // Tool quality
    const toolQuality = this.assessToolQuality(tools);
    quality += toolQuality * 0.2;
    
    // Fatigue reduces quality
    if (worker.physiology?.fatigue > 0.7) {
      quality *= 0.8;
    }
    
    return Math.max(0.1, Math.min(1, quality));
  }

  assessToolQuality(tools) {
    // Simplified tool quality assessment
    return 0.7;
  }

  checkDefects(process, quality) {
    // Defect probability inversely related to quality
    const defectProbability = process.defectRate * (1 - quality);
    
    if (this.kernel.random() < defectProbability) {
      const defectType = this.selectDefectType();
      return {
        defective: true,
        defect: defectType
      };
    }
    
    return { defective: false };
  }

  selectDefectType() {
    const types = [
      'structural_flaw',
      'poor_finish',
      'incorrect_dimensions',
      'material_defect',
      'assembly_error'
    ];
    return types[Math.floor(this.kernel.random() * types.length)];
  }

  calculateCost(process, worker) {
    let cost = 0;
    
    // Material costs
    for (const [material, amount] of Object.entries(process.inputs)) {
      const materialCost = this.getMaterialCost(material);
      cost += materialCost * amount;
    }
    
    // Labor cost
    const laborRate = worker.wage || 10; // per hour
    const hours = process.requirements.time / 60;
    cost += laborRate * hours;
    
    // Tool depreciation
    if (process.requirements.tools) {
      cost += process.requirements.tools.length * 0.5;
    }
    
    return cost;
  }

  getMaterialCost(material) {
    const costs = {
      wood: 5,
      iron: 20,
      cloth: 10,
      leather: 15,
      stone: 3,
      clay: 2
    };
    return costs[material] || 5;
  }

  improveProcess(processId, improvement) {
    const process = this.processes.get(processId);
    if (!process) {
      return { success: false, reason: 'Unknown process' };
    }
    
    switch (improvement.type) {
      case 'efficiency':
        process.efficiency = Math.min(1.5, process.efficiency + improvement.amount);
        break;
        
      case 'quality':
        process.defectRate = Math.max(0.01, process.defectRate - improvement.amount);
        break;
        
      case 'speed':
        process.requirements.time = Math.max(1, process.requirements.time * (1 - improvement.amount));
        break;
        
      case 'waste_reduction':
        for (const byproduct of process.byproducts) {
          byproduct.amount *= (1 - improvement.amount);
        }
        break;
    }
    
    return {
      success: true,
      process: process
    };
  }

  batchProduce(processId, worker, materials, tools, quantity) {
    const results = [];
    let totalCost = 0;
    let totalTime = 0;
    let defectCount = 0;
    
    for (let i = 0; i < quantity; i++) {
      const result = this.produce(processId, worker, materials, tools);
      
      if (!result.success) {
        break; // Stop if we run out of materials
      }
      
      results.push(result.product);
      totalCost += result.product.cost;
      totalTime += result.time;
      
      if (result.product.defective) {
        defectCount++;
      }
      
      // Worker fatigue increases with each item
      if (worker.physiology) {
        worker.physiology.fatigue = Math.min(1, worker.physiology.fatigue + 0.05);
      }
    }
    
    return {
      success: true,
      produced: results.length,
      defects: defectCount,
      totalCost: totalCost,
      totalTime: totalTime,
      averageQuality: results.reduce((sum, p) => sum + p.quality, 0) / results.length
    };
  }

  repairDefect(productId, repairer, materials) {
    const product = this.products.get(productId);
    if (!product) {
      return { success: false, reason: 'Unknown product' };
    }
    
    if (!product.defective) {
      return { success: false, reason: 'Product not defective' };
    }
    
    const skill = repairer.skills?.crafting?.repair || 0.3;
    
    // Repair chance based on skill and defect type
    const repairChance = skill * 0.7;
    
    if (this.kernel.random() < repairChance) {
      product.defective = false;
      product.quality = Math.min(0.8, product.quality + 0.3);
      product.repaired = true;
      product.repairer = repairer.id;
      
      return {
        success: true,
        newQuality: product.quality
      };
    }
    
    return {
      success: false,
      reason: 'Repair failed'
    };
  }

  recycleByproduct(byproduct) {
    if (!byproduct.usable) {
      return { success: false, reason: 'Byproduct not usable' };
    }
    
    // Convert byproduct to usable material
    const recycledMaterial = byproduct.material.replace('_waste', '_recycled');
    const recycledAmount = byproduct.amount * 0.7; // 70% recovery
    
    return {
      success: true,
      material: recycledMaterial,
      amount: recycledAmount
    };
  }

  calculateProductionRate(processId, workers, hoursPerDay) {
    const process = this.processes.get(processId);
    if (!process) return 0;
    
    const timePerUnit = process.requirements.time / 60; // hours
    const unitsPerWorkerPerDay = hoursPerDay / timePerUnit;
    const totalUnitsPerDay = unitsPerWorkerPerDay * workers.length * process.efficiency;
    
    // Account for defects
    const effectiveRate = totalUnitsPerDay * (1 - process.defectRate);
    
    return effectiveRate;
  }

  optimizeProduction(processId, constraints) {
    const process = this.processes.get(processId);
    if (!process) {
      return { success: false, reason: 'Unknown process' };
    }
    
    const optimization = {
      bottleneck: null,
      recommendations: []
    };
    
    // Identify bottlenecks
    if (process.requirements.time > 120) {
      optimization.bottleneck = 'time';
      optimization.recommendations.push('Consider process automation or division of labor');
    }
    
    if (process.defectRate > 0.2) {
      optimization.bottleneck = 'quality';
      optimization.recommendations.push('Improve worker training or tool quality');
    }
    
    if (process.byproducts.reduce((sum, b) => sum + b.amount, 0) > 5) {
      optimization.bottleneck = 'waste';
      optimization.recommendations.push('Implement waste reduction techniques');
    }
    
    // Check material efficiency
    const inputTotal = Object.values(process.inputs).reduce((sum, v) => sum + v, 0);
    const outputTotal = Object.values(process.outputs).reduce((sum, v) => sum + v.amount, 0);
    
    if (inputTotal / outputTotal > 2) {
      optimization.recommendations.push('Material usage inefficient - review process');
    }
    
    return {
      success: true,
      optimization: optimization
    };
  }

  getProcess(id) {
    return this.processes.get(id);
  }

  getProduct(id) {
    return this.products.get(id);
  }

  getProcessesByWorker(workerId) {
    return Array.from(this.products.values())
      .filter(p => p.worker === workerId)
      .map(p => p.process);
  }

  getDefectRate(processId) {
    const products = Array.from(this.products.values())
      .filter(p => p.process === processId);
    
    if (products.length === 0) return 0;
    
    const defects = products.filter(p => p.defective).length;
    return defects / products.length;
  }

  getAverageQuality(processId) {
    const products = Array.from(this.products.values())
      .filter(p => p.process === processId && !p.defective);
    
    if (products.length === 0) return 0;
    
    return products.reduce((sum, p) => sum + p.quality, 0) / products.length;
  }
}

/**
 * FoodSystem.js
 * Cooking, preservation, nutrition detail, food safety
 * Models preparation techniques, spoilage, contamination
 */

export class FoodSystem {
  constructor(kernel = null, game = null) {
    this.kernel = kernel || game?.kernel || null;
    this.game = game || null;
    this.recipes = this.initRecipes();
    this.preservationMethods = this.initPreservationMethods();
    this.cookingMethods = this.initCookingMethods();
  }

  _rng() {
    if (this.kernel) return this.kernel.random();
    throw new Error('FoodSystem requires a kernel for randomness');
  }

  initRecipes() {
    return {
      bread: {
        ingredients: [
          { item: 'flour', amount: 500 }, // grams
          { item: 'water', amount: 300 },
          { item: 'salt', amount: 10 }
        ],
        cookingMethod: 'baking',
        duration: 60, // minutes
        skill: 0.3,
        yield: 800, // grams
        nutrition: {
          calories: 2400,
          protein: 80,
          carbs: 480,
          fat: 20,
          fiber: 30
        },
        shelfLife: 3 // days
      },
      stew: {
        ingredients: [
          { item: 'meat', amount: 300 },
          { item: 'vegetables', amount: 400 },
          { item: 'water', amount: 1000 }
        ],
        cookingMethod: 'boiling',
        duration: 120,
        skill: 0.2,
        yield: 1500,
        nutrition: {
          calories: 800,
          protein: 60,
          carbs: 80,
          fat: 30,
          fiber: 20
        },
        shelfLife: 1
      },
      porridge: {
        ingredients: [
          { item: 'grain', amount: 200 },
          { item: 'water', amount: 600 }
        ],
        cookingMethod: 'boiling',
        duration: 30,
        skill: 0.1,
        yield: 700,
        nutrition: {
          calories: 600,
          protein: 20,
          carbs: 120,
          fat: 10,
          fiber: 15
        },
        shelfLife: 0.5
      },
      cheese: {
        ingredients: [
          { item: 'milk', amount: 10000 }, // ml
          { item: 'rennet', amount: 1 }
        ],
        cookingMethod: 'fermentation',
        duration: 10080, // 7 days
        skill: 0.6,
        yield: 1000,
        nutrition: {
          calories: 4000,
          protein: 250,
          carbs: 40,
          fat: 330,
          fiber: 0
        },
        shelfLife: 60
      },
      driedMeat: {
        ingredients: [
          { item: 'meat', amount: 1000 },
          { item: 'salt', amount: 50 }
        ],
        cookingMethod: 'drying',
        duration: 4320, // 3 days
        skill: 0.4,
        yield: 400, // 60% weight loss
        nutrition: {
          calories: 1600,
          protein: 320,
          carbs: 0,
          fat: 40,
          fiber: 0
        },
        shelfLife: 180
      }
    };
  }

  initPreservationMethods() {
    return {
      salting: {
        shelfLifeMultiplier: 10,
        saltRequired: 0.1, // 10% of food weight
        effectiveness: 0.9
      },
      smoking: {
        shelfLifeMultiplier: 8,
        fuelRequired: 5, // kg wood
        effectiveness: 0.85
      },
      drying: {
        shelfLifeMultiplier: 15,
        timeRequired: 4320, // 3 days
        effectiveness: 0.95
      },
      pickling: {
        shelfLifeMultiplier: 12,
        vinegarRequired: 0.5, // liters per kg
        effectiveness: 0.9
      },
      fermentation: {
        shelfLifeMultiplier: 20,
        timeRequired: 10080, // 7 days
        effectiveness: 0.85
      },
      cooling: {
        shelfLifeMultiplier: 3,
        temperatureRequired: 5, // °C
        effectiveness: 0.7
      }
    };
  }

  initCookingMethods() {
    return {
      boiling: {
        temperature: 100,
        fuelEfficiency: 0.6,
        pathogenKill: 0.99,
        nutrientRetention: 0.7
      },
      roasting: {
        temperature: 180,
        fuelEfficiency: 0.4,
        pathogenKill: 0.95,
        nutrientRetention: 0.8
      },
      baking: {
        temperature: 200,
        fuelEfficiency: 0.5,
        pathogenKill: 0.98,
        nutrientRetention: 0.85
      },
      frying: {
        temperature: 160,
        fuelEfficiency: 0.7,
        pathogenKill: 0.97,
        nutrientRetention: 0.75
      },
      smoking: {
        temperature: 70,
        fuelEfficiency: 0.3,
        pathogenKill: 0.8,
        nutrientRetention: 0.9
      }
    };
  }

  cook(recipeName, ingredients, skill, equipment) {
    const recipe = this.recipes[recipeName];
    if (!recipe) return { success: false, reason: 'Unknown recipe' };
    
    // Check ingredients
    const hasIngredients = this.checkIngredients(recipe.ingredients, ingredients);
    if (!hasIngredients.success) {
      return { success: false, reason: hasIngredients.reason };
    }
    
    // Check skill
    if (skill < recipe.skill) {
      return { success: false, reason: 'Insufficient cooking skill' };
    }
    
    // Check equipment
    const method = this.cookingMethods[recipe.cookingMethod];
    if (!equipment[recipe.cookingMethod]) {
      return { success: false, reason: `Need ${recipe.cookingMethod} equipment` };
    }
    
    // Calculate success chance
    const skillFactor = Math.min(1, skill / recipe.skill);
    const successChance = 0.5 + skillFactor * 0.5;
    
    if (this._rng() > successChance) {
      return { success: false, reason: 'Cooking failed', ingredientsLost: true };
    }
    
    // Calculate actual nutrition (affected by method and skill)
    const actualNutrition = {};
    for (const [nutrient, value] of Object.entries(recipe.nutrition)) {
      actualNutrition[nutrient] = value * method.nutrientRetention * skillFactor;
    }
    
    // Create food item
    const food = {
      name: recipeName,
      mass: recipe.yield,
      nutrition: actualNutrition,
      shelfLife: recipe.shelfLife,
      daysOld: 0,
      contamination: 0,
      quality: skillFactor,
      cooked: true,
      safe: method.pathogenKill > 0.95
    };
    
    return {
      success: true,
      food: food,
      timeRequired: recipe.duration
    };
  }

  checkIngredients(required, available) {
    for (const req of required) {
      const avail = available.find(a => a.item === req.item);
      if (!avail || avail.amount < req.amount) {
        return { success: false, reason: `Insufficient ${req.item}` };
      }
    }
    return { success: true };
  }

  preserve(food, method, resources) {
    const preservation = this.preservationMethods[method];
    if (!preservation) {
      return { success: false, reason: 'Unknown preservation method' };
    }
    
    // Check resources
    if (method === 'salting' && resources.salt < food.mass * preservation.saltRequired) {
      return { success: false, reason: 'Insufficient salt' };
    }
    
    if (method === 'smoking' && resources.wood < preservation.fuelRequired) {
      return { success: false, reason: 'Insufficient wood' };
    }
    
    if (method === 'pickling' && resources.vinegar < food.mass * preservation.vinegarRequired) {
      return { success: false, reason: 'Insufficient vinegar' };
    }
    
    // Apply preservation
    food.shelfLife *= preservation.shelfLifeMultiplier;
    food.preserved = method;
    food.preservationEffectiveness = preservation.effectiveness;
    
    // Some methods change mass
    if (method === 'drying') {
      food.mass *= 0.4; // 60% weight loss
      food.nutrition.calories *= 2.5; // Concentrated
    }
    
    return {
      success: true,
      food: food,
      timeRequired: preservation.timeRequired || 0
    };
  }

  checkSpoilage(food, temperature, humidity, daysPassed) {
    food.daysOld += daysPassed;
    
    // Calculate spoilage rate
    let spoilageRate = 1.0;
    
    // Temperature effect
    if (temperature > 20) {
      spoilageRate *= 1 + (temperature - 20) * 0.1;
    } else if (temperature < 5) {
      spoilageRate *= 0.3;
    }
    
    // Humidity effect
    if (humidity > 70) {
      spoilageRate *= 1.5;
    }
    
    // Preservation effect
    if (food.preserved) {
      spoilageRate *= (1 - food.preservationEffectiveness);
    }
    
    // Check if spoiled
    const effectiveAge = food.daysOld * spoilageRate;
    food.spoiled = effectiveAge > food.shelfLife;
    food.spoilageLevel = Math.min(1, effectiveAge / food.shelfLife);
    
    return {
      spoiled: food.spoiled,
      spoilageLevel: food.spoilageLevel,
      daysRemaining: Math.max(0, food.shelfLife - effectiveAge)
    };
  }

  checkContamination(food, waterQuality, handWashing, surfaceCleanliness) {
    let contaminationRisk = 0;
    
    // Water contamination
    if (waterQuality < 0.8) {
      contaminationRisk += (1 - waterQuality) * 0.3;
    }
    
    // Hand hygiene
    if (!handWashing) {
      contaminationRisk += 0.2;
    }
    
    // Surface cleanliness
    contaminationRisk += (1 - surfaceCleanliness) * 0.2;
    
    // Cooking kills pathogens
    if (food.cooked && food.safe) {
      contaminationRisk *= 0.1;
    }
    
    food.contamination = Math.min(1, food.contamination + contaminationRisk);
    
    return {
      contaminated: food.contamination > 0.3,
      contaminationLevel: food.contamination,
      safe: food.contamination < 0.1
    };
  }

  calculateNutrition(food, portionSize) {
    const ratio = portionSize / food.mass;
    
    return {
      calories: food.nutrition.calories * ratio,
      protein: food.nutrition.protein * ratio,
      carbs: food.nutrition.carbs * ratio,
      fat: food.nutrition.fat * ratio,
      fiber: food.nutrition.fiber * ratio
    };
  }

  eat(person, food, portionSize) {
    // Check if safe to eat
    if (food.spoiled) {
      return {
        success: false,
        reason: 'Food is spoiled',
        illness: true,
        severity: 0.7
      };
    }
    
    if (food.contamination > 0.5) {
      return {
        success: false,
        reason: 'Food is contaminated',
        illness: true,
        severity: food.contamination
      };
    }
    
    // Calculate nutrition absorbed
    const nutrition = this.calculateNutrition(food, portionSize);
    
    // Digestibility
    const digestibility = food.cooked ? 0.9 : 0.7;
    const absorbed = {
      calories: nutrition.calories * digestibility,
      protein: nutrition.protein * digestibility,
      carbs: nutrition.carbs * digestibility,
      fat: nutrition.fat * digestibility,
      fiber: nutrition.fiber
    };
    
    // Apply to person
    person.physiology.metabolism.energyStores += absorbed.calories;
    person.needs.hunger = Math.max(0, person.needs.hunger - absorbed.calories / 2000);
    
    // Reduce food mass
    food.mass -= portionSize;
    
    // Risk of illness from contamination
    let illness = false;
    let severity = 0;
    if (food.contamination > 0.1 && this._rng() < food.contamination) {
      illness = true;
      severity = food.contamination * 0.5;
    }
    
    return {
      success: true,
      nutrition: absorbed,
      illness: illness,
      severity: severity,
      remainingFood: food.mass
    };
  }

  getRecipes() {
    return Object.keys(this.recipes);
  }

  getRecipeDetails(recipeName) {
    return this.recipes[recipeName];
  }

  getPreservationMethods() {
    return Object.keys(this.preservationMethods);
  }

  getCookingMethods() {
    return Object.keys(this.cookingMethods);
  }
}

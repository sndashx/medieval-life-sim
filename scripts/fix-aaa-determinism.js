#!/usr/bin/env node
/**
 * Automated script to fix determinism violations in AAA NPC system
 * Replaces Date.now() with kernel.turn and Math.random() with kernel.rng
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AAA_DIR = path.join(__dirname, '../src/character/aaa-npc');

// Files to process
const FILES_TO_FIX = [
  'memory/EpisodicMemory.js',
  'memory/SemanticMemory.js',
  'memory/ProceduralMemory.js',
  'memory/WorkingMemory.js',
  'psychology/EmotionalState.js',
  'psychology/StressSystem.js',
  'social/Relationship.js',
  'social/ReputationSystem.js',
  'social/SocialNetwork.js',
  'decision/UtilityAI.js',
  'decision/GOAPPlanner.js',
  'decision/HybridDecisionSystem.js',
  'personality/PersonalitySystem.js',
  'economic/EconomicMotivation.js'
];

let totalChanges = 0;

console.log('🔧 Fixing AAA NPC Determinism Violations\n');

for (const file of FILES_TO_FIX) {
  const filePath = path.join(AAA_DIR, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${file} (not found)`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileChanges = 0;
  
  // Add kernel parameter to constructor if not present
  if (content.includes('constructor(') && !content.includes('kernel = null')) {
    // Find constructor and add kernel parameter
    content = content.replace(
      /constructor\(([^)]*)\)\s*{/,
      (match, params) => {
        if (params.trim() === '') {
          return 'constructor(kernel = null) {';
        } else if (!params.includes('kernel')) {
          return `constructor(${params}, kernel = null) {`;
        }
        return match;
      }
    );
    
    // Add kernel and rng initialization at start of constructor
    content = content.replace(
      /(constructor\([^)]*\)\s*{\s*)/,
      '$1this.kernel = kernel;\n    this.rng = kernel?.rng || { next: () => Math.random(), nextInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min };\n    '
    );
  }
  
  // Replace Date.now() with kernel.turn or 0
  const dateNowMatches = content.match(/Date\.now\(\)/g);
  if (dateNowMatches) {
    content = content.replace(/Date\.now\(\)/g, '(this.kernel?.turn || 0)');
    fileChanges += dateNowMatches.length;
  }
  
  // Replace Math.random() with this.rng.next()
  const mathRandomMatches = content.match(/Math\.random\(\)/g);
  if (mathRandomMatches) {
    content = content.replace(/Math\.random\(\)/g, 'this.rng.next()');
    fileChanges += mathRandomMatches.length;
  }
  
  // Replace Math.floor(Math.random() * ...) patterns with this.rng.nextInt()
  content = content.replace(
    /Math\.floor\(this\.rng\.next\(\)\s*\*\s*([^)]+)\)/g,
    'Math.floor(this.rng.next() * $1)'
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file}: ${fileChanges} changes`);
    totalChanges += fileChanges;
  } else {
    console.log(`⏭️  ${file}: no changes needed`);
  }
}

console.log(`\n✨ Total changes: ${totalChanges}`);
console.log('\n🔍 Run audit to verify: node scripts/audit-determinism.js');

# 🚀 Launch Guide - Medieval Life Sim with AAA NPCs

## Quick Start

### 1. Basic Launch (Legacy NPCs)
```bash
npm start
```
This launches the blessed terminal UI with legacy NPC behavior (no AAA features).

### 2. Launch with AAA NPCs (Recommended)

#### Option A: Narrative Preset (Story-Rich)
```bash
node src/main-blessed.js --aaa-preset narrative
```
- Best for: Story-driven gameplay, 100-500 NPCs
- Features: Full memory, emotions, personality development
- Performance: Medium

#### Option B: Balanced Preset
```bash
node src/main-blessed.js --aaa-preset balanced
```
- Best for: General gameplay, 500-1000 NPCs
- Features: Core memory, basic emotions
- Performance: Good

#### Option C: Performance Preset
```bash
node src/main-blessed.js --aaa-preset performance
```
- Best for: Large populations, 1000-2000 NPCs
- Features: Minimal memory, simplified emotions
- Performance: Excellent

#### Option D: Custom Configuration
```bash
node src/main-blessed.js --aaa-config custom-config.json
```

Example `custom-config.json`:
```json
{
  "enableAAA": true,
  "aaaFeatures": ["memory", "emotions", "decisions"],
  "aaaSyncInterval": 60,
  "lodDistance": {
    "active": 50,
    "regional": 200,
    "distant": 500
  },
  "memory": {
    "episodicCapacity": 512,
    "workingCapacity": 7,
    "consolidation": true
  }
}
```

### 3. Development Mode (Auto-Reload)
```bash
npm run dev
```
Watches for file changes and auto-reloads.

### 4. Run Tests
```bash
# All tests including AAA integration
npm test

# Specific test
node --test tests/aaa-integration.test.js

# Determinism audit
npm run determinism-audit
```

### 5. Run Demonstrations

#### Conceptual Demo (No Game Launch)
```bash
node examples/aaa-concept-demo.js
```
Shows side-by-side comparison of Legacy vs AAA NPCs with narrative examples.

#### Interactive Playthrough (Requires Full Integration)
```bash
node examples/aaa-demo-playthrough.js
```
Note: Currently requires AAA subsystems to be fully wired up.

## Configuration Options

### Command Line Arguments

```bash
node src/main-blessed.js [options]
```

**Options:**
- `--seed <number>` - Set random seed for reproducibility
- `--aaa-preset <preset>` - Use AAA preset (narrative|balanced|performance|minimal)
- `--aaa-config <file>` - Load AAA config from JSON file
- `--population <number>` - Set max population (default: 500)
- `--world-size <width>x<height>` - Set world dimensions (default: 100x100)
- `--settlements <number>` - Number of settlements (default: 5)

**Examples:**
```bash
# Reproducible game with AAA
node src/main-blessed.js --seed 42 --aaa-preset narrative

# Large world with performance preset
node src/main-blessed.js --world-size 200x200 --population 2000 --aaa-preset performance

# Custom everything
node src/main-blessed.js --seed 12345 --population 1000 --aaa-config my-config.json
```

### Programmatic Launch

Create a custom launcher script:

```javascript
// my-launcher.js
import { Game } from './src/Game.js';

const game = new Game(42, {
  worldSize: { width: 100, height: 100 },
  settlements: 3,
  populationMin: 50,
  populationMax: 200
}, {
  aaaPreset: 'narrative'
});

game.initialize();

// Run simulation
for (let i = 0; i < 1000; i++) {
  game.kernel.tick();
  
  if (i % 100 === 0) {
    console.log(`Turn ${game.kernel.turn}`);
    const stats = game.kernel.getStats();
    console.log(`Population: ${stats.population}`);
  }
}
```

Run it:
```bash
node my-launcher.js
```

## Performance Tuning

### Population Scaling

| Population | Recommended Preset | Expected FPS | Memory Usage |
|------------|-------------------|--------------|--------------|
| < 100      | narrative         | 60+          | ~50MB        |
| 100-500    | narrative/balanced| 30-60        | ~100MB       |
| 500-1000   | balanced          | 20-30        | ~200MB       |
| 1000-2000  | performance       | 10-20        | ~400MB       |
| 2000+      | minimal           | 5-10         | ~800MB       |

### Optimization Tips

1. **Use appropriate preset** for your population size
2. **Disable unused features** in custom config
3. **Adjust sync interval** (higher = better performance, less responsive)
4. **Use LOD distances** to reduce active NPC count
5. **Monitor with stats**: `game.kernel.getStats()`

## Troubleshooting

### Issue: Low FPS with AAA NPCs

**Solution:**
1. Switch to a lighter preset: `--aaa-preset performance`
2. Reduce population: `--population 500`
3. Increase sync interval in config: `"aaaSyncInterval": 120`

### Issue: NPCs not showing AAA behavior

**Check:**
1. AAA is enabled: `--aaa-preset narrative` or config has `"enableAAA": true`
2. Features are enabled: Check `aaaFeatures` array in config
3. NPCs have AAA bridge: `npc.aaaBridge !== null`

### Issue: Memory usage too high

**Solution:**
1. Reduce episodic memory capacity: `"episodicCapacity": 256`
2. Disable consolidation: `"consolidation": false`
3. Use performance preset: `--aaa-preset performance`

### Issue: Determinism violations

**Check:**
```bash
npm run determinism-audit
```
Should show 0 violations. If not, report as bug.

## Production Deployment

### Recommended Settings

**Small Server (2GB RAM):**
```bash
node src/main-blessed.js \
  --seed 42 \
  --population 500 \
  --aaa-preset balanced
```

**Medium Server (4GB RAM):**
```bash
node src/main-blessed.js \
  --seed 42 \
  --population 1000 \
  --aaa-preset balanced
```

**Large Server (8GB+ RAM):**
```bash
node src/main-blessed.js \
  --seed 42 \
  --population 2000 \
  --aaa-preset narrative
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

CMD ["node", "src/main-blessed.js", "--aaa-preset", "balanced"]
```

Build and run:
```bash
docker build -t medieval-sim .
docker run -it medieval-sim
```

## Next Steps

1. **Read the docs**: `docs/AAA-NPC-QUICKSTART.md`
2. **Run the demo**: `node examples/aaa-concept-demo.js`
3. **Start playing**: `npm start` or with AAA: `node src/main-blessed.js --aaa-preset narrative`
4. **Experiment**: Try different presets and configurations
5. **Monitor**: Use `game.kernel.getStats()` to track performance

## Support

- **Documentation**: `docs/` directory
- **Examples**: `examples/` directory
- **Tests**: `tests/` directory
- **Issues**: GitHub issues

Enjoy your living, breathing medieval world! 🏰

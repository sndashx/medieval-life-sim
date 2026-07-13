# Medieval Life Sim - Quick Start Guide

## 🚀 Installation & Launch

### Prerequisites
- Node.js 16+ installed
- Terminal/command prompt

### Quick Start
```bash
# Clone the repository (if not already done)
git clone https://github.com/sndashx/medieval-life-sim.git
cd medieval-life-sim

# Install dependencies
npm install

# Launch the game (narrative mode with AAA NPCs)
npm start
```

## 🎮 First 90 Seconds

### 1. Create Your Character
When the game starts, you'll see the welcome screen. Type:
```
start
```

Follow the prompts:
- Enter your character's name (or press Enter for random)
- Choose sex: `male` or `female` (or `m`/`f`)

### 2. The Opening Hook
You'll immediately spawn in a named village with an urgent crisis:

```
═══════════════════════════════════════════════════════════
  Welcome to Greenford
═══════════════════════════════════════════════════════════

You arrive in Greenford on a crisp autumn morning.
The village is small but lively...

"Help! Someone help!" cries Edda, your neighbor.
"My cow! She's fallen in the river and can't get out!"

Edda looks at you desperately. "Please, I can't
lose her — she's all I have!"
```

### 3. Make Your First Choice

**Option A: Help Edda**
```
help edda
```
- Rescue the cow from the river
- Gain +0.4 relationship with Edda
- She'll remember your kindness
- Village reputation increases

**Option B: Ignore Her**
```
ignore
```
- Walk away from the crisis
- Lose -0.3 relationship with Edda
- Village notices your refusal
- Social consequences follow

**Option C: Talk First**
```
talk edda
```
- Get more context
- Then decide to help or ignore

**Option D: Look Around**
```
look
```
- Examine your surroundings
- See the village layout
- Spot other NPCs

## 📖 Core Commands

### Movement & Exploration
```
look / l          - Examine surroundings
move n/s/e/w      - Travel one tile
```

### Basic Actions
```
work / w          - Work at your occupation
eat / e           - Consume food
drink             - Drink water
sleep / s         - Rest until rested
take              - Pick up item
drop              - Put down item
```

### Social Interactions
```
talk <person>     - Speak to nearby NPC
propose <person>  - Propose marriage
marry <person>    - Accept proposal
gossip            - Spread rumors
```

### Information
```
status / c        - Detailed character status
inventory / i     - List your items
family            - Show family tree
help              - Show all commands
?                 - Show help overlay
```

## 🎭 What Makes This Special

### 1. Living Story
The chronicle doesn't just log events—it tells a story:
- "Edda and Halvar were married at the village chapel. They are neighbors."
- "Thomas, age 45, died of starvation. The village mourns."
- "You hear that Edda told Halvar you cheated her at the market."

### 2. Social Consequences
Your actions create ripples:
- Help someone → they remember and help you back
- Ignore someone → word spreads, reputation suffers
- Gossip spreads through social networks
- NPCs form opinions based on your deeds

### 3. AAA NPCs (Narrative Preset)
NPCs have:
- **Memory**: Remember your actions and interactions
- **Emotions**: React emotionally to events
- **Personality**: Unique traits that affect behavior
- **Social Networks**: Relationships that evolve
- **Goals**: Make decisions based on needs and desires

## 🎯 Tips for New Players

1. **Start with the opening hook** - It teaches core mechanics through story
2. **Read the chronicle** - It's not a debug log, it's your story
3. **Pay attention to relationships** - They matter more than stats
4. **Gossip spreads** - Your reputation precedes you
5. **NPCs remember** - Every action has consequences

## ⚙️ Advanced Launch Options

### Custom World Size
```bash
node src/main-blessed.js --world-size 200x200 --population 2000
```

### Different AAA Presets
```bash
# Performance (large populations)
node src/main-blessed.js --aaa-preset performance

# Balanced (good mix)
node src/main-blessed.js --aaa-preset balanced

# Minimal (testing)
node src/main-blessed.js --aaa-preset minimal
```

### Reproducible Worlds
```bash
node src/main-blessed.js --seed 42
```

### Help
```bash
node src/main-blessed.js --help
```

## 🐛 Troubleshooting

**Game won't start?**
- Ensure Node.js 16+ is installed: `node --version`
- Run `npm install` first
- Check for error messages in terminal

**UI looks broken?**
- Maximize your terminal window
- Minimum size: 80x24 characters
- Use a terminal with Unicode support

**Game is slow?**
- Use `--aaa-preset performance`
- Reduce population: `--population 100`
- Smaller world: `--world-size 50x50`

## 📚 More Information

- **Full Documentation**: See `LAUNCH.md`
- **AAA NPC Guide**: See `docs/AAA-NPC-QUICKSTART.md`
- **Technical Details**: See `docs/AAA-NPC-INTEGRATION.md`

## 🎮 Ready to Play?

```bash
npm start
```

Type `start` and begin your medieval life!

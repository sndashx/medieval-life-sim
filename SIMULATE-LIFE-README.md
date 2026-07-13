# Life Simulation Script

A powerful script that simulates a complete life of a randomly generated entity in a randomly generated medieval world.

## Overview

This script creates a fully autonomous simulation where:
- A random world is generated with settlements, resources, and NPCs
- A random character is born into this world
- The character's entire life is simulated from birth to death (or up to age 80)
- All major life events are tracked and logged
- Complete ancestry information is recorded
- A beautiful narrative history is generated

## Installation

No additional dependencies needed beyond the base game. The script uses the existing Medieval Life Simulation engine.

## Usage

### Basic Usage (Random Seed)
```bash
cd /home/command/medieval-life-sim
node simulate-life.js
```

### With Specific Seed
```bash
node simulate-life.js 12345
```

Using the same seed will generate the same world and character, allowing for reproducible simulations.

## Output Files

The script generates three files in the `simulation-output/` directory:

### 1. Life Log (`*_life_log.json`)
Complete JSON record of all events in the character's life:
- Birth details
- Birthdays and age milestones
- Occupation changes
- Marriage events
- Children born
- Final status (alive/deceased)

**Example:**
```json
{
  "subject": {
    "name": "John",
    "sex": "male",
    "age": 45,
    "occupation": "craftsman"
  },
  "events": [
    {
      "turn": 0,
      "age": 0,
      "type": "birth",
      "data": {
        "settlement": "Oakshire",
        "parents": "Mary and William"
      }
    }
  ]
}
```

### 2. Ancestry Tree (`*_ancestry.json`)
Complete family tree information:
- Subject details
- Parents
- Grandparents
- Siblings
- Spouse
- Children

**Example:**
```json
{
  "subject": { "name": "John", "age": 45 },
  "parents": [
    { "name": "Mary", "sex": "female" },
    { "name": "William", "sex": "male" }
  ],
  "children": [
    { "name": "Thomas", "sex": "male", "age": 20 }
  ]
}
```

### 3. Written History (`*_history.txt`)
Beautiful narrative format telling the character's life story:
- Birth and childhood
- Coming of age
- Marriage and family
- Career and accomplishments
- Death or current status
- Life statistics

**Example:**
```
═══════════════════════════════════════════════════════════════════════════════
THE LIFE AND TIMES OF JOHN
═══════════════════════════════════════════════════════════════════════════════

In the year of our simulation, seed 1234567890, John was born
in the settlement of Oakshire. He was the
child of Mary and William, humble folk of the land.

CHILDHOOD
────────────────────────────────────────────────────────────────────────────────
John spent his early years learning the ways
of the world, growing in strength and wisdom.
...
```

## Simulation Details

### World Generation
- **Size:** 100×100 tiles
- **Settlements:** 5 villages/towns
- **Population:** 50-500 NPCs per settlement
- **Resources:** 50 resource nodes (iron, copper, timber, etc.)
- **Rivers:** 5 water sources

### Character Life Cycle
1. **Birth (Age 0):** Character is born to random parents in a settlement
2. **Childhood (0-12):** Growing and learning
3. **Coming of Age (12-18):** Becomes apprentice, learns occupation
4. **Adulthood (18+):** Works, may marry, have children
5. **Death or Max Age:** Simulation ends at death or age 80

### Tracked Events
- **Birthdays:** Every year milestone
- **Occupation Changes:** Career progression
- **Marriage:** When character weds
- **Children:** Birth of offspring
- **Health Status:** Overall wellbeing
- **Location:** Settlement residence

### Performance
- **Batch Processing:** Simulates 100 turns at a time for efficiency
- **Event Tracking:** Only logs significant life events
- **Typical Runtime:** 30-120 seconds for a full life (depends on lifespan)
- **Memory Usage:** Moderate (handles 2000+ NPCs)

## Example Output

After running the simulation, you'll see console output like:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║         MEDIEVAL LIFE SIMULATION - LIFE SIMULATOR                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝

🌍 Initializing world...
   Seed: 1705234567890
✓ World initialized

👤 Creating simulation subject...
✓ Created: John (male)
   Born in: Oakshire
   Parents: Mary and William

⏳ Simulating life...
   (This may take a while)

   Age 1: child in Oakshire
   Age 12: apprentice in Oakshire
   Age 18: craftsman in Oakshire
   Age 25: craftsman in Oakshire
   Age 45: craftsman in Oakshire

✓ Life simulation complete
   Final age: 45
   Status: Deceased
   Cause of death: old age
   Total turns: 65,700
   Total events: 47

🌳 Building ancestry tree...
✓ Ancestry tree built
   Parents: 2
   Grandparents: 4
   Siblings: 2
   Spouse: Yes
   Children: 3

📖 Generating narrative history...
✓ Narrative generated

💾 Saving results...
   ✓ Life log: ./simulation-output/John_2026-07-13T01-30-45-123Z_life_log.json
   ✓ Ancestry: ./simulation-output/John_2026-07-13T01-30-45-123Z_ancestry.json
   ✓ Narrative: ./simulation-output/John_2026-07-13T01-30-45-123Z_history.txt

✅ All results saved successfully!

Output directory: /home/command/medieval-life-sim/simulation-output

🎉 Simulation complete!
```

## Use Cases

### Research & Analysis
- Study emergent behavior in simulated societies
- Analyze life patterns and outcomes
- Test game mechanics and balance

### Storytelling
- Generate character backstories for RPGs
- Create realistic medieval life narratives
- Develop family histories for campaigns

### Testing
- Stress test the simulation engine
- Verify NPC autonomy systems
- Validate marriage and reproduction mechanics

### Entertainment
- Watch unique lives unfold
- Compare different seeds
- Discover interesting character stories

## Technical Notes

### Architecture
- Uses the full Medieval Life Simulation engine
- Runs in headless mode (no UI)
- Processes simulation in batches for performance
- Tracks only significant events to minimize memory

### Limitations
- Maximum age: 80 years
- Timeout: 1,000,000 turns (safety limit)
- Output directory: `./simulation-output/`
- Single character focus (doesn't track all NPCs)

### Customization
You can modify the script to:
- Change world generation parameters
- Adjust max age limit
- Modify event tracking criteria
- Customize narrative format
- Add additional output formats

## Troubleshooting

### "Failed to initialize world"
- Check that all game files are present
- Verify Node.js version (18+)
- Try a different seed

### "Simulation timeout"
- Character lived too long or simulation stuck
- Results are still saved up to timeout point
- Try reducing MAX_AGE in the script

### "Out of memory"
- Reduce world size in worldConfig
- Lower population limits
- Decrease settlements count

## Future Enhancements

Potential additions:
- Multiple character tracking
- Graphical family tree output
- CSV export for data analysis
- Interactive replay mode
- Comparison between multiple lives
- Achievement/milestone tracking

## Credits

Part of the Medieval Life Simulation project - a naturalistic medieval life simulator with emergent gameplay.

## License

MIT License - Same as the main Medieval Life Simulation project

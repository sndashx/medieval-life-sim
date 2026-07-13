# Medieval Life Simulation - Blessed UI Edition

## 🎨 Beautiful Terminal Graphics

Experience the Medieval Life Simulation with **pixel-perfect terminal graphics** powered by the `blessed` and `blessed-contrib` libraries. This enhanced UI provides a rich, immersive visual experience with:

- **True-color RGB support** with gradient effects
- **Split-panel layout** with dedicated sections for different information
- **Real-time progress bars** and gauges for health, hunger, thirst, and sleep
- **Color-coded status indicators** (green/yellow/red based on severity)
- **Scrollable content areas** with smooth navigation
- **Icon-enhanced messages** for better visual feedback
- **Responsive layout** that adapts to terminal size

## 🚀 Quick Start

### Launch the Blessed UI

```bash
./sandboxed-blessed [optional_seed]
```

Or from anywhere (if you've added the alias):

```bash
cd /home/command/medieval-life-sim
./sandboxed-blessed 12345
```

### First Time Setup

The game will automatically install dependencies on first run. Just execute the launcher script.

## 🎮 UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Character Name | Age 25 | Farmer | Summer - Morning            │ Header Bar
├──────────────────────────────────┬──────────────────────────────┤
│                                  │                              │
│  🗺️  Location & Surroundings     │  💚 Character Status         │
│                                  │                              │
│  Biome, Weather, Resources       │  Health Bars (with colors)   │
│  Ground Items                    │  Needs (Hunger/Thirst/Sleep) │
│  Nearby People                   │  Household Info              │
│                                  │                              │
├──────────────────────────────────┼──────────────────────────────┤
│                                  │                              │
│  📜 Message Log                  │  [Health Gauge]              │
│                                  │                              │
│  Scrolling event history         │  ⚡ Quick Actions            │
│  Color-coded by type             │  [W]ork [S]leep [E]at        │
│                                  │                              │
├──────────────────────────────────┴──────────────────────────────┤
│  💬 Command: _                                                   │ Input
└─────────────────────────────────────────────────────────────────┘
```

## 🎨 Visual Features

### Color-Coded Status

- **Green**: Healthy/Good condition
- **Yellow**: Warning/Moderate concern
- **Red**: Critical/Immediate attention needed
- **Cyan**: Information/Neutral
- **Magenta**: Social/Combat interactions

### Progress Bars

All vital statistics are displayed with visual progress bars:

```
Health: [████████████░░░░] 75%
Hunger: [██████████░░░░░░] 60%
Thirst: [████████████████] 100%
```

### Message Icons

- `•` Info messages
- `→` Actions taken
- `✓` Success
- `✗` Errors
- `⚔` Combat
- `⚙` System messages

## 🎯 Commands

### Character Management
- `start` - Begin a new life
- `status` - View detailed character status
- `inventory` / `i` - View inventory

### Actions
- `look` / `l` - Examine surroundings
- `move <direction>` / `m <dir>` - Move (n/s/e/w)
- `take <item>` - Pick up item from ground
- `drop <item>` - Drop item from inventory
- `eat [item]` / `e [item]` - Consume food
- `drink` - Drink water
- `sleep` / `s` - Rest for 8 hours
- `work` / `w` - Work at your occupation

### Social
- `talk <name>` - Talk to nearby person

### System
- `save` - Save game to file
- `help` - Show command reference
- `quit` / `exit` - Exit game

## ⌨️ Keyboard Shortcuts

- `Enter` - Focus command input
- `↑` / `↓` - Scroll location panel
- `Escape` / `q` / `Ctrl+C` - Quit game

## 🎨 Visual Enhancements

### Dynamic Color Coding

The blessed UI automatically color-codes information based on context:

- **Biomes**: Green for forests, yellow for plains, blue for water
- **Health**: Gradient from green (healthy) to red (critical)
- **Occupations**: Yellow for merchants, white for others
- **Resources**: Green (abundant) → Yellow (moderate) → Red (depleted)

### Real-Time Updates

All panels update in real-time as you play:
- Location changes immediately reflect new surroundings
- Status bars animate as values change
- Message log scrolls automatically with new events
- Health gauge updates with visual feedback

### Smooth Scrolling

Navigate through long content with smooth scrolling:
- Use arrow keys to scroll the location panel
- Message log auto-scrolls to show latest messages
- All scrollable areas have visual scrollbar indicators

## 🔧 Technical Details

### Dependencies

- `blessed` - Terminal UI framework with rich widget support
- `blessed-contrib` - Additional widgets (gauges, graphs, etc.)
- Node.js 18+ with ES modules support

### Performance

- Sub-millisecond redraws for smooth animations
- Efficient rendering with smart CSR (Change Screen Rendering)
- Minimal CPU usage during idle periods
- Handles large amounts of text without lag

### Compatibility

- Works on Linux, macOS, and Windows (with proper terminal)
- Requires terminal with 256-color support (most modern terminals)
- Best experience with terminals supporting true-color (24-bit)
- Minimum terminal size: 80x24 characters

## 🆚 Comparison with Standard UI

| Feature | Standard UI | Blessed UI |
|---------|-------------|------------|
| Layout | Single column | Multi-panel grid |
| Colors | Basic ANSI | True-color RGB |
| Progress Bars | Text-based | Visual gauges |
| Scrolling | Manual | Smooth navigation |
| Status Display | Text list | Color-coded bars |
| Message Log | Inline | Dedicated panel |
| Visual Feedback | Minimal | Rich icons/colors |

## 🎮 Gameplay Tips

1. **Monitor the status panel** - Color changes indicate when action is needed
2. **Use keyboard shortcuts** - Faster than typing full commands
3. **Check the message log** - Important events are logged with icons
4. **Watch the health gauge** - Visual indicator of overall condition
5. **Explore with look** - Updates all panels with current information

## 🐛 Troubleshooting

### UI appears broken or garbled
- Ensure your terminal supports 256 colors
- Try resizing the terminal window
- Check terminal size is at least 80x24

### Colors not displaying correctly
- Enable true-color support in your terminal
- Try a different terminal emulator (e.g., iTerm2, Windows Terminal)

### Input not working
- Press `Enter` to focus the command input
- Ensure the terminal window has focus

## 📝 Development

The blessed UI is implemented in:
- `src/ui/BlessedGameUI.js` - Main UI class
- `src/main-blessed.js` - Entry point
- `sandboxed-blessed` - Launch script

To modify the UI layout, edit the `setupUI()` method in `BlessedGameUI.js`.

## 🎉 Enjoy!

Experience medieval life like never before with beautiful, responsive terminal graphics!

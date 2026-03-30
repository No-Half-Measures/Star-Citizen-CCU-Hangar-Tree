# Star Citizen CCU Chain Visualizer

A web-based tool to visualize your Star Citizen Cross-Chassis Upgrade (CCU) chains from your hangarlink.json file.

## Features

- 📊 **Visual CCU Chain Tree**: See your upgrade paths as an interactive family tree
- 🚫 **Exclude Items**: Filter out ships or upgrades you don't want to see
- ➕ **Add Custom Items**: Add ships or upgrades not in your hangar (marked as not owned)
- 🎨 **Dark UI**: Sidebar + graph layout tuned for hangar dumps
- 🔍 **Interactive**: Click on nodes to see detailed information
- ⚙️ **View Options**: Toggle between owned items, upgrades, and ships

## How to Use

1. Open `index.html` in a modern web browser
2. Upload your `hangarlink.json` file (drag & drop or click to browse)
3. The visualization will automatically build your CCU chain tree
4. Use the sidebar controls to:
   - Exclude specific ships or upgrades
   - Add custom items (ships or upgrades not in your hangar)
   - Toggle view options

## File Structure

- `index.html` - Main HTML file
- `styles.css` - Styling
- `app.js` - Application logic
- `README.md` - This file

## Browser Compatibility

Works best in modern browsers (Chrome, Firefox, Edge, Safari) with JavaScript enabled.

## Notes

- Red nodes: not owned / custom / edge-only; blue: hangar CCU chain; green: standalone ship pledge
- Buyback upgrades are grey edges when shown; with “owned only” on they still appear if buyback is enabled
- Hierarchical layout, left → right along CCU direction


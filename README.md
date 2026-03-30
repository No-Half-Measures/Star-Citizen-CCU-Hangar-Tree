# Star Citizen CCU Chain Visualizer

Web app that turns a **hangarlink.json** export into an interactive CCU (Cross-Chassis Upgrade) graph. Uses [vis-network](https://visjs.github.io/vis-network/) for layout and pan/zoom; ships and upgrades appear as nodes, CCU steps as edges.

## Features

- **Hangar import**: Choose a `.json` file or drag it onto the upload area; the graph rebuilds from pledges and upgrades in the file.
- **View options**: Show owned-only, upgrades, ships, and buyback pledges independently; optional **hide redundant CCU** (edges into hulls you already own as full ships).
- **Exclude list**: Search and uncheck ships or upgrades to hide them from the graph (preferences persist).
- **Custom items**: Add synthetic upgrades or ships (slugs + labels) so you can plan chains not yet in the hangar.
- **Graph UI**: Zoom in/out, fit view, and a sidebar legend for node colors and edge styles (standard CCU, redundant-target dashed links, buyback).
- **Persistence**: The last uploaded hangar JSON and your sidebar choices are stored in the browser (see below).

## How to use

1. Open `index.html` in a modern browser (JavaScript enabled). The first run needs network access so **vis-network** and **Feather** icons can load from the CDN.
2. Upload your `hangarlink.json` (same format as typical Hangar XPLORer / hangar exports).
3. Use **Controls** to filter the graph; click a node to open the detail panel.
4. Unrelated CCU trees may appear as separate components; that is normal when paths do not share a hull.

## What gets saved locally

All of this is stored in **localStorage** for this origin only:

| Key | Purpose |
| --- | --- |
| `ccuTree_hangarJson` | Raw text of the last loaded hangar JSON |
| `ccuTree_excludedItems` | Slugs excluded via the checklist |
| `ccuTree_customItems` | Custom upgrades/ships you added |
| `ccuTree_viewOptions` | Checkbox state for view options |

Clearing site data for the page removes these. Uploading a new JSON replaces the cached hangar without wiping exclusions and custom rows unless you change them yourself.

## File layout

- `index.html` — Page shell, upload + controls + graph container
- `styles.css` — Layout and theme
- `app.js` — Parse hangar, build nodes/edges, vis-network wiring
- `README.md` — This file

## Browser support

Recent Chrome, Firefox, Edge, or Safari. If the graph area shows a library load error, check network/ad blockers and reload.

## Legend (quick reference)

- **Nodes**: green — full standalone ship pledge; blue — in hangar as part of a CCU chain or ticket; coral — custom or context shown as unowned.
- **Edges**: blue solid — normal CCU; amber dashed — upgrade target is a hull you already own (when redundant-CCU hiding is off); gray — buyback when buyback is shown.

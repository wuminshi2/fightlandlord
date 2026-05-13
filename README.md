# Fight Landlord

A polished single-player Fight the Landlord desktop game built with Electron. The game includes classic bidding and card-playing rules, AI opponents, achievements, persistent score tracking, imported background music, and a full-screen desktop interface.

## Features

- Classic Fight the Landlord gameplay with bidding, landlord assignment, bombs, rockets, spring and anti-spring scoring.
- Single-player mode against two AI opponents with configurable difficulty.
- Title screen with start game, settings, achievements, and exit controls.
- Full-screen startup with in-game windowed/full-screen toggle.
- Drag-and-drop hand sorting, right-click deselection, smart hints, and one-click auto sorting.
- Persistent statistics, achievements, settings, and cumulative player score.
- Randomized looped BGM from bundled CC0 audio tracks.
- Windows installer packaging through `electron-builder`.

## Tech Stack

- Electron
- Vanilla HTML, CSS, and JavaScript
- Web Audio API for sound effects
- Local JSON storage through Electron IPC

## Getting Started

Install dependencies:

```powershell
npm install
```

Run the app in development:

```powershell
npm.cmd start
```

PowerShell may block `npm.ps1` on some Windows machines, so `npm.cmd` is the safer command form.

## Build Windows EXE

Create the Windows installer:

```powershell
npm.cmd run build
```

Build output:

- Installer: `build/斗地主 Setup 1.0.0.exe`
- Unpacked app: `build/win-unpacked/斗地主.exe`

## Tests

Run the integration checks:

```powershell
node test-full.js
```

Run the smaller core test:

```powershell
node test-core.js
```

## Project Structure

```text
.
├── assets/
│   └── audio/              # Bundled CC0 background music
├── renderer/
│   ├── css/                # Table, card, animation, and modal styles
│   ├── js/                 # Game rules, AI, UI, sound, storage
│   └── index.html          # Renderer entry
├── main.js                 # Electron main process
├── preload.js              # Safe IPC bridge
├── package.json
├── test-core.js
└── test-full.js
```

## Audio Credits

Bundled background music is sourced from OpenGameArt and marked as CC0/public domain. See `assets/audio/LICENSES.md` for source links and attribution details.

## License

MIT

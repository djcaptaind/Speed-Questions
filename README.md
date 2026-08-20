# Callaway Chargers Challenge — Stadium Broadcast Edition

This package is a full visual upgrade of the working Callaway JROTC Firebase team answer game.

## Major visual upgrades
- Stadium/broadcast-style header and arena
- Animated orange/blue ambient lighting and scan-grid background
- Large Callaway Chargers logo treatment and watermark
- Live response meter showing how many eligible teams have answered
- More dramatic A/B/C/D answer cards
- Broadcast-style live leaderboard with top-rank highlighting
- Phase-driven visual states for OPEN / LOCKED / REVEALED
- Stronger team-screen presentation
- QR code now carries the room code automatically to the team page

## Game behavior preserved
- Correct answer: +100 (or question point value)
- Wrong answer: -50
- No answer: -50
- Teams may change answers until the instructor locks answers
- A team joining after a question starts is not penalized for that question
- CSV/Excel question manager remains included
- Firebase configuration for `callaway-jrotc-answer-game` is included

## Upload to GitHub
Upload the CONTENTS of this folder to the ROOT of the `Speed-Questions` repository and replace the matching files.

Important files:
- `host.html` — instructor screen
- `index.html` — team screen
- `styles.css` — Stadium Broadcast visual design
- `host.js` — host/Firebase/scoring logic
- `app.js` — team answering logic
- `firebase-config.js` — Firebase connection
- `callaway-chargers-logo.png` — Callaway logo

After GitHub Pages deploys, hard refresh with Ctrl + Shift + R.

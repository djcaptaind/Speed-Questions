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


## Adjustable Question Timer Upgrade
- Timer is adjustable from **5 to 300 seconds**.
- Quick presets: **15 / 20 / 30 / 45 / 60 seconds**.
- Timer setting automatically carries to the next question.
- Timer is synchronized through Firebase and is visible on the **host screen and every team phone**.
- At **0 seconds**, answers automatically lock.
- Host can **pause/resume** the timer.
- Host can add **+5 seconds** during a live question.
- `APPLY TO CURRENT QUESTION` resets the active question's timer to the newly selected time.
- The timer can be turned **OFF** for untimed questions.
- The timer changes from orange to amber at 10 seconds and flashes red for the final 5 seconds.
- No-answer scoring remains **-50** when the instructor reveals/scores the question.

The built-in **FULL SCREEN** button from the previous upgrade is retained.


## Timer Flow Update
The timer now follows the host controls automatically:

1. **Start Question** — timer starts.
2. Teams may answer/change answers while time remains.
3. **Next Question** — the next question opens and a brand-new timer starts automatically.
4. **Reveal + Score** — the timer stops and resets to the selected duration.
5. The reset timer stays ready until the next question begins.

Example: if the timer is set to **30 seconds**, Reveal + Score resets the display to **30**, and Next Question immediately begins counting down from **30** again.

The host can still pause/resume, add +5 seconds, change the duration, or turn the timer off.


# GOD MODE
- Cinematic intro
- Synchronized 3-2-1 GO before every question
- Adjustable timer starts after GO
- TIME / ANSWERS LOCKED takeover
- 3-2-1 reveal countdown
- Fastest correct team
- Correct-answer streaks
- Champion ceremony with podium/confetti
- Full screen, Firebase, CSV imports, +100/-50/-50 retained


## GOD MODE Performance Edition

This build specifically optimizes cadet answer selection:

- Answer buttons respond **immediately on the phone** without waiting for Firebase.
- Rapid answer changes are **debounced** so only the newest selection is sent.
- Firebase writes update only that team's `answers/<teamId>` record.
- Answer-only Firebase updates **do not rebuild the question or A/B/C/D buttons**.
- The question animation no longer restarts when another team submits.
- The scoreboard only rebuilds when a team score/name/streak actually changes.
- Timer updates remain independent from answer rendering.
- GOD MODE phase effects still run for countdown, lock, reveal, and champion screens.
- Cadets can still change answers until lock/timer expiration.


## Instructor Access Upgrade

- The **Instructor Screen link has been removed from the cadet/team page**.
- Opening `host.html` now displays an **Instructor PIN gate** before any game controls appear.
- Default instructor PIN: **1974**
- To change it, open `host.js` and change:

  `const INSTRUCTOR_PIN = '1974';`

- Unlock stays active only for the current browser tab/session. Closing the tab clears the unlocked session.

### Important security note
Because this game is hosted as a static GitHub Pages site, a PIN stored in JavaScript is a **casual-access deterrent**, not strong authentication. A technically skilled user could inspect the public source code and find the PIN. For true instructor-only security, the next step would be Firebase Authentication and security rules.

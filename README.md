# CALLAWAY CHARGERS — MASTER FINAL 2026.08.21

Use only this build going forward. See `START_HERE_MASTER_FINAL.txt` for deployment instructions.

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

## Phone Question Sync Fix
- Host publishes the actual question to Firebase before the 3–2–1 countdown.
- Phones preview the question during countdown, then answers enable at GO.
- Backup listeners watch currentQuestion and phase.
- LIVE / RECONNECTING badge shows Firebase status.


## Critical Phone Runtime Fix

This update fixes the exact JavaScript failure that could leave a cadet phone on:
**“The instructor will start the first question.”**

The GOD MODE/Performance build referenced several runtime variables before they were
declared (`previousCinematicKey`, render keys, and answer-write queue state). When the
first Firebase room update arrived, that caused the phone listener to stop before it
could render the question.

Fixes:
- Declares all GOD MODE / Performance runtime variables.
- Protects Firebase rendering from animation/effects errors.
- Forces the phone connection badge to LIVE when room state is successfully received.
- Keeps the pre-countdown question sync fix.
- Keeps instructor PIN, timer, full screen, performance mode, and all scoring/effects.


## English / Spanish Bilingual Team Mode

Cadets choose a language when joining:

- 🇺🇸 **English**
- 🇲🇽 **Español**
- 🇺🇸 + 🇲🇽 **English + Español**

The instructor screen stays in English. Spanish-support teams are identified with **ES** or **EN/ES** badges on the host leaderboard.

### Question translations

The game does not send question text to an outside translation service. Spanish question text is stored with the question bank so the instructor controls the wording.

The Question Manager now includes optional Spanish fields for:
- Question Spanish
- Answer A Spanish
- Answer B Spanish
- Answer C Spanish
- Answer D Spanish

CSV import/export now supports the same Spanish columns. A ready-to-use file named
`Callaway_Bilingual_Question_Bank_Template.csv` is included in this package.

If a cadet selects Español but a question has no Spanish translation, the game safely displays the English question with a notice instead of showing a blank screen.

The five default sample questions in `questions.js` include Spanish support.


## QR Reliability Upgrade

The game now has two QR layers:

1. **Room-specific QR** — when QRCode.js loads, the QR sends cadets directly to the team page and automatically fills the room code.
2. **Permanent fallback QR** — `team-join-qr.png` is bundled in the repository. If the school network blocks the external QR library, this QR still opens the team page. Cadets then type the large room code shown directly below the QR.

Other changes:
- QR display increased to 220 × 220.
- High error correction is used for the room-specific QR.
- Larger white quiet zone improves scanning from a projector/TV.
- Direct team join link is displayed as a backup.
- Scanned room codes are prefilled and locked on the team page.


## Critical QR Public URL Fix

If `host.html` is opened from the instructor computer's Downloads folder, the browser URL begins with `file:///C:/...`.

A phone cannot access that local Windows path.

This build forces every room-specific QR code to point to:

`https://djcaptaind.github.io/Speed-Questions/index.html?room=ROOMCODE`

Therefore:
- The instructor may run the host screen locally or from GitHub Pages.
- Cadet phones always open the public GitHub Pages team screen.
- The active room code is automatically filled when the room-specific QR is generated.
- The permanent fallback QR also points to the public GitHub Pages team page.

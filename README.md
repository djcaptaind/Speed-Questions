# Callaway Chargers JROTC Answer Game — Logo + Layout Upgrade

## What was updated
- Added the **new Callaway Chargers JROTC logo** throughout the game.
- Updated the host and team layouts to be **more eye-catching** with stronger orange/blue branding.
- Added **automatic scoring**:
  - Correct = **+100**
  - Wrong = **-50**
  - **No answer = -50**
- Teams can **change their answer until the host locks answers**.
- Only teams already active when a question starts are eligible for the **no-answer penalty**.
- Question Manager remains included for CSV/Excel imports.

## Files to upload to GitHub
Upload **all files in this folder** to your repository root.

## Important setup
1. Open `firebase-config.js`
2. Paste your Firebase project configuration.
3. Make sure your GitHub Pages site points to the same folder where these files are uploaded.

## Firebase rule reminder
Use rules that allow the game to read and write during setup/testing.

## Main pages
- `host.html` = instructor screen
- `index.html` = team screen

## Question import format
Your CSV headers must be exactly:

Question, Answer A, Answer B, Answer C, Answer D, Correct Answer, Points

Correct Answer must be **A, B, C, or D**.

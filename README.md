# JROTC Team Answer Game

A live classroom quiz game designed for GitHub Pages. All teams see the same question, submit one answer, and watch a shared live leaderboard. The instructor controls question progression and scoring from a separate host screen.

## Features

- Shared question screen for every team
- A/B/C/D answer choices
- One answer submission per team per question
- Live team scoreboard visible to all teams
- Instructor host dashboard
- Lock answers before reveal
- Automatic scoring on reveal
- Manual +50 / -50 score adjustment
- Room codes so multiple classes can use the same site
- Mobile, Chromebook, laptop, and classroom-TV friendly
- Callaway orange-and-blue styling

## 1. Create Firebase Realtime Database

GitHub Pages is static, so Firebase is used only for real-time game state.

1. Go to Firebase Console and create a project.
2. Add a **Web App** to the project.
3. Open **Build > Realtime Database** and create a database.
4. For a simple classroom setup, use these Realtime Database rules:

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> These open rules are easiest for a classroom demo but are not appropriate for sensitive/private data. Do not store student personal information in the game.

5. Copy the Firebase Web App config into `firebase-config.js`.

## 2. Customize questions

Open `questions.js`. Each question uses this format:

```js
{
  question: "Your question?",
  choices: ["A choice", "B choice", "C choice", "D choice"],
  answer: 1,
  points: 100
}
```

`answer` is zero-based: A=0, B=1, C=2, D=3.

## 3. Publish with GitHub Pages

1. Create a GitHub repository, for example `jrotc-team-answer-game`.
2. Upload all files from this folder to the repository root.
3. In GitHub: **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/root`, then Save.
6. GitHub will provide your public game URL.

## 4. Run the game

### Instructor
Open:

`https://YOUR-USERNAME.github.io/jrotc-team-answer-game/host.html`

Enter a room code such as `LET3A` and click **Create / Open Room**.

### Teams
Open:

`https://YOUR-USERNAME.github.io/jrotc-team-answer-game/`

Each team enters the same room code and its team name.

### Round sequence

1. Instructor clicks **Start Question**.
2. Every team sees the question at the same time.
3. Each team selects A, B, C, or D once.
4. Instructor can see which teams have answered.
5. Instructor clicks **Lock Answers**.
6. Instructor clicks **Reveal + Score**.
7. Correct teams receive the question's points automatically.
8. Instructor clicks **Next Question**.

## Classroom recommendation

Display the team page on the classroom TV so everyone can see the live leaderboard. Keep `host.html` open only on the instructor computer so students cannot control the game.


## Updated automatic scoring

Correct answers automatically add the question point value (normally +100), wrong submitted answers automatically subtract 50 points, and unanswered questions receive 0 points when the instructor selects **Reveal & Score**.

## Team name controls
- Teams choose their own names when joining.
- Names are limited to 20 characters.
- Duplicate names are blocked.
- A basic inappropriate-name filter is included.
- The instructor can rename or remove teams from the host scoreboard without changing a team’s score when renamed.

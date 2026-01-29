# Sarah's Reward Tracker

A web app to track Sarah's rewards and penalties based on behavior and achievements.

**Live URL**: Deployed on Railway (check Railway dashboard for domain)

**GitHub Repo**: https://github.com/floralu2015/sarah-reward-tracker

---

## Reward Rules

| Event | Amount | Condition |
|-------|--------|-----------|
| Crying incident | -$50 | Cannot calm down by herself |
| Piano practice | +$50 | 150 minutes per week (flexible daily distribution) |
| Test score | +$100 | Score 95%+ on any test |

---

## Features

- **Balance Dashboard**: Shows current total earnings/losses
- **Piano Progress Bar**: Tracks weekly practice (Mon-Sun), shows progress toward 150 min goal
- **Log Piano**: Add practice sessions with date and minutes
- **Log Test**: Record test scores with subject, auto-awards $100 for 95%+
- **Log Incident**: Record crying incidents with optional note (-$50)
- **Transaction History**: View all activity with delete option
- **Confetti Celebration**: Fun animations when earning rewards
- **Data Persistence**: PostgreSQL database - data syncs across all devices

---

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (single-page app)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Railway)
- **Hosting**: Railway

---

## Project Structure

```
reward-tracker/
├── index.html       # Frontend (HTML, CSS, JS all-in-one)
├── server.js        # Express API server with PostgreSQL
├── package.json     # Node dependencies
├── railway.toml     # Railway deployment config
├── nixpacks.toml    # Build config
└── README.md        # This file
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data` | Get all data (balance, sessions, transactions) |
| POST | `/api/piano` | Log piano practice session |
| POST | `/api/test` | Log test score |
| POST | `/api/incident` | Log crying incident |
| DELETE | `/api/transaction/:id` | Delete a transaction |
| POST | `/api/reset` | Reset all data |

---

## Database Schema

```sql
-- Piano practice sessions
piano_sessions (id, date, minutes, created_at)

-- Track which weeks received piano awards
weekly_awards (id, week_start, created_at)

-- Test scores
tests (id, date, subject, score, max_score, awarded, created_at)

-- Crying incidents
incidents (id, date, note, created_at)

-- All balance changes (rewards and penalties)
transactions (id, date, type, amount, description, created_at)
```

---

## Deployment History

### Initial Build (Jan 28, 2026)
1. Created single-file HTML app with localStorage
2. Added Express server for Railway deployment
3. Deployed to Railway via GitHub integration
4. Added PostgreSQL database for cross-device data persistence
5. Updated frontend to use API calls instead of localStorage

### Railway Setup Steps
1. Create GitHub repo: `sarah-reward-tracker`
2. Connect Railway to GitHub repo
3. Add PostgreSQL database in Railway project
4. Link DATABASE_URL variable to the app service
5. Auto-deploys on git push

---

## Local Development

```bash
# Install dependencies
npm install

# Set environment variable
export DATABASE_URL="postgresql://..."

# Run server
npm start

# Open http://localhost:3000
```

---

## Design Decisions

- **No authentication**: Trust-based system for family use
- **Week starts Monday**: Piano goal resets every Monday
- **Edit/Delete allowed**: Users can freely modify entries
- **Fun & colorful theme**: Kid-friendly design with confetti rewards

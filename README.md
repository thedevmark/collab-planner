# Twitch Friends Organizer

A single-user web app for planning collab streams with your Twitch friends. Uses AI to find the best times to stream together, suggest games, and generate ready-to-send Discord messages.

## What it does

- **Friends system** — Add Twitch streamers by username. The app pulls their real VOD history (past broadcasts) to learn when they typically stream and what they play.
- **Smart scheduling** — AI analyzes your streaming patterns and your friends' to find overlap windows. Get ranked time suggestions with reasoning.
- **Game suggestions** — AI recommends games based on what you and your friends actually play, plus what's trending on Twitch.
- **Discord messages** — Generate personalized collab invite and reminder messages, ready to copy-paste into Discord.
- **Calendar** — Visual calendar showing your events alongside estimated stream times for all your friends.
- **Reminders** — Set browser notification reminders for upcoming collabs.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Twitch Developer](https://dev.twitch.tv/console/apps) account (free)
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (free tier available)

### Install

```bash
git clone https://github.com/yourusername/TwitchFriendsOrganizer.git
cd TwitchFriendsOrganizer
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and go to **Settings** to add your API keys.

### API Keys

You configure everything in-app on the **Settings** page — no `.env` file needed.

| Key | Where to get it | What it does |
|-----|----------------|--------------|
| Twitch Client ID | [Twitch Developer Console](https://dev.twitch.tv/console/apps) | Search for streamers, pull VOD history and schedules |
| Twitch Client Secret | Same as above | Authenticate with Twitch API |
| Gemini API Key | [Google AI Studio](https://aistudio.google.com/apikey) | AI time/game suggestions, Discord message generation |

Alternatively, you can set them as environment variables in a `.env.local` file (see `.env.example`). Keys saved in Settings take priority over env vars.

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **SQLite** via Prisma ORM — zero-config local database
- **Tailwind CSS v4** + shadcn/ui components
- **Google Gemini 2.5 Flash** — AI suggestions and message generation
- **Twitch Helix API** — user search, VOD history, schedules, game categories
- **FullCalendar** — interactive calendar view
- **SWR** — client-side data fetching

## How it works

1. **Add your Twitch username** in Settings — the app pulls your past broadcasts to learn your streaming patterns
2. **Add friends** by their Twitch username — their VOD history is fetched automatically
3. **Plan a collab** — select friends, click "Suggest Times" for AI-ranked time slots that work for everyone
4. **Pick a game** — click "AI Suggest" for game recommendations based on shared play history
5. **Send invites** — generate a Discord message and copy it with one click

The AI considers:
- Actual stream history (days, times, duration, games played)
- Posted Twitch schedules (if available, used as supplementary data)
- Trending games on Twitch
- Your own streaming patterns (you're always included in suggestions)

## Project Structure

```
app/                    # Next.js pages and API routes
├── api/                # REST API endpoints
├── calendar/           # Calendar view
├── events/             # Create/view events
├── friends/            # Friends list and detail
├── messages/           # Discord message generator
└── settings/           # API key configuration
lib/
├── apiKeys.ts          # Reads keys from DB, falls back to env vars
├── db.ts               # Prisma client singleton
├── twitch/             # Twitch API client, auth, VOD fetching
├── gemini/             # Gemini client and prompt templates
├── scheduling/         # Pattern analysis and overlap detection
└── discord/            # Message template fallbacks
components/             # UI components (shadcn/ui)
hooks/                  # React hooks (reminders, clipboard)
prisma/                 # Database schema and migrations
```

## License

MIT

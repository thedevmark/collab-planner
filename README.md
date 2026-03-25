# Twitch Friends Organizer

A single-user web app for planning collab streams with your Twitch friends. It uses stream history, schedules, and deterministic ranking logic to suggest times, surface likely games, and build Discord message drafts.

## What it does

- **Friends system** — Add Twitch streamers by username. The app pulls their real VOD history (past broadcasts) to learn when they typically stream and what they play.
- **Smart scheduling** — Pattern analysis ranks likely overlap windows based on real stream history and Twitch schedules.
- **Game suggestions** — Shared play history surfaces games your selected group is most likely to enjoy together.
- **Discord messages** — Build invite and reminder drafts from event details and selected friends.
- **Calendar** — Visual calendar showing your events alongside estimated stream times for all your friends.
- **Reminders** — Set browser notification reminders for upcoming collabs.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A Supabase project with Postgres and Auth enabled
- A [Twitch Developer](https://dev.twitch.tv/console/apps) account (free)

### Install

```bash
git clone https://github.com/yourusername/TwitchFriendsOrganizer.git
cd TwitchFriendsOrganizer
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Twitch.

### API Keys

You configure everything in-app on the **Settings** page — no `.env` file needed.

| Key | Where to get it | What it does |
|-----|----------------|--------------|
| `DATABASE_URL` / `DIRECT_URL` | Supabase project settings | Postgres connection for app data |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` | Supabase project settings | Authentication and session handling |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | [Twitch Developer Console](https://dev.twitch.tv/console/apps) | Search for streamers, pull VOD history and schedules |

Alternatively, you can set them as environment variables in a `.env.local` file (see `.env.example`). Keys saved in Settings take priority over env vars.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Postgres** via Prisma ORM
- **Tailwind CSS v4** + shadcn/ui components
- **Supabase Auth** — Twitch login and session handling
- **Twitch Helix API** — user search, VOD history, schedules, game categories
- **FullCalendar** — interactive calendar view
- **SWR** — client-side data fetching

## How it works

1. **Add your Twitch username** in Settings — the app pulls your past broadcasts to learn your streaming patterns
2. **Add friends** by their Twitch username — their VOD history is fetched automatically
3. **Plan a collab** — select friends, click "Suggest Times" for ranked time slots that fit the group
4. **Pick a game** — click "Suggest" for game recommendations based on shared play history
5. **Send invites** — build a Discord message draft and copy it with one click

The ranking considers:
- Actual stream history (days, times, duration, games played)
- Posted Twitch schedules (if available, used as supplementary data)
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
├── db.ts               # Prisma client singleton
├── twitch/             # Twitch API client, auth, VOD fetching
├── scheduling/         # Pattern analysis and overlap detection
└── discord/            # Message template builders
components/             # UI components (shadcn/ui)
hooks/                  # React hooks (reminders, clipboard)
prisma/                 # Database schema and migrations
```

## License

MIT

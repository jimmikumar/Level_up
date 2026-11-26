# LevelUp

A responsive personal routine and goal tracker built with React, Vite, Recharts and browser localStorage.

## Features
- Habit tracking across Health and fitness, Learning, Work and productivity, Business development, Personal development and My goals.
- XP rewards, levels and a daily challenge.
- Streak indicator, achievements and weekly consistency chart.
- Long term goals for finance, startup, YouTube, LinkedIn and other areas.
- Daily reflection note.
- Dark and light themes.
- Installable PWA shell with basic offline asset caching.
- JSON backup export and restore from Settings.
- Responsive layout for desktop and mobile.
- Data is saved in the browser using localStorage.

## Run locally
1. Install Node.js 18 or newer.
2. Extract this project.
3. Open a terminal in the project folder.
4. Run `npm install`
5. Run `npm run dev`
6. Open the local URL printed by Vite.

## Build for deployment
Run `npm run build`. The production site is generated in `dist/`. Deploy that folder or connect the repository to Vercel.

## Current MVP limitations
This version stores data in the current browser only. It does not yet sync between devices or provide login, cloud backups, reminders or a server database. The weekly chart uses saved day completion markers. Detailed per habit history and automatic reminder notifications will be added in a later version.


## Free deployment recommendation
- Store source code in a GitHub repository.
- Deploy the Vite `dist/` output to Cloudflare Pages Free.
- Keep JSON backups in Google Drive manually, or add Google Drive OAuth integration later.
- Cloud sync is intentionally not required in this local first architecture. Supabase can be added later as an optional sync provider.
- AI features can be added through a Cloudflare Worker proxy to Groq. Never put a Groq API key in browser code.


## Zero-cost-first deployment

See [NO_SURPRISE_BILLING.md](./NO_SURPRISE_BILLING.md) for the static hosting setup and steps to avoid enabling paid services. This version uses no paid backend or external API.
Cloud sync configuration updated. 

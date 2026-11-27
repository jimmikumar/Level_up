# LevelUp

LevelUp is a personal growth tracker with selectable preserved versions, including the latest V3.2 workspace. It is built with React and Vite and can be hosted as a static site on Cloudflare Pages.

## Versions

### V1
The original tracker is preserved in `src/LevelUpV1.jsx`. It retains its existing habits, goals, XP, charts, backup tools, authentication and Supabase table integration.

### V2
V2 is a redesigned personal dashboard with:
- Daily habit tracking and XP.
- Long term goals with progress controls.
- A task list.
- Daily reflections.
- Voice input through the browser Speech Recognition API.
- Spoken assistant replies through browser text to speech.
- A built in local command assistant for common habit, task and goal actions.
- An optional AI endpoint that can connect to an OpenAI compatible provider through a Cloudflare Worker.
- Separate Supabase storage in `user_progress_v2`, so V2 never overwrites V1 progress.
- Local browser backup for V2.

Use the V1 and V2 switch in the top right corner. The selected version is remembered on the device.

## Data storage

Both versions require a Supabase account login. V1 continues using its existing `user_progress` table. V2 uses a separate `user_progress_v2` table.

To enable V2 cloud sync, open the Supabase SQL Editor and run [SUPABASE_V2_SETUP.sql](./SUPABASE_V2_SETUP.sql). V2 also keeps a local browser copy under `levelup-v2-data`. Local browser data is specific to that browser and device. Sign in and configure the V2 table to sync across devices.

Set these build environment variables in Cloudflare Pages:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_AI_ASSISTANT_URL` (optional, the deployed Worker URL)

Never put an AI provider secret key in a `VITE_` variable or browser code.

## Optional AI assistant

The local assistant works without an AI provider and can perform common commands. For open ended AI responses, deploy [workers/ai-coach.js](./workers/ai-coach.js) as a Cloudflare Worker.

Set Worker variables:
- `AI_BASE_URL`, for example `https://api.groq.com/openai/v1`
- `AI_MODEL`, for example `llama-3.3-70b-versatile`

Add `AI_API_KEY` as a Worker secret using the Cloudflare dashboard or Wrangler secret command. You can use another provider that supports the OpenAI chat completions API by changing the base URL, model and secret.

Then set `VITE_AI_ASSISTANT_URL` to the Worker URL in Cloudflare Pages and redeploy the site. The provider key stays on the Worker.

## Run locally

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Create a `.env` file with the two Supabase variables and, optionally, the AI endpoint.
4. Run `npm run dev`.
5. Run `npm run build` to create the production build in `dist/`.

## Deployment

For Cloudflare Pages, connect this GitHub repository and use:
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

The existing V1 service worker and PWA setup remain in place. Review `NO_SURPRISE_BILLING.md` before enabling any paid service.


### V3 and V3.1
V3 and V3.1 are preserved in their own source files and use the V3 Supabase progress table.

### V3.2
V3.2 adds a compact version selector, AI plan suggestions that can be added individually or in bulk as tasks, day, week and month calendar views with drag and drop rescheduling, schedule conflict warnings, overdue task catch up scheduling that preserves original deadlines, energy aware AI planning, a next best action panel, goal health signals, productivity scoring, stale task signals, focus presets and break timing, and expanded AI Coach task actions.

V3.2 intentionally reuses the existing levelup-v3-data local storage key and user_progress_v3 Supabase table. This keeps existing V3 progress available without a new database migration. V1, V2, V3 and V3.1 remain selectable.

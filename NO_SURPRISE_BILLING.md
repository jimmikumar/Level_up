# LevelUp: zero-cost-first deployment

## What this version uses

- React and Vite for the app.
- Browser local storage for habits, goals, XP, and progress.
- JSON export and import for backups.
- Static hosting only.

There is no paid database, server, AI API, or background service in this version.
The app can run locally without creating any cloud account.

## Recommended hosting

Use **Cloudflare Pages on its Free plan** and deploy this as a static site.

Build settings:
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`

Connect a GitHub repository containing this project, then create a Pages project.
Keep the project on the Free plan. Do not add Workers, paid add-ons, or a paid
database for this version.

## How to keep billing disabled

1. Do not enable paid Workers or Workers Paid usage.
2. Do not attach a paid database or other paid Cloudflare product.
3. Do not add API keys for external services in the frontend.
4. Check the plan and billing page before enabling any new service.
5. Keep a recent JSON backup from LevelUp Settings.

Static Pages hosting on the Free plan does not need a card-backed usage-based
backend for this app. Provider terms and free-plan limits can change, so check
the current plan before deployment.

## Important data note

LevelUp stores data in the browser on the device where it is used. Browser data
can be lost if site data is cleared, the browser profile is removed, or the device
is replaced. Export a JSON backup regularly and store a copy somewhere safe.

## Run locally

```bash
npm install
npm run dev
```

## Build for deployment

```bash
npm run build
npm run preview
```

The generated production site is in `dist/`.

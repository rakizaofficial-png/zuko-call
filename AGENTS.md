<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### What this repo is
- Root is the primary product: the **Luma** Next.js 16 (Turbopack) user web app. Scripts are in `package.json` (`dev`, `build`, `start`, `lint`). Dev runs on `http://localhost:3000`.
- `expo-app/` is a secondary Expo/React Native product that is just a thin WebView shell pointing at the deployed web URL. It needs its own `npm install` (run inside `expo-app/`) plus an Android/iOS emulator or device, so it is not runnable in this headless VM. Setup here targets the web app only.

### Backend is external (not in this repo)
- The web app calls an external CoinCall API, default `https://coincall-api.onrender.com/api` (see `src/config/apiConfig.ts`). Override with `NEXT_PUBLIC_API_BASE_URL` if you have a local/other backend.
- No local backend or `.env` file is required for `npm run dev` — defaults are baked in. When that API is down or cold-starting (free tier), network-driven lists (online hosts, calls) will be **empty**; this is expected and not an environment failure. Client-side features (wallet ledger, rewards/daily check-in, navigation, IAP sheet) work without the backend.

### Lint
- `npm run lint` currently reports pre-existing errors/warnings in committed code. Treat those as baseline, not as a broken environment.

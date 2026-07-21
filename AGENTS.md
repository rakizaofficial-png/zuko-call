<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### What this repo is
- Root is the primary product: the **Luma** Next.js 16 (Turbopack) user web app. Scripts are in `package.json` (`dev`, `build`, `start`, `lint`). Dev runs on `http://localhost:3000`.
- `expo-app/` is a secondary Expo/React Native product: a thin WebView shell that loads `EXPO_PUBLIC_LUMA_WEB_URL` (default `https://luma-user.onrender.com`, see `expo-app/App.tsx`). Its deps are separate from the root (`npm --prefix expo-app install`).

### Running the Expo app
- Start the Metro dev server with `npx expo start` (or `npm start`) from inside `expo-app/` — it serves on port `8081`. The "Could not connect to development server" red screen just means Metro is not running; start it first. Metro bundling is verified working (the Android JS bundle at `/.expo/.virtual-metro-entry.bundle?platform=android` builds and returns HTTP 200).
- **No Android/iOS emulator can run inside the Cloud VM**: `/dev/kvm` is absent, so a hardware-accelerated emulator won't start (software emulation is not viable). Run the emulator on a local machine, or use a physical device with Expo Go / an EAS build. An Android emulator reaches Metro on the host at `http://10.0.2.2:8081`.
- To preview local web-app changes inside the shell, run the Next.js dev server (`npm run dev`) and launch Expo with `EXPO_PUBLIC_LUMA_WEB_URL=http://10.0.2.2:3000` (`10.0.2.2` is the Android emulator alias for the host's `localhost`). Otherwise the shell shows the deployed production site, not your local edits.

### Backend is external (not in this repo)
- The web app calls an external CoinCall API, default `https://coincall-api.onrender.com/api` (see `src/config/apiConfig.ts`). Override with `NEXT_PUBLIC_API_BASE_URL` if you have a local/other backend.
- No local backend or `.env` file is required for `npm run dev` — defaults are baked in. When that API is down or cold-starting (free tier), network-driven lists (online hosts, calls) will be **empty**; this is expected and not an environment failure. Client-side features (wallet ledger, rewards/daily check-in, navigation, IAP sheet) work without the backend.

### Lint
- `npm run lint` currently reports pre-existing errors/warnings in committed code. Treat those as baseline, not as a broken environment.

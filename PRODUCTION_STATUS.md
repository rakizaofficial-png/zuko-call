# Production status (2026-07-19) — Luma user app

## Architecture
- Next.js 16 user app (`luma-coincall-user`) talking to CoinCall Express+ws API
- Device UUID identity (`X-User-Id`) — not Firebase Auth / OTP yet
- Agora tokens minted by API; AI hosts = prerecorded catalog fallback

## Hardened this release
- Call billing awaits server `spendAsync` (no optimistic free minutes)
- AI fallback disclosed in call toast
- GiftSheet sends `X-User-Id`
- Reward credits prefixed `reward:` for server allowlist
- Free VIP activation surfaces purchase requirement on API reject

## Still not production-complete
- Live / party / messages mostly demo UI (not full Agora audience / chat)
- Spoofable device UUID (need JWT/Firebase Auth)
- Real IAP verification + merchant payouts (API-side)
- Mongo durability is API-side optional — not required in Luma

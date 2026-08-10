# Zuko — Play Store production release draft

This document is a release-preparation artifact. It does not replace the
Google Play Console declarations: they must accurately reflect the deployed
backend, SDK configuration, and legal privacy policy at the time of release.

## Release identity

| Field | Value |
| --- | --- |
| Application ID | `com.zuko.user` |
| Android version | `1.0.19` |
| Version code | `21` |
| Release source commit | `d2920ae` |
| Distribution | Google Play production Android App Bundle |

## Main store listing

**App name**

`Zuko – Live Video Calls`

**Short description** (73 characters)

`Discover hosts and enjoy one-to-one video and voice calls on Zuko.`

**Full description**

```text
Zuko helps you discover hosts and connect through one-to-one video and voice calls.

Explore live rooms, follow hosts you enjoy, and use coins for eligible in-app features such as calls, gifts, and access to supported live experiences. Manage your wallet, review activity, and choose VIP plans when they are available in your region.

Features
• Discover hosts and live experiences
• One-to-one video and voice calls
• Live chat and virtual gifts
• Wallet, coin, and purchase history
• VIP plans and member benefits where offered
• Reporting, blocking, and support tools

Some features require an internet connection, an eligible account, and device permissions. Availability can vary by country, account status, and host availability.
```

## Release notes — English (en-US)

```text
• Improved camera and microphone permission handling for video calls
• Improved call connection and safer billing verification
• Updated coin package catalogue and localized store pricing support
• Improved wallet, VIP, and payment authorization safeguards
• General stability and performance improvements
```

## Required listing media before submission

Capture real production-build screens only; do not use mock balances, fake
reviews, unsupported pricing, or misleading call outcomes.

1. App icon: existing 1024 × 1024 PNG is available at `expo-app/assets/icon.png`.
2. Feature graphic: original 1024 × 500 PNG/JPG, no pricing or misleading
   claims. Use the Zuko mark plus real in-app visual design.
3. Phone screenshots: at least two portrait screenshots from the signed
   production build. Recommended set: home/host discovery, call permission
   state, active call, live room, wallet/history, and safety/report screen.
4. Optional tablet screenshots only if tablet support is intentionally enabled.

## Data Safety completion evidence to verify

The source indicates that the Console declaration needs review for the
following categories. Select only data that the deployed app/SDKs actually
collect, share, retain, or process.

- Personal info: account email, display name, profile information.
- Photos/media: profile and chat-image uploads where enabled.
- Audio/video: camera and microphone streams used for calls; declare the
  actual retention and sharing behavior of Agora and backend services.
- Messages and user-generated content: direct/live chat and support content.
- Financial/app activity: coin wallet, purchases, gifts, call/live activity.
- Device or other IDs: installation/device identifiers and push tokens.

No location collection was identified in the User app source. Do not claim
"no data collected" while the above functionality is enabled.

## Privacy and account deletion prerequisites

Before submitting to production, publish a Zuko-branded, public privacy policy
that covers data collection, use, sharing, security, retention, payment
processors, call/video providers, contact details, and account deletion.

The current backend `/privacy` page is not sufficient: it is branded CoinCall,
does not fully cover the deployed data practices, and does not provide a real
account deletion request/process. Add a public deletion URL and ensure that
the in-app account-deletion path matches it before completing the Play Console
Data deletion form.

## Billing catalogue to create/activate in Play Console

| Product ID | Type | US price | Server entitlement |
| --- | --- | ---: | ---: |
| `zuko_coins_90` | Consumable one-time product | $1.00 | 90 coins |
| `zuko_coins_600` | Consumable one-time product | $5.00 | 600 coins |
| `zuko_coins_1300` | Consumable one-time product | $10.00 | 1,300 coins |
| `luma_vip_week` | Subscription | Set in Play Console | 7-day VIP mapping |
| `luma_vip_month` | Subscription | Set in Play Console | 30-day VIP mapping |
| `luma_vip_year` | Subscription | Set in Play Console | 365-day VIP mapping |

Google Play pricing remains authoritative. The app must display localized
ProductDetails prices and the backend must grant wallet/VIP value only after
Google Play Developer API verification.

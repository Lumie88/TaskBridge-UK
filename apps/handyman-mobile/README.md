# TaskBridge Handyman Mobile App

This Expo app is the Android/iOS alternative to the secure handyman web visit link.

It uses the existing TaskBridge production APIs:

- `GET /api/visit/:token`
- `POST /api/visit/:token/accept`
- `POST /api/visit/:token/decline`
- `POST /api/visit/:token/check-in`
- `POST /api/visit/:token/evidence-upload-url`
- `POST /api/visit/:token/evidence`
- `POST /api/visit/:token/complete`

## Local Run

```bash
cd apps/handyman-mobile
npm install
npm run start
```

Use Expo Go for early testing, or build a development client when testing universal links and native permissions.

## Configure API Origin

The default API origin is:

```text
https://www.growingfig.com
```

Change `expo.extra.apiBaseUrl` in `app.json` for staging or local testing.

For local testing against the desktop server, use a reachable LAN URL rather than `localhost`, for example:

```json
"extra": {
  "apiBaseUrl": "http://192.168.1.22:4173"
}
```

## Deep Links

Supported links:

- `taskbridge://visit/<token>`
- `https://www.growingfig.com/visit/<token>`
- `https://growingfig.com/visit/<token>`

Android intent filters and iOS associated domains are configured in `app.json`.
For full production universal links, add the Apple App Site Association and Android Asset Links files to the public web app after store identifiers are final.

## Build

Install EAS CLI, authenticate with Expo, then run:

```bash
npm run build:android
npm run build:ios
```

Recommended first release path:

1. Build Android `preview` APK for internal handyman testing.
2. Build iOS internal/TestFlight release.
3. Confirm camera, location, SMS link opening, evidence upload, and completion approval workflow.
4. Submit production builds when the app name, icon, privacy text, and store listing are final.

# Xello Tuition phone app (Expo)

The app shows the Xello Tuition website (https://xellotuition.com) inside a
phone app, so every feature and every role (owner, coordinator, Accounts,
trainer) works exactly as on the website, and website updates reach the app
without building a new APK.

What the app adds around the website:

- Staff stay signed in (the website's 30-day sign-in), and the Android back
  button goes back through website pages before leaving the app.
- Spreadsheets (CSV) and backup files are fetched with the signed-in session
  and offered through the phone's Save / Share sheet.
- WhatsApp, phone, email and other websites open in the phone's own apps.
- A clear "Can't reach Xello Tuition" screen with "Try again" when offline.

The rules for which addresses stay in the app, download or open outside are
in `src/web-shell.ts` (tested by `tests/mobile-shell.test.ts` at the project
root).

## Build an Android APK

```bash
cd mobile
npm ci
npx eas-cli build -p android --profile preview
```

iPhone builds need an Apple Developer account (the `preview` iOS profile only
builds for the simulator).

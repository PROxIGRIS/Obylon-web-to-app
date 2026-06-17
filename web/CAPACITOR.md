# Nexus Sentinel — Mobile Faculty Console (Capacitor)

Packages the Lovable web dashboard as a native **Android APK** with
push notifications for critical incidents.

> The default `vite build` produces a Cloudflare Worker bundle, **not**
> a flat `dist/index.html`. Capacitor needs the static SPA — use
> `npm run build:mobile` (defined in `package.json`), which runs
> `vite build` and stages the prerendered SPA into `dist-mobile/`.
> `capacitor.config.ts` already points `webDir` at `dist-mobile`.

## 1. Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/push-notifications
```

(Peer-installed at packaging time — they aren't required for the web build.)

## 2. Build the static bundle

```bash
npm run build:mobile
# → dist-mobile/index.html  (+ assets/)
```

If the script reports it can't find an `index.html`, your Vite output
location moved — open `scripts/build-mobile.mjs` and add the new path
to the `candidates` array.

## 3. Initialize Android (first time only)

```bash
npx cap add android
npx cap sync android
```

## 4. Build the APK

```bash
# Open in Android Studio for signed release builds
npx cap open android

# Or unsigned debug APK from CLI:
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## 5. Push notifications

`src/hooks/use-mobile-push.ts` is already wired into the dashboard. It
no-ops on the web build and on native it:

1. Requests permission and registers with FCM.
2. Stores the device token in `device_tokens` (Lovable Cloud).
3. Foreground pushes appear as toasts; tapping any push opens the
   matching dossier (`/case/$id`).

To deliver, configure Firebase (FCM) and have the `notify-principal`
edge function fan out a push to every row in `device_tokens` whenever an
`alerts` row with `severity = 'critical'` is inserted.

## 6. Live reload during development

```bash
npx cap run android --livereload --external
```

## Re-syncing after code changes

```bash
npm run build:mobile && npx cap sync android
```

# ClubOS mobile app roadmap

Goal: one iOS app and one Android app for every club, built from this React
codebase with Capacitor, with real native value rather than a website wrapper.

## Foundation already in place (Phase 1)

- `VITE_CLUBOS_MODE=multi`: the app starts at "Find your club" or returns to
  the remembered club, then connects to that club's own backend from the
  operator-managed registry.
- Per-club auth storage and caches; club switch reloads the app.
- `/clubs/<code>/...` links carry the club, ready to become universal/app links.

## Why Capacitor

Reuses the existing React/TypeScript app and Supabase client, has maintained
plugins for push, camera, share, preferences, biometrics and app links, and
keeps one codebase for web, iOS and Android. React Native would mean a rewrite.

## Work items (Phase 6)

1. Add `@capacitor/core`, iOS and Android projects; build `multi` mode into the
   native bundle; no remote-URL loading of the web app.
2. Registry: bundle a signed copy; refresh from the control plane; apply the
   same validator.
3. Secure session storage: Supabase auth `storage` adapter backed by Keychain /
   Keystore (per-club keys), replacing `localStorage` on native.
4. Biometric unlock (optional per user) over the stored session.
5. Push: APNs/FCM via `@capacitor/push-notifications`; register the device
   token with the selected club's backend only; unregister on sign-out and
   club switch; add a `device_tokens` migration and extend
   `send-push-notification`.
6. Deep links: universal links (iOS) and app links (Android) for
   `/clubs/<code>/...`; Supabase Auth redirect allowlist per club.
7. Camera and photo library for player photos, documents and match photos,
   respecting photography consent.
8. Native share sheet for invites and registration links.
9. Calendar: add-to-calendar and subscription via native intents.
10. Offline: cache non-sensitive data only (schedule, venues, club branding),
    per club, with clear offline states. No medical, safeguarding or contact
    details offline.
11. Account deletion in-app (App Store requirement) and data export request.
12. Privacy: App Store privacy labels, Play data safety form, permission
    prompts with purpose strings.
13. Accessibility: tab bar navigation, dynamic type, screen reader labels.

## Release

TestFlight and Play internal testing first, with Ambassadors staff. No store
submission or developer-account fees without the owner's approval. The Apple
nonprofit developer account application is pending.

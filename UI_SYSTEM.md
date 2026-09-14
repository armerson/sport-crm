# ClubOS UI system

The interface uses a quiet neutral canvas, white panels and club-colour actions. It is shared across clubs; a club's configured primary colour continues to drive actions and selected navigation.

## Foundations

`src/index.css` owns the `--ui-*` tokens: canvas, surface, ink, muted text, border, accent, radius and shadow. Use these rather than introducing new page-specific colour values. The deep green feature surface is a shared editorial treatment; it is not the configurable club colour.

Use 16px panel corners, 10px controls, 44px minimum primary interaction targets and 16px form input text. Group related content into panels with 20–24px padding. Reserve stronger shadows for floating controls. Motion is subtle and respects reduced-motion preferences.

## Components

- `Button`: primary, secondary and ghost variants; disabled and busy states. Busy buttons retain their action label to avoid width changes and expose `aria-busy`.
- `TextField` and `SelectField`: consistent labels, hints, disabled styling and optional `error` text linked to the control. Error appearance uses both text and colour.
- `TabNav`: pressed state and keyboard-focusable buttons. Workspace navigation becomes a desktop rail at 1024px; nested filters remain horizontal.
- `BottomNav`: mobile navigation, current-page semantics and unread indicators.
- `ui-panel`: reusable white surface with restrained border and shadow.
- `ui-feature`: high-emphasis next-session and registration panel.

The desktop rail uses the existing full role tab lists, so all existing destinations remain available. A skip link bypasses the dashboard header. At smaller widths the existing mobile navigation remains in place.

On phones, the workspace opens with a branded role header that names the current section, greets the member and explains the workspace. The content rises into a rounded sheet beneath it. Primary navigation floats above the device safe area, with a filled background for the current destination.

The installed app activates a completed release immediately and reloads its open shell when the service-worker controller changes. This keeps cached JavaScript and styles from leaving an older interface on screen after deployment.

## Preview and verification

Run `npm run dev` and visit `/ui-preview` for an interactive component and coaching-layout gallery using fictional records. The route and gallery are development-only, excluded from the production route tree. Preview actions do not write club data. Public `/register` and `/login` show the actual onboarding layouts.

Verified: lint, production build, 22 existing tests, desktop gallery, 390px mobile gallery without horizontal overflow, preview save interaction, and public registration/login browser checks. This UI pass does not repeat the authenticated database workflow tests from the previous release.

## Extending the system

Prefer shared primitives for new features. Older specialist screens still contain local utility styles; migrate these when changing those screens rather than adding global CSS overrides for unrelated elements. Keep warning, error and success colours semantic. Do not use colour as the only status indicator.

## Workflow rollout

Squad search matches names and shirt numbers and reports the visible player count. Attendance actions use 44px controls and explicit response text. Messaging stacks the conversation above its composer, preserves message line breaks, wraps long content and disables empty sends. Parent registration uses the shared canvas and a three-stage progress indicator. Registration was checked at 390px without horizontal overflow. Authenticated role workflows were not re-exercised with real member accounts in this visual rollout.

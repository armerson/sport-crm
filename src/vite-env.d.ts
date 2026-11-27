/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_CLUBOS_MODE?: 'standalone' | 'directory' | 'multi'
  readonly VITE_CLUBOS_REGISTRY_JSON?: string
  readonly VITE_CLUBOS_BACKEND_HOSTS?: string
  readonly VITE_CLUB_DIRECTORY_JSON?: string
  readonly VITE_CLUB_DIRECTORY_ONLY?: string
  readonly VITE_CLUB_PUBLIC_SITE_JSON?: string
  readonly VITE_CLUB_WEBSITE_URL?: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_MAP_SEARCH_REGION?: string
  readonly VITE_CLUB_HOME_VENUE_NAME?: string
  readonly VITE_CLUB_HOME_VENUE_ADDRESS?: string
  readonly VITE_CLUB_HOME_VENUE_ALIASES?: string
  readonly VITE_CLUB_HOME_VENUE_LAT?: string
  readonly VITE_CLUB_HOME_VENUE_LNG?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_GUEST_CHECKOUT_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

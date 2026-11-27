import { prepareClubDirectory } from './clubos/directoryBootstrap.ts'

// The club directory decides which backend the app connects to, so it must be
// ready before anything creates the Supabase client.
void prepareClubDirectory().finally(() => import('./startApp.tsx'))

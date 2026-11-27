/**
 * Runs before the app (and its Supabase client) loads. In directory and multi
 * modes with a control plane configured, fetches the club directory so
 * runtime.ts can use it. Must not import runtime.ts or lib/supabase.ts.
 */
import { controlPlaneConfig, loadClubDirectory, registryOptionsFromEnv } from './controlPlane.ts'

export async function prepareClubDirectory(): Promise<void> {
  const options = registryOptionsFromEnv(import.meta.env)
  let config
  try {
    config = controlPlaneConfig(import.meta.env, options)
  } catch (error) {
    console.error('[ClubOS] Control plane settings rejected:', error)
    return
  }
  if (!config) return
  let storage: Storage | undefined
  try {
    storage = window.localStorage
  } catch {
    storage = undefined
  }
  const result = await loadClubDirectory(config, options, storage)
  if (result.json) globalThis.__CLUBOS_DIRECTORY_JSON__ = result.json
}

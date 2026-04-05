import { supabase, supabaseConfigError } from '../lib/supabase.ts'

export interface BulkImportRowResult {
  playerName: string
  parentEmail: string
  teamName: string
  status: 'imported' | 'skipped' | 'error'
  reason?: string
}

export interface BulkImportResult {
  dryRun: boolean
  total: number
  imported: number
  skipped: number
  errors: number
  valid?: number
  rows: BulkImportRowResult[]
}

export async function runBulkImport(csvText: string, dryRun: boolean): Promise<BulkImportResult> {
  if (!supabase) throw new Error(supabaseConfigError)

  const { data, error } = await supabase.functions.invoke<BulkImportResult>('bulk-import', {
    body: { csvText, dryRun },
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Bulk import failed.')
  }

  return data
}

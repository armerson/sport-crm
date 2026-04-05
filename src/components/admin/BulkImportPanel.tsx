import { useRef, useState } from 'react'
import { runBulkImport } from '../../services/bulkImport.ts'
import type { BulkImportResult, BulkImportRowResult } from '../../services/bulkImport.ts'
import { Button } from '../ui/Button.tsx'

const EXAMPLE_CSV = `player_name,dob,gender,parent_name,parent_email
Sam Jones,2015-03-12,boy,Rachel Jones,rachel@example.com
Aoife Murphy,2016-07-24,girl,Sinead Murphy,sinead@example.com`

function StatusBadge({ status }: { status: BulkImportRowResult['status'] }) {
  if (status === 'imported') {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        Imported
      </span>
    )
  }
  if (status === 'skipped') {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        Skipped
      </span>
    )
  }
  return (
    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
      Error
    </span>
  )
}

export function BulkImportPanel() {
  const [csvText, setCsvText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<BulkImportResult | null>(null)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') setCsvText(text)
    }
    reader.readAsText(file)
  }

  async function handlePreview() {
    setError(null)
    setPreview(null)
    setResult(null)

    if (!csvText.trim()) {
      setError('Paste CSV data or upload a file first.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await runBulkImport(csvText, true)
      setPreview(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleImport() {
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await runBulkImport(csvText, false)
      setResult(res)
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function reset() {
    setCsvText('')
    setPreview(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const activeData = result ?? preview

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Bulk import players</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV to register players, auto-assign them to year groups, and invite parents in one go.
        </p>
      </div>

      {/* CSV format guide */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Required columns</p>
        <p className="mt-2 font-mono text-xs text-slate-700">
          player_name, dob, gender, parent_name, parent_email
        </p>
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          <li><span className="font-medium text-slate-700">dob</span> — date of birth in YYYY-MM-DD format</li>
          <li><span className="font-medium text-slate-700">gender</span> — boy / girl (or male / female)</li>
          <li>Teams are named automatically e.g. <span className="font-medium text-slate-700">2015 Boys</span> from birth year</li>
          <li>Parents receive an invite email to set their password</li>
          <li>If a parent email already exists they are linked without re-inviting</li>
        </ul>
        <button
          className="mt-3 text-xs font-medium text-[#123524] underline underline-offset-2"
          onClick={() => setCsvText(EXAMPLE_CSV)}
          type="button"
        >
          Load example data
        </button>
      </div>

      {/* File upload */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Upload CSV file</label>
        <input
          ref={fileInputRef}
          accept=".csv,text/csv"
          className="block w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-[#123524] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
          onChange={handleFileChange}
          type="file"
        />
      </div>

      {/* Paste area */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="csv-paste">
          Or paste CSV
        </label>
        <textarea
          className="min-h-40 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#f18a3f] focus:ring-4 focus:ring-[#f18a3f]/15"
          id="csv-paste"
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={EXAMPLE_CSV}
          value={csvText}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {/* Action buttons */}
      {!result ? (
        <div className="flex gap-3">
          <Button
            className="flex-1"
            loading={isSubmitting}
            onClick={() => void handlePreview()}
            type="button"
            variant="secondary"
          >
            Preview import
          </Button>
          {preview ? (
            <Button
              className="flex-1"
              loading={isSubmitting}
              onClick={() => void handleImport()}
              type="button"
            >
              Import {preview.valid ?? preview.total} players
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Results table */}
      {activeData ? (
        <div className="space-y-4">
          {/* Summary pills */}
          <div className="flex flex-wrap gap-2">
            {activeData.dryRun ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Preview — no data written
              </span>
            ) : null}
            {!activeData.dryRun && activeData.imported > 0 ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {activeData.imported} imported
              </span>
            ) : null}
            {activeData.skipped > 0 ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {activeData.skipped} need manual assignment
              </span>
            ) : null}
            {activeData.errors > 0 ? (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                {activeData.errors} errors
              </span>
            ) : null}
          </div>

          {/* Row-by-row breakdown */}
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Player</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Team</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Parent</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeData.rows.map((row, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.playerName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.teamName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{row.parentEmail}</td>
                    <td className="px-4 py-2.5">
                      <div className="space-y-1">
                        <StatusBadge status={row.status} />
                        {row.reason ? (
                          <p className="text-xs text-slate-400">{row.reason}</p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result ? (
            <Button className="w-full" onClick={reset} type="button" variant="secondary">
              Import another file
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

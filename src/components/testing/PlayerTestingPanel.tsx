import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchPlayerTestResults, fetchTestDefinitions, type TestDefinition, type TestResult } from '../../services/performanceTesting.ts'
import { SelectField } from '../ui/SelectField.tsx'

function formatValue(value: number, test: TestDefinition): string {
  return `${value.toFixed(test.decimalPlaces)} ${test.unit}`
}

export function PlayerTestingPanel({ playerId }: { playerId: string }) {
  const [definitions, setDefinitions] = useState<TestDefinition[]>([])
  const [results, setResults] = useState<TestResult[]>([])
  const [selectedTestId, setSelectedTestId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchTestDefinitions(), fetchPlayerTestResults(playerId)])
      .then(([nextDefinitions, nextResults]) => {
        if (cancelled) return
        setDefinitions(nextDefinitions)
        setResults(nextResults)
        const available = nextDefinitions.find((test) => nextResults.some((result) => result.testDefinitionId === test.id))
        setSelectedTestId(available?.id ?? '')
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load testing results.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [playerId])

  const availableTests = useMemo(
    () => definitions.filter((test) => results.some((result) => result.testDefinitionId === test.id)),
    [definitions, results],
  )
  const selectedTest = definitions.find((test) => test.id === selectedTestId) ?? null
  const selectedResults = results.filter((result) => result.testDefinitionId === selectedTestId)
  const latest = selectedResults.at(-1) ?? null
  const previous = selectedResults.at(-2) ?? null
  const best = selectedTest && selectedResults.length
    ? selectedResults.reduce((winner, result) => selectedTest.higherIsBetter
      ? result.resultValue > winner.resultValue ? result : winner
      : result.resultValue < winner.resultValue ? result : winner)
    : null
  const change = latest && previous && previous.resultValue !== 0
    ? ((latest.resultValue - previous.resultValue) / Math.abs(previous.resultValue)) * 100
    : null
  const improvement = change != null && selectedTest ? (selectedTest.higherIsBetter ? change : -change) : null
  const chartData = selectedResults.map((result) => ({
    date: new Date(`${result.testedAt}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    value: result.resultValue,
  }))

  return (
    <section className="ui-module">
      <div className="ui-module-header">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-accent)]">Performance testing</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-950">Progress over time</h3>
        <p className="mt-1 text-sm text-slate-500">Results are compared only within the same test and unit.</p>
      </div>
      <div className="ui-module-body">
      {loading ? <p className="text-sm text-slate-400">Loading results…</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {!loading && !error && availableTests.length === 0 ? (
        <div className="ui-empty"><p className="font-semibold text-slate-700">No testing results yet</p><p className="mt-1">Results will appear here after the player joins a testing event.</p></div>
      ) : null}
      {selectedTest ? (
        <div className="space-y-5">
          <SelectField
            label="Test"
            value={selectedTestId}
            options={availableTests.map((test) => ({ value: test.id, label: `${test.name} (${test.unit})` }))}
            onChange={(event) => setSelectedTestId(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="ui-metric"><p className="ui-metric-label">Latest</p><p className="ui-metric-value">{latest ? formatValue(latest.resultValue, selectedTest) : '—'}</p></div>
            <div className="ui-metric"><p className="ui-metric-label">Previous</p><p className="ui-metric-value">{previous ? formatValue(previous.resultValue, selectedTest) : '—'}</p></div>
            <div className="ui-metric"><p className="ui-metric-label">Personal best</p><p className="ui-metric-value">{best ? formatValue(best.resultValue, selectedTest) : '—'}</p></div>
            <div className="ui-metric"><p className="ui-metric-label">Change</p><p className={`ui-metric-value ${improvement != null && improvement > 0 ? '!text-emerald-700' : ''}`}>{improvement == null ? '—' : `${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`}</p></div>
          </div>
          {chartData.length > 1 ? (
            <div className="h-64 w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-raised)] p-2 sm:p-4" aria-label={`${selectedTest.name} results over time`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} unit={` ${selectedTest.unit}`} width={65} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(selectedTest.decimalPlaces)} ${selectedTest.unit}`, selectedTest.name]} />
                  <Line type="monotone" dataKey="value" stroke="var(--ui-accent)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-slate-500">A chart will appear after a second result is recorded.</p>}
        </div>
      ) : null}
      </div>
    </section>
  )
}

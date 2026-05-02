import { useState } from 'react'
import { createClubInvite } from '../../services/teamInvites.ts'

interface ClubInviteButtonProps {
  role: 'coach' | 'admin'
}

export function ClubInviteButton({ role }: ClubInviteButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')
  const [link, setLink] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleGenerate() {
    setState('loading')
    try {
      const code = await createClubInvite(role)
      setLink(`${window.location.origin}/join/club/${code}`)
      setOpen(true)
      setState('idle')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  async function handleCopy() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setState('copied')
    setTimeout(() => setState('idle'), 2500)
  }

  const label = role === 'admin' ? 'Invite admin' : 'Invite coach'
  const description = role === 'admin'
    ? 'Share with a trusted person — they sign up and get admin access immediately.'
    : 'Share with a new coach — they sign up and appear in Members where you can assign them to teams.'

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={state === 'loading'}
          className="flex items-center gap-1.5 rounded-xl border border-[#1565ff]/30 px-3 py-1.5 text-xs font-semibold text-[#1565ff] transition hover:bg-[#1565ff]/5 disabled:opacity-50 active:scale-[0.97]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          {state === 'loading' ? 'Generating…' : state === 'error' ? 'Failed — retry' : label}
        </button>
      ) : (
        <div className="rounded-2xl border border-[#1565ff]/20 bg-[#1565ff]/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-[#1565ff] capitalize">{label} link</p>
          <p className="text-[10px] text-slate-500 leading-4">{description}</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link ?? ''}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 outline-none"
            />
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                state === 'copied' ? 'bg-green-100 text-green-700' : 'bg-[#1565ff] text-white hover:bg-[#0d4ed8]'
              }`}
            >
              {state === 'copied' ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); setLink(null); setState('idle') }}
            className="text-[10px] text-slate-400 hover:text-slate-600"
          >
            Generate a new link
          </button>
        </div>
      )}
    </div>
  )
}

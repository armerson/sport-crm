import { useState } from 'react'
import { createTeamInvite } from '../../services/teamInvites.ts'

interface InviteButtonProps {
  teamId: string
  teamName: string
  role: 'parent' | 'coach'
}

export function InviteButton({ teamId, teamName, role }: InviteButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')
  const [link, setLink] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleGenerate() {
    setState('loading')
    try {
      const code = await createTeamInvite(teamId, role)
      const url = `${window.location.origin}/join/${code}`
      setLink(url)
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

  const label = role === 'parent' ? 'Invite parents' : 'Invite coaches'
  const icon = role === 'parent'
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={state === 'loading'}
          className="flex items-center gap-1.5 rounded-xl border border-[#123524]/30 px-3 py-1.5 text-xs font-semibold text-[#123524] transition hover:bg-[#123524]/5 disabled:opacity-50 active:scale-[0.97]"
        >
          {icon}
          {state === 'loading' ? 'Generating…' : state === 'error' ? 'Failed — retry' : label}
        </button>
      ) : (
        <div className="rounded-2xl border border-[#123524]/20 bg-[#123524]/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-[#123524]">
            {role === 'parent' ? 'Parent' : 'Coach'} invite link for {teamName}
          </p>
          <p className="text-[10px] text-slate-500 leading-4">
            {role === 'parent'
              ? 'Share this on WhatsApp or email — parents tap it to register and add their child.'
              : 'Share with the coach — they click to create their account and join this team.'}
          </p>
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
                state === 'copied'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-[#123524] text-white hover:bg-[#1a4a33]'
              }`}
            >
              {state === 'copied' ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          {link ? (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                role === 'parent'
                  ? `Hi! Register your child for ${teamName} using this link:\n${link}`
                  : `Join ${teamName} as a coach using this link:\n${link}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1ebe5d]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Share on WhatsApp
            </a>
          ) : null}
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

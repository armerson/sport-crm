import { useEffect, useMemo, useState } from 'react'
import { useTeamMessages } from '../../hooks/useTeamMessages.ts'
import { AnnouncementsPanel } from './AnnouncementsPanel.tsx'
import type { UserProfile } from '../../types/auth.ts'
import { formatDateTime } from '../../utils/date.ts'
import { Button } from '../ui/Button.tsx'

interface TeamMessagesPanelProps {
  profile: UserProfile
}

export function TeamMessagesPanel({ profile }: TeamMessagesPanelProps) {
  const [selectedTarget, setSelectedTarget] = useState('')
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const {
    activeTarget,
    activeTeamId,
    error,
    groups,
    isConfigured,
    isSubmitting,
    loadingMessages,
    loadingTeams,
    messages,
    senders,
    sendMessage,
    teams,
  } = useTeamMessages(profile, selectedTarget)

  // Restore draft from localStorage when the active target changes
  useEffect(() => {
    if (!activeTarget) return
    const saved = localStorage.getItem(`msg-draft-${activeTarget}`)
    setDraft(saved ?? '')
  }, [activeTarget])

  const isAdmin = profile.roles.includes('admin')
  const isCoachOrParent = !isAdmin

  // Derive a display label for the active target
  const activeLabel = useMemo(() => {
    if (!activeTarget) return null
    if (activeTarget === 'club') return 'Whole Club'
    if (activeTarget.startsWith('group:')) {
      const gid = activeTarget.slice(6)
      return groups.find((g) => g.id === gid)?.name ?? 'Group'
    }
    const t = teams.find((t) => t.id === activeTarget)
    return t ? `${t.name} (${t.ageGroup})` : null
  }, [activeTarget, groups, teams])

  const isSingleTeam = !isAdmin && teams.length === 1
  const senderById = useMemo(() => new Map(senders.map((s) => [s.id, s])), [senders])
  const activeError = localError ?? error

  // Can the current user send to the active target?
  const canSend = isAdmin || (isCoachOrParent && !!activeTeamId)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    if (!activeTarget) {
      setLocalError('Choose a destination before sending a message.')
      return
    }

    if (draft.trim().length < 2) {
      setLocalError('Enter a message before sending.')
      return
    }

    try {
      await sendMessage(activeTarget, draft.trim())
      setDraft('')
      localStorage.removeItem(`msg-draft-${activeTarget}`)
    } catch {
      // Hook exposes a user-facing error.
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Team messaging</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {isSingleTeam
              ? `Messages for ${teams[0]?.name ?? 'your team'}`
              : activeLabel
                ? `Conversation · ${activeLabel}`
                : isAdmin
                  ? 'Club conversations'
                  : 'Per-team conversation'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isAdmin
              ? 'Send to individual teams, named groups, or the whole club.'
              : 'Admins, coaches, and parents only see messages for the teams they can access.'}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          {loadingTeams ? 'Loading…' : `${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}
        </p>
      </div>

      {!isConfigured ? (
        <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured yet. Add your project values to .env.local before using team messaging.
        </div>
      ) : null}

      {activeError ? (
        <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{activeError}</div>
      ) : null}

      {/* Announcements panel for coaches and parents */}
      {isCoachOrParent ? (
        <div className="mt-5">
          <AnnouncementsPanel profile={profile} />
        </div>
      ) : null}

      {/* Target selector: admin gets Club + Groups + Teams; others get their teams */}
      {isAdmin ? (
        <div className="mt-5 max-w-sm">
          <label className="block text-sm font-medium text-slate-700" htmlFor="msg-target-select">Send to</label>
          <select
            id="msg-target-select"
            disabled={loadingTeams}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#f18a3f] focus:ring-4 focus:ring-[#f18a3f]/15 disabled:cursor-wait disabled:opacity-60"
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
          >
            <option value="">{loadingTeams ? 'Loading destinations…' : 'Choose destination'}</option>
            <option value="club">📣  Whole Club</option>
            {groups.length > 0 ? (
              <>
                <option disabled value="">── Groups ──</option>
                {groups.map((g) => (
                  <option key={g.id} value={`group:${g.id}`}>📂  {g.name}</option>
                ))}
              </>
            ) : null}
            {teams.length > 0 ? (
              <>
                <option disabled value="">── Teams ──</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.ageGroup})</option>
                ))}
              </>
            ) : null}
          </select>
        </div>
      ) : !isSingleTeam ? (
        <div className="mt-5 max-w-sm">
          <label className="block text-sm font-medium text-slate-700" htmlFor="msg-team-select">Active team</label>
          <select
            id="msg-team-select"
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#f18a3f] focus:ring-4 focus:ring-[#f18a3f]/15"
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
          >
            <option value="">{teams.length > 0 ? 'Choose a team' : 'No teams available'}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.ageGroup})</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Conversation thread */}
        <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-950">Conversation</h3>
            <p className="text-sm text-slate-500">{loadingMessages ? 'Loading…' : `${messages.length} messages`}</p>
          </div>
          <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {messages.length > 0 ? (
              messages.map((message) => {
                const isCurrentUser = message.senderId === profile.id
                const sender = senderById.get(message.senderId)

                return (
                  <div
                    key={message.id}
                    className={`rounded-2xl px-4 py-3 ${
                      isCurrentUser ? 'ml-6 bg-[#1565ff] text-white' : 'mr-6 bg-white text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em]">
                      <span className={isCurrentUser ? 'text-white/70' : 'text-slate-500'}>
                        {isCurrentUser ? 'You' : sender?.name ?? 'Club member'}
                      </span>
                      <span className={isCurrentUser ? 'text-white/65' : 'text-slate-400'}>{formatDateTime(message.timestamp)}</span>
                    </div>
                    <p className={`mt-2 text-sm leading-6 ${isCurrentUser ? 'text-white' : 'text-slate-700'}`}>{message.content}</p>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                {activeTarget
                  ? 'No messages yet in this conversation.'
                  : isAdmin
                    ? 'Choose a destination to open the conversation.'
                    : 'Choose a team to open the conversation.'}
              </div>
            )}
          </div>
        </article>

        {/* Send form */}
        <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
          <h3 className="text-lg font-semibold text-slate-950">New message</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {activeTarget === 'club'
              ? 'This message will reach all club members.'
              : activeTarget?.startsWith('group:')
                ? `Reaches all members in the ${activeLabel ?? 'group'} section.`
                : activeLabel
                  ? `Write a message to ${activeLabel}.`
                  : 'Select a destination above, then write your message.'}
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor="team-message-draft">
              <span>Message</span>
              <textarea
                id="team-message-draft"
                className="min-h-36 w-full rounded-2xl border border-white/60 bg-white/90 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#f18a3f] focus:ring-4 focus:ring-[#f18a3f]/15"
                onChange={(e) => {
                  setDraft(e.target.value)
                  if (activeTarget) {
                    if (e.target.value) {
                      localStorage.setItem(`msg-draft-${activeTarget}`, e.target.value)
                    } else {
                      localStorage.removeItem(`msg-draft-${activeTarget}`)
                    }
                  }
                }}
                placeholder={canSend ? 'Write your message…' : 'Select a destination to send a message…'}
                value={draft}
              />
            </label>
            <Button
              className="w-full"
              disabled={!activeTarget || !canSend}
              loading={isSubmitting}
              type="submit"
            >
              {activeTarget === 'club'
                ? 'Send to whole club'
                : activeTarget?.startsWith('group:')
                  ? `Send to ${activeLabel ?? 'group'}`
                  : 'Send message'}
            </Button>
          </form>
        </article>
      </div>
    </section>
  )
}

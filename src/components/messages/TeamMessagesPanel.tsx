import { useMemo, useState } from 'react'
import { useTeamMessages } from '../../hooks/useTeamMessages.ts'
import type { UserProfile } from '../../types/auth.ts'
import { formatDateTime } from '../../utils/date.ts'
import { Button } from '../ui/Button.tsx'
import { SelectField } from '../ui/SelectField.tsx'

interface TeamMessagesPanelProps {
  profile: UserProfile
}

export function TeamMessagesPanel({ profile }: TeamMessagesPanelProps) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const {
    activeTeamId,
    error,
    isConfigured,
    isSubmitting,
    loadingMessages,
    loadingTeams,
    messages,
    senders,
    sendMessage,
    teams,
  } = useTeamMessages(profile, selectedTeamId)

  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null
  const senderById = useMemo(() => new Map(senders.map((sender) => [sender.id, sender])), [senders])
  const activeError = localError ?? error
  const isSingleTeam = teams.length === 1

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    if (!activeTeamId) {
      setLocalError('Choose a team before sending a message.')
      return
    }

    if (draft.trim().length < 2) {
      setLocalError('Enter a message before sending.')
      return
    }

    try {
      await sendMessage(activeTeamId, draft.trim())
      setDraft('')
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
            {isSingleTeam ? `Messages for ${activeTeam?.name ?? 'your team'}` : 'Per-team conversation'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Admins, coaches, and parents only see messages for the teams they can access.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          {loadingTeams ? 'Loading teams...' : `${teams.length} available ${teams.length === 1 ? 'team' : 'teams'}`}
        </p>
      </div>

      {!isSingleTeam ? (
        <div className="mt-5 max-w-sm">
          <SelectField
            label="Active team"
            onChange={(event) => setSelectedTeamId(event.target.value)}
            options={[
              { label: teams.length > 0 ? 'Choose a team' : 'No teams available', value: '' },
              ...teams.map((team) => ({ label: `${team.name} (${team.ageGroup})`, value: team.id })),
            ]}
            value={activeTeamId}
          />
        </div>
      ) : null}

      {!isConfigured ? (
        <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured yet. Add your project values to .env.local before using team messaging.
        </div>
      ) : null}

      {activeError ? (
        <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{activeError}</div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-950">Conversation</h3>
            <p className="text-sm text-slate-500">{loadingMessages ? 'Loading...' : `${messages.length} messages`}</p>
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
                      isCurrentUser ? 'ml-6 bg-[#123524] text-white' : 'mr-6 bg-white text-slate-900'
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
                {activeTeamId ? 'No messages yet for this team.' : 'Choose a team to open the conversation.'}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
          <h3 className="text-lg font-semibold text-slate-950">New message</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Share updates, logistics, and reminders with the selected team.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor="team-message-draft">
              <span>Message</span>
              <textarea
                id="team-message-draft"
                className="min-h-36 w-full rounded-2xl border border-white/60 bg-white/90 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#f18a3f] focus:ring-4 focus:ring-[#f18a3f]/15"
                onChange={(event) => setDraft(event.target.value)}
                placeholder={activeTeam ? `Write a message to ${activeTeam.name}...` : 'Choose a team and write your message...'}
                value={draft}
              />
            </label>
            <Button className="w-full" disabled={!activeTeamId} loading={isSubmitting} type="submit">
              Send message
            </Button>
          </form>
        </article>
      </div>
    </section>
  )
}
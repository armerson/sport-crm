import { useEffect, useMemo, useState } from 'react'
import type { UserProfile } from '../../types/auth.ts'
import type { MessageRecord } from '../../types/club.ts'
import { fetchParentCommunicationContacts, sendDirectMessage, subscribeToDirectMessages, subscribeToUserProfilesByIds, type CommunicationContact } from '../../services/messages.ts'
import { sendPushToUsers } from '../../lib/pushNotifications.ts'
import { Button } from '../ui/Button.tsx'
import { formatDateTime } from '../../utils/date.ts'

export function DirectMessagesPanel({ profile }: { profile: UserProfile }) {
  const isParentOnly = profile.roles.includes('parent') && !profile.roles.some((role) => role === 'admin' || role === 'coach')
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [contacts, setContacts] = useState<CommunicationContact[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => subscribeToDirectMessages(profile.id, setMessages, setError), [profile.id])
  useEffect(() => {
    if (!isParentOnly) return
    void fetchParentCommunicationContacts(profile.id).then(setContacts).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load club contacts.'))
  }, [isParentOnly, profile.id])

  const counterpartIds = useMemo(() => [...new Set(messages.map((message) => message.senderId === profile.id ? message.recipientId : message.senderId).filter((id): id is string => !!id))], [messages, profile.id])
  useEffect(() => {
    if (!counterpartIds.length) { setProfiles([]); return }
    return subscribeToUserProfilesByIds(counterpartIds, setProfiles, setError)
  }, [counterpartIds])

  const choices = useMemo(() => {
    if (isParentOnly) return contacts.map((contact) => ({ ...contact, key: `${contact.id}:${contact.teamId ?? ''}` }))
    return counterpartIds.map((id) => ({ id, teamId: null, name: profiles.find((item) => item.id === id)?.name ?? 'Club member', label: 'Private conversation', key: id }))
  }, [contacts, counterpartIds, isParentOnly, profiles])
  const active = choices.find((choice) => choice.key === selectedKey) ?? (choices.length === 1 ? choices[0] : null)
  const thread = active ? messages.filter((message) => message.senderId === active.id || message.recipientId === active.id) : []

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!active || !draft.trim()) return
    setSending(true); setError(null)
    try {
      const sent = await sendDirectMessage(profile.id, active.id, active.teamId, draft.trim())
      setMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent])
      setDraft('')
      void sendPushToUsers([active.id], `New private message from ${profile.name}`, draft.trim().slice(0, 120), '/?view=parent')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send message.') }
    finally { setSending(false) }
  }

  return <section className="mt-5 rounded-2xl border border-[var(--ui-border)] bg-white p-4 sm:p-5">
    <h3 className="text-lg font-semibold text-slate-950">{isParentOnly ? 'Contact the club' : 'Private parent messages'}</h3>
    <p className="mt-1 text-sm text-slate-500">{isParentOnly ? 'Message your child’s coaches or an approved club contact privately.' : 'Private conversations sent directly to you.'}</p>
    {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    <select className="ui-input mt-4" value={active?.key ?? ''} onChange={(event) => setSelectedKey(event.target.value)}>
      <option value="">{choices.length ? 'Choose a contact' : isParentOnly ? 'No contacts configured' : 'No parent messages yet'}</option>
      {choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.name} · {choice.label}</option>)}
    </select>
    {active ? <>
      <div className="mt-4 max-h-80 min-h-32 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
        {thread.length ? thread.map((message) => <div key={message.id} className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${message.senderId === profile.id ? 'ml-auto bg-[var(--ui-accent)] text-white' : 'bg-white text-slate-700'}`}><p>{message.content}</p><p className={`mt-1 text-[10px] ${message.senderId === profile.id ? 'text-white/65' : 'text-slate-400'}`}>{formatDateTime(message.timestamp)}</p></div>) : <p className="py-8 text-center text-sm text-slate-400">No messages yet.</p>}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(event) => void submit(event)}><textarea className="ui-input min-h-12 flex-1 resize-y" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a private message…" /><Button type="submit" loading={sending} disabled={!draft.trim()}>Send</Button></form>
    </> : null}
  </section>
}

import { useEffect, useRef, useState } from 'react'
import {
  addEmergencyContact,
  deleteEmergencyContact,
  deletePlayerDocument,
  fetchEmergencyContacts,
  fetchPlayerDocuments,
  fetchPlayerProfile,
  getDocumentSignedUrl,
  markDocumentVerified,
  updateEmergencyContact,
  updatePlayerProfile,
  uploadPlayerDocument,
  uploadPlayerPhoto,
} from '../../services/playerProfiles.ts'
import { formatDate } from '../../utils/date.ts'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { SuccessMessage } from '../ui/SuccessMessage.tsx'
import type {
  EmergencyContact,
  EmergencyContactInput,
  PlayerDocument,
  PlayerDocumentType,
  PlayerProfileInput,
  PlayerRecord,
} from '../../types/club.ts'

export type ProfileViewerRole = 'admin' | 'coach' | 'parent'

interface Permissions {
  canEditSportsProfile: boolean   // position, bio, jersey, photo — admin only
  canEditContacts: boolean        // emergency contacts — admin + parent
  canUploadDocuments: boolean     // birth cert / passport — admin + parent
  canVerifyDocuments: boolean     // mark as verified — admin only
  canDeleteDocuments: boolean     // admin only
  canViewMedicalNotes: boolean    // all roles that have access to this player
  canViewDocuments: boolean       // admin + coach + parent (own child enforced by RLS)
}

function permissionsFor(role: ProfileViewerRole): Permissions {
  return {
    canEditSportsProfile:  role === 'admin',
    canEditContacts:       role === 'admin' || role === 'parent',
    canUploadDocuments:    role === 'admin' || role === 'parent',
    canVerifyDocuments:    role === 'admin',
    canDeleteDocuments:    role === 'admin',
    canViewMedicalNotes:   true,   // all roles with access to the card can see medical notes
    canViewDocuments:      true,   // all roles — RLS enforces the actual row-level gate
  }
}

interface PlayerProfileCardProps {
  playerId: string
  role: ProfileViewerRole
  currentUserId: string
  /** Optional label shown above the card, e.g. the player's name for parent view */
  headingOverride?: string
}

// ── Avatar ────────────────────────────────────────────────────────────────

function PlayerAvatar({
  player,
  canUpload,
  onPhotoChange,
}: {
  player: PlayerRecord
  canUpload: boolean
  onPhotoChange: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5 MB.'); return }
    setUploading(true)
    setError(null)
    try {
      const url = await uploadPlayerPhoto(player.id, file)
      onPhotoChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={player.name}
            className="h-24 w-24 rounded-full object-cover shadow-md ring-2 ring-white sm:h-28 sm:w-28"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#123524]/10 text-3xl font-bold text-[#123524] shadow-md ring-2 ring-white sm:h-28 sm:w-28">
            {player.name.charAt(0)}
          </div>
        )}
        {canUpload && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#123524] text-white shadow transition hover:bg-[#1a4d34] disabled:opacity-60"
            aria-label="Upload photo"
          >
            {uploading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFile(e)} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}

// ── Profile edit form ─────────────────────────────────────────────────────

const POSITIONS = [
  'Goalkeeper', 'Right Back', 'Left Back', 'Centre Back',
  'Defensive Midfielder', 'Central Midfielder', 'Attacking Midfielder',
  'Right Winger', 'Left Winger', 'Centre Forward', 'Striker',
]

function ProfileEditForm({
  player,
  onSaved,
  onCancel,
}: {
  player: PlayerRecord
  onSaved: (updated: Partial<PlayerRecord>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<PlayerProfileInput>({
    position: player.position ?? '',
    nationality: player.nationality ?? '',
    dominantFoot: player.dominantFoot ?? '',
    jerseyNumber: player.jerseyNumber?.toString() ?? '',
    bio: player.bio ?? '',
    medicalNotes: player.medicalNotes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updatePlayerProfile(player.id, form)
      onSaved({
        position: form.position || null,
        nationality: form.nationality || null,
        dominantFoot: (form.dominantFoot as PlayerRecord['dominantFoot']) || null,
        jerseyNumber: form.jerseyNumber ? parseInt(form.jerseyNumber) : null,
        bio: form.bio || null,
        medicalNotes: form.medicalNotes || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#123524]/30"

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Position</label>
          <select value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} className={inputCls}>
            <option value="">Not set</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Jersey number</label>
          <input type="number" min="1" max="99" value={form.jerseyNumber} onChange={(e) => setForm((f) => ({ ...f, jerseyNumber: e.target.value }))} placeholder="e.g. 7" className={inputCls} />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Dominant foot</label>
          <select value={form.dominantFoot} onChange={(e) => setForm((f) => ({ ...f, dominantFoot: e.target.value as PlayerProfileInput['dominantFoot'] }))} className={inputCls}>
            <option value="">Not set</option>
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="both">Both</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Nationality</label>
          <input type="text" value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} placeholder="e.g. English" className={inputCls} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Player bio / notes for coaches</label>
        <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={2} placeholder="Strengths, development areas, anything coaches should know..." className={`${inputCls} resize-none`} />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold text-rose-500 uppercase tracking-wide">Medical notes</label>
        <textarea value={form.medicalNotes} onChange={(e) => setForm((f) => ({ ...f, medicalNotes: e.target.value }))} rows={2} placeholder="Allergies, conditions, medication, injury history..." className={`${inputCls} resize-none border-rose-200 focus:ring-rose-400/30`} />
        <p className="text-xs text-slate-400">Visible to admin and coaches only.</p>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="rounded-xl bg-[#123524] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a4d34] disabled:opacity-60">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Emergency contacts ────────────────────────────────────────────────────

function EmergencyContacts({ playerId, canEdit }: { playerId: string; canEdit: boolean }) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const blank: EmergencyContactInput = { name: '', relationship: '', phone: '', email: '', isPrimary: false }
  const [form, setForm] = useState<EmergencyContactInput>(blank)

  useEffect(() => {
    void fetchEmergencyContacts(playerId).then(setContacts)
  }, [playerId])

  async function handleSave() {
    if (!form.name || !form.phone) return
    try {
      if (editingId) {
        await updateEmergencyContact(editingId, playerId, form)
        setSuccessMsg('Contact updated.')
      } else {
        await addEmergencyContact(playerId, form)
        setSuccessMsg('Contact added.')
      }
      setContacts(await fetchEmergencyContacts(playerId))
      setForm(blank)
      setShowForm(false)
      setEditingId(null)
    } catch (err) {
      setSuccessMsg(null)
      console.error(err)
    }
  }

  async function handleDelete(id: string) {
    await deleteEmergencyContact(id)
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#123524]/30"

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Emergency contacts</h4>
        {canEdit && !showForm && (
          <button type="button" onClick={() => { setForm(blank); setEditingId(null); setShowForm(true) }} className="text-xs font-semibold text-[#123524] hover:underline">
            + Add contact
          </button>
        )}
      </div>

      <SuccessMessage message={successMsg} />

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="text-xs font-medium text-slate-500">Full name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Jane Smith" /></div>
            <div><label className="text-xs font-medium text-slate-500">Relationship</label><input value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))} className={inputCls} placeholder="Mother / Father / Guardian" /></div>
            <div><label className="text-xs font-medium text-slate-500">Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="+44 7700 000000" /></div>
            <div><label className="text-xs font-medium text-slate-500">Email (optional)</label><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="jane@example.com" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))} className="rounded" />
            Primary emergency contact
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleSave()} className="rounded-xl bg-[#123524] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a4d34]">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {contacts.length === 0 && !showForm ? (
        <p className="text-sm text-slate-400">No emergency contacts on file.</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{contact.name}</p>
                  {contact.isPrimary && <span className="rounded-full bg-[#123524]/10 px-2 py-0.5 text-xs font-semibold text-[#123524]">Primary</span>}
                </div>
                <p className="text-xs text-slate-500">{contact.relationship}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
                  <a href={`tel:${contact.phone}`} className="font-medium hover:text-[#123524]">{contact.phone}</a>
                  {contact.email && <a href={`mailto:${contact.email}`} className="hover:text-[#123524]">{contact.email}</a>}
                </div>
              </div>
              {canEdit && (
                <ConfirmInline onConfirm={() => void handleDelete(contact.id)} label="Remove" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Identity documents ────────────────────────────────────────────────────

function IdentityDocuments({
  playerId,
  permissions,
  currentUserId,
}: {
  playerId: string
  permissions: Permissions
  currentUserId: string
}) {
  const [documents, setDocuments] = useState<PlayerDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState<PlayerDocumentType>('birth_certificate')
  const [docLabel, setDocLabel] = useState('')

  useEffect(() => {
    void fetchPlayerDocuments(playerId).then(setDocuments)
  }, [playerId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('File must be under 10 MB.'); return }

    setUploading(true)
    setError(null)
    try {
      await uploadPlayerDocument(playerId, file, docType, docLabel, currentUserId)
      setDocuments(await fetchPlayerDocuments(playerId))
      setSuccessMsg('Document uploaded securely.')
      setDocLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleView(doc: PlayerDocument) {
    try {
      const url = await getDocumentSignedUrl(doc.storagePath, 60)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Failed to open document. Please try again.')
    }
  }

  async function handleVerify(docId: string) {
    await markDocumentVerified(docId, currentUserId)
    setDocuments(await fetchPlayerDocuments(playerId))
    setSuccessMsg('Document verified.')
  }

  async function handleDelete(doc: PlayerDocument) {
    await deletePlayerDocument(doc.id, doc.storagePath)
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
  }

  const docTypeLabels: Record<PlayerDocumentType, string> = {
    birth_certificate: 'Birth Certificate',
    passport: 'Passport',
    other: 'Other',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Identity documents</h4>
        {permissions.canUploadDocuments && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="text-xs font-semibold text-[#123524] hover:underline disabled:opacity-50">
            {uploading ? 'Uploading…' : '+ Upload document'}
          </button>
        )}
      </div>

      {/* GDPR notice */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Data protection:</strong> Identity documents are stored in a private, encrypted bucket. Access is restricted to admins and assigned coaches. Documents are accessed via time-limited links and are never publicly visible.
      </div>

      <SuccessMessage message={successMsg} />
      {error && <p className="text-xs text-rose-600">{error}</p>}

      {permissions.canUploadDocuments && (
        <div className="flex flex-wrap gap-3">
          <select value={docType} onChange={(e) => setDocType(e.target.value as PlayerDocumentType)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123524]/30">
            <option value="birth_certificate">Birth Certificate</option>
            <option value="passport">Passport</option>
            <option value="other">Other</option>
          </select>
          <input type="text" value={docLabel} onChange={(e) => setDocLabel(e.target.value)} placeholder="Label (optional)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123524]/30" />
        </div>
      )}

      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => void handleUpload(e)} />

      {documents.length === 0 ? (
        <p className="text-sm text-slate-400">No documents uploaded yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{doc.label ?? docTypeLabels[doc.type]}</p>
                  {doc.verified ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Verified</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Unverified</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Uploaded {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => void handleView(doc)} className="text-xs font-semibold text-[#123524] hover:underline">
                  View
                </button>
                {permissions.canVerifyDocuments && !doc.verified && (
                  <button type="button" onClick={() => void handleVerify(doc.id)} className="text-xs font-semibold text-emerald-600 hover:underline">
                    Verify
                  </button>
                )}
                {permissions.canDeleteDocuments && (
                  <ConfirmInline onConfirm={() => void handleDelete(doc)} label="Delete" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export function PlayerProfileCard({ playerId, role, currentUserId }: PlayerProfileCardProps) {
  const perms = permissionsFor(role)
  const [player, setPlayer] = useState<PlayerRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'profile' | 'contacts' | 'documents'>('profile')

  useEffect(() => {
    setLoading(true)
    void fetchPlayerProfile(playerId)
      .then(setPlayer)
      .finally(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return (
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-900/5">
        <p className="text-sm text-slate-500">Loading player profile…</p>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-lg shadow-slate-900/5">
        <p className="text-sm text-rose-600">Player not found.</p>
      </div>
    )
  }

  const sectionTabs = [
    { label: 'Profile', value: 'profile' as const },
    { label: 'Emergency contacts', value: 'contacts' as const },
    ...(perms.canViewDocuments ? [{ label: 'Documents', value: 'documents' as const }] : []),
  ]

  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/85 shadow-lg shadow-slate-900/5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col items-center gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-start">
        <PlayerAvatar
          player={player}
          canUpload={perms.canEditSportsProfile}
          onPhotoChange={(url) => setPlayer((p) => p ? { ...p, photoUrl: url } : p)}
        />
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h2 className="text-2xl font-bold text-slate-900">{player.name}</h2>
            {player.jerseyNumber && (
              <span className="rounded-full bg-[#123524]/10 px-2.5 py-0.5 text-sm font-bold text-[#123524]">#{player.jerseyNumber}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-slate-500 sm:justify-start">
            <span>DOB: {formatDate(player.dob)}</span>
            {player.position && <span>{player.position}</span>}
            {player.dominantFoot && <span className="capitalize">{player.dominantFoot} foot</span>}
            {player.nationality && <span>{player.nationality}</span>}
          </div>
          {player.bio && <p className="mt-2 text-sm text-slate-600 italic max-w-md">{player.bio}</p>}
        </div>
        {perms.canEditSportsProfile && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
            Edit profile
          </button>
        )}
      </div>

      {/* Section tabs */}
      <div className="border-b border-slate-100 px-6">
        <div className="flex gap-4">
          {sectionTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setActiveSection(tab.value); setEditing(false) }}
              className={`border-b-2 py-3 text-sm font-semibold transition ${
                activeSection === tab.value
                  ? 'border-[#123524] text-[#123524]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        <SuccessMessage message={successMsg} />

        {activeSection === 'profile' && (
          <>
            {editing ? (
              <ProfileEditForm
                player={player}
                onSaved={(updated) => {
                  setPlayer((p) => p ? { ...p, ...updated } : p)
                  setEditing(false)
                  setSuccessMsg('Profile saved.')
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="space-y-4">
                {player.medicalNotes && perms.canViewMedicalNotes && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Medical notes</p>
                    <p className="mt-1 text-sm text-rose-900">{player.medicalNotes}</p>
                  </div>
                )}
                {!player.position && !player.bio && !player.medicalNotes && (
                  <p className="text-sm text-slate-400">
                    {perms.canEditSportsProfile
                      ? 'No additional profile information yet. Click "Edit profile" to add details.'
                      : 'No additional profile information on file.'}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {activeSection === 'contacts' && (
          <EmergencyContacts playerId={playerId} canEdit={perms.canEditContacts} />
        )}

        {activeSection === 'documents' && perms.canViewDocuments && (
          <IdentityDocuments playerId={playerId} permissions={perms} currentUserId={currentUserId} />
        )}
      </div>
    </div>
  )
}

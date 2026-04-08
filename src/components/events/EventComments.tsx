import { useEffect, useRef, useState } from 'react'
import { addEventComment, deleteEventComment, fetchEventComments } from '../../services/eventComments.ts'
import type { EventComment } from '../../services/eventComments.ts'

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface EventCommentsProps {
  eventId: string
  currentUserId: string
  isAdmin?: boolean
}

export function EventComments({ eventId, currentUserId, isAdmin = false }: EventCommentsProps) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<EventComment[]>([])
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!open || loadedRef.current) return
    loadedRef.current = true
    setLoading(true)
    void fetchEventComments(eventId)
      .then(setComments)
      .catch(() => setError('Could not load comments.'))
      .finally(() => setLoading(false))
  }, [open, eventId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      const comment = await addEventComment(eventId, currentUserId, trimmed)
      setComments((prev) => [...prev, comment])
      setBody('')
    } catch {
      setError('Could not post comment.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteEventComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch {
      setError('Could not delete comment.')
    }
  }

  const count = comments.length

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setTimeout(() => textareaRef.current?.focus(), 100) }}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#123524]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {open
          ? 'Hide comments'
          : loadedRef.current
            ? `${count} comment${count !== 1 ? 's' : ''}`
            : 'Comments'}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading && (
            <p className="text-xs text-slate-400">Loading comments…</p>
          )}

          {!loading && comments.length === 0 && (
            <p className="text-xs text-slate-400">No comments yet — be the first.</p>
          )}

          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#123524]/10 text-xs font-bold text-[#123524]">
                {c.authorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-slate-800">{c.authorName}</span>
                  <span className="text-xs text-slate-400">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-700 break-words">{c.body}</p>
              </div>
              {(c.authorId === currentUserId || isAdmin) && (
                <button
                  type="button"
                  onClick={() => void handleDelete(c.id)}
                  className="shrink-0 self-start text-slate-300 transition hover:text-rose-400"
                  aria-label="Delete comment"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit(e as unknown as React.FormEvent) } }}
              placeholder="Add a comment…"
              rows={1}
              maxLength={1000}
              className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#123524]/30"
            />
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className="shrink-0 rounded-xl bg-[#123524] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a4a33] disabled:opacity-40"
            >
              {submitting ? '…' : 'Post'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import { generateInstagramCaption } from '../../services/social.ts'
import { Button } from '../ui/Button.tsx'
import type { Post } from '../../types/posts.ts'

interface InstagramSharePanelProps {
  post: Post
  clubName: string
  defaultTagline: string
  defaultHashtags: string
  onClose: () => void
}

type PanelState = 'idle' | 'generating' | 'ready' | 'error'

// Instagram logo SVG
function IgIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function InstagramSharePanel({ post, clubName, defaultTagline, defaultHashtags, onClose }: InstagramSharePanelProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [caption, setCaption] = useState('')
  const [tagline, setTagline] = useState(defaultTagline)
  const [hashtags, setHashtags] = useState(defaultHashtags)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isMatchResult = post.body.startsWith('Full-time:')

  async function handleGenerate() {
    setState('generating')
    setError(null)
    try {
      const generated = await generateInstagramCaption({
        postBody: post.body,
        postTitle: post.title ?? undefined,
        isMatchResult,
        clubName,
        tagline: tagline.trim() || undefined,
        hashtags: hashtags.trim() || undefined,
      })
      setCaption(generated)
      setState('ready')
      setTimeout(() => textareaRef.current?.focus(), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate caption.')
      setState('error')
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the textarea text
      textareaRef.current?.select()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-slate-900">
            <span className="text-pink-500"><IgIcon /></span>
            <span className="font-semibold">Instagram caption</span>
          </div>
          <button
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            type="button"
          >
            <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth={2.5} viewBox="0 0 24 24" width="16">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">

          {/* Post preview */}
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            {post.imageUrl && (
              <img alt="Post photo" className="mb-2 aspect-video w-full rounded-xl object-cover" src={post.imageUrl} />
            )}
            <p className="line-clamp-2 text-sm text-slate-600">{post.title ? `${post.title} — ` : ''}{post.body}</p>
          </div>

          {/* Tagline + hashtag customisation */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Club tagline</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Up the Rovers!"
                type="text"
                value={tagline}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Hashtags</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#COYB #GrassrootsFootball"
                type="text"
                value={hashtags}
              />
            </div>
          </div>

          {/* Generate button */}
          <Button
            className="w-full"
            disabled={state === 'generating'}
            loading={state === 'generating'}
            onClick={() => void handleGenerate()}
            type="button"
            variant="secondary"
          >
            {state === 'ready' || caption ? 'Regenerate caption' : 'Generate caption with AI'}
          </Button>

          {/* Caption editor + copy */}
          {(state === 'ready' || caption) && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">
                  Caption — edit then copy to Instagram
                </label>
                <span className="text-xs text-slate-400">{caption.length} / 2200</span>
              </div>
              <textarea
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
                onChange={(e) => setCaption(e.target.value)}
                ref={textareaRef}
                rows={8}
                value={caption}
              />
              <button
                type="button"
                onClick={() => void handleCopy()}
                className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90'
                }`}
              >
                {copied ? (
                  <>✓ Copied!</>
                ) : (
                  <><CopyIcon /> Copy caption</>
                )}
              </button>
              {!copied && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  Open Instagram → New post → paste caption
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {copied && (
            <Button className="w-full" onClick={onClose} type="button" variant="secondary">
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

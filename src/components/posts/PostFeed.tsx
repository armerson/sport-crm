import { useEffect, useRef, useState } from 'react'
import { addComment, deleteComment, fetchComments, fetchFeed, toggleLike } from '../../services/posts.ts'
import type { Post, PostComment } from '../../types/posts.ts'
import type { UserProfile } from '../../types/auth.ts'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M16 3a1 1 0 0 1 .707 1.707L14 7.414V13l3 3v2h-5v4l-1 2-1-2v-4H5v-2l3-3V7.414L5.293 4.707A1 1 0 0 1 6 3h10z" />
    </svg>
  )
}

interface PostCardProps {
  post: Post
  profile: UserProfile
  onLikeToggle: (postId: string, liked: boolean) => void
}

function PostCard({ post, profile, onLikeToggle }: PostCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleShowComments() {
    const next = !showComments
    setShowComments(next)
    if (next && !commentsLoaded) {
      const loaded = await fetchComments(post.id)
      setComments(loaded)
      setCommentsLoaded(true)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    const body = commentText.trim()
    if (!body || posting) return
    setPosting(true)
    try {
      const comment = await addComment(post.id, profile.id, body)
      setComments((prev) => [...prev, comment])
      setCommentText('')
    } finally {
      setPosting(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    await deleteComment(commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-md shadow-slate-900/6">
      {/* Pinned banner */}
      {post.pinned && (
        <div className="flex items-center gap-1.5 bg-amber-50 px-4 py-1.5 text-xs font-bold text-amber-700">
          <PinIcon />
          Pinned
        </div>
      )}

      {/* Image */}
      {post.imageUrl && (
        <div className="aspect-video w-full overflow-hidden bg-slate-100">
          <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="px-5 py-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1565ff] text-xs font-bold text-white">
              {(post.authorName ?? 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{post.authorName ?? 'Club'}</p>
              <p className="text-xs text-slate-400">{timeAgo(post.createdAt)}</p>
            </div>
          </div>
          {post.teamName && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {post.teamName}
            </span>
          )}
        </div>

        {/* Content */}
        {post.title && (
          <h3 className="mb-1.5 text-base font-bold text-slate-900">{post.title}</h3>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{post.body}</p>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => onLikeToggle(post.id, post.likedByMe)}
            className={`flex items-center gap-1.5 text-sm font-semibold transition ${post.likedByMe ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'}`}
          >
            <HeartIcon filled={post.likedByMe} />
            {post.likeCount > 0 && <span>{post.likeCount}</span>}
            <span className="sr-only">{post.likedByMe ? 'Unlike' : 'Like'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleShowComments()}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 transition hover:text-[#1565ff]"
          >
            <ChatIcon />
            {post.commentCount > 0 ? post.commentCount : null}
            <span>{showComments ? 'Hide' : 'Comments'}</span>
          </button>
        </div>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          {!commentsLoaded ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-400">No comments yet. Be the first!</p>
          ) : (
            <div className="mb-4 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold text-slate-700">
                    {(c.authorName ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-slate-800">{c.authorName ?? 'Unknown'}</span>
                      <span className="text-[11px] text-slate-400">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700">{c.body}</p>
                  </div>
                  {(c.authorId === profile.id || profile.roles.includes('admin')) && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteComment(c.id)}
                      className="mt-0.5 text-slate-300 hover:text-rose-400"
                      aria-label="Delete comment"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          <form onSubmit={handleAddComment} className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1565ff]/20"
              rows={1}
              placeholder="Write a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleAddComment(e as unknown as React.FormEvent)
                }
              }}
            />
            <button
              type="submit"
              disabled={!commentText.trim() || posting}
              className="rounded-xl bg-[#1565ff] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </article>
  )
}

interface PostFeedProps {
  profile: UserProfile
  teamIds?: string[]
}

export function PostFeed({ profile, teamIds = [] }: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadFeed()
  }, [profile.id, teamIds.join(',')])

  async function loadFeed() {
    try {
      const data = await fetchFeed(profile.id, teamIds)
      setPosts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts.')
    } finally {
      setLoading(false)
    }
  }

  function handleLikeToggle(postId: string, liked: boolean) {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likedByMe: !liked, likeCount: liked ? p.likeCount - 1 : p.likeCount + 1 }
          : p,
      ),
    )
    void toggleLike(postId, profile.id, liked).catch(() => {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likedByMe: liked, likeCount: liked ? p.likeCount + 1 : p.likeCount - 1 }
            : p,
        ),
      )
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-[1.75rem] bg-slate-200" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 px-4 py-16 text-center">
        <p className="text-sm font-medium text-slate-600">Nothing posted yet</p>
        <p className="mt-1 text-sm text-slate-400">Club announcements will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          profile={profile}
          onLikeToggle={handleLikeToggle}
        />
      ))}
    </div>
  )
}

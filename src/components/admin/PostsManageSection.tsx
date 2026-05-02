import { useEffect, useRef, useState } from 'react'
import {
  createPost,
  deletePost,
  fetchAllPostsAdmin,
  updatePost,
  uploadPostImage,
} from '../../services/posts.ts'
import { PostFeed } from '../posts/PostFeed.tsx'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { Button } from '../ui/Button.tsx'
import { InstagramSharePanel } from './InstagramSharePanel.tsx'
import { useClubSettings } from '../../hooks/useClubSettings.ts'
import type { Post, PostInput } from '../../types/posts.ts'
import type { UserProfile } from '../../types/auth.ts'

function IgIcon() {
  return (
    <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24" width="13">
      <rect height="20" rx="5" ry="5" width="20" x="2" y="2" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" fill="currentColor" r="0.5" stroke="none" />
    </svg>
  )
}

const BLANK: PostInput = {
  title: '',
  body: '',
  teamId: null,
  pinned: false,
  imageFile: null,
  imageUrl: null,
}

interface PostsManageSectionProps {
  profile: UserProfile
  teams: { id: string; name: string; ageGroup: string }[]
}

export function PostsManageSection({ profile, teams }: PostsManageSectionProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [input, setInput] = useState<PostInput>(BLANK)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sharingPost, setSharingPost] = useState<Post | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { settings: clubSettings } = useClubSettings()

  useEffect(() => {
    void loadPosts()
  }, [])

  async function loadPosts() {
    try {
      const data = await fetchAllPostsAdmin(profile.id)
      setPosts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts.')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingPost(null)
    setInput(BLANK)
    setImagePreview(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(post: Post) {
    setEditingPost(post)
    setInput({
      title: post.title ?? '',
      body: post.body,
      teamId: post.teamId,
      pinned: post.pinned,
      imageFile: null,
      imageUrl: post.imageUrl,
    })
    setImagePreview(post.imageUrl)
    setError(null)
    setShowForm(true)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setInput((prev) => ({ ...prev, imageFile: file, imageUrl: null }))
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setInput((prev) => ({ ...prev, imageFile: null, imageUrl: null }))
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.body.trim()) { setError('Post body is required.'); return }
    setError(null)
    setSubmitting(true)
    try {
      let imageUrl = input.imageUrl
      if (input.imageFile) {
        imageUrl = await uploadPostImage(input.imageFile)
      }

      const payload = {
        title: input.title.trim() || null,
        body: input.body.trim(),
        teamId: input.teamId,
        pinned: input.pinned,
        imageUrl,
      }

      if (editingPost) {
        await updatePost(editingPost.id, payload)
        setSuccess('Post updated.')
      } else {
        await createPost(profile.id, payload)
        setSuccess('Post published.')
      }

      setShowForm(false)
      await loadPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(postId: string) {
    try {
      await deletePost(postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      setSuccess('Post deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post.')
    }
  }

  if (showForm) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowForm(false)} className="text-sm font-semibold text-[#1565ff] hover:underline">
            ← Back
          </button>
          <h2 className="text-xl font-semibold text-slate-950">{editingPost ? 'Edit post' : 'New post'}</h2>
        </div>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Photo (optional)</label>
            {imagePreview ? (
              <div className="relative overflow-hidden rounded-2xl">
                <img src={imagePreview} alt="Preview" className="aspect-video w-full object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                  aria-label="Remove image"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-8 text-slate-500 transition hover:border-[#1565ff] hover:text-[#1565ff]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-sm font-medium">Click to upload a photo</span>
                <span className="text-xs text-slate-400">JPEG, PNG, GIF or WebP · max 5 MB</span>
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              </label>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Title (optional)</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1565ff]/20"
              placeholder="e.g. Training cancelled this Friday"
              value={input.title}
              onChange={(e) => setInput((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Message <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1565ff]/20"
              rows={5}
              placeholder="Write your announcement here…"
              required
              value={input.body}
              onChange={(e) => setInput((p) => ({ ...p, body: e.target.value }))}
            />
          </div>

          {/* Team + options */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Visible to</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1565ff]/20"
                value={input.teamId ?? ''}
                onChange={(e) => setInput((p) => ({ ...p, teamId: e.target.value || null }))}
              >
                <option value="">Everyone in the club</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.ageGroup})</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 w-full">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1565ff]"
                  checked={input.pinned}
                  onChange={(e) => setInput((p) => ({ ...p, pinned: e.target.checked }))}
                />
                Pin to top of feed
              </label>
            </div>
          </div>

          <Button className="w-full" loading={submitting} type="submit">
            {editingPost ? 'Save changes' : 'Publish post'}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Club noticeboard</h2>
          <p className="text-sm text-slate-500">Post announcements, updates and photos to your members.</p>
        </div>
        <Button onClick={openCreate} type="button">New post</Button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-[1.75rem] bg-slate-200" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 px-4 py-16 text-center">
          <p className="text-sm font-medium text-slate-600">No posts yet</p>
          <p className="mt-1 text-sm text-slate-400">Create your first announcement to get started.</p>
          <button type="button" onClick={openCreate} className="mt-4 text-sm font-semibold text-[#1565ff] underline underline-offset-2">
            Create a post
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="relative">
              {/* Admin controls overlay */}
              <div className="mb-1.5 flex justify-end gap-2">
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-pink-200 bg-white px-3 py-1 text-xs font-semibold text-pink-600 hover:bg-pink-50 shadow-sm"
                  onClick={() => setSharingPost(post)}
                  type="button"
                >
                  <IgIcon />
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(post)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-sm"
                >
                  Edit
                </button>
                <ConfirmInline
                  label="Delete"
                  confirmLabel="Yes, delete"
                  onConfirm={() => void handleDelete(post.id)}
                />
              </div>
              {/* Reuse PostFeed card styles by embedding one post in PostFeed */}
              <article className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-md shadow-slate-900/6">
                {post.pinned && (
                  <div className="flex items-center gap-1.5 bg-amber-50 px-4 py-1.5 text-xs font-bold text-amber-700">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M16 3a1 1 0 0 1 .707 1.707L14 7.414V13l3 3v2h-5v4l-1 2-1-2v-4H5v-2l3-3V7.414L5.293 4.707A1 1 0 0 1 6 3h10z" />
                    </svg>
                    Pinned
                  </div>
                )}
                {post.imageUrl && (
                  <div className="aspect-video w-full overflow-hidden bg-slate-100">
                    <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="px-5 py-4">
                  <div className="mb-2 flex items-center gap-2">
                    {post.teamName && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{post.teamName}</span>
                    )}
                    <span className="text-xs text-slate-400">{new Date(post.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  {post.title && <p className="font-bold text-slate-900">{post.title}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{post.body}</p>
                  <p className="mt-3 text-xs text-slate-400">
                    {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'} · {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
                  </p>
                </div>
              </article>
            </div>
          ))}

          <div className="pt-4 border-t border-slate-200">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Member view preview</p>
            <PostFeed profile={profile} />
          </div>
        </div>
      )}
    </div>

    {sharingPost && (
      <InstagramSharePanel
        clubName={clubSettings.name}
        defaultHashtags={clubSettings.instagramHashtags}
        defaultTagline={clubSettings.instagramTagline}
        onClose={() => setSharingPost(null)}
        post={sharingPost}
      />
    )}
    </>
  )
}

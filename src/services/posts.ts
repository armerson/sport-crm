import { supabase } from '../lib/supabase.ts'
import type { Post, PostComment } from '../types/posts.ts'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function mapPost(row: Record<string, unknown>, myProfileId: string | null): Post {
  const likes = (row.post_likes as unknown[] | null) ?? []
  return {
    id: row.id as string,
    authorId: (row.author_id as string | null) ?? null,
    authorName: (row.author_name as string | null) ?? 'Club',
    title: (row.title as string | null) ?? null,
    body: row.body as string,
    imageUrl: (row.image_url as string | null) ?? null,
    teamId: (row.team_id as string | null) ?? null,
    teamName: (row.team_name as string | null) ?? null,
    pinned: (row.pinned as boolean) ?? false,
    likeCount: likes.length,
    commentCount: (row.comment_count as number) ?? 0,
    likedByMe: myProfileId ? likes.some((l) => (l as Record<string, unknown>).profile_id === myProfileId) : false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapComment(row: Record<string, unknown>): PostComment {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    authorId: (row.author_id as string | null) ?? null,
    authorName: (row.author_name as string | null) ?? 'Unknown',
    body: row.body as string,
    createdAt: row.created_at as string,
  }
}

// Fetch the feed for a user. myProfileId is used to check if they've liked each post.
// If teamIds are provided, returns club-wide posts + posts for those teams.
export async function fetchFeed(myProfileId: string | null, teamIds: string[] = []): Promise<Post[]> {
  const client = requireSupabase()

  let query = client
    .from('posts')
    .select(`
      *,
      author_name:profiles!author_id(name),
      team_name:teams!team_id(name),
      post_likes(profile_id),
      comment_count:post_comments(count)
    `)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  // Filter: club-wide OR any of the user's teams
  if (teamIds.length > 0) {
    query = query.or(`team_id.is.null,team_id.in.(${teamIds.join(',')})`)
  } else {
    query = query.is('team_id', null)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: Record<string, unknown>) => {
    // Flatten nested relations
    const authorObj = r.author_name as Record<string, unknown> | null
    const teamObj = r.team_name as Record<string, unknown> | null
    const countObj = (r.comment_count as unknown[]) ?? []
    return mapPost(
      {
        ...r,
        author_name: authorObj?.name ?? null,
        team_name: teamObj?.name ?? null,
        comment_count: countObj.length > 0 ? ((countObj[0] as Record<string, unknown>).count as number) : 0,
      },
      myProfileId,
    )
  })
}

export async function fetchAllPostsAdmin(myProfileId: string | null): Promise<Post[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('posts')
    .select(`
      *,
      author_name:profiles!author_id(name),
      team_name:teams!team_id(name),
      post_likes(profile_id),
      comment_count:post_comments(count)
    `)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: Record<string, unknown>) => {
    const authorObj = r.author_name as Record<string, unknown> | null
    const teamObj = r.team_name as Record<string, unknown> | null
    const countObj = (r.comment_count as unknown[]) ?? []
    return mapPost(
      {
        ...r,
        author_name: authorObj?.name ?? null,
        team_name: teamObj?.name ?? null,
        comment_count: countObj.length > 0 ? ((countObj[0] as Record<string, unknown>).count as number) : 0,
      },
      myProfileId,
    )
  })
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('post_comments')
    .select('*, author_name:profiles!author_id(name)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => {
    const authorObj = r.author_name as Record<string, unknown> | null
    return mapComment({ ...r, author_name: authorObj?.name ?? null })
  })
}

export async function toggleLike(postId: string, profileId: string, liked: boolean): Promise<void> {
  const client = requireSupabase()
  if (liked) {
    const { error } = await client.from('post_likes').delete().eq('post_id', postId).eq('profile_id', profileId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await client.from('post_likes').insert({ post_id: postId, profile_id: profileId })
    if (error) throw new Error(error.message)
  }
}

export async function addComment(postId: string, authorId: string, body: string): Promise<PostComment> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('post_comments')
    .insert({ post_id: postId, author_id: authorId, body })
    .select('*, author_name:profiles!author_id(name)')
    .single()
  if (error) throw new Error(error.message)
  const r = data as Record<string, unknown>
  const authorObj = r.author_name as Record<string, unknown> | null
  return mapComment({ ...r, author_name: authorObj?.name ?? null })
}

export async function deleteComment(commentId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('post_comments').delete().eq('id', commentId)
  if (error) throw new Error(error.message)
}

export async function uploadPostImage(file: File): Promise<string> {
  const client = requireSupabase()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await client.storage.from('post-images').upload(path, file, { contentType: file.type })
  if (error) throw new Error(error.message)
  const { data } = client.storage.from('post-images').getPublicUrl(path)
  return data.publicUrl
}

export async function createPost(
  authorId: string,
  input: { title: string | null; body: string; teamId: string | null; pinned: boolean; imageUrl: string | null },
): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('posts')
    .insert({
      author_id: authorId,
      title: input.title || null,
      body: input.body,
      image_url: input.imageUrl,
      team_id: input.teamId,
      pinned: input.pinned,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as Record<string, unknown>).id as string
}

export async function updatePost(
  postId: string,
  input: { title: string | null; body: string; teamId: string | null; pinned: boolean; imageUrl: string | null },
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('posts')
    .update({
      title: input.title || null,
      body: input.body,
      image_url: input.imageUrl,
      team_id: input.teamId,
      pinned: input.pinned,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
  if (error) throw new Error(error.message)
}

export async function deletePost(postId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('posts').delete().eq('id', postId)
  if (error) throw new Error(error.message)
}

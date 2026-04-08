export interface Post {
  id: string
  authorId: string | null
  authorName: string | null
  title: string | null
  body: string
  imageUrl: string | null
  teamId: string | null
  teamName: string | null
  pinned: boolean
  likeCount: number
  commentCount: number
  likedByMe: boolean
  createdAt: string
  updatedAt: string
}

export interface PostComment {
  id: string
  postId: string
  authorId: string | null
  authorName: string | null
  body: string
  createdAt: string
}

export interface PostInput {
  title: string
  body: string
  teamId: string | null
  pinned: boolean
  imageFile: File | null
  imageUrl: string | null
}

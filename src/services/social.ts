import { requireSupabase } from './supabaseHelpers.ts'

export interface GenerateCaptionInput {
  postBody: string
  postTitle?: string
  isMatchResult?: boolean
  clubName: string
  tagline?: string
  hashtags?: string
}

export async function generateInstagramCaption(input: GenerateCaptionInput): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke<{ caption?: string; error?: string }>('generate-caption', {
    body: input,
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  if (!data?.caption) throw new Error('No caption returned.')
  return data.caption
}


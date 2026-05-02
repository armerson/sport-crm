/**
 * Supabase Edge Function: generate-caption
 *
 * Generates an Instagram caption for a club post using the Anthropic Claude API.
 *
 * Required secrets (set with `supabase secrets set`):
 *   ANTHROPIC_API_KEY — Anthropic API key
 *
 * Deploy with:
 *   supabase functions deploy generate-caption
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  /** Main text of the club post */
  postBody: string
  /** Optional post title */
  postTitle?: string
  /** True when the post is a match result (e.g. "Full-time: Lions 3–1 City") */
  isMatchResult?: boolean
  /** Club name used in the prompt */
  clubName: string
  /** Club-specific tagline to include verbatim, e.g. "Up the Rovers!" */
  tagline?: string
  /** Space-separated hashtags to append, e.g. "#COYB #GrassrootsFootball" */
  hashtags?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY secret is not set.')

    const body: RequestBody = await req.json()
    const { postBody, postTitle, isMatchResult, clubName, tagline, hashtags } = body

    if (!postBody?.trim()) {
      return new Response(JSON.stringify({ error: 'postBody is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const systemPrompt = `You are a social media manager for a grassroots sports club.
Your job is to write punchy, authentic Instagram captions that resonate with players, parents, and supporters.
Keep the tone warm and community-focused — never corporate or generic.
Always write in the first person plural ("We", "Our", "The squad").`

    const userPrompt = `Write an Instagram caption for this club post.

Club: ${clubName}
${postTitle ? `Post title: ${postTitle}` : ''}
Post content: ${postBody}
${isMatchResult ? 'This is a match result announcement.' : ''}
${tagline ? `End the caption with this club tagline on its own line: ${tagline}` : ''}
${hashtags ? `Append these hashtags on a new line at the end: ${hashtags}` : 'Add 4–6 relevant grassroots football hashtags at the end.'}

Rules:
- Under 300 words
- Use line breaks to aid readability (blank line between paragraphs)
- Be specific to the content — no filler phrases like "what a game!" or "so proud"
- If it's a result, lead with the scoreline and build from there
- Hashtags go on their own line at the very end
- Return ONLY the caption text, nothing else`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic API error: ${err}`)
    }

    const result = await response.json() as {
      content: { type: string; text: string }[]
    }
    const caption = result.content.find((c) => c.type === 'text')?.text?.trim() ?? ''

    return new Response(JSON.stringify({ caption }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

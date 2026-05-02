import { requireSupabase } from '../services/supabaseHelpers.ts'

const CANVAS_SIZE = 800   // square output, px
const BADGE_OPACITY = 0.18 // badge shows through subtly behind the player

/**
 * Load an image from a URL (or blob URL) into an HTMLImageElement.
 * Handles cross-origin by fetching through Supabase's signed-URL or a direct blob.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Remove the background from a photo using our Supabase Edge Function,
 * which proxies to remove.bg.  Returns a transparent-PNG Blob.
 * Throws if the API key is not configured or the call fails.
 */
async function removeBg(file: File): Promise<Blob> {
  const client = requireSupabase()
  const {
    data: { session },
  } = await client.auth.getSession()

  const form = new FormData()
  form.append('image', file)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const res = await fetch(`${supabaseUrl}/functions/v1/remove-photo-bg`, {
    method: 'POST',
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `remove.bg failed (${res.status})`)
  }

  return res.blob()
}

/**
 * Composite a transparent-background player PNG over the club badge.
 *
 * Layout:
 *   - Navy background fill (#0d1b2a)
 *   - Club badge stretched to fill, dimmed to BADGE_OPACITY
 *   - Player image drawn on top, centred, scaled to fill (object-cover logic)
 *
 * Returns a JPEG Blob.
 */
async function compositeWithBadge(
  playerBlob: Blob,
  badgeUrl: string | null,
  primaryColor: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')!

  // ── Background fill ──────────────────────────────────────────────────────
  ctx.fillStyle = primaryColor || '#0d1b2a'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  // ── Club badge ───────────────────────────────────────────────────────────
  if (badgeUrl) {
    try {
      // Fetch badge through our own fetch so CORS isn't an issue for data: / blob: URLs
      const badgeRes = await fetch(badgeUrl)
      const badgeBlob = await badgeRes.blob()
      const badgeSrc = URL.createObjectURL(badgeBlob)
      const badge = await loadImage(badgeSrc)
      URL.revokeObjectURL(badgeSrc)

      ctx.save()
      ctx.globalAlpha = BADGE_OPACITY
      // Scale to fill, centred (cover)
      const scale = Math.max(CANVAS_SIZE / badge.naturalWidth, CANVAS_SIZE / badge.naturalHeight)
      const bw = badge.naturalWidth * scale
      const bh = badge.naturalHeight * scale
      ctx.drawImage(badge, (CANVAS_SIZE - bw) / 2, (CANVAS_SIZE - bh) / 2, bw, bh)
      ctx.restore()
    } catch {
      // Badge load failed — continue with plain background
    }
  }

  // ── Player (transparent PNG) ─────────────────────────────────────────────
  const playerSrc = URL.createObjectURL(playerBlob)
  const player = await loadImage(playerSrc)
  URL.revokeObjectURL(playerSrc)

  // object-cover: scale to fill the canvas, keep aspect ratio
  const scale = Math.max(CANVAS_SIZE / player.naturalWidth, CANVAS_SIZE / player.naturalHeight)
  const pw = player.naturalWidth * scale
  const ph = player.naturalHeight * scale
  ctx.drawImage(player, (CANVAS_SIZE - pw) / 2, (CANVAS_SIZE - ph) / 2, pw, ph)

  // ── Export as JPEG ───────────────────────────────────────────────────────
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      'image/jpeg',
      0.92,
    ),
  )
}

export interface HeadshotOptions {
  /** Club badge/logo URL (from ClubSettings.logoUrl). Can be null. */
  badgeUrl: string | null
  /** Club primary colour used as the solid background tint. */
  primaryColor: string
}

/**
 * Full pipeline: remove background → composite with badge → return as File.
 *
 * If background removal fails (e.g. API key not set), falls back to the
 * original file so upload still succeeds.
 */
export async function makeHeadshot(
  original: File,
  options: HeadshotOptions,
): Promise<File> {
  let playerBlob: Blob

  try {
    playerBlob = await removeBg(original)
  } catch (err) {
    console.warn('Background removal skipped:', err)
    // Graceful fallback — upload as-is
    return original
  }

  const composite = await compositeWithBadge(playerBlob, options.badgeUrl, options.primaryColor)
  return new File([composite], 'headshot.jpg', { type: 'image/jpeg' })
}

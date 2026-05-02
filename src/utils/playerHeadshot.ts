import removeBackground from '@imgly/background-removal'

const CANVAS_SIZE = 800    // square output px
const BADGE_OPACITY = 0.18 // badge ghost behind player

/**
 * Load an image from a blob URL into an HTMLImageElement.
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
 * Strip the background from an image file using @imgly/background-removal.
 * Runs entirely in-browser via WebAssembly — no API key needed.
 * The ONNX model (~10 MB) is downloaded once and cached in the browser.
 */
async function removeBg(file: File): Promise<Blob> {
  return removeBackground(file, {
    // Use the 'medium' quality model — good balance of speed vs quality
    model: 'medium',
    // Output as PNG so transparency is preserved
    output: { format: 'image/png', quality: 1 },
  })
}

/**
 * Composite a transparent-background player PNG over the club badge.
 *
 * Layout:
 *   - Solid fill with club primary colour (#0d1b2a if unset)
 *   - Club badge centred and scaled to fill, dimmed to BADGE_OPACITY
 *   - Player cutout centred, scaled to cover
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

  // ── Club badge watermark ─────────────────────────────────────────────────
  if (badgeUrl) {
    try {
      const badgeRes = await fetch(badgeUrl)
      const badgeBlob = await badgeRes.blob()
      const badgeSrc = URL.createObjectURL(badgeBlob)
      const badge = await loadImage(badgeSrc)
      URL.revokeObjectURL(badgeSrc)

      ctx.save()
      ctx.globalAlpha = BADGE_OPACITY
      const scale = Math.max(CANVAS_SIZE / badge.naturalWidth, CANVAS_SIZE / badge.naturalHeight)
      const bw = badge.naturalWidth * scale
      const bh = badge.naturalHeight * scale
      ctx.drawImage(badge, (CANVAS_SIZE - bw) / 2, (CANVAS_SIZE - bh) / 2, bw, bh)
      ctx.restore()
    } catch {
      // Badge unreachable — carry on with plain background
    }
  }

  // ── Player cutout ─────────────────────────────────────────────────────────
  const playerSrc = URL.createObjectURL(playerBlob)
  const player = await loadImage(playerSrc)
  URL.revokeObjectURL(playerSrc)

  const scale = Math.max(CANVAS_SIZE / player.naturalWidth, CANVAS_SIZE / player.naturalHeight)
  const pw = player.naturalWidth * scale
  const ph = player.naturalHeight * scale
  ctx.drawImage(player, (CANVAS_SIZE - pw) / 2, (CANVAS_SIZE - ph) / 2, pw, ph)

  // ── Export ────────────────────────────────────────────────────────────────
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
  /** Club primary colour used as the solid background. */
  primaryColor: string
}

/**
 * Full pipeline: strip background → composite over club badge → return as File.
 *
 * Falls back to the original file if anything fails, so upload always succeeds.
 */
export async function makeHeadshot(
  original: File,
  options: HeadshotOptions,
): Promise<File> {
  let playerBlob: Blob

  try {
    playerBlob = await removeBg(original)
  } catch (err) {
    console.warn('[headshot] Background removal skipped:', err)
    return original
  }

  const composite = await compositeWithBadge(playerBlob, options.badgeUrl, options.primaryColor)
  return new File([composite], 'headshot.jpg', { type: 'image/jpeg' })
}

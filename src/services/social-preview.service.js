const fs = require('fs/promises')
const path = require('path')
const sharp = require('sharp')

const storage = require('../config/storage')

const WIDTH = 1200
const HEIGHT = 630

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function resolveStoredPath(filePath) {
  const clean = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const resolved = path.resolve(storage.uploadsRoot, clean)
  const relative = path.relative(storage.uploadsRoot, resolved)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Ruta multimedia inválida para social preview.')
  }

  return resolved
}

function formatEventDate(value) {
  if (!value) return ''

  const date = value instanceof Date
    ? value
    : new Date(`${String(value).slice(0, 10)}T00:00:00Z`)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('es-MX', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function splitText(value, maxChars = 34, maxLines = 2) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const lines = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word

    if (candidate.length <= maxChars || !current) {
      current = candidate
      continue
    }

    lines.push(current)
    current = word

    if (lines.length >= maxLines - 1) break
  }

  if (lines.length < maxLines && current) {
    const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length
    const remaining = words.slice(consumed).join(' ')
    lines.push(remaining || current)
  }

  if (lines.length > maxLines) {
    lines.length = maxLines
  }

  const consumedChars = lines.join(' ').length
  if (consumedChars < String(value || '').trim().length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.\s]+$/, '')}…`
  }

  return lines
}

function normalizeDisplayContent(event) {
  const config = event.config || {}
  const hero = config.hero || {}
  const rsvp = config.rsvp || {}

  const heroName = String(hero.name || '').trim()
  const rsvpName = String(rsvp.celebrantName || '').trim()
  const eventTitle = String(event.title || '').trim()

  const displayName = heroName || rsvpName || eventTitle || 'Mis XV'
  const eyebrow = String(hero.eyebrow || 'Mis XV años').trim()
  const phrase = String(hero.phrase || '').trim()
  const eventDate = formatEventDate(event.event_date)

  return {
    displayName,
    eyebrow,
    phrase,
    eventDate
  }
}

function cacheVersion(event, heroRow) {
  const eventTime = new Date(event.updated_at || 0).getTime() || 0
  const mediaTime = new Date(heroRow?.updated_at || 0).getTime() || 0
  return `${event.id}-${Math.max(eventTime, mediaTime)}`
}

function renderTextOverlay({ event, eventTheme, hasHero }) {
  const palette = eventTheme?.palette || {}
  const paper = palette.paper || '#fbf7f1'
  const surface = palette.surface || '#fffdfa'
  const ink = palette.ink || '#332a25'
  const muted = palette.muted || '#83766d'
  const primary = palette.primary || '#c9a66a'
  const primaryDeep = palette.primaryDeep || '#a57a3f'
  const accent = palette.accent || '#b87568'

  const { displayName, eyebrow, phrase, eventDate } = normalizeDisplayContent(event)
  const titleLines = splitText(displayName, 20, 2)
  const phraseLines = splitText(phrase, 42, 2)

  const titleSvg = titleLines.map((line, index) => (
    `<text x="82" y="${240 + index * 74}" font-family="Georgia, 'Times New Roman', serif" font-size="67" font-weight="600" fill="${escapeXml(ink)}">${escapeXml(line)}</text>`
  )).join('')

  const phraseStartY = 402
  const phraseSvg = phraseLines.map((line, index) => (
    `<text x="84" y="${phraseStartY + index * 31}" font-family="Arial, sans-serif" font-size="23" font-weight="400" fill="${escapeXml(muted)}">${escapeXml(line)}</text>`
  )).join('')

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <defs>
        <linearGradient id="base" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${escapeXml(paper)}" stop-opacity="1"/>
          <stop offset="52%" stop-color="${escapeXml(surface)}" stop-opacity="${hasHero ? '.97' : '1'}"/>
          <stop offset="100%" stop-color="${escapeXml(paper)}" stop-opacity="${hasHero ? '.42' : '1'}"/>
        </linearGradient>
        <radialGradient id="glow1" cx="0" cy="0" r="1">
          <stop offset="0%" stop-color="${escapeXml(primary)}" stop-opacity=".27"/>
          <stop offset="100%" stop-color="${escapeXml(primary)}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glow2" cx="0" cy="0" r="1">
          <stop offset="0%" stop-color="${escapeXml(accent)}" stop-opacity=".22"/>
          <stop offset="100%" stop-color="${escapeXml(accent)}" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#base)"/>
      <circle cx="110" cy="70" r="230" fill="url(#glow1)"/>
      <circle cx="585" cy="610" r="250" fill="url(#glow2)"/>

      <text x="84" y="112" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="5" fill="${escapeXml(primaryDeep)}">${escapeXml(eyebrow.toUpperCase())}</text>
      <rect x="84" y="143" width="92" height="3" rx="1.5" fill="${escapeXml(accent)}"/>

      ${titleSvg}

      ${eventDate ? `<text x="84" y="368" font-family="Arial, sans-serif" font-size="25" font-weight="600" letter-spacing="1.2" fill="${escapeXml(primaryDeep)}">${escapeXml(eventDate)}</text>` : ''}
      ${phraseSvg}

      <text x="84" y="558" font-family="Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="2.5" fill="${escapeXml(primaryDeep)}">MIEVENTOCZC</text>
      <circle cx="257" cy="552" r="4" fill="${escapeXml(accent)}"/>
      <text x="274" y="558" font-family="Arial, sans-serif" font-size="15" fill="${escapeXml(muted)}">Tu momento, en una invitación especial</text>
    </svg>
  `)
}

async function roundedHeroCard(heroPath, eventTheme) {
  const palette = eventTheme?.palette || {}
  const accent = palette.accent || '#b87568'

  const image = await sharp(heroPath, { failOn: 'error' })
    .rotate()
    .resize(430, 530, {
      fit: 'cover',
      position: sharp.strategy.attention
    })
    .modulate({ saturation: 1.02 })
    .toBuffer()

  const mask = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="430" height="530">
      <rect x="0" y="0" width="430" height="530" rx="34" ry="34" fill="#fff"/>
    </svg>
  `)

  const border = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="430" height="530">
      <rect x="1.5" y="1.5" width="427" height="527" rx="33" ry="33"
        fill="none" stroke="${escapeXml(accent)}" stroke-opacity=".34" stroke-width="3"/>
    </svg>
  `)

  return sharp(image)
    .composite([
      { input: mask, blend: 'dest-in' },
      { input: border, blend: 'over' }
    ])
    .png()
    .toBuffer()
}

async function renderPreviewBuffer(event, mediaRows, eventTheme) {
  const heroRow = (mediaRows || []).find((row) => row.media_type === 'HERO') || null
  const heroPath = heroRow?.file_path ? resolveStoredPath(heroRow.file_path) : null
  let heroExists = false

  if (heroPath) {
    try {
      const stat = await fs.stat(heroPath)
      heroExists = stat.isFile()
    } catch (_) {
      heroExists = false
    }
  }

  const palette = eventTheme?.palette || {}
  const paper = palette.paper || '#fbf7f1'

  let canvas = sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: paper
    }
  })

  const composites = []

  if (heroExists) {
    const blurredBackground = await sharp(heroPath, { failOn: 'error' })
      .rotate()
      .resize(WIDTH, HEIGHT, {
        fit: 'cover',
        position: sharp.strategy.attention
      })
      .blur(24)
      .modulate({ saturation: 0.78, brightness: 0.91 })
      .jpeg({ quality: 78 })
      .toBuffer()

    composites.push({
      input: blurredBackground,
      left: 0,
      top: 0
    })
  }

  composites.push({
    input: renderTextOverlay({
      event,
      eventTheme,
      hasHero: heroExists
    }),
    left: 0,
    top: 0
  })

  if (heroExists) {
    const heroCard = await roundedHeroCard(heroPath, eventTheme)

    const shadow = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="500" height="590">
        <rect x="34" y="28" width="432" height="532" rx="35"
          fill="#1f1712" fill-opacity=".18"/>
      </svg>
    `)

    composites.push({
      input: await sharp(shadow).blur(18).png().toBuffer(),
      left: 675,
      top: 20
    })

    composites.push({
      input: heroCard,
      left: 712,
      top: 50
    })
  }

  return canvas
    .composite(composites)
    .jpeg({
      quality: 88,
      chromaSubsampling: '4:2:0',
      progressive: false,
      mozjpeg: false
    })
    .toBuffer()
}

async function ensurePreview(event, mediaRows, eventTheme) {
  const heroRow = (mediaRows || []).find((row) => row.media_type === 'HERO') || null
  const version = cacheVersion(event, heroRow)
  const generatedDir = path.resolve(
    storage.uploadsRoot,
    'events',
    String(event.id),
    'generated'
  )
  const outputPath = path.join(generatedDir, 'social-preview.jpg')
  const metaPath = path.join(generatedDir, 'social-preview.meta.json')

  await fs.mkdir(generatedDir, { recursive: true })

  try {
    const [metaRaw, outputStat] = await Promise.all([
      fs.readFile(metaPath, 'utf8'),
      fs.stat(outputPath)
    ])

    const meta = JSON.parse(metaRaw)

    if (outputStat.isFile() && meta.version === version) {
      return {
        path: outputPath,
        version
      }
    }
  } catch (_) {
    // Primera generación o caché desactualizada.
  }

  const buffer = await renderPreviewBuffer(event, mediaRows, eventTheme)
  const tempPath = path.join(
    generatedDir,
    `social-preview-${process.pid}-${Date.now()}.tmp.jpg`
  )

  await fs.writeFile(tempPath, buffer)
  await fs.rename(tempPath, outputPath)
  await fs.writeFile(
    metaPath,
    JSON.stringify({
      version,
      generatedAt: new Date().toISOString()
    }, null, 2)
  )

  return {
    path: outputPath,
    version
  }
}

function previewVersion(event, mediaRows) {
  const heroRow = (mediaRows || []).find((row) => row.media_type === 'HERO') || null
  return cacheVersion(event, heroRow)
}

module.exports = {
  ensurePreview,
  previewVersion,
  normalizeDisplayContent
}

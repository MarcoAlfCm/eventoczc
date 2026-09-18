const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')
const sharp = require('sharp')

const storage = require('../config/storage')
const eventMediaRepository = require('../repositories/event-media.repository')

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_AUDIO_BYTES = 30 * 1024 * 1024
const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif'])

const AUDIO_TYPES = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav'
}

const TYPE_CONFIG = {
  HERO: {
    kind: 'image',
    featureCode: 'HERO_PHOTO',
    folder: 'hero',
    maxWidth: 1920,
    maxHeight: 2400,
    quality: 84
  },
  GALLERY: {
    kind: 'image',
    featureCode: 'GALLERY',
    folder: 'gallery',
    maxWidth: 1600,
    maxHeight: 2000,
    quality: 82
  },
  MUSIC: {
    kind: 'audio',
    featureCode: 'MUSIC',
    folder: 'music'
  }
}

function normalizeType(value) {
  const type = String(value || '').trim().toUpperCase()
  return Object.prototype.hasOwnProperty.call(TYPE_CONFIG, type) ? type : null
}

function publicUrl(filePath) {
  const clean = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  return `/uploads/${clean}`
}

function resolveStoredPath(filePath) {
  const clean = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const resolved = path.resolve(storage.uploadsRoot, clean)
  const relative = path.relative(storage.uploadsRoot, resolved)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Ruta multimedia inválida.')
  }

  return resolved
}

async function ensureRegularFile(filePath, maxBytes, label) {
  const absolute = path.resolve(filePath)
  const stat = await fs.stat(absolute)

  if (!stat.isFile()) {
    throw new Error('El archivo indicado no es un archivo regular.')
  }

  if (stat.size > maxBytes) {
    throw new Error(`${label} excede el límite de ${Math.round(maxBytes / 1024 / 1024)} MB.`)
  }

  return { absolute, stat }
}

async function ensureInputImage(filePath) {
  const input = await ensureRegularFile(filePath, MAX_IMAGE_BYTES, 'La imagen')
  const metadata = await sharp(input.absolute, { failOn: 'error' }).metadata()

  if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format)) {
    throw new Error('Formato no permitido. Usa JPG, PNG, WebP o AVIF.')
  }

  return {
    ...input,
    metadata
  }
}

async function ensureInputAudio(filePath) {
  const input = await ensureRegularFile(filePath, MAX_AUDIO_BYTES, 'El audio')
  const extension = path.extname(input.absolute).toLowerCase()
  const mimeType = AUDIO_TYPES[extension]

  if (!mimeType) {
    throw new Error('Formato de audio no permitido. Usa MP3, M4A, AAC, OGG, OPUS o WAV.')
  }

  return {
    ...input,
    extension,
    mimeType
  }
}

async function capabilityFor(slug, type) {
  const config = TYPE_CONFIG[type]
  const event = await eventMediaRepository.findEventContextBySlug(slug, config.featureCode)

  if (!event) {
    throw new Error(`No existe el evento ${slug}.`)
  }

  if (!Number(event.feature_enabled)) {
    throw new Error(`El plan ${event.tier_name} no tiene habilitada la capacidad ${config.featureCode}.`)
  }

  return event
}

async function optimizeImage(event, type, sourcePath) {
  const config = TYPE_CONFIG[type]
  const input = await ensureInputImage(sourcePath)
  const fileName = `${Date.now()}-${crypto.randomUUID()}.webp`
  const relativePath = path.posix.join('events', String(event.id), config.folder, fileName)
  const destination = resolveStoredPath(relativePath)

  await fs.mkdir(path.dirname(destination), { recursive: true })

  await sharp(input.absolute, { failOn: 'error' })
    .rotate()
    .resize({
      width: config.maxWidth,
      height: config.maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: config.quality, effort: 4 })
    .toFile(destination)

  const outputStat = await fs.stat(destination)
  const outputMeta = await sharp(destination).metadata()

  return {
    file_path: relativePath,
    original_name: path.basename(input.absolute),
    mime_type: 'image/webp',
    file_size: outputStat.size,
    width: outputMeta.width || null,
    height: outputMeta.height || null,
    metadata_json: {
      sourceFormat: input.metadata.format,
      sourceSize: input.stat.size
    }
  }
}

async function storeAudio(event, sourcePath, { title, artist } = {}) {
  const config = TYPE_CONFIG.MUSIC
  const input = await ensureInputAudio(sourcePath)
  const fileName = `${Date.now()}-${crypto.randomUUID()}${input.extension}`
  const relativePath = path.posix.join('events', String(event.id), config.folder, fileName)
  const destination = resolveStoredPath(relativePath)

  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.copyFile(input.absolute, destination)

  return {
    file_path: relativePath,
    original_name: path.basename(input.absolute),
    mime_type: input.mimeType,
    file_size: input.stat.size,
    width: null,
    height: null,
    metadata_json: {
      title: String(title || '').trim() || '',
      artist: String(artist || '').trim() || '',
      sourceSize: input.stat.size
    }
  }
}

async function safeUnlinkStored(filePath) {
  if (!filePath) return

  try {
    await fs.unlink(resolveStoredPath(filePath))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

async function importMedia({ slug, type: requestedType, filePath, title, artist }) {
  const type = normalizeType(requestedType)
  if (!type) throw new Error('Tipo inválido. Usa HERO, GALLERY o MUSIC.')
  if (!filePath) throw new Error('Debes indicar un archivo con --file.')

  const event = await capabilityFor(slug, type)

  if (type === 'GALLERY') {
    const current = await eventMediaRepository.countActiveByType(event.id, 'GALLERY')
    const limit = Number(event.feature_limit || 0)

    if (!limit) {
      throw new Error('El plan no tiene un límite de galería configurado.')
    }

    if (current >= limit) {
      throw new Error(`La galería ya alcanzó el límite del plan: ${limit} fotografías.`)
    }
  }

  const stored = TYPE_CONFIG[type].kind === 'image'
    ? await optimizeImage(event, type, filePath)
    : await storeAudio(event, filePath, { title, artist })

  try {
    if (type === 'HERO') {
      const result = await eventMediaRepository.replaceHeroAndInsert({
        event_id: event.id,
        ...stored
      })

      for (const old of result.replaced) {
        await safeUnlinkStored(old.file_path)
      }

      return {
        id: result.id,
        eventId: event.id,
        type,
        url: publicUrl(stored.file_path),
        replaced: result.replaced.length
      }
    }

    if (type === 'MUSIC') {
      const result = await eventMediaRepository.replaceMusicAndInsert({
        event_id: event.id,
        ...stored
      })

      for (const old of result.replaced) {
        await safeUnlinkStored(old.file_path)
      }

      return {
        id: result.id,
        eventId: event.id,
        type,
        url: publicUrl(stored.file_path),
        title: stored.metadata_json.title,
        artist: stored.metadata_json.artist,
        replaced: result.replaced.length
      }
    }

    const sortOrder = await eventMediaRepository.nextSortOrder(event.id, 'GALLERY')
    const id = await eventMediaRepository.insertGallery({
      event_id: event.id,
      sort_order: sortOrder,
      ...stored
    })

    return {
      id,
      eventId: event.id,
      type,
      url: publicUrl(stored.file_path),
      sortOrder
    }
  } catch (error) {
    await safeUnlinkStored(stored.file_path)
    throw error
  }
}

async function importImage(options) {
  return importMedia(options)
}

async function listForEvent(slug) {
  const event = await eventMediaRepository.findEventContextBySlug(slug)
  if (!event) throw new Error(`No existe el evento ${slug}.`)

  const rows = await eventMediaRepository.listActiveByEventId(event.id)
  return rows.map((row) => ({
    ...row,
    url: publicUrl(row.file_path)
  }))
}

async function removeById(id) {
  const media = await eventMediaRepository.markDeleted(id)
  if (!media) throw new Error(`No existe el medio ${id}.`)

  await safeUnlinkStored(media.file_path)

  return {
    id: media.id,
    eventId: media.event_id,
    type: media.media_type,
    removed: true
  }
}

function parseMetadata(value) {
  if (!value) return {}
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch (_) {
    return {}
  }
}

function buildViewMedia(rows = []) {
  const active = Array.isArray(rows) ? rows : []
  const hero = active.find((row) => row.media_type === 'HERO') || null
  const gallery = active.filter((row) => row.media_type === 'GALLERY')
  const music = active.find((row) => row.media_type === 'MUSIC') || null
  const musicMetadata = parseMetadata(music?.metadata_json)

  return {
    hero: hero
      ? {
          id: hero.id,
          src: publicUrl(hero.file_path),
          width: hero.width,
          height: hero.height
        }
      : null,
    gallery: gallery.map((row) => ({
      id: row.id,
      src: publicUrl(row.file_path),
      width: row.width,
      height: row.height
    })),
    music: music
      ? {
          id: music.id,
          src: publicUrl(music.file_path),
          mimeType: music.mime_type,
          title: musicMetadata.title || '',
          artist: musicMetadata.artist || ''
        }
      : null
  }
}

module.exports = {
  importMedia,
  importImage,
  listForEvent,
  removeById,
  buildViewMedia,
  publicUrl
}

const fs = require('fs/promises')
const os = require('os')
const multer = require('multer')

const eventRepository = require('../repositories/event.repository')
const eventMediaRepository = require('../repositories/event-media.repository')
const eventMediaService = require('../services/event-media.service')
const eventThemeService = require('../services/event-theme.service')
const socialPreviewService = require('../services/social-preview.service')
const publicHost = require('../config/public-host')

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 1
  }
})

function trimText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function nullableText(value, max = 500) {
  const clean = trimText(value, max)
  return clean || null
}

function splitNames(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => trimText(item, 150))
      .filter(Boolean)
      .slice(0, 12)
  }

  return String(value || '')
    .split(/\r?\n/)
    .map((item) => trimText(item, 150))
    .filter(Boolean)
    .slice(0, 12)
}

function validDate(value) {
  const clean = trimText(value, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null
}

function validHex(value) {
  const clean = String(value || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(clean) ? clean : null
}

function editorColors(eventTheme) {
  const colors = eventTheme?.colors || {}
  const count = Math.min(3, Math.max(1, Number(colors.count || 3)))

  if (count === 1) return [colors.primary || '#d7a4b0']
  if (count === 2) {
    return [
      colors.primary || '#d7a4b0',
      colors.accent || '#c7a15a'
    ]
  }

  return [
    colors.base || '#fffdfc',
    colors.primary || '#d7a4b0',
    colors.accent || '#c7a15a'
  ]
}


function normalizeSubdomainInput(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function calculateExpiry(eventDate, graceDays) {
  if (!eventDate) return null

  const date = new Date(`${String(eventDate).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null

  date.setUTCDate(date.getUTCDate() + graceDays)

  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd} 23:59:59`
}

function formatLongDate(value) {
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

function publicationUrls(event) {
  if (!event?.subdomain) {
    return {
      publicUrl: '',
      shareUrl: '',
      socialImageUrl: ''
    }
  }

  const baseDomain = publicHost.getBaseDomain()

  return {
    publicUrl: `https://${event.subdomain}.${baseDomain}/`,
    shareUrl: `https://${event.subdomain}.${baseDomain}/`,
    socialImageUrl: `https://${event.subdomain}.${baseDomain}/social-preview.jpg`
  }
}


async function loadEditorContext(slug) {
  const event = await eventRepository.findBySlug(slug, { includeDraft: true })
  if (!event) return null

  const mediaRows = await eventMediaRepository.listActiveByEventId(event.id)
  const media = eventMediaService.buildViewMedia(mediaRows)
  const config = event.config || {}
  const eventTheme = eventThemeService.normalizeTheme(config.theme)

  return {
    event,
    config,
    eventTheme,
    media,
    mediaRows
  }
}

async function editor(req, res, next) {
  try {
    const context = await loadEditorContext(req.params.slug)
    if (!context) {
      return res.status(404).send('Evento no encontrado.')
    }

    const { event, config, eventTheme, media } = context

    return res.render('dashboard/event-editor', {
      layout: 'layouts/editor',
      pageTitle: `Editar · ${event.title} | MiEventoCzC`,
      event,
      config,
      eventTheme,
      media,
      editorColors: editorColors(eventTheme),
      fontPresets: eventThemeService.FONT_PRESETS,
      heroFontPresets: eventThemeService.HERO_FONT_PRESETS,
      previewUrl: `/evento/${encodeURIComponent(event.slug)}/preview`
    })
  } catch (error) {
    next(error)
  }
}

async function saveContent(req, res, next) {
  try {
    const context = await loadEditorContext(req.params.slug)
    if (!context) {
      return res.status(404).json({ ok: false, message: 'Evento no encontrado.' })
    }

    const { event } = context
    const payload = req.body || {}
    const current = event.config || {}

    const nextConfig = {
      ...current,
      hero: {
        ...(current.hero || {}),
        name: trimText(payload.hero?.name, 150) || 'Mis XV',
        eyebrow: trimText(payload.hero?.eyebrow, 80) || 'Mis XV años',
        phrase: trimText(payload.hero?.phrase, 300)
      },
      family: {
        ...(current.family || {}),
        enabled: true,
        parents: splitNames(payload.family?.parents),
        godparents: splitNames(payload.family?.godparents)
      },
      ceremony: {
        ...(current.ceremony || {}),
        enabled: true,
        name: nullableText(payload.ceremony?.name, 180),
        time: nullableText(payload.ceremony?.time, 10),
        address: nullableText(payload.ceremony?.address, 350),
        mapsUrl: nullableText(payload.ceremony?.mapsUrl, 1200)
      },
      reception: {
        ...(current.reception || {}),
        enabled: true,
        name: nullableText(payload.reception?.name, 180),
        time: nullableText(payload.reception?.time, 10),
        address: nullableText(payload.reception?.address, 350),
        mapsUrl: nullableText(payload.reception?.mapsUrl, 1200)
      },
      dressCode: {
        ...(current.dressCode || {}),
        enabled: true,
        title: trimText(payload.dressCode?.title, 100) || 'Formal',
        description: trimText(payload.dressCode?.description, 350)
      },
      gallery: {
        ...(current.gallery || {}),
        enabled: true
      },
      rsvp: {
        ...(current.rsvp || {}),
        enabled: true,
        type: 'whatsapp',
        phone: trimText(payload.rsvp?.phone, 40).replace(/[^\d+]/g, '')
      }
    }

    const requestedCount = Math.min(3, Math.max(1, Number(payload.theme?.colorCount || 3)))
    const suppliedColors = Array.isArray(payload.theme?.colors)
      ? payload.theme.colors
      : []

    const selectedColors = suppliedColors
      .map(validHex)
      .filter(Boolean)
      .slice(0, requestedCount)

    while (selectedColors.length < requestedCount) {
      selectedColors.push(
        selectedColors.length === 0
          ? '#d7a4b0'
          : selectedColors.length === 1
            ? '#c7a15a'
            : '#fffdfc'
      )
    }

    const requestedFont = String(payload.theme?.fontPreset || '')
    const fontPreset = Object.prototype.hasOwnProperty.call(
      eventThemeService.FONT_PRESETS,
      requestedFont
    )
      ? requestedFont
      : 'elegant'

    const requestedHeroFont = String(payload.theme?.heroFont || '')
    const heroFont = Object.prototype.hasOwnProperty.call(
      eventThemeService.HERO_FONT_PRESETS,
      requestedHeroFont
    )
      ? requestedHeroFont
      : 'great-vibes'

    nextConfig.theme = {
      ...(current.theme || {}),
      colors: {
        selected: selectedColors
      },
      fonts: {
        ...((current.theme || {}).fonts || {}),
        preset: fontPreset,
        hero: heroFont
      }
    }

    const eventDate = validDate(payload.eventDate) || event.event_date || null
    const visibleName = trimText(nextConfig.hero.name, 150) || 'Mis XV'

    await eventRepository.updateEditorConfig(event.id, {
      title: visibleName,
      eventDate,
      config: nextConfig
    })

    return res.json({
      ok: true,
      message: 'Cambios guardados.',
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
}

async function uploadMedia(req, res, next, type) {
  const tempPath = req.file?.path

  try {
    if (!tempPath) {
      return res.status(400).json({
        ok: false,
        message: 'Selecciona un archivo.'
      })
    }

    const result = await eventMediaService.importMedia({
      slug: req.params.slug,
      type,
      filePath: tempPath
    })

    return res.json({
      ok: true,
      media: result
    })
  } catch (error) {
    return res.status(422).json({
      ok: false,
      message: error.message
    })
  } finally {
    if (tempPath) {
      fs.unlink(tempPath).catch(() => {})
    }
  }
}

async function uploadHero(req, res, next) {
  return uploadMedia(req, res, next, 'HERO')
}

async function uploadGallery(req, res, next) {
  return uploadMedia(req, res, next, 'GALLERY')
}

async function removeMedia(req, res, next) {
  try {
    const context = await loadEditorContext(req.params.slug)
    if (!context) {
      return res.status(404).json({ ok: false, message: 'Evento no encontrado.' })
    }

    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'Medio inválido.' })
    }

    const media = await eventMediaRepository.findById(id)
    if (!media || Number(media.event_id) !== Number(context.event.id)) {
      return res.status(404).json({ ok: false, message: 'Medio no encontrado.' })
    }

    const result = await eventMediaService.removeById(id)
    return res.json({ ok: true, media: result })
  } catch (error) {
    next(error)
  }
}


async function publishPage(req, res, next) {
  try {
    const context = await loadEditorContext(req.params.slug)
    if (!context) {
      return res.status(404).send('Evento no encontrado.')
    }

    const { event, media } = context
    const graceDays = Math.max(
      0,
      Math.min(365, Number(event.publication_grace_days ?? 3))
    )

    const expiresAt = calculateExpiry(event.event_date, graceDays)
    const urls = publicationUrls(event)

    return res.render('dashboard/event-publish', {
      layout: 'layouts/publish',
      pageTitle: event.status === 'PUBLISHED'
        ? `Publicada · ${event.title} | MiEventoCzC`
        : `Publicar · ${event.title} | MiEventoCzC`,
      event,
      media,
      baseDomain: publicHost.getBaseDomain(),
      graceDays,
      eventDateLong: formatLongDate(event.event_date),
      expiryDateLong: expiresAt ? formatLongDate(expiresAt) : '',
      publicationPreviewUrl:
        `/mi-evento/${encodeURIComponent(event.slug)}/publicar/social-preview.jpg`,
      ...urls
    })
  } catch (error) {
    next(error)
  }
}

async function checkSubdomain(req, res, next) {
  try {
    const context = await loadEditorContext(req.params.slug)
    if (!context) {
      return res.status(404).json({
        ok: false,
        available: false,
        message: 'Evento no encontrado.'
      })
    }

    if (context.event.status === 'PUBLISHED') {
      return res.json({
        ok: true,
        available: false,
        locked: true,
        subdomain: context.event.subdomain || '',
        message: 'La invitación ya está publicada.'
      })
    }

    const subdomain = normalizeSubdomainInput(req.query.subdomain)

    if (!publicHost.isValidEventSubdomain(subdomain)) {
      return res.json({
        ok: true,
        available: false,
        subdomain,
        message: 'Usa de 3 a 40 caracteres: letras, números y guiones.'
      })
    }

    const owner = await eventRepository.findSubdomainOwner(subdomain)
    const available = !owner || Number(owner.id) === Number(context.event.id)

    return res.json({
      ok: true,
      available,
      subdomain,
      message: available
        ? 'Este enlace está disponible.'
        : 'Este enlace ya está ocupado.'
    })
  } catch (error) {
    next(error)
  }
}

async function publicationSocialPreview(req, res, next) {
  try {
    const context = await loadEditorContext(req.params.slug)
    if (!context) return res.status(404).end()

    const { event, mediaRows, eventTheme } = context
    const preview = await socialPreviewService.ensurePreview(
      event,
      mediaRows,
      eventTheme
    )

    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    })

    if (req.method === 'HEAD') {
      return res.status(200).end()
    }

    return res.sendFile(preview.path)
  } catch (error) {
    next(error)
  }
}

async function publish(req, res, next) {
  try {
    const context = await loadEditorContext(req.params.slug)

    if (!context) {
      return res.status(404).json({
        ok: false,
        message: 'Evento no encontrado.'
      })
    }

    const { event, media, mediaRows, eventTheme } = context

    if (event.status === 'PUBLISHED') {
      return res.status(409).json({
        ok: false,
        message: 'Esta invitación ya está publicada.'
      })
    }

    if (event.status !== 'DRAFT') {
      return res.status(409).json({
        ok: false,
        message: 'La invitación no está disponible para publicación.'
      })
    }

    if (!event.event_date) {
      return res.status(422).json({
        ok: false,
        message: 'Agrega la fecha del evento antes de publicar.'
      })
    }

    if (!media.hero) {
      return res.status(422).json({
        ok: false,
        message: 'Agrega la fotografía principal antes de publicar.'
      })
    }

    const subdomain = normalizeSubdomainInput(req.body?.subdomain)

    if (!publicHost.isValidEventSubdomain(subdomain)) {
      return res.status(422).json({
        ok: false,
        message: 'Elige una dirección válida de 3 a 40 caracteres.'
      })
    }

    const owner = await eventRepository.findSubdomainOwner(subdomain)
    if (owner && Number(owner.id) !== Number(event.id)) {
      return res.status(409).json({
        ok: false,
        code: 'SUBDOMAIN_TAKEN',
        message: 'Ese enlace ya está ocupado. Elige otro.'
      })
    }

    const graceDays = Math.max(
      0,
      Math.min(365, Number(event.publication_grace_days ?? 3))
    )

    const expiresAt = calculateExpiry(event.event_date, graceDays)
    if (!expiresAt) {
      return res.status(422).json({
        ok: false,
        message: 'La fecha del evento no es válida.'
      })
    }

    // La tarjeta social se prepara con el mismo template que ya usamos
    // para Dayana: HERO + datos del evento + Theme Engine.
    try {
      await socialPreviewService.ensurePreview(
        event,
        mediaRows,
        eventTheme
      )
    } catch (error) {
      console.error('[publish-social-preview]', error)

      return res.status(422).json({
        ok: false,
        message: 'No se pudo preparar la tarjeta para compartir. Revisa la fotografía principal.'
      })
    }

    try {
      await eventRepository.publishEvent({
        eventId: event.id,
        subdomain,
        expiresAt
      })
    } catch (error) {
      if (error?.code === 'SUBDOMAIN_TAKEN') {
        return res.status(409).json({
          ok: false,
          code: 'SUBDOMAIN_TAKEN',
          message: 'Ese enlace acaba de ser ocupado. Elige otro.'
        })
      }

      if (error?.code === 'EVENT_NOT_DRAFT') {
        return res.status(409).json({
          ok: false,
          message: 'La invitación ya no está disponible para publicación.'
        })
      }

      throw error
    }

    const publishedEvent = await eventRepository.findBySlug(
      event.slug,
      { includeDraft: true }
    )

    return res.json({
      ok: true,
      message: 'Tu invitación ya está publicada.',
      event: {
        status: publishedEvent?.status || 'PUBLISHED',
        subdomain,
        expiresAt
      },
      ...publicationUrls({
        ...publishedEvent,
        subdomain
      })
    })
  } catch (error) {
    next(error)
  }
}


module.exports = {
  upload,
  editor,
  saveContent,
  uploadHero,
  uploadGallery,
  removeMedia,
  publishPage,
  checkSubdomain,
  publicationSocialPreview,
  publish
}

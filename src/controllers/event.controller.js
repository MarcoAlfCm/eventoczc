const eventRepository = require('../repositories/event.repository')
const eventMediaRepository = require('../repositories/event-media.repository')
const eventMediaService = require('../services/event-media.service')
const eventThemeService = require('../services/event-theme.service')
const publicHost = require('../config/public-host')
const socialPreviewService = require('../services/social-preview.service')

const TEMPLATE_MAP = {
  XV_ESENCIAL_BASE: {
    view: 'events/xv-esencial',
    stylesheet: '/assets/css/events/xv-esencial.css',
    script: '/assets/js/events/xv-esencial.js'
  }
}

function resolveTemplate(event) {
  if (event.template_code && TEMPLATE_MAP[event.template_code]) {
    return TEMPLATE_MAP[event.template_code]
  }

  if (event.event_type === 'XV') {
    return TEMPLATE_MAP.XV_ESENCIAL_BASE
  }

  return null
}

function renderNotFound(res) {
  return res.status(404).render('pages/404', {
    pageTitle: 'Invitación no encontrada | MiEventoCzC',
    bodyClass: 'page-error',
    navActive: ''
  })
}

function eventViewModel(event, preview, mediaRows = []) {
  const config = event.config || {}
  const eventTheme = eventThemeService.normalizeTheme(config.theme)
  const media = eventMediaService.buildViewMedia(mediaRows)

  const hero = {
    ...(config.hero || {})
  }

  if (media.hero) {
    hero.image = media.hero.src
  }

  const configuredGallery = config.gallery || {}
  const gallery = {
    ...configuredGallery,
    images: media.gallery.length
      ? media.gallery
      : (Array.isArray(configuredGallery.images) ? configuredGallery.images : [])
  }

  const configuredMusic = config.music || {}
  const music = {
    ...configuredMusic
  }

  if (media.music) {
    music.enabled = true
    music.track = {
      id: media.music.id,
      src: media.music.src,
      mimeType: media.music.mimeType,
      title: media.music.title,
      artist: media.music.artist
    }
  }

  return {
    event,
    preview,
    eventTheme,
    hero,
    countdown: config.countdown || {},
    ceremony: config.ceremony || {},
    reception: config.reception || {},
    dressCode: config.dressCode || {},
    family: config.family || {},
    gallery,
    music,
    rsvp: config.rsvp || {}
  }
}

function formatSocialDate(value) {
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

function buildSocialMeta(event, mediaRows) {
  const baseDomain = publicHost.getBaseDomain()
  const config = event.config || {}
  const hero = config.hero || {}
  const display = socialPreviewService.normalizeDisplayContent(event)
  const eventDate = formatSocialDate(event.event_date)

  const canonicalUrl = event.subdomain
    ? `https://${event.subdomain}.${baseDomain}/`
    : `https://${baseDomain}/evento/${encodeURIComponent(event.slug)}`

  const imageUrl = event.subdomain
    ? `https://${event.subdomain}.${baseDomain}/social-preview.jpg`
    : `https://${baseDomain}/evento/${encodeURIComponent(event.slug)}/social-preview.jpg`

  const title = eventDate
    ? `${display.displayName} · ${eventDate}`
    : display.displayName

  const description = String(hero.phrase || '').trim()
    || 'Te invitamos a compartir este día tan especial.'

  return {
    title,
    description,
    canonicalUrl,
    imageUrl
  }
}

async function renderResolvedEvent(res, event, preview) {
  const template = resolveTemplate(event)
  if (!template) return renderNotFound(res)

  const mediaRows = await eventMediaRepository.listActiveByEventId(event.id)

  res.set('Cache-Control', 'no-store, max-age=0')

  if (preview) {
    res.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return res.render(template.view, {
    layout: 'layouts/event',
    pageTitle: preview
      ? `Vista previa · ${event.title} | MiEventoCzC`
      : `${event.title} | MiEventoCzC`,
    bodyClass: `event-page event-page-xv-esencial${preview ? ' is-preview' : ''}`,
    eventStylesheet: template.stylesheet,
    eventScript: template.script,
    robots: preview ? 'noindex,nofollow' : 'index,follow',
    socialMeta: preview ? null : buildSocialMeta(event, mediaRows),
    ...eventViewModel(event, preview, mediaRows)
  })
}

async function sendSocialPreview(res, event) {
  const mediaRows = await eventMediaRepository.listActiveByEventId(event.id)
  const eventTheme = eventThemeService.normalizeTheme(event.config?.theme)
  const socialPreview = await socialPreviewService.ensurePreview(
    event,
    mediaRows,
    eventTheme
  )

  res.set({
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=300, must-revalidate',
    'X-Content-Type-Options': 'nosniff'
  })

  return res.sendFile(socialPreview.path)
}

async function renderEventBySlug(req, res, next, preview) {
  try {
    const event = await eventRepository.findBySlug(req.params.slug, {
      includeDraft: preview
    })

    if (!event) return renderNotFound(res)

    return renderResolvedEvent(res, event, preview)
  } catch (error) {
    next(error)
  }
}

async function publicSubdomainEvent(req, res, next) {
  const subdomain = publicHost.extractEventSubdomain(req.hostname)

  // Dominio principal, www, localhost u otro host no administrado:
  // continúa hacia la portada normal.
  if (!subdomain) return next()

  try {
    const event = await eventRepository.findBySubdomain(subdomain)

    // Un subdominio válido pero inexistente, DRAFT o expirado
    // nunca debe caer en la portada principal.
    if (!event) return renderNotFound(res)

    return renderResolvedEvent(res, event, false)
  } catch (error) {
    next(error)
  }
}

async function publicSubdomainSocialPreview(req, res, next) {
  const subdomain = publicHost.extractEventSubdomain(req.hostname)

  if (!subdomain) {
    return res.status(404).end()
  }

  try {
    const event = await eventRepository.findBySubdomain(subdomain)
    if (!event) return res.status(404).end()

    return sendSocialPreview(res, event)
  } catch (error) {
    next(error)
  }
}

async function publicSlugSocialPreview(req, res, next) {
  try {
    const event = await eventRepository.findBySlug(req.params.slug)
    if (!event) return res.status(404).end()

    return sendSocialPreview(res, event)
  } catch (error) {
    next(error)
  }
}

async function publicEvent(req, res, next) {
  return renderEventBySlug(req, res, next, false)
}

async function previewEvent(req, res, next) {
  return renderEventBySlug(req, res, next, true)
}

module.exports = {
  publicSubdomainEvent,
  publicSubdomainSocialPreview,
  publicSlugSocialPreview,
  publicEvent,
  previewEvent
}

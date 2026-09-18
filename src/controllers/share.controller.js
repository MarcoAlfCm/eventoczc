const eventRepository = require('../repositories/event.repository')
const publicHost = require('../config/public-host')

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

function buildShareMeta(event) {
  const baseDomain = publicHost.getBaseDomain()
  const subdomain = String(event.subdomain || '').trim()
  const eventDate = formatEventDate(event.event_date)
  const eventTitle = String(event.title || 'Mis XV').trim()

  const shareUrl = `https://${baseDomain}/s/${encodeURIComponent(subdomain)}`
  const invitationUrl = `https://${subdomain}.${baseDomain}/`

  // V1: igual que Zendtry, una sola imagen social para todos los enlaces.
  // La ruta /branding/mieventoczc-share.jpg sirve la imagen fija actual.
  const imageUrl = `https://${baseDomain}/branding/mieventoczc-share.jpg`

  const title = eventDate
    ? `${eventTitle} · ${eventDate}`
    : eventTitle

  const description = 'Te invitamos a compartir este día tan especial.'

  return {
    title,
    description,
    shareUrl,
    invitationUrl,
    imageUrl
  }
}

async function shareInvitation(req, res, next) {
  try {
    const subdomain = String(req.params.subdomain || '').trim().toLowerCase()

    if (!publicHost.isValidEventSubdomain(subdomain)) {
      return res.status(404).render('pages/404', {
        pageTitle: 'Invitación no encontrada | MiEventoCzC',
        bodyClass: 'page-error',
        navActive: ''
      })
    }

    // findBySubdomain ya exige PUBLISHED, no expirado y dentro de vigencia.
    const event = await eventRepository.findBySubdomain(subdomain)

    if (!event) {
      return res.status(404).render('pages/404', {
        pageTitle: 'Invitación no encontrada | MiEventoCzC',
        bodyClass: 'page-error',
        navActive: ''
      })
    }

    const shareMeta = buildShareMeta(event)

    // Mismo enfoque de Zendtry: el HTML inicial de share nunca se cachea.
    // Igual que share-meta-server.mjs de Zendtry:
    // 200 + HTML inicial dinámico + no-store, sin marcar el recurso noindex.
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    })

    if (req.method === 'HEAD') {
      return res.status(200).end()
    }

    return res.status(200).render('share/meta', {
      layout: false,
      shareMeta
    })
  } catch (error) {
    next(error)
  }
}


module.exports = {
  shareInvitation
}

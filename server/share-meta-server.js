require('dotenv').config()

const http = require('node:http')

const port = Number.parseInt(process.env.SHARE_META_PORT || '3111', 10)
const appPort = Number.parseInt(process.env.APP_PORT || '3110', 10)
const appHost = process.env.APP_HOST || '127.0.0.1'
const baseDomain = String(process.env.PUBLIC_BASE_DOMAIN || 'mieventoczc.com')
  .trim()
  .toLowerCase()

const imageUrl = `https://${baseDomain}/branding/mieventoczc-share.jpg`
const description = 'Te invitamos a compartir este día tan especial.'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function extractMeta(html, attribute, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const re = new RegExp(
    `<meta\\s+[^>]*${escapedAttribute}=["']${escapedName}["'][^>]*content=["']([^"']*)["'][^>]*>|` +
    `<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${escapedAttribute}=["']${escapedName}["'][^>]*>`,
    'i'
  )

  const match = html.match(re)
  return match ? (match[1] || match[2] || '') : ''
}

function extractTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/is)
  return match ? String(match[1] || '').trim() : ''
}

function replaceTitle(html, title) {
  const safe = escapeHtml(title)
  return /<title>.*?<\/title>/is.test(html)
    ? html.replace(/<title>.*?<\/title>/is, `<title>${safe}</title>`)
    : html.replace('</head>', `  <title>${safe}</title>\n</head>`)
}

function replaceOrInsertMeta(html, attribute, name, content) {
  const safeContent = escapeHtml(content)
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const re = new RegExp(
    `<meta\\s+[^>]*${escapedAttribute}=["']${escapedName}["'][^>]*>`,
    'i'
  )

  const tag = `<meta ${attribute}="${name}" content="${safeContent}">`

  return re.test(html)
    ? html.replace(re, tag)
    : html.replace('</head>', `  ${tag}\n</head>`)
}

function replaceOrInsertCanonical(html, url) {
  const safe = escapeHtml(url)
  const re = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i
  const tag = `<link rel="canonical" href="${safe}">`

  return re.test(html)
    ? html.replace(re, tag)
    : html.replace('</head>', `  ${tag}\n</head>`)
}

function fetchInvitationHtml(subdomain) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: appHost,
        port: appPort,
        method: 'GET',
        path: '/',
        headers: {
          Host: `${subdomain}.${baseDomain}`,
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'MiEventoCzC-ShareMeta/1.0'
        },
        timeout: 4500
      },
      (res) => {
        const chunks = []

        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            statusCode: Number(res.statusCode || 500),
            html: Buffer.concat(chunks).toString('utf8')
          })
        })
      }
    )

    req.on('timeout', () => {
      req.destroy(new Error('Timeout obteniendo invitación'))
    })
    req.on('error', reject)
    req.end()
  })
}

function buildShareHtml(baseHtml, requestUrl) {
  const existingOgTitle = extractMeta(baseHtml, 'property', 'og:title')
  const existingTitle = extractTitle(baseHtml)
  const title = existingOgTitle || existingTitle || 'Invitación | MiEventoCzC'
  const canonicalUrl = `https://${baseDomain}${requestUrl.pathname}`

  let html = replaceTitle(baseHtml, `${title} | MiEventoCzC`)

  html = replaceOrInsertMeta(html, 'name', 'description', description)
  html = replaceOrInsertMeta(html, 'property', 'og:locale', 'es_MX')
  html = replaceOrInsertMeta(html, 'property', 'og:type', 'website')
  html = replaceOrInsertMeta(html, 'property', 'og:site_name', 'MiEventoCzC')
  html = replaceOrInsertMeta(html, 'property', 'og:title', title)
  html = replaceOrInsertMeta(html, 'property', 'og:description', description)
  html = replaceOrInsertMeta(html, 'property', 'og:url', canonicalUrl)
  html = replaceOrInsertMeta(html, 'property', 'og:image', imageUrl)
  html = replaceOrInsertMeta(html, 'property', 'og:image:url', imageUrl)
  html = replaceOrInsertMeta(html, 'property', 'og:image:secure_url', imageUrl)
  html = replaceOrInsertMeta(html, 'property', 'og:image:type', 'image/jpeg')
  html = replaceOrInsertMeta(html, 'property', 'og:image:width', '1200')
  html = replaceOrInsertMeta(html, 'property', 'og:image:height', '630')
  html = replaceOrInsertMeta(html, 'property', 'og:image:alt', title)
  html = replaceOrInsertMeta(html, 'name', 'twitter:card', 'summary_large_image')
  html = replaceOrInsertMeta(html, 'name', 'twitter:title', title)
  html = replaceOrInsertMeta(html, 'name', 'twitter:description', description)
  html = replaceOrInsertMeta(html, 'name', 'twitter:image', imageUrl)
  html = replaceOrInsertCanonical(html, canonicalUrl)

  return html
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `https://${baseDomain}`)

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' })
      res.end()
      return
    }

    const match = requestUrl.pathname.match(/^\/s\/([a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?)\/?$/i)

    if (!match) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }

    const subdomain = match[1].toLowerCase()
    const invitation = await fetchInvitationHtml(subdomain)

    // El backend principal ya aplica la regla PUBLISHED / expiración.
    if (invitation.statusCode !== 200) {
      res.writeHead(invitation.statusCode, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff'
      })

      if (req.method === 'HEAD') {
        res.end()
        return
      }

      res.end(invitation.html || 'Invitación no disponible')
      return
    }

    const html = buildShareHtml(invitation.html, requestUrl)

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    })

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    // Igual que Zendtry: se devuelve el HTML REAL completo de la aplicación,
    // únicamente con los metadatos sociales sustituidos.
    res.end(html)
  } catch (error) {
    console.error('[share-meta]', error)

    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0'
      })
      res.end('MiEventoCzC')
    } else {
      res.destroy()
    }
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[share-meta] Listening on 127.0.0.1:${port}`)
})

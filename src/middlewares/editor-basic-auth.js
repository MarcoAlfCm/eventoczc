const crypto = require('crypto')

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))

  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function requireEditorAuth(req, res, next) {
  const configuredUser = String(process.env.EDITOR_USER || '').trim()
  const configuredPass = String(process.env.EDITOR_PASS || '').trim()

  if (!configuredUser || !configuredPass) {
    return res.status(503).send(
      'El editor interno no está configurado. Define EDITOR_USER y EDITOR_PASS en .env.'
    )
  }

  const authorization = String(req.headers.authorization || '')
  const match = authorization.match(/^Basic\s+(.+)$/i)

  if (!match) {
    res.set('WWW-Authenticate', 'Basic realm="MiEventoCzC Editor", charset="UTF-8"')
    return res.status(401).send('Autenticación requerida.')
  }

  let decoded = ''
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8')
  } catch (_) {
    decoded = ''
  }

  const separator = decoded.indexOf(':')
  const receivedUser = separator >= 0 ? decoded.slice(0, separator) : ''
  const receivedPass = separator >= 0 ? decoded.slice(separator + 1) : ''

  if (
    !safeEqual(receivedUser, configuredUser) ||
    !safeEqual(receivedPass, configuredPass)
  ) {
    res.set('WWW-Authenticate', 'Basic realm="MiEventoCzC Editor", charset="UTF-8"')
    return res.status(401).send('Credenciales inválidas.')
  }

  next()
}

function requireEditorRequest(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next()

  if (req.get('X-Editor-Request') !== '1') {
    return res.status(403).json({
      ok: false,
      message: 'Solicitud de edición no válida.'
    })
  }

  next()
}

module.exports = {
  requireEditorAuth,
  requireEditorRequest
}

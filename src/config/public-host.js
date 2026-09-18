const DEFAULT_BASE_DOMAIN = 'mieventoczc.com'

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'admin',
  'api',
  'app',
  'mail',
  'smtp',
  'ftp',
  'webmail',
  'panel',
  'login',
  'soporte',
  'support',
  'preview',
  'evento',
  'eventos',
  'assets',
  'static',
  'cdn',
  'status',
  'health'
])

function normalizeHostname(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
}

function normalizeSubdomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function getBaseDomain() {
  return normalizeHostname(
    process.env.PUBLIC_BASE_DOMAIN || DEFAULT_BASE_DOMAIN
  )
}

function isValidEventSubdomain(value) {
  const subdomain = normalizeSubdomain(value)

  if (subdomain.length < 3 || subdomain.length > 40) {
    return false
  }

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(subdomain)) {
    return false
  }

  return !RESERVED_SUBDOMAINS.has(subdomain)
}

function extractEventSubdomain(hostname) {
  const host = normalizeHostname(hostname)
  const baseDomain = getBaseDomain()

  if (!host || !baseDomain) return null

  if (host === baseDomain || host === `www.${baseDomain}`) {
    return null
  }

  const suffix = `.${baseDomain}`

  if (!host.endsWith(suffix)) {
    return null
  }

  const candidate = host.slice(0, -suffix.length)

  // Por ahora sólo aceptamos un nivel:
  // misxvlaura.mieventoczc.com
  // y no algo.otro.mieventoczc.com
  if (!candidate || candidate.includes('.')) {
    return null
  }

  return isValidEventSubdomain(candidate)
    ? candidate
    : null
}

module.exports = {
  DEFAULT_BASE_DOMAIN,
  RESERVED_SUBDOMAINS,
  getBaseDomain,
  isValidEventSubdomain,
  extractEventSubdomain
}

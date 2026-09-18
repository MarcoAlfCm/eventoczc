const { pool } = require('../config/database')

function parseConfig(value) {
  if (!value) return {}
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch (error) {
    return {}
  }
}

function toDateString(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function normalizeEvent(row) {
  if (!row) return null

  return {
    ...row,
    event_date: toDateString(row.event_date),
    config: parseConfig(row.config_json)
  }
}

const EVENT_SELECT = `
  SELECT
    e.id,
    e.service_request_id,
    e.client_user_id,
    e.tier_id,
    e.template_id,
    e.slug,
    e.subdomain,
    e.event_type,
    e.title,
    e.event_date,
    e.status,
    e.config_json,
    e.published_at,
    e.expires_at,
    e.expired_at,
    e.created_at,
    e.updated_at,
    tr.name AS tier_name,
    tr.slug AS tier_slug,
    tr.publication_grace_days,
    tp.code AS template_code,
    tp.slug AS template_slug,
    tp.name AS template_name,
    sr.folio AS request_folio
  FROM events e
  INNER JOIN tiers tr ON tr.id = e.tier_id
  LEFT JOIN templates tp ON tp.id = e.template_id
  LEFT JOIN service_requests sr ON sr.id = e.service_request_id
`

function publicVisibilityWhere(includeDraft) {
  if (includeDraft) return ''

  return `
    AND e.status = 'PUBLISHED'
    AND e.expired_at IS NULL
    AND (e.expires_at IS NULL OR e.expires_at > NOW())
  `
}

async function findBySlug(slug, options = {}) {
  const includeDraft = options.includeDraft === true

  const [rows] = await pool.query(`
    ${EVENT_SELECT}
    WHERE e.slug = ?
    ${publicVisibilityWhere(includeDraft)}
    LIMIT 1
  `, [slug])

  return normalizeEvent(rows[0])
}

async function findBySubdomain(subdomain, options = {}) {
  const includeDraft = options.includeDraft === true

  const [rows] = await pool.query(`
    ${EVENT_SELECT}
    WHERE e.subdomain = ?
    ${publicVisibilityWhere(includeDraft)}
    LIMIT 1
  `, [subdomain])

  return normalizeEvent(rows[0])
}

async function updateEditorConfig(eventId, { title, eventDate, config }) {
  await pool.query(`
    UPDATE events
    SET
      title = ?,
      event_date = ?,
      config_json = ?
    WHERE id = ?
    LIMIT 1
  `, [
    title,
    eventDate || null,
    JSON.stringify(config || {}),
    eventId
  ])
}


async function findSubdomainOwner(subdomain) {
  const [rows] = await pool.query(`
    SELECT
      id,
      slug,
      subdomain,
      status
    FROM events
    WHERE subdomain = ?
    LIMIT 1
  `, [subdomain])

  return rows[0] || null
}

async function publishEvent({
  eventId,
  subdomain,
  expiresAt
}) {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [owners] = await connection.query(`
      SELECT
        id
      FROM events
      WHERE subdomain = ?
        AND id <> ?
      LIMIT 1
      FOR UPDATE
    `, [subdomain, eventId])

    if (owners.length) {
      const error = new Error('El subdominio ya está ocupado.')
      error.code = 'SUBDOMAIN_TAKEN'
      throw error
    }

    const [result] = await connection.query(`
      UPDATE events
      SET
        subdomain = ?,
        status = 'PUBLISHED',
        published_at = COALESCE(published_at, NOW()),
        expires_at = ?,
        expired_at = NULL
      WHERE id = ?
        AND status = 'DRAFT'
      LIMIT 1
    `, [
      subdomain,
      expiresAt,
      eventId
    ])

    if (result.affectedRows !== 1) {
      const error = new Error('La invitación ya no está disponible para publicar.')
      error.code = 'EVENT_NOT_DRAFT'
      throw error
    }

    await connection.commit()
    return true
  } catch (error) {
    await connection.rollback()

    if (error?.code === 'ER_DUP_ENTRY') {
      const duplicate = new Error('El subdominio ya está ocupado.')
      duplicate.code = 'SUBDOMAIN_TAKEN'
      throw duplicate
    }

    throw error
  } finally {
    connection.release()
  }
}


module.exports = {
  findBySlug,
  findBySubdomain,
  findSubdomainOwner,
  updateEditorConfig,
  publishEvent
}

const { pool } = require('../config/database')

async function findEventContextBySlug(slug, featureCode = null) {
  const params = [slug]
  let featureJoin = ''
  let featureSelect = 'NULL AS feature_enabled, NULL AS feature_limit'

  if (featureCode) {
    featureJoin = `
      LEFT JOIN features f
        ON f.code = ?
       AND f.active = 1
      LEFT JOIN tier_features tf
        ON tf.tier_id = e.tier_id
       AND tf.feature_id = f.id
    `
    featureSelect = 'COALESCE(tf.enabled, 0) AS feature_enabled, tf.limit_value AS feature_limit'
    params.unshift(featureCode)
  }

  const [rows] = await pool.query(`
    SELECT
      e.id,
      e.slug,
      e.status,
      e.tier_id,
      e.config_json,
      t.code AS tier_code,
      t.name AS tier_name,
      ${featureSelect}
    FROM events e
    INNER JOIN tiers t ON t.id = e.tier_id
    ${featureJoin}
    WHERE e.slug = ?
    LIMIT 1
  `, params)

  return rows[0] || null
}

async function listActiveByEventId(eventId) {
  const [rows] = await pool.query(`
    SELECT
      id,
      event_id,
      media_type,
      file_path,
      original_name,
      mime_type,
      file_size,
      width,
      height,
      sort_order,
      status,
      metadata_json,
      created_at,
      updated_at
    FROM event_media
    WHERE event_id = ?
      AND status = 'ACTIVE'
    ORDER BY
      CASE media_type
        WHEN 'HERO' THEN 10
        WHEN 'GALLERY' THEN 20
        WHEN 'MUSIC' THEN 30
        ELSE 99
      END,
      sort_order,
      id
  `, [eventId])

  return rows
}

async function countActiveByType(eventId, mediaType) {
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM event_media
    WHERE event_id = ?
      AND media_type = ?
      AND status = 'ACTIVE'
  `, [eventId, mediaType])

  return Number(rows[0]?.total || 0)
}

async function nextSortOrder(eventId, mediaType) {
  const [rows] = await pool.query(`
    SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order
    FROM event_media
    WHERE event_id = ?
      AND media_type = ?
      AND status = 'ACTIVE'
  `, [eventId, mediaType])

  return Number(rows[0]?.next_order || 10)
}

async function replaceSingleAndInsert(media, mediaType) {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [oldRows] = await connection.query(`
      SELECT id, file_path
      FROM event_media
      WHERE event_id = ?
        AND media_type = ?
        AND status = 'ACTIVE'
      FOR UPDATE
    `, [media.event_id, mediaType])

    await connection.query(`
      UPDATE event_media
      SET status = 'REPLACED'
      WHERE event_id = ?
        AND media_type = ?
        AND status = 'ACTIVE'
    `, [media.event_id, mediaType])

    const [result] = await connection.query(`
      INSERT INTO event_media (
        event_id,
        media_type,
        file_path,
        original_name,
        mime_type,
        file_size,
        width,
        height,
        sort_order,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [
      media.event_id,
      mediaType,
      media.file_path,
      media.original_name,
      media.mime_type,
      media.file_size,
      media.width || null,
      media.height || null,
      media.metadata_json ? JSON.stringify(media.metadata_json) : null
    ])

    if (mediaType === 'MUSIC') {
      await connection.query(`
        UPDATE events
        SET config_json = JSON_SET(
          COALESCE(config_json, JSON_OBJECT()),
          '$.music.enabled',
          TRUE
        )
        WHERE id = ?
      `, [media.event_id])
    }

    await connection.commit()

    return {
      id: result.insertId,
      replaced: oldRows
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function replaceHeroAndInsert(media) {
  return replaceSingleAndInsert(media, 'HERO')
}

async function replaceMusicAndInsert(media) {
  return replaceSingleAndInsert(media, 'MUSIC')
}

async function insertGallery(media) {
  const [result] = await pool.query(`
    INSERT INTO event_media (
      event_id,
      media_type,
      file_path,
      original_name,
      mime_type,
      file_size,
      width,
      height,
      sort_order,
      metadata_json
    ) VALUES (?, 'GALLERY', ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    media.event_id,
    media.file_path,
    media.original_name,
    media.mime_type,
    media.file_size,
    media.width,
    media.height,
    media.sort_order,
    media.metadata_json ? JSON.stringify(media.metadata_json) : null
  ])

  await pool.query(`
    UPDATE events
    SET config_json = JSON_SET(
      COALESCE(config_json, JSON_OBJECT()),
      '$.gallery.enabled',
      TRUE
    )
    WHERE id = ?
  `, [media.event_id])

  return result.insertId
}

async function findById(id) {
  const [rows] = await pool.query(`
    SELECT *
    FROM event_media
    WHERE id = ?
    LIMIT 1
  `, [id])

  return rows[0] || null
}

async function markDeleted(id) {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [rows] = await connection.query(`
      SELECT *
      FROM event_media
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `, [id])

    const media = rows[0]
    if (!media) {
      await connection.rollback()
      return null
    }

    await connection.query(`
      UPDATE event_media
      SET status = 'DELETED'
      WHERE id = ?
    `, [id])

    if (media.media_type === 'MUSIC') {
      const [countRows] = await connection.query(`
        SELECT COUNT(*) AS total
        FROM event_media
        WHERE event_id = ?
          AND media_type = 'MUSIC'
          AND status = 'ACTIVE'
      `, [media.event_id])

      if (Number(countRows[0]?.total || 0) === 0) {
        await connection.query(`
          UPDATE events
          SET config_json = JSON_SET(
            COALESCE(config_json, JSON_OBJECT()),
            '$.music.enabled',
            FALSE
          )
          WHERE id = ?
        `, [media.event_id])
      }
    }

    await connection.commit()
    return media
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

module.exports = {
  findEventContextBySlug,
  listActiveByEventId,
  countActiveByType,
  nextSortOrder,
  replaceHeroAndInsert,
  replaceMusicAndInsert,
  insertGallery,
  findById,
  markDeleted
}

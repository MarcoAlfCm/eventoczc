const { pool } = require('../config/database')

async function create(data) {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.query(`
      INSERT INTO service_requests (
        name,
        email,
        phone,
        event_type,
        celebrant_name,
        desired_date,
        tier_id,
        template_id,
        notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW')
    `, [
      data.name,
      data.email || null,
      data.phone,
      data.eventType,
      data.celebrantName || null,
      data.desiredDate,
      data.tierId,
      data.templateId || null,
      data.notes || null
    ])

    const folio = `ME-${String(result.insertId).padStart(6, '0')}`

    await connection.query(`
      UPDATE service_requests
      SET folio = ?
      WHERE id = ?
    `, [folio, result.insertId])

    await connection.commit()

    return {
      id: result.insertId,
      folio
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function findByFolio(folio) {
  const [rows] = await pool.query(`
    SELECT
      sr.id,
      sr.folio,
      sr.name,
      sr.email,
      sr.phone,
      sr.event_type,
      sr.celebrant_name,
      sr.desired_date,
      sr.notes,
      sr.status,
      sr.created_at,
      t.name AS tier_name,
      t.price_cents AS tier_price_cents,
      t.currency AS tier_currency,
      tp.name AS template_name
    FROM service_requests sr
    LEFT JOIN tiers t ON t.id = sr.tier_id
    LEFT JOIN templates tp ON tp.id = sr.template_id
    WHERE sr.folio = ?
    LIMIT 1
  `, [folio])

  return rows[0] || null
}

module.exports = {
  create,
  findByFolio
}

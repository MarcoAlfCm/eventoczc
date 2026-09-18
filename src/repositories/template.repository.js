const { pool } = require('../config/database')

async function findPublished() {
  const [rows] = await pool.query(`
    SELECT
      t.id,
      t.code,
      t.slug,
      t.name,
      t.description,
      t.event_type,
      t.preview_image,
      t.sort_order,
      GROUP_CONCAT(DISTINCT tr.id ORDER BY tr.sort_order SEPARATOR ',') AS tier_ids,
      GROUP_CONCAT(DISTINCT tr.slug ORDER BY tr.sort_order SEPARATOR ',') AS tier_slugs,
      GROUP_CONCAT(DISTINCT tr.name ORDER BY tr.sort_order SEPARATOR ', ') AS tier_names
    FROM templates t
    LEFT JOIN template_tiers tt ON tt.template_id = t.id
    LEFT JOIN tiers tr ON tr.id = tt.tier_id AND tr.active = 1
    WHERE t.status = 'PUBLISHED'
    GROUP BY
      t.id,
      t.code,
      t.slug,
      t.name,
      t.description,
      t.event_type,
      t.preview_image,
      t.sort_order
    ORDER BY t.sort_order, t.id
  `)

  return rows.map((row) => ({
    ...row,
    tierIds: row.tier_ids
      ? row.tier_ids.split(',').map((value) => Number(value))
      : [],
    tiers: row.tier_names ? row.tier_names.split(', ') : []
  }))
}

module.exports = {
  findPublished
}

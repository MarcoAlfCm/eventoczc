const { pool } = require('../config/database')

async function findActiveWithFeatures() {
  const [tiers] = await pool.query(`
    SELECT
      id,
      code,
      slug,
      name,
      short_description,
      description,
      price_cents,
      currency,
      correction_rounds,
      highlighted,
      sort_order
    FROM tiers
    WHERE active = 1
    ORDER BY sort_order, id
  `)

  if (tiers.length === 0) {
    return []
  }

  const tierIds = tiers.map((tier) => tier.id)

  const [features] = await pool.query(`
    SELECT
      tf.tier_id,
      f.id,
      f.code,
      f.name,
      f.description,
      f.category,
      f.sort_order,
      tf.limit_value,
      tf.config_json
    FROM tier_features tf
    INNER JOIN features f ON f.id = tf.feature_id
    WHERE tf.enabled = 1
      AND f.active = 1
      AND tf.tier_id IN (?)
    ORDER BY tf.tier_id, f.sort_order, f.id
  `, [tierIds])

  const grouped = new Map()

  for (const feature of features) {
    if (!grouped.has(feature.tier_id)) {
      grouped.set(feature.tier_id, [])
    }

    grouped.get(feature.tier_id).push(feature)
  }

  return tiers.map((tier) => ({
    ...tier,
    features: grouped.get(tier.id) || []
  }))
}

async function findBySlug(slug) {
  const [rows] = await pool.query(`
    SELECT
      id,
      code,
      slug,
      name,
      short_description,
      description,
      price_cents,
      currency,
      correction_rounds,
      highlighted,
      sort_order
    FROM tiers
    WHERE slug = ?
      AND active = 1
    LIMIT 1
  `, [slug])

  return rows[0] || null
}

module.exports = {
  findActiveWithFeatures,
  findBySlug
}

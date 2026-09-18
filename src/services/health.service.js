const { checkDatabase } = require('../config/database')
const { checkRedis } = require('../config/redis')

async function getHealthStatus() {
  const status = {
    database: false,
    redis: false
  }

  try {
    status.database = await checkDatabase()
  } catch (error) {
    status.database = false
  }

  try {
    status.redis = await checkRedis()
  } catch (error) {
    status.redis = false
  }

  return {
    ok: status.database && status.redis,
    application: 'MiEventoCzC',
    services: status,
    timestamp: new Date().toISOString()
  }
}

module.exports = {
  getHealthStatus
}

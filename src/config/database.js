const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'mieventoczc',
  user: process.env.DB_USER || 'mieventoczc_app',
  password: process.env.DB_PASS ,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
  maxIdle: Number(process.env.DB_POOL_LIMIT || 10),
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4'
})

async function checkDatabase() {
  const connection = await pool.getConnection()

  try {
    await connection.query('SELECT 1')
    return true
  } finally {
    connection.release()
  }
}

module.exports = {
  pool,
  checkDatabase
}

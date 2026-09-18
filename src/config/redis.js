const { createClient } = require('redis')

async function checkRedis() {
  const client = createClient({
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      connectTimeout: 1500,
      reconnectStrategy: false
    }
  })

  client.on('error', () => {})

  try {
    await client.connect()
    const response = await client.ping()
    return response === 'PONG'
  } finally {
    if (client.isOpen) {
      await client.quit()
    }
  }
}

module.exports = {
  checkRedis
}

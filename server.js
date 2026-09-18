require('dotenv').config()

const app = require('./src/app')

const host = process.env.APP_HOST || '127.0.0.1'
const port = Number(process.env.APP_PORT || 3110)

app.listen(port, host, () => {
  console.log(`
╔══════════════════════════════════════╗
║          MiEventoCzC iniciado        ║
╠══════════════════════════════════════╣
║ Host: ${host}
║ Port: ${port}
║ Env : ${process.env.APP_ENV || 'development'}
╚══════════════════════════════════════╝
  `)
})
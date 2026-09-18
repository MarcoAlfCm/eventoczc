const express = require('express')
const path = require('path')
const helmet = require('helmet')
const compression = require('compression')
const expressLayouts = require('express-ejs-layouts')

const storage = require('./config/storage')
const webRoutes = require('./routes/web.routes')

const app = express()

// ------------------------------------------------------
// Vistas
// ------------------------------------------------------

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(expressLayouts)
app.set('layout', 'layouts/main')

// ------------------------------------------------------
// Share metadata / branding
// ------------------------------------------------------

// Igual que Zendtry: el recurso social global es un archivo real y estable.
// Se sirve ANTES de Helmet para mantener una respuesta simple de archivo.
app.use(
  '/branding',
  express.static(path.join(storage.uploadsRoot, 'share'), {
    fallthrough: true,
    maxAge: '1d'
  })
)

// ------------------------------------------------------
// Seguridad / optimización
// ------------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: false
  })
)

app.use(compression())

// ------------------------------------------------------
// Request parsing
// ------------------------------------------------------

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ------------------------------------------------------
// Archivos estáticos
// ------------------------------------------------------

app.use(
  '/assets',
  express.static(path.join(__dirname, 'public/assets'))
)

// Multimedia persistente fuera del código de la aplicación.
// Si existe contenido legado en src/public/uploads, se conserva como fallback.
app.use(
  '/uploads',
  express.static(storage.uploadsRoot, {
    fallthrough: true,
    maxAge: process.env.APP_ENV === 'production' ? '7d' : 0
  })
)

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'public/uploads'))
)

// ------------------------------------------------------
// Rutas
// ------------------------------------------------------

app.use('/', webRoutes)

// ------------------------------------------------------
// 404
// ------------------------------------------------------

app.use((req, res) => {
  res.status(404).render('pages/404', {
    pageTitle: 'Página no encontrada | MiEventoCzC',
    bodyClass: 'page-error',
    navActive: ''
  })
})

// ------------------------------------------------------
// Error handler
// ------------------------------------------------------

app.use((error, req, res, next) => {
  console.error('[MiEventoCzC]', error)

  if (res.headersSent) {
    return next(error)
  }

  res.status(500).render('pages/500', {
    pageTitle: 'Error interno | MiEventoCzC',
    bodyClass: 'page-error',
    navActive: '',
    showDetails: process.env.APP_ENV === 'development',
    errorMessage: error.message
  })
})

module.exports = app

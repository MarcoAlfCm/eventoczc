const express = require('express')
const shareController = require('../controllers/share.controller')

const router = express.Router()

// Pipeline dedicado de enlace compartido.
// Se monta ANTES de Helmet/compresión en app.js, igualando el concepto
// de zendtry-share-meta para que el HTML inicial llegue limpio al crawler.
router.head('/s/:subdomain', shareController.shareInvitation)
router.get('/s/:subdomain', shareController.shareInvitation)

module.exports = router

const express = require('express')
const publicController = require('../controllers/public.controller')
const eventController = require('../controllers/event.controller')
const eventEditorController = require('../controllers/event-editor.controller')
const {
  requireEditorAuth,
  requireEditorRequest
} = require('../middlewares/editor-basic-auth')

const router = express.Router()

router.get('/health', publicController.health)

router.head('/social-preview.jpg', eventController.publicSubdomainSocialPreview)
router.get('/social-preview.jpg', eventController.publicSubdomainSocialPreview)
router.head('/', eventController.publicSubdomainEvent, publicController.home)
router.get('/', eventController.publicSubdomainEvent, publicController.home)
router.get('/catalogo', publicController.catalog)
router.get('/planes', publicController.plans)

router.get('/solicitud', publicController.requestForm)
router.post('/solicitud', publicController.submitRequest)
router.get('/solicitud/:folio/confirmada', publicController.requestConfirmation)

router.get('/evento/:slug/preview', eventController.previewEvent)
router.head('/evento/:slug/social-preview.jpg', eventController.publicSlugSocialPreview)
router.get('/evento/:slug/social-preview.jpg', eventController.publicSlugSocialPreview)
router.head('/evento/:slug', eventController.publicEvent)
router.get('/evento/:slug', eventController.publicEvent)

// Editor interno temporal. Más adelante estas rutas se moverán al dashboard
// autenticado del cliente/admin sin cambiar el contrato de edición.
router.get(
  '/mi-evento/:slug/editar',
  requireEditorAuth,
  eventEditorController.editor
)

router.post(
  '/mi-evento/:slug/editar/contenido',
  requireEditorAuth,
  requireEditorRequest,
  eventEditorController.saveContent
)

router.post(
  '/mi-evento/:slug/editar/media/hero',
  requireEditorAuth,
  requireEditorRequest,
  eventEditorController.upload.single('file'),
  eventEditorController.uploadHero
)

router.post(
  '/mi-evento/:slug/editar/media/gallery',
  requireEditorAuth,
  requireEditorRequest,
  eventEditorController.upload.single('file'),
  eventEditorController.uploadGallery
)

router.post(
  '/mi-evento/:slug/editar/media/:id/eliminar',
  requireEditorAuth,
  requireEditorRequest,
  eventEditorController.removeMedia
)

// Paso final del flujo: editar -> siguiente -> publicar.
router.get(
  '/mi-evento/:slug/publicar',
  requireEditorAuth,
  eventEditorController.publishPage
)

router.get(
  '/mi-evento/:slug/publicar/disponibilidad',
  requireEditorAuth,
  eventEditorController.checkSubdomain
)

router.head(
  '/mi-evento/:slug/publicar/social-preview.jpg',
  requireEditorAuth,
  eventEditorController.publicationSocialPreview
)

router.get(
  '/mi-evento/:slug/publicar/social-preview.jpg',
  requireEditorAuth,
  eventEditorController.publicationSocialPreview
)

router.post(
  '/mi-evento/:slug/publicar',
  requireEditorAuth,
  requireEditorRequest,
  eventEditorController.publish
)

module.exports = router

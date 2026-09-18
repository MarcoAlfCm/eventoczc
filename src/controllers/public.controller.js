const tierRepository = require('../repositories/tier.repository')
const templateRepository = require('../repositories/template.repository')
const requestRepository = require('../repositories/request.repository')
const { getHealthStatus } = require('../services/health.service')

async function health(req, res) {
  const healthStatus = await getHealthStatus()
  res.status(healthStatus.ok ? 200 : 503).json(healthStatus)
}

async function home(req, res, next) {
  try {
    const [tiers, templates] = await Promise.all([
      tierRepository.findActiveWithFeatures(),
      templateRepository.findPublished()
    ])

    res.render('pages/home', {
      pageTitle: 'MiEventoCzC | Invitaciones digitales para momentos únicos',
      bodyClass: 'page-home',
      navActive: 'inicio',
      tiers,
      templates: templates.slice(0, 3)
    })
  } catch (error) {
    next(error)
  }
}

async function catalog(req, res, next) {
  try {
    const templates = await templateRepository.findPublished()

    res.render('pages/catalogo', {
      pageTitle: 'Diseños | MiEventoCzC',
      bodyClass: 'page-catalogo',
      navActive: 'catalogo',
      templates
    })
  } catch (error) {
    next(error)
  }
}

async function plans(req, res, next) {
  try {
    const tiers = await tierRepository.findActiveWithFeatures()

    res.render('pages/planes', {
      pageTitle: 'Planes | MiEventoCzC',
      bodyClass: 'page-planes',
      navActive: 'planes',
      tiers
    })
  } catch (error) {
    next(error)
  }
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidEmail(value) {
  if (!value) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const selected = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(selected.getTime())) return false

  const today = new Date()
  const todayUtc = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ))

  return selected >= todayUtc
}

function normalizeRequestBody(body) {
  return {
    event_type: clean(body.event_type) || 'XV',
    desired_date: clean(body.desired_date),
    tier_id: clean(body.tier_id),
    template_id: clean(body.template_id),
    name: clean(body.name),
    celebrant_name: clean(body.celebrant_name),
    phone: clean(body.phone),
    email: clean(body.email),
    notes: clean(body.notes),
    terms: body.terms === '1'
  }
}

function validateRequest(formData, tiers, templates) {
  const errors = {}
  const tierId = Number(formData.tier_id)
  const templateId = formData.template_id ? Number(formData.template_id) : null
  const selectedTier = tiers.find((tier) => Number(tier.id) === tierId)
  const selectedTemplate = templateId
    ? templates.find((template) => Number(template.id) === templateId)
    : null

  if (!['XV', 'BODA', 'CUMPLE', 'OTRO'].includes(formData.event_type)) {
    errors.event_type = 'Selecciona un tipo de evento válido.'
  }

  if (!isValidDate(formData.desired_date)) {
    errors.desired_date = 'Selecciona una fecha válida que no haya pasado.'
  }

  if (!selectedTier) {
    errors.tier_id = 'Selecciona uno de los planes disponibles.'
  }

  if (templateId && !selectedTemplate) {
    errors.template_id = 'El diseño seleccionado ya no está disponible.'
  }

  if (selectedTemplate && selectedTemplate.tierIds.length > 0 && !selectedTemplate.tierIds.includes(tierId)) {
    errors.template_id = 'Ese diseño no está disponible para el plan seleccionado.'
  }

  if (formData.name.length < 2) {
    errors.name = 'Escribe el nombre de la persona de contacto.'
  }

  if (formData.celebrant_name.length < 2) {
    errors.celebrant_name = 'Escribe el nombre de la festejada o festejado.'
  }

  const phoneDigits = formData.phone.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.phone = 'Escribe un número de WhatsApp válido.'
  }

  if (!isValidEmail(formData.email)) {
    errors.email = 'Escribe un correo válido o déjalo vacío.'
  }

  if (!formData.terms) {
    errors.terms = 'Debes aceptar el uso de tus datos para atender la solicitud.'
  }

  return {
    errors,
    selectedTier,
    selectedTemplate
  }
}

async function requestForm(req, res, next) {
  try {
    const [tiers, templates] = await Promise.all([
      tierRepository.findActiveWithFeatures(),
      templateRepository.findPublished()
    ])

    const requestedTier = clean(req.query.plan)
    const requestedTemplate = clean(req.query.diseno)

    const tierFromQuery = requestedTier
      ? tiers.find((tier) => tier.slug === requestedTier)
      : null

    const templateFromQuery = requestedTemplate
      ? templates.find((template) => template.slug === requestedTemplate)
      : null

    res.render('pages/solicitud', {
      pageTitle: 'Crear mi invitación | MiEventoCzC',
      bodyClass: 'page-request',
      navActive: '',
      tiers,
      templates,
      errors: {},
      formData: {
        event_type: 'XV',
        desired_date: '',
        tier_id: tierFromQuery ? String(tierFromQuery.id) : '',
        template_id: templateFromQuery ? String(templateFromQuery.id) : '',
        name: '',
        celebrant_name: '',
        phone: '',
        email: '',
        notes: '',
        terms: false
      },
      minDate: new Date().toISOString().slice(0, 10)
    })
  } catch (error) {
    next(error)
  }
}

async function submitRequest(req, res, next) {
  try {
    const [tiers, templates] = await Promise.all([
      tierRepository.findActiveWithFeatures(),
      templateRepository.findPublished()
    ])

    const formData = normalizeRequestBody(req.body)
    const validation = validateRequest(formData, tiers, templates)

    if (Object.keys(validation.errors).length > 0) {
      return res.status(422).render('pages/solicitud', {
        pageTitle: 'Crear mi invitación | MiEventoCzC',
        bodyClass: 'page-request',
        navActive: '',
        tiers,
        templates,
        errors: validation.errors,
        formData,
        minDate: new Date().toISOString().slice(0, 10)
      })
    }

    const created = await requestRepository.create({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      eventType: formData.event_type,
      celebrantName: formData.celebrant_name,
      desiredDate: formData.desired_date,
      tierId: Number(formData.tier_id),
      templateId: formData.template_id ? Number(formData.template_id) : null,
      notes: formData.notes
    })

    return res.redirect(`/solicitud/${encodeURIComponent(created.folio)}/confirmada`)
  } catch (error) {
    next(error)
  }
}

async function requestConfirmation(req, res, next) {
  try {
    const request = await requestRepository.findByFolio(req.params.folio)

    if (!request) {
      return res.status(404).render('pages/404', {
        pageTitle: 'Solicitud no encontrada | MiEventoCzC',
        bodyClass: 'page-error',
        navActive: ''
      })
    }

    res.render('pages/solicitud-confirmada', {
      pageTitle: `${request.folio} | MiEventoCzC`,
      bodyClass: 'page-request-confirmed',
      navActive: '',
      request
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  health,
  home,
  catalog,
  plans,
  requestForm,
  submitRequest,
  requestConfirmation
}

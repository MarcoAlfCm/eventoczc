(() => {
  const header = document.querySelector('[data-site-header]')
  const navToggle = document.querySelector('[data-nav-toggle]')
  const navigation = document.querySelector('[data-main-nav]')

  const syncHeader = () => {
    if (!header) return
    header.classList.toggle('is-scrolled', window.scrollY > 12)
  }

  syncHeader()
  window.addEventListener('scroll', syncHeader, { passive: true })

  if (navToggle && navigation) {
    navToggle.addEventListener('click', () => {
      const open = navigation.classList.toggle('is-open')
      navToggle.classList.toggle('is-open', open)
      navToggle.setAttribute('aria-expanded', String(open))
    })

    navigation.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navigation.classList.remove('is-open')
        navToggle.classList.remove('is-open')
        navToggle.setAttribute('aria-expanded', 'false')
      })
    })
  }

  const revealItems = document.querySelectorAll('.reveal')
  if (!revealItems.length) return

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealItems.forEach((item) => item.classList.add('is-visible'))
    return
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    })
  }, { threshold: 0.12 })

  revealItems.forEach((item) => observer.observe(item))
})();

(() => {
  const form = document.querySelector('[data-request-form]')
  if (!form) return

  const steps = [...form.querySelectorAll('[data-request-step]')]
  const progressSteps = [...document.querySelectorAll('[data-request-progress-step]')]
  const progressLine = document.querySelector('[data-request-progress-line]')
  const backButton = form.querySelector('[data-request-back]')
  const nextButton = form.querySelector('[data-request-next]')
  const submitButton = form.querySelector('[data-request-submit]')

  let currentStep = 0

  const eventNames = {
    XV: 'Mis XV años',
    BODA: 'Boda',
    CUMPLE: 'Cumpleaños',
    OTRO: 'Otro evento'
  }

  const syncChoiceClasses = () => {
    form.querySelectorAll('.request-choice, .request-tier, .request-template').forEach((label) => {
      const input = label.querySelector('input[type="radio"]')
      label.classList.toggle('is-selected', Boolean(input && input.checked))
    })
  }

  const syncTemplateAvailability = () => {
    const selectedTier = form.querySelector('input[name="tier_id"]:checked')
    if (!selectedTier) return

    const tierId = Number(selectedTier.value)

    form.querySelectorAll('.request-template[data-template-tier-ids]').forEach((card) => {
      const ids = (card.dataset.templateTierIds || '')
        .split(',')
        .filter(Boolean)
        .map(Number)

      const available = ids.length === 0 || ids.includes(tierId)
      card.hidden = !available

      if (!available) {
        const input = card.querySelector('input')
        if (input && input.checked) {
          const later = form.querySelector('input[name="template_id"][value=""]')
          if (later) later.checked = true
        }
      }
    })

    syncChoiceClasses()
  }

  const updateSummary = () => {
    const event = form.querySelector('input[name="event_type"]:checked')
    const date = form.querySelector('[name="desired_date"]')
    const tier = form.querySelector('input[name="tier_id"]:checked')
    const template = form.querySelector('input[name="template_id"]:checked')
    const celebrant = form.querySelector('[name="celebrant_name"]')
    const contact = form.querySelector('[name="name"]')

    const set = (selector, value) => {
      const target = form.querySelector(selector)
      if (target) target.textContent = value || '—'
    }

    set('[data-summary-event]', event ? eventNames[event.value] : '—')

    if (date && date.value) {
      const parsed = new Date(`${date.value}T00:00:00`)
      set('[data-summary-date]', parsed.toLocaleDateString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric'
      }))
    } else {
      set('[data-summary-date]', '—')
    }

    set('[data-summary-tier]', tier
      ? `${tier.dataset.tierName} · $${tier.dataset.tierPrice}`
      : '—')
    set('[data-summary-template]', template ? template.dataset.templateName : 'Aún no lo sé')
    set('[data-summary-celebrant]', celebrant ? celebrant.value.trim() : '—')
    set('[data-summary-contact]', contact ? contact.value.trim() : '—')
  }

  const validateStep = (index) => {
    const step = steps[index]
    const required = [...step.querySelectorAll('[required]')]

    for (const field of required) {
      if (!field.checkValidity()) {
        field.reportValidity()
        return false
      }
    }

    if (index === 0) {
      const event = step.querySelector('input[name="event_type"]:checked')
      if (!event) return false
    }

    if (index === 1) {
      const tier = step.querySelector('input[name="tier_id"]:checked')
      if (!tier) return false
    }

    return true
  }

  const renderStep = () => {
    steps.forEach((step, index) => {
      step.classList.toggle('is-active', index === currentStep)
    })

    progressSteps.forEach((step, index) => {
      step.classList.toggle('is-active', index === currentStep)
      step.classList.toggle('is-complete', index < currentStep)
    })

    if (progressLine) {
      progressLine.style.height = `${(currentStep / Math.max(steps.length - 1, 1)) * 100}%`
    }

    backButton.hidden = currentStep === 0
    nextButton.hidden = currentStep === steps.length - 1
    submitButton.hidden = currentStep !== steps.length - 1

    if (currentStep === steps.length - 1) updateSummary()

    const cardTop = form.getBoundingClientRect().top + window.scrollY - 96
    if (window.scrollY > cardTop + 120) {
      window.scrollTo({ top: cardTop, behavior: 'smooth' })
    }
  }

  form.addEventListener('change', (event) => {
    if (event.target.matches('input[type="radio"]')) {
      syncChoiceClasses()
    }

    if (event.target.matches('input[name="tier_id"]')) {
      syncTemplateAvailability()
    }

    updateSummary()
  })

  form.addEventListener('input', updateSummary)

  nextButton.addEventListener('click', () => {
    if (!validateStep(currentStep)) return
    currentStep = Math.min(currentStep + 1, steps.length - 1)
    renderStep()
  })

  backButton.addEventListener('click', () => {
    currentStep = Math.max(currentStep - 1, 0)
    renderStep()
  })

  const firstError = form.querySelector('.field-error')
  if (firstError) {
    const errorStep = firstError.closest('[data-request-step]')
    const errorIndex = errorStep ? steps.indexOf(errorStep) : -1
    if (errorIndex >= 0) currentStep = errorIndex
  }

  syncChoiceClasses()
  syncTemplateAvailability()
  updateSummary()
  renderStep()
})();

(() => {
  const root = document.querySelector('[data-publish-root]')
  if (!root) return

  const input = root.querySelector('[data-subdomain]')
  const status = root.querySelector('[data-domain-status]')
  const publishButton = root.querySelector('[data-publish-button]')
  const message = root.querySelector('[data-publish-message]')

  const checkUrl = root.dataset.checkUrl
  const publishUrl = root.dataset.publishUrl
  const isPublished = root.dataset.status === 'PUBLISHED'

  let timer = null
  let requestId = 0
  let available = false

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
  }

  function setDomainState(type, text) {
    if (!status) return

    status.classList.remove('is-good', 'is-bad')
    if (type) status.classList.add(type)
    status.textContent = text
  }

  async function checkAvailability() {
    if (!input || !checkUrl || isPublished) return

    const normalized = normalize(input.value)
    if (input.value !== normalized) input.value = normalized

    available = false
    if (publishButton) publishButton.disabled = true

    if (normalized.length < 3) {
      setDomainState('', 'Escribe al menos 3 caracteres.')
      return
    }

    const ownRequest = ++requestId
    setDomainState('', 'Comprobando disponibilidad…')

    try {
      const url = new URL(checkUrl, window.location.origin)
      url.searchParams.set('subdomain', normalized)

      const response = await fetch(url, {
        headers: { Accept: 'application/json' }
      })

      const result = await response.json().catch(() => ({}))
      if (ownRequest !== requestId) return

      available = response.ok && result.available === true

      setDomainState(
        available ? 'is-good' : 'is-bad',
        result.message || (available
          ? 'Este enlace está disponible.'
          : 'Este enlace no está disponible.')
      )

      if (publishButton) publishButton.disabled = !available
    } catch (error) {
      console.error(error)
      setDomainState('is-bad', 'No se pudo comprobar el enlace.')
    }
  }

  input?.addEventListener('input', () => {
    window.clearTimeout(timer)
    available = false
    if (publishButton) publishButton.disabled = true
    timer = window.setTimeout(checkAvailability, 350)
  })

  input?.addEventListener('blur', () => {
    window.clearTimeout(timer)
    checkAvailability()
  })

  publishButton?.addEventListener('click', async () => {
    if (!available || !input || !publishUrl) return

    publishButton.disabled = true
    publishButton.textContent = 'Publicando…'
    if (message) message.textContent = ''

    try {
      const response = await fetch(publishUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Editor-Request': '1'
        },
        body: JSON.stringify({
          subdomain: normalize(input.value)
        })
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok || result.ok !== true) {
        throw new Error(result.message || 'No se pudo publicar la invitación.')
      }

      window.location.reload()
    } catch (error) {
      console.error(error)
      if (message) message.textContent = error.message || 'Error al publicar.'
      publishButton.disabled = false
      publishButton.textContent = 'Publicar invitación'
      checkAvailability()
    }
  })

  root.querySelectorAll('[data-copy-url]').forEach((button) => {
    button.addEventListener('click', async () => {
      const url = button.dataset.copyUrl
      if (!url) return

      try {
        await navigator.clipboard.writeText(url)
        const original = button.textContent
        button.textContent = 'Copiado ✓'
        window.setTimeout(() => {
          button.textContent = original
        }, 1500)
      } catch (_) {
        window.prompt('Copia este enlace:', url)
      }
    })
  })

  if (input && !isPublished && input.value.trim()) {
    checkAvailability()
  }
})()

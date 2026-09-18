(() => {
  const root = document.querySelector('[data-editor-root]')
  if (!root) return

  const form = root.querySelector('[data-editor-form]')
  const previewFrame = root.querySelector('[data-preview-frame]')
  const saveState = root.querySelector('[data-save-state]')
  const saveNow = root.querySelector('[data-save-now]')
  const publishNext = root.querySelector('[data-publish-next]')
  const colorCount = root.querySelector('[data-color-count]')
  const colorFields = [...root.querySelectorAll('[data-color-index]')]
  const colorInputs = [...root.querySelectorAll('[data-color-value]')]
  const slug = root.dataset.slug
  const saveUrl = root.dataset.saveUrl

  let saveTimer = null
  let saving = false
  let dirtyAfterSave = false
  let lastSavedPayload = ''

  function setState(type, label) {
    saveState?.classList.remove('is-saving', 'is-saved', 'has-error')
    if (type) saveState?.classList.add(type)
    const text = saveState?.querySelector('strong')
    if (text) text.textContent = label
  }

  function getValue(path) {
    return form?.querySelector(`[data-field="${path}"]`)?.value ?? ''
  }

  function getPayload() {
    const count = Math.min(3, Math.max(1, Number(getValue('theme.colorCount') || 3)))
    const colors = colorInputs
      .slice(0, count)
      .map((input) => input.value)

    return {
      eventDate: getValue('eventDate'),
      hero: {
        name: getValue('hero.name'),
        eyebrow: getValue('hero.eyebrow'),
        phrase: getValue('hero.phrase')
      },
      family: {
        parents: getValue('family.parents'),
        godparents: getValue('family.godparents')
      },
      ceremony: {
        name: getValue('ceremony.name'),
        time: getValue('ceremony.time'),
        address: getValue('ceremony.address'),
        mapsUrl: getValue('ceremony.mapsUrl')
      },
      reception: {
        name: getValue('reception.name'),
        time: getValue('reception.time'),
        address: getValue('reception.address'),
        mapsUrl: getValue('reception.mapsUrl')
      },
      dressCode: {
        title: getValue('dressCode.title'),
        description: getValue('dressCode.description')
      },
      rsvp: {
        phone: getValue('rsvp.phone')
      },
      theme: {
        colorCount: count,
        colors,
        heroFont: getValue('theme.heroFont'),
        fontPreset: getValue('theme.fontPreset')
      }
    }
  }

  function refreshPreview() {
    if (!previewFrame) return
    const url = new URL(previewFrame.src, window.location.origin)
    url.searchParams.set('_editor', Date.now().toString())
    previewFrame.src = url.toString()
  }

  async function save() {
    if (saving) {
      dirtyAfterSave = true
      return
    }

    const payload = getPayload()
    const serialized = JSON.stringify(payload)

    if (serialized === lastSavedPayload) {
      setState('is-saved', 'Guardado')
      return true
    }

    saving = true
    dirtyAfterSave = false
    setState('is-saving', 'Guardando…')

    try {
      const response = await fetch(saveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Editor-Request': '1'
        },
        body: serialized
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok !== true) {
        throw new Error(result.message || 'No se pudieron guardar los cambios.')
      }

      lastSavedPayload = serialized
      setState('is-saved', 'Guardado')
      refreshPreview()
      return true
    } catch (error) {
      console.error(error)
      setState('has-error', 'Error al guardar')
      return false
    } finally {
      saving = false
      if (dirtyAfterSave) save()
    }
  }

  function queueSave(delay = 700) {
    setState('', 'Cambios pendientes')
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(save, delay)
  }

  function syncColorUi() {
    const count = Math.min(3, Math.max(1, Number(colorCount?.value || 3)))
    const labels = count === 1
      ? ['Principal']
      : count === 2
        ? ['Principal', 'Acento']
        : ['Base', 'Principal', 'Acento']

    colorFields.forEach((field, index) => {
      field.hidden = index >= count
      const label = field.querySelector('[data-color-label]')
      if (label && labels[index]) label.textContent = labels[index]
    })
  }

  form?.addEventListener('input', (event) => {
    if (event.target.matches('[data-color-value]')) {
      const code = event.target.closest('.editor-color')?.querySelector('[data-color-code]')
      if (code) code.textContent = event.target.value
    }

    queueSave()
  })

  form?.addEventListener('change', (event) => {
    if (event.target.matches('[data-color-count]')) syncColorUi()
    queueSave(280)
  })

  saveNow?.addEventListener('click', () => {
    window.clearTimeout(saveTimer)
    save()
  })

  async function uploadMedia(input) {
    const file = input.files?.[0]
    if (!file) return

    const type = input.dataset.mediaUpload
    const endpoint = `/mi-evento/${encodeURIComponent(slug)}/editar/media/${type}`
    const formData = new FormData()
    formData.append('file', file)

    root.classList.add('editor-is-busy')
    setState('is-saving', 'Subiendo archivo…')

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Editor-Request': '1'
        },
        body: formData
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok !== true) {
        throw new Error(result.message || 'No se pudo subir el archivo.')
      }

      window.location.reload()
    } catch (error) {
      console.error(error)
      setState('has-error', error.message || 'Error al subir')
      input.value = ''
    } finally {
      root.classList.remove('editor-is-busy')
    }
  }

  root.querySelectorAll('[data-media-upload]').forEach((input) => {
    input.addEventListener('change', () => uploadMedia(input))
  })

  root.querySelectorAll('[data-media-remove]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.mediaRemove
      if (!id) return
      if (!window.confirm('¿Quitar esta fotografía?')) return

      root.classList.add('editor-is-busy')
      setState('is-saving', 'Quitando fotografía…')

      try {
        const response = await fetch(
          `/mi-evento/${encodeURIComponent(slug)}/editar/media/${encodeURIComponent(id)}/eliminar`,
          {
            method: 'POST',
            headers: {
              'X-Editor-Request': '1'
            }
          }
        )

        const result = await response.json().catch(() => ({}))
        if (!response.ok || result.ok !== true) {
          throw new Error(result.message || 'No se pudo quitar la fotografía.')
        }

        window.location.reload()
      } catch (error) {
        console.error(error)
        setState('has-error', error.message || 'Error al eliminar')
        root.classList.remove('editor-is-busy')
      }
    })
  })


  async function saveBeforePublish() {
    window.clearTimeout(saveTimer)

    while (saving) {
      await new Promise((resolve) => window.setTimeout(resolve, 80))
    }

    return save()
  }

  publishNext?.addEventListener('click', async () => {
    const url = publishNext.dataset.publishUrl
    if (!url) return

    publishNext.disabled = true
    publishNext.classList.add('is-loading')

    const saved = await saveBeforePublish()

    if (saved !== false) {
      window.location.assign(url)
      return
    }

    publishNext.disabled = false
    publishNext.classList.remove('is-loading')
  })


  syncColorUi()
  lastSavedPayload = JSON.stringify(getPayload())
})()

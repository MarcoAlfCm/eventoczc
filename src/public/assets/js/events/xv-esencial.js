(() => {
  const root = document.querySelector('.xv-invitation')
  if (!root) return

  const entryGate = document.querySelector('[data-entry-gate]')
  const entryOpen = entryGate?.querySelector('[data-entry-open]')
  const embeddedInEditor = window.self !== window.top
  let entryMusicStarter = null
  let entryOpening = false

  const finishEntry = () => {
    if (!entryGate) return
    document.body.classList.remove('xv-entry-locked')
    entryGate.hidden = true
    entryGate.classList.remove('is-opening', 'is-leaving')
  }

  if (entryGate) {
    if (embeddedInEditor) {
      finishEntry()
    } else {
      document.body.classList.add('xv-entry-locked')

      entryOpen?.addEventListener('click', () => {
        if (entryOpening) return
        entryOpening = true

        // Se invoca dentro del click del sello para que el navegador
        // reconozca la reproducción como una interacción real.
        if (typeof entryMusicStarter === 'function') {
          entryMusicStarter()
        }

        entryGate.classList.add('is-opening')

        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        const revealDelay = reduceMotion ? 20 : 720
        const finishDelay = reduceMotion ? 40 : 1120

        window.setTimeout(() => {
          entryGate.classList.add('is-leaving')
          document.body.classList.remove('xv-entry-locked')
        }, revealDelay)

        window.setTimeout(finishEntry, finishDelay)
      })
    }
  }

  const countdown = root.querySelector('[data-countdown]')
  if (countdown) {
    const rawDate = root.dataset.eventDate

    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate || '')) {
      const [year, month, day] = rawDate.split('-').map(Number)
      const target = new Date(year, month - 1, day, 0, 0, 0, 0)

      const fields = {
        days: countdown.querySelector('[data-days]'),
        hours: countdown.querySelector('[data-hours]'),
        minutes: countdown.querySelector('[data-minutes]'),
        seconds: countdown.querySelector('[data-seconds]')
      }

      const pad = (value) => String(Math.max(0, value)).padStart(2, '0')

      const renderCountdown = () => {
        const diff = Math.max(0, target.getTime() - Date.now())
        const totalSeconds = Math.floor(diff / 1000)

        const days = Math.floor(totalSeconds / 86400)
        const hours = Math.floor((totalSeconds % 86400) / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (fields.days) fields.days.textContent = String(days)
        if (fields.hours) fields.hours.textContent = pad(hours)
        if (fields.minutes) fields.minutes.textContent = pad(minutes)
        if (fields.seconds) fields.seconds.textContent = pad(seconds)

        return diff > 0
      }

      if (renderCountdown()) {
        const timer = window.setInterval(() => {
          if (!renderCountdown()) window.clearInterval(timer)
        }, 1000)
      }
    }
  }

  const lightbox = document.querySelector('[data-lightbox]')
  const lightboxImage = lightbox?.querySelector('[data-lightbox-image]')
  const lightboxClose = lightbox?.querySelector('[data-lightbox-close]')

  const galleryRoot = root.querySelector('[data-gallery]')
  const galleryPhotos = galleryRoot
    ? Array.from(galleryRoot.querySelectorAll('[data-gallery-src]'))
    : []

  const galleryUsesCenterStage = galleryPhotos.length === 4
  const galleryPositionClasses = [
    'is-gallery-far',
    'is-gallery-prev',
    'is-gallery-featured',
    'is-gallery-next',
    'is-gallery-wrapping',
    'is-gallery-teleport'
  ]

  let galleryActiveIndex = 0
  let galleryTimer = null
  let galleryTransitionTimer = null
  let galleryTransitioning = false

  const clearGalleryPositionClasses = (item) => {
    galleryPositionClasses.forEach((className) => {
      item.classList.remove(className)
    })
  }

  const markGalleryCurrent = () => {
    galleryPhotos.forEach((item, itemIndex) => {
      if (itemIndex === galleryActiveIndex) {
        item.setAttribute('aria-current', 'true')
      } else {
        item.removeAttribute('aria-current')
      }
    })
  }

  const setGalleryFeaturedFallback = (index) => {
    if (!galleryPhotos.length) return

    galleryActiveIndex = ((index % galleryPhotos.length) + galleryPhotos.length) % galleryPhotos.length

    galleryPhotos.forEach((item, itemIndex) => {
      item.classList.toggle('is-gallery-featured', itemIndex === galleryActiveIndex)
    })

    markGalleryCurrent()
  }

  const setGalleryStageInitial = (index = 0) => {
    if (!galleryUsesCenterStage) return

    galleryActiveIndex = ((index % 4) + 4) % 4

    const active = galleryActiveIndex
    const previous = (active + 3) % 4
    const farPrevious = (active + 2) % 4
    const next = (active + 1) % 4

    galleryPhotos.forEach(clearGalleryPositionClasses)

    galleryPhotos[farPrevious].classList.add('is-gallery-far', 'is-gallery-teleport')
    galleryPhotos[previous].classList.add('is-gallery-prev', 'is-gallery-teleport')
    galleryPhotos[active].classList.add('is-gallery-featured', 'is-gallery-teleport')
    galleryPhotos[next].classList.add('is-gallery-next', 'is-gallery-teleport')

    markGalleryCurrent()

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        galleryPhotos.forEach((item) => item.classList.remove('is-gallery-teleport'))
      })
    })
  }

  const advanceGalleryStage = () => {
    if (!galleryUsesCenterStage || galleryTransitioning) return

    const oldActive = galleryActiveIndex
    const oldFar = (oldActive + 2) % 4
    const oldPrevious = (oldActive + 3) % 4
    const oldNext = (oldActive + 1) % 4

    galleryTransitioning = true
    galleryActiveIndex = oldNext

    /*
     * Movimiento principal:
     *   anterior -> fondo izquierdo
     *   actual   -> mini izquierda
     *   siguiente-> centro y crece
     * La foto del fondo se desvanece y después reaparece a la derecha,
     * evitando que cruce por encima de la protagonista.
     */
    galleryPhotos[oldFar].classList.add('is-gallery-wrapping')

    galleryPhotos[oldPrevious].classList.remove('is-gallery-prev')
    galleryPhotos[oldPrevious].classList.add('is-gallery-far')

    galleryPhotos[oldActive].classList.remove('is-gallery-featured')
    galleryPhotos[oldActive].classList.add('is-gallery-prev')

    galleryPhotos[oldNext].classList.remove('is-gallery-next')
    galleryPhotos[oldNext].classList.add('is-gallery-featured')

    markGalleryCurrent()

    window.clearTimeout(galleryTransitionTimer)
    galleryTransitionTimer = window.setTimeout(() => {
      const wrappingItem = galleryPhotos[oldFar]

      wrappingItem.classList.add('is-gallery-teleport')
      wrappingItem.classList.remove('is-gallery-far', 'is-gallery-wrapping')
      wrappingItem.classList.add('is-gallery-next')

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          wrappingItem.classList.remove('is-gallery-teleport')
          galleryTransitioning = false
        })
      })
    }, 790)
  }

  const stopGalleryCarousel = () => {
    if (!galleryTimer) return
    window.clearInterval(galleryTimer)
    galleryTimer = null
  }

  const startGalleryCarousel = () => {
    stopGalleryCarousel()

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduceMotion || galleryPhotos.length < 2) return

    galleryTimer = window.setInterval(() => {
      if (galleryUsesCenterStage) {
        advanceGalleryStage()
      } else {
        setGalleryFeaturedFallback(galleryActiveIndex + 1)
      }
    }, 4200)
  }

  if (galleryPhotos.length) {
    if (galleryUsesCenterStage) {
      galleryRoot.classList.add('is-gallery-stage')
      setGalleryStageInitial(0)
    } else {
      setGalleryFeaturedFallback(galleryPhotos.length > 1 ? 1 : 0)
    }

    startGalleryCarousel()

    galleryRoot?.addEventListener('mouseenter', stopGalleryCarousel)
    galleryRoot?.addEventListener('mouseleave', startGalleryCarousel)
    galleryRoot?.addEventListener('focusin', stopGalleryCarousel)
    galleryRoot?.addEventListener('focusout', (event) => {
      if (!galleryRoot.contains(event.relatedTarget)) startGalleryCarousel()
    })

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopGalleryCarousel()
      else startGalleryCarousel()
    })
  }

  const closeLightbox = () => {
    if (!lightbox || !lightboxImage) return
    lightbox.hidden = true
    lightboxImage.removeAttribute('src')
    document.body.style.overflow = ''
    startGalleryCarousel()
  }

  root.querySelectorAll('[data-gallery-src]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!lightbox || !lightboxImage) return
      const src = button.dataset.gallerySrc
      if (!src) return

      stopGalleryCarousel()
      lightboxImage.src = src
      lightbox.hidden = false
      document.body.style.overflow = 'hidden'
    })
  })

  lightboxClose?.addEventListener('click', closeLightbox)
  lightbox?.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox && !lightbox.hidden) closeLightbox()
  })


  const rsvpRoot = root.querySelector('[data-rsvp-whatsapp]')
  const rsvpForm = rsvpRoot?.querySelector('[data-rsvp-form]')
  const rsvpName = rsvpRoot?.querySelector('[data-rsvp-name]')
  const rsvpError = rsvpRoot?.querySelector('[data-rsvp-error]')

  const setRsvpError = (show) => {
    if (!rsvpName) return
    rsvpName.closest('.xv-rsvp-field')?.classList.toggle('has-error', show)
    if (rsvpError) rsvpError.hidden = !show
  }

  rsvpName?.addEventListener('input', () => {
    if (rsvpName.value.trim()) setRsvpError(false)
  })

  rsvpForm?.addEventListener('submit', (event) => {
    event.preventDefault()

    const guestName = rsvpName?.value.trim() || ''
    if (!guestName) {
      setRsvpError(true)
      rsvpName?.focus()
      return
    }

    const phone = String(rsvpRoot?.dataset.rsvpPhone || '').replace(/\D/g, '')
    if (!phone) return

    const celebrant = String(rsvpRoot?.dataset.rsvpCelebrant || '').trim()
    const eventDate = String(rsvpRoot?.dataset.rsvpDate || '').trim()

    const eventLine = `Hola ✨ Confirmo mi asistencia a los XV años${celebrant ? ` de ${celebrant}` : ''}${eventDate ? ` el ${eventDate}` : ''}.`
    const message = `${eventLine}\n\nNombre: ${guestName}\n\n¡Gracias por la invitación! 💕`
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  })

  const musicRoot = document.querySelector('[data-music-player]')
  const audio = musicRoot?.querySelector('[data-music-audio]')
  const toggle = musicRoot?.querySelector('[data-music-toggle]')
  const toggleIcon = musicRoot?.querySelector('[data-music-toggle-icon]')
  const progressTrack = musicRoot?.querySelector('[data-music-progress-track]')
  const progress = musicRoot?.querySelector('[data-music-progress]')
  const status = musicRoot?.querySelector('[data-music-status]')

  if (audio && toggle) {
    const originalStatus = status?.textContent || ''
    let userPaused = false
    let playAttemptInFlight = false

    const syncMusicButton = () => {
      const playing = !audio.paused && !audio.ended

      if (toggleIcon) {
        toggleIcon.classList.toggle('xv-zendtry-icon-play', !playing)
        toggleIcon.classList.toggle('xv-zendtry-icon-pause', playing)
      }

      toggle.setAttribute('aria-pressed', playing ? 'true' : 'false')
      toggle.setAttribute('aria-label', playing ? 'Pausar música' : 'Reproducir música')
      musicRoot.classList.toggle('is-playing', playing)
    }

    const syncProgress = () => {
      if (!progress) return

      const duration = Number(audio.duration)
      const current = Number(audio.currentTime)
      const percentage = Number.isFinite(duration) && duration > 0
        ? Math.min(100, Math.max(0, (current / duration) * 100))
        : 0

      progress.style.width = `${percentage}%`
    }

    const markPlaying = () => {
      playAttemptInFlight = false
      musicRoot.classList.remove('is-autoplay-blocked')

      if (status) status.textContent = originalStatus

      syncMusicButton()
    }

    const markBlocked = () => {
      playAttemptInFlight = false
      musicRoot.classList.add('is-autoplay-blocked')

      if (status) status.textContent = ''

      syncMusicButton()
    }

    const playNow = () => {
      if (userPaused || !audio.paused || playAttemptInFlight) return

      playAttemptInFlight = true

      let result
      try {
        result = audio.play()
      } catch (_) {
        markBlocked()
        return
      }

      if (result && typeof result.then === 'function') {
        result.then(markPlaying).catch(markBlocked)
      } else {
        window.setTimeout(() => {
          if (audio.paused) markBlocked()
          else markPlaying()
        }, 0)
      }
    }

    // ÚNICO arranque automático de la música:
    // el click directo sobre el sello XV antes de abrir el sobre.
    entryMusicStarter = () => {
      userPaused = false
      playNow()
    }

    // El reproductor persistente conserva su control manual después de abrir
    // la invitación, pero ningún otro click, scroll, touch o tecla inicia audio.
    toggle.addEventListener('click', () => {
      if (audio.paused) {
        userPaused = false
        playNow()
      } else {
        userPaused = true
        audio.pause()
      }

      syncMusicButton()
    })

    progressTrack?.addEventListener('click', (event) => {
      const duration = Number(audio.duration)
      if (!Number.isFinite(duration) || duration <= 0) return

      const rect = progressTrack.getBoundingClientRect()
      if (!rect.width) return

      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      audio.currentTime = duration * ratio
      syncProgress()
    })

    audio.addEventListener('play', markPlaying)
    audio.addEventListener('pause', syncMusicButton)
    audio.addEventListener('ended', syncMusicButton)
    audio.addEventListener('timeupdate', syncProgress)
    audio.addEventListener('loadedmetadata', syncProgress)

    audio.addEventListener('error', () => {
      playAttemptInFlight = false
      musicRoot.classList.add('has-error')

      if (toggleIcon) {
        toggleIcon.classList.remove('xv-zendtry-icon-play', 'xv-zendtry-icon-pause')
        toggleIcon.textContent = '!'
      }

      toggle.setAttribute('aria-label', 'No se pudo cargar la música')
      toggle.setAttribute('aria-disabled', 'true')

      if (status) status.textContent = ''
    })

    syncMusicButton()
    syncProgress()
  }

})()

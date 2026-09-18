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

  let galleryActiveIndex = galleryPhotos.length > 1 ? 1 : 0
  let galleryTimer = null

  const setGalleryFeatured = (index) => {
    if (!galleryPhotos.length) return

    galleryActiveIndex = ((index % galleryPhotos.length) + galleryPhotos.length) % galleryPhotos.length

    galleryPhotos.forEach((item, itemIndex) => {
      const featured = itemIndex === galleryActiveIndex
      item.classList.toggle('is-gallery-featured', featured)

      if (featured) {
        item.setAttribute('aria-current', 'true')
      } else {
        item.removeAttribute('aria-current')
      }
    })
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
      setGalleryFeatured(galleryActiveIndex + 1)
    }, 4200)
  }

  if (galleryPhotos.length) {
    setGalleryFeatured(galleryActiveIndex)
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

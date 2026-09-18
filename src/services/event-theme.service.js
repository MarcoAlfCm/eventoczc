const DEFAULT_PRESET = 'champagne'
const DEFAULT_FONT_PRESET = 'elegant'
const DEFAULT_HERO_FONT_PRESET = 'great-vibes'

const THEME_PRESETS = {
  champagne: {
    label: 'Champagne',
    palette: {
      ink: '#332a25',
      muted: '#83766d',
      paper: '#fbf7f1',
      paperSoft: '#f4ebe1',
      surface: '#fffdfa',
      primary: '#c9a66a',
      primaryDeep: '#a57a3f',
      accent: '#b87568',
      footer: '#302824'
    }
  },
  rose: {
    label: 'Rosa empolvado',
    palette: {
      ink: '#3c2d31',
      muted: '#8b747a',
      paper: '#fcf7f7',
      paperSoft: '#f5e8eb',
      surface: '#fffafa',
      primary: '#c9989f',
      primaryDeep: '#a96f79',
      accent: '#d7b3a8',
      footer: '#392a2e'
    }
  },
  lavender: {
    label: 'Lavanda',
    palette: {
      ink: '#332f3c',
      muted: '#7c7586',
      paper: '#faf8fd',
      paperSoft: '#eee9f5',
      surface: '#fdfbff',
      primary: '#aa97c5',
      primaryDeep: '#806da0',
      accent: '#c8a9ba',
      footer: '#2f2a38'
    }
  },
  sage: {
    label: 'Verde salvia',
    palette: {
      ink: '#30362f',
      muted: '#747d72',
      paper: '#fafbf7',
      paperSoft: '#edf1e8',
      surface: '#fdfefb',
      primary: '#a6b08d',
      primaryDeep: '#788360',
      accent: '#c6a98f',
      footer: '#2d332d'
    }
  },
  midnight: {
    label: 'Azul noche',
    palette: {
      ink: '#252d3a',
      muted: '#727c8a',
      paper: '#f7f9fc',
      paperSoft: '#e9eef5',
      surface: '#fbfcfe',
      primary: '#8799b7',
      primaryDeep: '#5d7193',
      accent: '#c3a77a',
      footer: '#202733'
    }
  },
  burgundy: {
    label: 'Borgoña',
    palette: {
      ink: '#382b2d',
      muted: '#806f72',
      paper: '#fbf8f6',
      paperSoft: '#f1e8e5',
      surface: '#fffdfb',
      primary: '#a77d70',
      primaryDeep: '#74454d',
      accent: '#c9ab7f',
      footer: '#302326'
    }
  }
}

const FONT_PRESETS = {
  elegant: {
    label: 'Elegante',
    heading: '"Cormorant Garamond", Georgia, serif',
    body: '"Manrope", Arial, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap'
  },
  classic: {
    label: 'Clásica',
    heading: '"Playfair Display", Georgia, serif',
    body: '"Montserrat", Arial, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap'
  },
  romantic: {
    label: 'Romántica',
    heading: '"DM Serif Display", Georgia, serif',
    body: '"Poppins", Arial, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Poppins:wght@400;500;600;700&display=swap'
  },
  modern: {
    label: 'Moderna',
    heading: '"Lora", Georgia, serif',
    body: '"Inter", Arial, sans-serif',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@500;600;700&display=swap'
  }
}


const HERO_FONT_PRESETS = {
  'great-vibes': {
    label: 'Great Vibes',
    family: '"Great Vibes", cursive',
    href: 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap'
  },
  allura: {
    label: 'Allura',
    family: '"Allura", cursive',
    href: 'https://fonts.googleapis.com/css2?family=Allura&display=swap'
  },
  'alex-brush': {
    label: 'Alex Brush',
    family: '"Alex Brush", cursive',
    href: 'https://fonts.googleapis.com/css2?family=Alex+Brush&display=swap'
  },
  parisienne: {
    label: 'Parisienne',
    family: '"Parisienne", cursive',
    href: 'https://fonts.googleapis.com/css2?family=Parisienne&display=swap'
  }
}

const RADIUS_PRESETS = {
  soft: {
    card: '34px',
    soft: '28px',
    large: '42px',
    icon: '18px'
  },
  rounded: {
    card: '24px',
    soft: '20px',
    large: '30px',
    icon: '14px'
  },
  minimal: {
    card: '12px',
    soft: '10px',
    large: '16px',
    icon: '10px'
  }
}

const BUTTON_PRESETS = {
  pill: '999px',
  soft: '18px',
  minimal: '8px'
}

const HERO_PRESETS = new Set(['editorial', 'soft', 'minimal'])
const COLOR_KEYS = ['ink', 'muted', 'paper', 'paperSoft', 'surface', 'primary', 'primaryDeep', 'accent', 'accentDeep', 'footer']

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeHex(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return { r: 0, g: 0, b: 0 }

  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  }
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function mixHex(hexA, hexB, weightA = 0.5) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const weightB = 1 - weightA

  const toHex = (value) => Math.round(value).toString(16).padStart(2, '0')

  return `#${toHex(a.r * weightA + b.r * weightB)}${toHex(a.g * weightA + b.g * weightB)}${toHex(a.b * weightA + b.b * weightB)}`
}

function contrastText(hex) {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#2d2926' : '#ffffff'
}

function deriveTint(color, amount = 0.08) {
  return mixHex(color, '#ffffff', amount)
}

function deriveShade(color, strength = 0.76) {
  return mixHex(color, '#000000', strength)
}

function normalizeFlexibleColors(input) {
  if (!isPlainObject(input)) return null

  // Contrato futuro del dashboard:
  // selected: [1..3 colores]
  // 1 color  -> principal; base y acento se derivan.
  // 2 colores -> principal + acento; base se deriva.
  // 3 colores -> base + principal + acento.
  //
  // El contrato nominal actual (base / primary / accent) sigue siendo válido.
  if (Array.isArray(input.selected)) {
    const selected = input.selected
      .map(normalizeHex)
      .filter(Boolean)
      .slice(0, 3)

    if (selected.length === 1) {
      const primary = selected[0]
      return {
        base: deriveTint(primary, 0.07),
        primary,
        accent: deriveShade(primary, 0.70),
        count: 1
      }
    }

    if (selected.length === 2) {
      const [primary, accent] = selected
      return {
        base: mixHex(mixHex(primary, accent, 0.5), '#ffffff', 0.07),
        primary,
        accent,
        count: 2
      }
    }

    if (selected.length === 3) {
      return {
        base: selected[0],
        primary: selected[1],
        accent: selected[2],
        count: 3
      }
    }
  }

  const base = normalizeHex(input.base)
  const primary = normalizeHex(input.primary)
  const accent = normalizeHex(input.accent)
  const providedCount = [base, primary, accent].filter(Boolean).length

  if (!providedCount) return null

  if (providedCount === 3) {
    return { base, primary, accent, count: 3 }
  }

  if (providedCount === 2) {
    if (primary && accent) {
      return {
        base: mixHex(mixHex(primary, accent, 0.5), '#ffffff', 0.07),
        primary,
        accent,
        count: 2
      }
    }

    if (base && primary) {
      return {
        base,
        primary,
        accent: deriveShade(primary, 0.72),
        count: 2
      }
    }

    return {
      base,
      primary: accent,
      accent: deriveShade(accent, 0.72),
      count: 2
    }
  }

  const only = primary || accent || base
  return {
    base: deriveTint(only, 0.07),
    primary: only,
    accent: deriveShade(only, 0.70),
    count: 1
  }
}

function derivePaletteFromFlexibleColors(colors) {
  // El color base domina superficies. Principal se reserva para acciones e iconos.
  // Acento se usa en microdetalles/etiquetas. Esto evita que una invitación con
  // rosa + dorado termine viéndose monocromática.
  const ink = contrastText(colors.base)
  const primaryDeep = deriveShade(colors.primary, 0.80)
  const accentDeep = deriveShade(colors.accent, 0.72)

  return {
    ink,
    muted: mixHex(ink, colors.base, 0.64),
    paper: colors.base,
    paperSoft: mixHex(colors.base, colors.primary, 0.96),
    surface: mixHex(colors.base, '#ffffff', 0.92),
    primary: colors.primary,
    primaryDeep,
    accent: colors.accent,
    accentDeep,
    footer: mixHex(ink, primaryDeep, 0.88)
  }
}

function normalizePalette(input, presetPalette) {
  const palette = { ...presetPalette }
  if (!isPlainObject(input)) return palette

  COLOR_KEYS.forEach((key) => {
    const value = normalizeHex(input[key])
    if (value) palette[key] = value
  })

  return palette
}

function normalizeTheme(themeInput = {}) {
  const input = isPlainObject(themeInput) ? themeInput : {}

  const preset = Object.prototype.hasOwnProperty.call(THEME_PRESETS, input.preset)
    ? input.preset
    : DEFAULT_PRESET

  // Nuevo contrato simple para cliente: máximo tres colores.
  // - base: fondo dominante
  // - primary: acciones, títulos e iconografía
  // - accent: detalles decorativos
  // El resto de la paleta se deriva automáticamente para conservar contraste y coherencia.
  // Si un evento antiguo todavía usa theme.palette, sigue funcionando sin cambios.
  const flexibleColors = normalizeFlexibleColors(input.colors)
  const palette = flexibleColors
    ? derivePaletteFromFlexibleColors(flexibleColors)
    : normalizePalette(input.palette, THEME_PRESETS[preset].palette)

  if (!palette.accentDeep) {
    palette.accentDeep = deriveShade(palette.accent, 0.72)
  }

  const requestedFont = isPlainObject(input.fonts) ? input.fonts.preset : null
  const fontPreset = Object.prototype.hasOwnProperty.call(FONT_PRESETS, requestedFont)
    ? requestedFont
    : DEFAULT_FONT_PRESET

  const requestedHeroFont = isPlainObject(input.fonts) ? input.fonts.hero : null
  const heroFontPreset = Object.prototype.hasOwnProperty.call(HERO_FONT_PRESETS, requestedHeroFont)
    ? requestedHeroFont
    : DEFAULT_HERO_FONT_PRESET

  const styleInput = isPlainObject(input.style) ? input.style : {}
  const radiusPreset = Object.prototype.hasOwnProperty.call(RADIUS_PRESETS, styleInput.radius)
    ? styleInput.radius
    : 'soft'
  const buttonPreset = Object.prototype.hasOwnProperty.call(BUTTON_PRESETS, styleInput.buttons)
    ? styleInput.buttons
    : 'pill'
  const heroPreset = HERO_PRESETS.has(styleInput.hero) ? styleInput.hero : 'editorial'

  const fonts = FONT_PRESETS[fontPreset]
  const heroFont = HERO_FONT_PRESETS[heroFontPreset]
  const radius = RADIUS_PRESETS[radiusPreset]

  const heroStart = mixHex(palette.paper, '#ffffff', 0.96)
  const heroMid = mixHex(palette.paper, palette.primary, 0.95)
  const heroEnd = mixHex(palette.paper, palette.accent, 0.94)

  const cssVariables = {
    '--event-ink': palette.ink,
    '--event-muted': palette.muted,
    '--event-paper': palette.paper,
    '--event-paper-soft': palette.paperSoft,
    '--event-surface': palette.surface,
    '--event-primary': palette.primary,
    '--event-primary-deep': palette.primaryDeep,
    '--event-accent': palette.accent,
    '--event-accent-deep': palette.accentDeep,
    '--event-footer': palette.footer,
    '--event-on-primary': contrastText(palette.primaryDeep),
    '--event-on-footer': contrastText(palette.footer),
    '--event-line': rgba(palette.ink, 0.14),
    '--event-shadow': `0 24px 70px ${rgba(palette.ink, 0.12)}`,
    '--event-shadow-soft': `0 12px 32px ${rgba(palette.ink, 0.06)}`,
    '--event-primary-glow': rgba(palette.primary, 0.22),
    '--event-accent-glow': rgba(palette.accent, 0.16),
    '--event-surface-glass': rgba(palette.surface, 0.66),
    '--event-surface-glass-soft': rgba(palette.surface, 0.58),
    '--event-hero-start': heroStart,
    '--event-hero-mid': heroMid,
    '--event-hero-end': heroEnd,
    '--event-heading-font': fonts.heading,
    '--event-body-font': fonts.body,
    '--event-hero-font': heroFont.family,
    '--event-card-radius': radius.card,
    '--event-soft-radius': radius.soft,
    '--event-large-radius': radius.large,
    '--event-icon-radius': radius.icon,
    '--event-button-radius': BUTTON_PRESETS[buttonPreset]
  }

  return {
    preset,
    presetLabel: THEME_PRESETS[preset].label,
    colors: flexibleColors
      ? {
          base: flexibleColors.base,
          primary: flexibleColors.primary,
          accent: flexibleColors.accent,
          count: flexibleColors.count
        }
      : {
          base: palette.paper,
          primary: palette.primary,
          accent: palette.accent,
          count: 3
        },
    palette,
    fonts: {
      preset: fontPreset,
      label: fonts.label,
      heading: fonts.heading,
      body: fonts.body,
      hero: heroFontPreset,
      heroLabel: heroFont.label,
      heroFamily: heroFont.family
    },
    style: {
      radius: radiusPreset,
      buttons: buttonPreset,
      hero: heroPreset
    },
    fontHref: fonts.href,
    heroFontHref: heroFont.href,
    cssVariables
  }
}

module.exports = {
  normalizeTheme,
  THEME_PRESETS,
  FONT_PRESETS,
  HERO_FONT_PRESETS
}

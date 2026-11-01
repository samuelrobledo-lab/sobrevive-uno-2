import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { sound } from '../../audio/sound'
import { ICONS, drawCampusVignette, drawUaoVignette } from '../../utils/sprites'
import { campusSnapshot } from '../../utils/campusSnapshot'
import { frameAt, getCharacter } from '../../data/characters'
import { useGameStore } from '../../store/useGameStore'

/**
 * Primitivas de UI reutilizables: panel glass, botones, iconos y sprites pixel.
 */

/** Panel "liquid glass" con esquinas pixel. */
export function GlassPanel({ as: Tag = 'div', light = false, large = true, className = '', children, ...rest }) {
  return (
    <Tag
      className={`${light ? 'glass-pixel-light' : 'glass-pixel'} pixel-corners ${large ? 'pixel-corners-lg' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Botón principal pixel. variant: 'primary' | 'ghost' | 'green' */
export function PixelButton({ variant = 'primary', className = '', children, ...rest }) {
  const v = variant === 'primary' ? '' : variant
  return (
    <button type="button" className={`btn-pixel pixel-corners ${v} ${className}`} {...rest}>
      {children}
    </button>
  )
}

/** Icono pixel en SVG (crispEdges). */
export function PixelIcon({ name, size = 18, color = 'currentColor', className = '' }) {
  const grid = ICONS[name]
  if (!grid) return null
  const w = Math.max(...grid.map((r) => r.length))
  const h = grid.length
  return (
    <svg
      width={size}
      height={(size * h) / w}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      {grid.flatMap((row, y) =>
        [...row].map((c, x) => (c === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} /> : null)),
      )}
    </svg>
  )
}

/** Botón circular de icono (home / back / retry…): mismo sistema que PixelButton, en círculo pixel. */
export function IconButton({ icon, label, solid = false, className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`btn-pixel glass btn-icon pixel-circle ${solid ? 'solid' : ''} ${className}`}
      {...rest}
    >
      <PixelIcon name={icon} size={18} />
    </button>
  )
}

/** Carga (y cachea) la imagen de un spritesheet. */
const imageCache = new Map()
function loadImage(src) {
  if (!imageCache.has(src)) {
    const img = new Image()
    img.src = src
    imageCache.set(src, img)
  }
  return imageCache.get(src)
}

/**
 * Personaje animado en un <canvas> pixelado.
 * anim: 'idle' | 'walk' | 'jump' | 'panic'  ·  flip: mirar a la izquierda
 */
export function CharacterSprite({ character, anim = 'walk', scale = 4, flip = false, className = '' }) {
  const ref = useRef(null)
  const { sheet, frameW, frameH } = character

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const img = loadImage(sheet)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    let last = -1
    const draw = (now) => {
      const f = reduced ? 0 : frameAt(anim, now - start)
      if (f !== last && img.complete) {
        last = f
        ctx.clearRect(0, 0, frameW, frameH)
        ctx.save()
        if (flip) {
          ctx.translate(frameW, 0)
          ctx.scale(-1, 1)
        }
        ctx.drawImage(img, f * frameW, 0, frameW, frameH, 0, 0, frameW, frameH)
        ctx.restore()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [sheet, frameW, frameH, anim, flip])

  return (
    <canvas
      ref={ref}
      width={frameW}
      height={frameH}
      className={`pixelated ${className}`}
      style={{ width: frameW * scale, height: frameH * scale }}
      aria-hidden="true"
    />
  )
}

/** Viñeta pixel del campus con variante de emergencia; anima mientras `animate` sea true. */
export function CampusVignette({ variant = 'base', animate = false, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    let frame = 0
    drawCampusVignette(ctx, variant, frame)
    if (!animate) return
    const id = setInterval(() => drawCampusVignette(ctx, variant, ++frame), 140)
    return () => clearInterval(id)
  }, [variant, animate])
  return <canvas ref={ref} width={48} height={36} className={`pixelated ${className}`} aria-hidden="true" />
}

/** Viñeta con la foto pixel del campus UAO (modelo 3D) y la emergencia encima. */
export function UaoVignette({ variant = 'base', animate = false, className = '' }) {
  const ref = useRef(null)
  const [photo, setPhoto] = useState(null)
  // La foto se toma cuando el campus 3D ya cargó (si se entra antes, p. ej. al volver de la experiencia, espera)
  useEffect(() => {
    let id
    const tryShot = () => {
      const shot = campusSnapshot()
      if (shot) setPhoto(shot)
      else id = setTimeout(tryShot, 150)
    }
    id = setTimeout(tryShot, 50)
    return () => clearTimeout(id)
  }, [])
  useEffect(() => {
    if (!photo) return
    const ctx = ref.current.getContext('2d')
    let frame = 0
    drawUaoVignette(ctx, photo, variant, frame)
    if (!animate) return
    const id = setInterval(() => drawUaoVignette(ctx, photo, variant, ++frame), 140)
    return () => clearInterval(id)
  }, [photo, variant, animate])
  // mientras carga: el mismo círculo vacío (nunca el dibujo genérico)
  return (
    <canvas
      ref={ref}
      width={photo?.width ?? 96}
      height={photo?.height ?? 96}
      className={`pixelated ${className}`}
      aria-hidden="true"
    />
  )
}

/** Wordmark temporal sobre placa liquid glass. Reemplazar por el logo oficial (SVG) en /public/images. */
export function UaoMark({ className = '' }) {
  return (
    <GlassPanel
      large={false}
      className={`mx-auto flex h-16 w-36 items-center justify-center ${className}`}
      aria-label="UAO"
      role="img"
    >
      <span className="font-sans text-4xl leading-none font-bold tracking-tight text-[#ff2440] lowercase drop-shadow-[0_2px_0_rgb(0_0_0/0.45)] [transform:translateY(0.12em)]">
        uao
      </span>
    </GlassPanel>
  )
}

/** Pantalla de carga pixel mientras la escena 3D compila shaders/texturas. */
export function LoadingScreen({ label = 'Cargando escena' }) {
  const character = getCharacter(useGameStore((st) => st.selectedCharacter))
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-carbon-950" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <CharacterSprite character={character} anim="walk" scale={4} />
        <p className="font-pixel text-[0.65rem] text-white/80">
          {label}
          <span className="anim-blink">…</span>
        </p>
      </div>
    </div>
  )
}

/** Botón para activar / silenciar todos los sonidos (se recuerda en este navegador). */
export function SoundToggle({ className = '' }) {
  const muted = useSyncExternalStore(sound.subscribe, sound.isMuted)
  return (
    <IconButton
      icon={muted ? 'soundOff' : 'soundOn'}
      label={muted ? 'Activar sonido' : 'Silenciar sonido'}
      aria-pressed={muted}
      onClick={() => {
        sound.unlock()
        sound.setMuted(!muted)
      }}
      className={className}
    />
  )
}

/** Nota emergente que invita a hacer scroll (rebota suavemente). */
export function ScrollHint({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto absolute inset-x-0 bottom-5 z-20 mx-auto w-fit cursor-pointer"
      aria-label={label}
    >
      <GlassPanel large={false} className="anim-float flex items-center gap-3 px-4 py-2.5">
        <span className="font-pixel text-[0.55rem] text-white/90 uppercase sm:text-[0.6rem]">{label}</span>
        <span className="rotate-90">
          <PixelIcon name="next" size={14} />
        </span>
      </GlassPanel>
    </button>
  )
}

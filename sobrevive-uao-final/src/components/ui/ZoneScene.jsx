import { useEffect, useRef, useState } from 'react'

/**
 * Imagen de una ficha del mapa dibujada a partir del modelo 3D del lugar, como sprite pixel art
 * (mismo estilo de los árboles del mapa). Cada sprite se carga y se dibuja solo cuando se abre su ficha.
 */
const SPRITES = {
  escaleras: () => import('../three/escalerasSprite').then((m) => m.drawEscaleras()),
}

export default function ZoneScene({ name, label }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    SPRITES[name]?.().then((image) => {
      if (!alive || !ref.current) return
      ref.current.width = image.width
      ref.current.height = image.height
      ref.current.getContext('2d').putImageData(image, 0, 0)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [name])
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={`pixelated size-full object-cover transition-opacity ${ready ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}

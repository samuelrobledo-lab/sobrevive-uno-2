import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

/**
 * Avisa cuando la escena ya pintó sus primeros frames (texturas y shaders compilados).
 * Se usa para ocultar la pantalla de carga sin depender de Suspense.
 */
export default function ReadySignal({ onReady, frames = 3 }) {
  const count = useRef(0)
  useFrame(({ invalidate }) => {
    count.current += 1
    if (count.current === frames) onReady()
    else if (count.current < frames) invalidate() // en escenas "bajo demanda" pide los cuadros que faltan
  })
  return null
}

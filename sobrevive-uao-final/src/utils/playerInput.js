import { useEffect } from 'react'

/**
 * Entrada de movimiento del simulador: flechas, W A S D o la cruceta táctil.
 * Vive fuera de React (se lee en cada cuadro desde el avatar).
 *
 *   x → derecha (+) / izquierda (−) · z → hacia la cámara (+) / hacia el fondo (−)
 */
export const playerInput = { held: new Set(), moved: false, listeners: new Set() }

const KEYS = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}

export function press(dir, down) {
  if (down) playerInput.held.add(dir)
  else playerInput.held.delete(dir)
  if (down && !playerInput.moved) {
    playerInput.moved = true
    playerInput.listeners.forEach((fn) => fn())
  }
}

/** Dirección actual (sin normalizar). */
export function inputDirection(out) {
  const h = playerInput.held
  out.x = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0)
  out.z = (h.has('down') ? 1 : 0) - (h.has('up') ? 1 : 0)
  return out
}

/** Escucha el teclado mientras el simulador está abierto. */
export function useKeyboardMovement() {
  useEffect(() => {
    playerInput.held.clear()
    playerInput.moved = false
    const onDown = (e) => {
      const dir = KEYS[e.code]
      if (!dir || e.target.closest?.('input, textarea')) return
      e.preventDefault() // las flechas no deben desplazar la página ni mover el foco
      press(dir, true)
    }
    const onUp = (e) => KEYS[e.code] && press(KEYS[e.code], false)
    const clear = () => playerInput.held.clear() // al cambiar de ventana no queda una tecla "pegada"
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
      clear()
    }
  }, [])
}

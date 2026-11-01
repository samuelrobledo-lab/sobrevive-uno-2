/**
 * Configuración global de "Sobrevive a la UAO".
 * Todo lo que se espera ajustar al integrar assets finales vive aquí.
 */

/**
 * Resolución de render del canvas 3D [mín, máx] respecto a la pantalla.
 * Se renderiza a resolución completa (nítido y estable al mover la cámara);
 * el estilo pixel art viene de las texturas, no de bajar la resolución.
 */
export const PIXEL_DPR = { simulator: [1, 1.5], map: [1, 1.5], home: [1, 1.5] }

/** Duración de la secuencia caótica antes de mostrar la tarjeta reflexiva (ms). */
export const CHAOS_DURATION_MS = 2600

/** Duración del toast de acierto (ms). */
export const TOAST_DURATION_MS = 2600

/** Velocidad de caminata del avatar (unidades/seg). */
export const WALK_SPEED = 3.4

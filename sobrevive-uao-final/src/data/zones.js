/**
 * Zonas del Módulo 2 (Mapa 3D interactivo).
 *
 * position     → dónde se ubica el pin sobre el campus (UaoCampus / mapa-uao.fbx, unidades de escena)
 * cameraOffset → desde dónde mira la cámara al enfocar la zona
 * image        → foto/render opcional (ej. '/images/sotano-1.jpg'); null = placeholder pixel
 * scene        → modelo 3D del lugar para la imagen de la ficha (tiene prioridad sobre image)
 *
 * Estructura de la ficha según wireframe: ¿Qué lugar es? (opcional: whatIs) · ¿Por qué es riesgoso? · ¿Cómo evacuar?
 * ⚠️ Contenido de referencia: reemplazar/validar con los protocolos oficiales de la UAO.
 */

export const ZONES = [
  {
    id: 'aulas-2',
    name: 'Escaleras',
    category: 'Edificios',
    risk: 'medio',
    // sobre el techo de la segunda torre alargada
    position: [16, 8.5, 4.6],
    cameraOffset: [4, 13, 24],
    image: null,
    scene: 'escaleras', // modelo 3D del lugar en la ficha (ver ZoneScene)
    whyRisky:
      'Es un lugar donde las aglomeraciones, las caídas y las prisas pueden bloquear el paso y provocar accidentes durante una evacuación.',
    howToEvacuate: [
      'Camina con calma, sin correr ni empujar.',
      'Usa las escaleras señalizadas y sigue las indicaciones de las personas encargadas.',
      'Mantén el paso libre y utiliza el pasamanos.',
      'Al salir, dirígete al punto de encuentro.',
    ],
  },
  {
    id: 'edificio-principal',
    name: 'Edificio Principal',
    category: 'Edificios',
    risk: 'medio',
    position: [-13.4, 14.1, -0.1],
    cameraOffset: [18, 6, 22],
    image: null,
    whatIs: 'Edificio central del campus: aulas, oficinas administrativas y auditorios, con alta concentración de personas.',
    whyRisky: 'Muchas personas evacuando a la vez, varios pisos y zonas con vidrio en fachada.',
    howToEvacuate: [
      'Atiende las indicaciones de los brigadistas (chalecos).',
      'Baja por las escaleras por tu derecha, sin correr ni empujar.',
      'Aléjate de ventanales y fachadas al salir.',
      'Ve al punto de encuentro asignado a tu bloque.',
    ],
  },
  {
    id: 'punto-encuentro',
    name: 'Punto de encuentro',
    category: 'Zona segura',
    risk: 'bajo',
    position: [0, 0, 0],
    cameraOffset: [-2, 16, 12],
    image: null,
    whatIs: 'Zona abierta señalizada donde se reúnen las personas evacuadas para el conteo.',
    whyRisky: 'Es la zona segura; el riesgo es no llegar o irse sin reportarse.',
    howToEvacuate: [
      'Repórtate con la brigada de tu bloque.',
      'Avisa si alguien falta o está herido.',
      'No regreses a los edificios hasta recibir autorización.',
    ],
  },
]

export const RISK_LABEL = { alto: 'Riesgo alto', medio: 'Riesgo medio', bajo: 'Riesgo bajo' }

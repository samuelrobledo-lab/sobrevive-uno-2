import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LEVEL, nav } from './basementLayout'

/**
 * Mesas de trabajo de 6 puestos (dos mesas blancas juntas, canto de triplex, patas metálicas y cajas de tomas)
 * con 3 sillas rojas a cada lado:
 *  - labs 1 (Sótano 1), según el plano del equipo: dos filas a lo largo del corredor oeste (y dos al norte);
 *    entre las filas queda el paso.
 *  - Sótano 2: una hilera de 6 junto al muro del patio del corredor este, repartidas de esquina a esquina
 *    (del pasillo de cruce norte al sur), donde empieza la fuga de gas
 *    (el personaje está sentado en la del medio, ver STUDY_TABLE).
 *
 * Cada mesa con sus sillas registra una caja invisible en `nav.blockers` (entre una y otra se puede pasar).
 * Las piezas repetidas son InstancedMesh (una llamada de dibujo por tipo de pieza).
 */

/** Mesa donde empieza la fuga de gas (Sótano 2): ahí se sienta el personaje (SPOTS.studyS2) y están sus libros. */
export const STUDY_TABLE = [26.1, LEVEL.s2, -1.5]

/** Centros [x, z] de las mesas de labs 1 (medidos sobre el plano). El largo va a lo largo del corredor (z). */
const TABLES_S1 = [
  // al norte, junto al muro del patio
  [-6.6, -29.5],
  [-6.6, -26.8],
  // fila contra el muro del patio
  ...[-17.6, -12.4, -8.7, -4.3, 1.8, 7.3, 15.6, 21.7].map((z) => [-5, z]),
  // fila contra el muro exterior
  ...[-18.3, -12.4, -8.6, -3.9, 1.3, 7.4, 15.9].map((z) => [-12, z]),
]
/** Todas las mesas: [x, y, z]. En el Sótano 2, 6 contra el muro del patio (x 24.67) del corredor este, de z −18 a 10. */
const TABLES = [
  ...TABLES_S1.map(([x, z]) => [x, LEVEL.s1, z]),
  ...[-16.5, -11.5, -6.5, -1.5, 3.5, 8.5].map((z) => [STUDY_TABLE[0], LEVEL.s2, z]),
]
const TABLE_LEN = 2.0 // largo de cada mesa de 6 puestos
const TABLE_W = 1.5 // ancho (dos mesas de 0.75 juntas)
const SEATS = [-0.65, 0, 0.65] // 3 sillas por lado
const CHAIR_GAP = 0.36 // separación de la silla al canto de la mesa

const COLORS = {
  top: '#eceae4',
  plywood: '#d2c29f',
  seam: '#b8b5ad',
  metal: '#a3a6aa',
  outlet: '#9ea1a5',
  chair: '#d82a31',
  chairShade: '#b01f27',
}

/** Partes de una mesa: [geometría, color, posiciones locales]. */
function tableParts() {
  const half = TABLE_W / 2
  return {
    top: [new THREE.BoxGeometry(TABLE_W, 0.05, TABLE_LEN - 0.05), COLORS.top, [[0, 0.75, 0]]],
    plywood: [new THREE.BoxGeometry(TABLE_W - 0.02, 0.035, TABLE_LEN - 0.07), COLORS.plywood, [[0, 0.71, 0]]],
    seam: [new THREE.BoxGeometry(0.02, 0.054, TABLE_LEN - 0.05), COLORS.seam, [[0, 0.752, 0]]],
    outlet: [
      new THREE.BoxGeometry(0.26, 0.012, 0.18),
      COLORS.outlet,
      SEATS.flatMap((z) => [
        [-half / 2, 0.78, z],
        [half / 2, 0.78, z],
      ]),
    ],
    leg: [
      new THREE.BoxGeometry(TABLE_W - 0.3, 0.68, 0.05),
      COLORS.metal,
      [
        [0, 0.35, TABLE_LEN / 2 - 0.12],
        [0, 0.35, -TABLE_LEN / 2 + 0.12],
      ],
    ],
  }
}

/** Partes de una silla roja, modelada mirando hacia +x (hacia la mesa). */
function chairParts() {
  return {
    seat: [new THREE.BoxGeometry(0.42, 0.05, 0.42), COLORS.chair, [[0, 0.46, 0]]],
    back: [new THREE.BoxGeometry(0.05, 0.42, 0.4).translate(0, 0.21, 0).rotateZ(0.16), COLORS.chair, [[-0.2, 0.48, 0]]],
    sled: [
      new THREE.BoxGeometry(0.36, 0.44, 0.04),
      COLORS.chairShade,
      [
        [0, 0.22, 0.17],
        [0, 0.22, -0.17],
      ],
    ],
  }
}

/** Un InstancedMesh por parte, colocando cada parte en cada mueble (posición + giro). */
function instanced(parts, items, clippingPlanes) {
  const m = new THREE.Matrix4()
  const local = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const one = new THREE.Vector3(1, 1, 1)
  return Object.values(parts).map(([geo, color, offsets]) => {
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color, clippingPlanes }), items.length * offsets.length)
    let i = 0
    items.forEach(({ x, y, z, rotY = 0 }) => {
      m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY), one)
      offsets.forEach(([ox, oy, oz]) => mesh.setMatrixAt(i++, local.makeTranslation(ox, oy, oz).premultiply(m)))
    })
    return mesh
  })
}

export default function LabsTables({ clippingPlanes }) {
  const { meshes, colliders } = useMemo(() => {
    const chairs = TABLES.flatMap(([x, y, z]) =>
      [-1, 1].flatMap((side) =>
        SEATS.map((dz) => ({ x: x + side * (TABLE_W / 2 + CHAIR_GAP), y, z: z + dz, rotY: side > 0 ? Math.PI : 0 })),
      ),
    )
    const meshes = [
      ...instanced(tableParts(), TABLES.map(([x, y, z]) => ({ x, y, z })), clippingPlanes),
      ...instanced(chairParts(), chairs, clippingPlanes),
    ]
    const colliders = TABLES.map(([x, y, z]) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(TABLE_W + 2 * (CHAIR_GAP + 0.25), 1, TABLE_LEN + 0.1),
        new THREE.MeshBasicMaterial(),
      )
      box.position.set(x, y + 0.5, z)
      box.visible = false
      box.updateMatrixWorld()
      return box
    })
    return { meshes, colliders }
  }, [clippingPlanes])

  useEffect(() => {
    nav.blockers.push(...colliders)
    return () => {
      for (const c of colliders) {
        const i = nav.blockers.indexOf(c)
        if (i >= 0) nav.blockers.splice(i, 1)
      }
    }
  }, [colliders])

  return (
    <group>
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  )
}

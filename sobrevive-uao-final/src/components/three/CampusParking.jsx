import { useMemo } from 'react'
import * as THREE from 'three'
import { rng } from '../../utils/pixelTextures'
import { spriteToTexture } from '../../utils/sprites'
import { PLANT_PALETTE, PlantInstances, TREE, billboardMaterial } from './CampusGround'

/**
 * Costado norte del campus (según el plano de la UAO), entre el Edificio Principal y la Carrera 115:
 *
 *  - Parqueadero angosto: franja larga oeste-este con una fila de puestos contra la valla y la calzada
 *    del lado del edificio, una jardinera verde con árbol, carros parqueados y entrada desde la Carrera 115.
 *
 * Coordenadas de escena (norte = −z, este = +x). Las capas planas usan polygonOffset para no parpadear
 * contra el pasto (ver LAYER en CampusSurroundings).
 */

export const LOT = { x: [-28, 0], z: [-23.5, -15] } // parqueadero, casi pegado a los setos del Edificio Principal
export const DRIVEWAY = { x: [-13, -7], z: [-27.5, -23.5] } // hasta la Carrera 115
const STALL = 2.5 // ancho de un puesto (a lo largo de x)
const DEPTH = 5 // fondo de un puesto (a lo largo de z)
const PPU = 8 // píxeles de textura por unidad

/** Filas de puestos: [z inicial, hacia dónde mira el carro (+1 sur, −1 norte)]. Una sola fila: el resto es calzada. */
const ROWS = [[LOT.z[0], 1]] // contra la valla
/** Jardinera verde en la mitad de la fila (ocupa dos puestos, al lado de la entrada). */
const PLANTER = { x: [-18.5, -13.5], z: [LOT.z[0] + 0.4, LOT.z[0] + DEPTH - 0.4] }
const inPlanter = (x) => x > PLANTER.x[0] - 0.5 && x < PLANTER.x[1] + 0.5

const layered = (offset) => ({ polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset })

/** Asfalto con las líneas blancas de los puestos (una sola textura para todo el parqueadero). */
function paintLot() {
  const W = (LOT.x[1] - LOT.x[0]) * PPU
  const H = (LOT.z[1] - LOT.z[0]) * PPU
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const r = rng(31)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const j = Math.round((r() - 0.5) * 10)
      g.fillStyle = `rgb(${120 + j},${122 + j},${126 + j})`
      g.fillRect(x, y, 1, 1)
    }
  g.fillStyle = '#ebe8de'
  // líneas entre puestos (perpendiculares a la calzada)
  ROWS.forEach(([z0]) => {
    const y0 = Math.round((z0 - LOT.z[0]) * PPU)
    for (let u = 1; u <= LOT.x[1] - LOT.x[0] - 1; u += STALL) {
      const x = LOT.x[0] + u
      if (x > DRIVEWAY.x[0] && x < DRIVEWAY.x[1]) continue // la entrada atraviesa la fila
      g.fillRect(Math.round(u * PPU), y0, 1, DEPTH * PPU)
    }
  })
  // borde exterior
  g.fillRect(0, 0, 1, H)
  g.fillRect(W - 1, 0, 1, H)
  return c
}

/** Puestos ocupados (posición del centro del carro y hacia dónde mira). */
function layoutCars() {
  const r = rng(52)
  const cars = []
  ROWS.forEach(([z0, facing]) => {
    for (let x = LOT.x[0] + 1 + STALL / 2; x < LOT.x[1] - 1; x += STALL) {
      if (inPlanter(x) || (x > DRIVEWAY.x[0] - 1 && x < DRIVEWAY.x[1] + 1)) continue // jardinera y entrada
      if (r() < 0.65) cars.push({ x, z: z0 + DEPTH / 2, facing, color: Math.floor(r() * 5) })
    }
  })
  return cars
}
const CAR_COLORS = ['#c8102e', '#2b6cb0', '#e8e4dc', '#3a3a44', '#d9a400']

let cache = null
function build() {
  if (cache) return cache
  const lotTex = new THREE.CanvasTexture(paintLot())
  lotTex.magFilter = THREE.NearestFilter
  lotTex.minFilter = THREE.LinearMipmapLinearFilter
  lotTex.anisotropy = 8
  lotTex.colorSpace = THREE.SRGBColorSpace

  // Carros instanciados: carrocería (color por carro), cabina de vidrio y base oscura (ruedas).
  // El carro se modela a lo largo de x y se gira para quedar perpendicular a la calzada.
  const cars = layoutCars()
  const parts = {
    body: {
      geo: new THREE.BoxGeometry(3.2, 0.6, 1.5).translate(0, 0.5, 0),
      mat: new THREE.MeshLambertMaterial({ flatShading: true }),
    },
    cabin: {
      geo: new THREE.BoxGeometry(1.7, 0.5, 1.3).translate(-0.2, 1.05, 0),
      mat: new THREE.MeshLambertMaterial({ color: '#9fd0ea', flatShading: true }),
    },
    base: {
      geo: new THREE.BoxGeometry(2.9, 0.3, 1.4).translate(0, 0.15, 0),
      mat: new THREE.MeshLambertMaterial({ color: '#1c1c20' }),
    },
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const one = new THREE.Vector3(1, 1, 1)
  const color = new THREE.Color()
  const carMeshes = Object.entries(parts).map(([name, { geo, mat }]) => {
    const im = new THREE.InstancedMesh(geo, mat, cars.length)
    cars.forEach(({ x, z, facing, color: c }, i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, facing > 0 ? -Math.PI / 2 : Math.PI / 2)
      im.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), q, one))
      if (name === 'body') im.setColorAt(i, color.set(CAR_COLORS[c]))
    })
    return im
  })

  // Árbol de la jardinera
  const h = TREE.length / TREE[0].length
  const planterTrees = [
    m
      .makeScale(2.4, 2.4 * h, 1)
      .setPosition((PLANTER.x[0] + PLANTER.x[1]) / 2, 0.25, (PLANTER.z[0] + PLANTER.z[1]) / 2)
      .clone(),
  ]
  const treeMat = billboardMaterial(spriteToTexture(TREE, PLANT_PALETTE))

  cache = { lotTex, carMeshes, planterTrees, treeMat }
  return cache
}

export default function CampusParking() {
  const { lotTex, carMeshes, planterTrees, treeMat } = useMemo(build, [])

  return (
    <group>
      {/* Parqueadero */}
      <mesh rotation-x={-Math.PI / 2} position={[(LOT.x[0] + LOT.x[1]) / 2, 0.025, (LOT.z[0] + LOT.z[1]) / 2]}>
        <planeGeometry args={[LOT.x[1] - LOT.x[0], LOT.z[1] - LOT.z[0]]} />
        <meshLambertMaterial map={lotTex} {...layered(-2)} />
      </mesh>
      {/* Entrada vehicular desde la Carrera 115 (cruza el andén) */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[(DRIVEWAY.x[0] + DRIVEWAY.x[1]) / 2, 0.028, (DRIVEWAY.z[0] + DRIVEWAY.z[1]) / 2]}
      >
        <planeGeometry args={[DRIVEWAY.x[1] - DRIVEWAY.x[0], DRIVEWAY.z[1] - DRIVEWAY.z[0]]} />
        <meshLambertMaterial color="#7a7c80" {...layered(-3)} />
      </mesh>
      {/* Jardinera verde con sardinel */}
      <mesh position={[(PLANTER.x[0] + PLANTER.x[1]) / 2, 0.12, (PLANTER.z[0] + PLANTER.z[1]) / 2]}>
        <boxGeometry args={[PLANTER.x[1] - PLANTER.x[0], 0.24, PLANTER.z[1] - PLANTER.z[0]]} />
        <meshLambertMaterial color="#7f9a68" />
      </mesh>
      <PlantInstances material={treeMat} matrices={planterTrees} />
      {carMeshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  )
}

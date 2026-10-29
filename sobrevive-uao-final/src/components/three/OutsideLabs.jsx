import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { makePixelTexture } from '../../utils/pixelTextures'
import { spriteToTexture } from '../../utils/sprites'
import { BUSH, PLANT_PALETTE, PlantInstances, TREE, billboardMaterial } from './CampusGround'
import { LEVEL, nav } from './basementLayout'

/**
 * Afuera de labs: el jardín al que da la salida de los sótanos (costado este del Sótano 1, x > 38.9).
 * Pasto, un andén frente a las puertas de vidrio y los mismos árboles y arbustos pixel del Mapa 3D.
 * Se monta cuando el personaje sale (transición a negro) y registra su piso en `nav` para poder caminar.
 */
const AREA = { x: [38.9, 78], z: [-30, 24] }
const WALK = { x: [38.9, 50], z: [-6.5, -0.5] } // andén frente a la salida
const Y = LEVEL.s1

const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

function buildPlants() {
  const r = rand(19)
  const m = new THREE.Matrix4()
  const trees = []
  const bushes = []
  const tH = TREE.length / TREE[0].length
  const bH = BUSH.length / BUSH[0].length
  for (let i = 0; i < 40; i++) {
    const x = 52 + r() * 24
    const z = AREA.z[0] + r() * (AREA.z[1] - AREA.z[0])
    const s = 2.6 + r() * 1.4
    trees.push(
      m
        .makeScale(s, s * tH, 1)
        .setPosition(x, Y, z)
        .clone(),
    )
  }
  // arbustos a lo largo de la fachada (dejan libre el andén)
  for (let z = AREA.z[0] + 1; z < AREA.z[1]; z += 2.2) {
    if (z > WALK.z[0] - 1 && z < WALK.z[1] + 1) continue
    const s = 1.3 + r() * 0.5
    bushes.push(
      m
        .makeScale(s, s * bH, 1)
        .setPosition(40.2 + r() * 1.2, Y, z)
        .clone(),
    )
  }
  return { trees, bushes }
}

export default function OutsideLabs() {
  const { ground, walk, trees, bushes, treeMat, bushMat } = useMemo(() => {
    const grass = makePixelTexture('grass', (AREA.x[1] - AREA.x[0]) / 2, (AREA.z[1] - AREA.z[0]) / 2)
    const walk = makePixelTexture('stone', (WALK.x[1] - WALK.x[0]) / 1.5, (WALK.z[1] - WALK.z[0]) / 1.5)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(AREA.x[1] - AREA.x[0], AREA.z[1] - AREA.z[0]).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: grass }),
    )
    ground.position.set((AREA.x[0] + AREA.x[1]) / 2, Y, (AREA.z[0] + AREA.z[1]) / 2)
    ground.userData.walkable = true
    ground.updateMatrixWorld()
    return {
      ground,
      walk,
      ...buildPlants(),
      treeMat: billboardMaterial(spriteToTexture(TREE, PLANT_PALETTE)),
      bushMat: billboardMaterial(spriteToTexture(BUSH, PLANT_PALETTE)),
    }
  }, [])

  // el pasto es piso caminable mientras se está afuera
  useEffect(() => {
    nav.floors.push(ground)
    return () => {
      const i = nav.floors.indexOf(ground)
      if (i >= 0) nav.floors.splice(i, 1)
    }
  }, [ground])

  return (
    <group>
      <primitive object={ground} />
      <mesh rotation-x={-Math.PI / 2} position={[(WALK.x[0] + WALK.x[1]) / 2, Y + 0.02, (WALK.z[0] + WALK.z[1]) / 2]}>
        <planeGeometry args={[WALK.x[1] - WALK.x[0], WALK.z[1] - WALK.z[0]]} />
        <meshLambertMaterial map={walk} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <PlantInstances material={treeMat} matrices={trees} />
      <PlantInstances material={bushMat} matrices={bushes} />
    </group>
  )
}

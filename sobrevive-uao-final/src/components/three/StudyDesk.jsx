import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { nav } from './basementLayout'

/**
 * Mesita de estudio donde empieza la fuga de gas (route.seated): queda delante del personaje (hacia la cámara),
 * así le tapa las piernas mientras está sentado. Con libro y hojas encima; no se puede atravesar.
 */
export default function StudyDesk({ position: [x, y, z] }) {
  const collider = useMemo(() => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1, 0.75), new THREE.MeshBasicMaterial())
    box.position.set(x, y + 0.5, z + 0.75)
    box.visible = false
    box.updateMatrixWorld()
    return box
  }, [x, y, z])
  useEffect(() => {
    nav.blockers.push(collider)
    return () => {
      const i = nav.blockers.indexOf(collider)
      if (i >= 0) nav.blockers.splice(i, 1)
    }
  }, [collider])

  return (
    <group position={[x, y, z + 0.75]}>
      {/* tablero y patas */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[1.2, 0.06, 0.65]} />
        <meshLambertMaterial color="#eceae4" />
      </mesh>
      {[-0.55, 0.55].map((dx) =>
        [-0.27, 0.27].map((dz) => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.35, dz]}>
            <boxGeometry args={[0.05, 0.7, 0.05]} />
            <meshLambertMaterial color="#a3a6aa" />
          </mesh>
        )),
      )}
      {/* libro abierto y hojas */}
      <mesh position={[-0.2, 0.77, 0]} rotation-y={0.2}>
        <boxGeometry args={[0.36, 0.04, 0.26]} />
        <meshLambertMaterial color="#2563c9" />
      </mesh>
      <mesh position={[0.25, 0.755, 0.05]} rotation-y={-0.3}>
        <boxGeometry args={[0.24, 0.01, 0.32]} />
        <meshLambertMaterial color="#fffdf6" />
      </mesh>
    </group>
  )
}

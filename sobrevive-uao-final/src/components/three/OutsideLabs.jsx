import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import UaoCampus from './UaoCampus'
import { MeetingSign } from './Props'
import { OUTSIDE_OFFSET, nav } from './basementLayout'

/**
 * Afuera de labs: el campus real del Mapa 3D (mismo modelo y suelo pixel), puesto para que el personaje salga
 * frente al Edificio Principal mirando a la plazoleta circular, que es el punto de encuentro. Antes del círculo
 * está la señal de punto de encuentro.
 *
 * OUTSIDE_OFFSET es dónde queda el centro de la plazoleta (el origen del campus) en la escena del simulador.
 * Se monta cuando el personaje sale (transición a negro) y registra un piso plano invisible en `nav`.
 */
const SIGN = [-5, 0, -2.2] // en coordenadas del campus: al lado del camino, antes del anillo de la plazoleta

export default function OutsideLabs() {
  // piso caminable (invisible) a la altura del suelo del campus
  const ground = useMemo(() => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial())
    mesh.position.set(...OUTSIDE_OFFSET)
    mesh.visible = false
    mesh.updateMatrixWorld()
    return mesh
  }, [])

  useEffect(() => {
    nav.floors.push(ground)
    return () => {
      const i = nav.floors.indexOf(ground)
      if (i >= 0) nav.floors.splice(i, 1)
    }
  }, [ground])

  return (
    <group position={OUTSIDE_OFFSET}>
      <UaoCampus />
      {/* mirando a quien llega desde el edificio (y a la cámara) */}
      <MeetingSign position={SIGN} rotation={-Math.PI / 4} />
    </group>
  )
}

import { STUDY_TABLE } from './LabsTables'

/**
 * Lo que el personaje estaba estudiando cuando empieza la fuga de gas: libro abierto y hojas sobre su mesa
 * (STUDY_TABLE, Sótano 2), del lado de su silla.
 */
export default function StudyBooks() {
  const [x, y, z] = STUDY_TABLE
  return (
    <group position={[x + 0.35, y + 0.78, z]}>
      {/* libro abierto y hojas */}
      <mesh rotation-y={0.2}>
        <boxGeometry args={[0.26, 0.04, 0.36]} />
        <meshLambertMaterial color="#2563c9" />
      </mesh>
      <mesh position={[-0.05, -0.015, 0.4]} rotation-y={-0.3}>
        <boxGeometry args={[0.24, 0.01, 0.32]} />
        <meshLambertMaterial color="#fffdf6" />
      </mesh>
    </group>
  )
}

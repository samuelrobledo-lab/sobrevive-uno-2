import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import npcSheet from '../../assets/characters/npcs.png'
import { pixelateTexture } from '../../utils/pixelTextures'
import { useEmergency, useGameStore } from '../../store/useGameStore'
import { LEVEL, OUTSIDE_OFFSET } from './basementLayout'
import { buildGraph, pathFrom, segDist } from './corridorGraph'

/**
 * Estudiantes (NPC) evacuando, para ambientar: caminan por los pasillos hacia la salida de su piso (rampa o
 * escaleras en el Sótano 2, la salida de los sótanos en el Sótano 1, y se alejan por el jardín afuera de labs),
 * desaparecen al llegar y vuelven a salir desde otro lugar. No interactúan con el personaje: lo atraviesan.
 *
 * Estampida: en las preguntas marcadas con `stampede` (todos empiezan a correr) sale un grupo corriendo desde
 * detrás del personaje, pasa a su lado y se va hacia la salida más cercana.
 *
 * Afuera de labs salen del Edificio Principal y se quedan reunidos en la plazoleta (el punto de encuentro).
 *
 * Los sprites (src/assets/characters/npcs.png) son 4 estudiantes × 4 fotogramas de caminata (25 × 25 px, miran
 * a la derecha). Solo se ven los del piso donde está el personaje (como el modelo).
 */

const TYPES = 4
const FRAMES = 4
const HEIGHT = 1.7 // igual que el personaje: 25 px de alto
const PER_LEVEL = { s2: 12, s1: 22, out: 8 }
const STAMPEDE = 10
const JITTER = 0.35 // cada uno camina un poco corrido del centro del pasillo
/** Corre cada punto del camino hacia un lado (perpendicular al tramo) para que no vayan en fila india. */
function jitter(pts, amount) {
  return pts.map(([x, z], i) => {
    const [ax, az] = pts[Math.max(0, i - 1)]
    const [bx, bz] = pts[Math.min(pts.length - 1, i + 1)]
    const len = Math.hypot(bx - ax, bz - az) || 1
    return [x + (-(bz - az) / len) * amount, z + ((bx - ax) / len) * amount]
  })
}

const rand = (a, b) => a + Math.random() * (b - a)

/** Afuera de labs: salen del Edificio Principal y caminan a un lugar dentro de la plazoleta, donde se quedan. */
function outsidePath() {
  const [cx, , cz] = OUTSIDE_OFFSET
  const ang = Math.random() * Math.PI * 2
  const r = rand(1.2, 3.2)
  return [
    [cx - 8.2, cz + rand(-2.8, 2.8)],
    [cx - 4.2, cz + rand(-1.5, 1.5)],
    [cx + Math.cos(ang) * r, cz + Math.sin(ang) * r],
  ]
}

export default function Evacuees({ avatarRef }) {
  const emergency = useEmergency()
  const runId = useGameStore((s) => s.runId)
  const sheet = useTexture(npcSheet)
  const graphs = useMemo(
    () => ({ s2: buildGraph('s2', emergency?.hazard), s1: buildGraph('s1', emergency?.hazard) }),
    [emergency],
  )

  // Un sprite y una sombra por NPC (pool fijo): ambiente de cada piso + grupo de la estampida
  const pool = useMemo(() => {
    const list = []
    for (const [level, n] of Object.entries(PER_LEVEL)) for (let i = 0; i < n; i++) list.push({ level, ambient: true })
    for (let i = 0; i < STAMPEDE; i++) list.push({ level: 's2', ambient: false })
    return list.map((npc) => {
      const map = pixelateTexture(sheet.clone())
      map.repeat.set(1 / FRAMES, 1 / TYPES)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, alphaTest: 0.5, toneMapped: false, transparent: true }))
      sprite.center.set(0.5, 0)
      sprite.scale.set(HEIGHT, HEIGHT, 1)
      sprite.visible = false
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 8).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }),
      )
      shadow.visible = false
      return { ...npc, sprite, shadow, map, active: false, wait: rand(0, 2.5), facing: 1 }
    })
  }, [sheet])

  const group = useRef(null)
  const stampedeKey = useRef(null)
  const lastRun = useRef(runId)

  /** Pone a caminar a un NPC del ambiente desde algún lugar de su piso (más seguido cerca del personaje). */
  const spawnAmbient = (npc, a) => {
    let pts
    if (npc.level === 'out') pts = outsidePath()
    else {
      const g = graphs[npc.level]
      if (!g.spawnable.length) return
      const weights = g.spawnable.map((k) => 1 / (1 + Math.hypot(g.nodes[k][0] - a.x, g.nodes[k][1] - a.z) / 6))
      let r = Math.random() * weights.reduce((sum, w) => sum + w, 0)
      const start = g.spawnable.find((_, i) => (r -= weights[i]) <= 0) ?? g.spawnable[0]
      pts = pathFrom(g, start)
      // arranca en un punto del primer tramo (no todos justo en un nodo)
      if (pts.length > 1) {
        const t = Math.random() * 0.8
        pts[0] = [pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t]
      }
    }
    start(npc, jitter(pts, rand(-JITTER, JITTER)), rand(1.7, 2.4), false)
  }

  const start = (npc, pts, speed, running) => {
    Object.assign(npc, { active: true, pts, seg: 0, x: pts[0][0], z: pts[0][1], speed, running, fade: 0, out: false, t: rand(0, 1) })
  }

  /** Estampida: un grupo sale corriendo desde detrás del personaje, pasa junto a él y va a la salida más cercana. */
  const spawnStampede = (a) => {
    const level = a.y > LEVEL.s1 / 2 ? 's1' : 's2'
    const g = graphs[level]
    const near = (k) => Math.hypot(g.nodes[k][0] - a.x, g.nodes[k][1] - a.z)
    // sale de un lugar a unos 8 m cuyo camino a la salida pase junto al personaje
    const candidates = g.spawnable
      .map((k) => {
        const pts = pathFrom(g, k)
        const pass = Math.min(...pts.slice(1).map((p, i) => segDist(pts[i], p, a.x, a.z)))
        return { k, pts, score: (pass < 2.5 ? 0 : 100) + Math.abs(near(k) - 8) }
      })
      .filter((c) => c.pts.length > 1 && near(c.k) > 3)
      .sort((p, q) => p.score - q.score)
    const pick = candidates[0]
    if (!pick) return
    pool
      .filter((n) => !n.ambient)
      .forEach((npc, i) => {
        npc.level = level
        const pts = jitter(pick.pts.map(([x, z]) => [x, z]), rand(-0.9, 0.9))
        // en grupo: unos más atrás que otros
        const [x0, z0] = pts[0]
        const [x1, z1] = pts[1]
        const back = (i % 5) * 0.7 + rand(0, 0.5)
        const len = Math.hypot(x1 - x0, z1 - z0) || 1
        pts[0] = [x0 - ((x1 - x0) / len) * back, z0 - ((z1 - z0) / len) * back]
        npc.type = Math.floor(Math.random() * TYPES)
        start(npc, pts, rand(4.2, 5.2), true)
      })
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const a = avatarRef.current
    const { phase, currentStep, attempts, isOutside, runId: run } = useGameStore.getState()
    const view = isOutside ? 'out' : a.y > LEVEL.s1 / 2 ? 's1' : 's2'

    // nueva partida: todos de nuevo
    if (run !== lastRun.current) {
      lastRun.current = run
      pool.forEach((n) => Object.assign(n, { active: false, wait: rand(0, 2) }))
      stampedeKey.current = null
    }

    // estampida al llegar a una pregunta de "todos corren"
    const decision = emergency?.decisions[currentStep]
    const key = `${run}|${attempts}|${currentStep}`
    if (phase === 'deciding' && decision?.stampede && stampedeKey.current !== key) {
      stampedeKey.current = key
      spawnStampede(a)
    }

    for (const npc of pool) {
      if (!npc.active) {
        npc.sprite.visible = npc.shadow.visible = false
        if (npc.ambient && (npc.wait -= dt) <= 0) {
          npc.type = Math.floor(Math.random() * TYPES)
          spawnAmbient(npc, a)
        }
        continue
      }
      // avanzar por el camino
      let step = npc.speed * dt
      while (step > 0 && npc.seg < npc.pts.length - 1) {
        const [tx, tz] = npc.pts[npc.seg + 1]
        const dx = tx - npc.x
        const dz = tz - npc.z
        const d = Math.hypot(dx, dz)
        if (Math.abs(dx) > 0.02) npc.facing = Math.sign(dx)
        if (d <= step) {
          npc.x = tx
          npc.z = tz
          npc.seg++
          step -= d
        } else {
          npc.x += (dx / d) * step
          npc.z += (dz / d) * step
          step = 0
        }
      }
      // al llegar a la salida se desvanece; afuera se queda en el punto de encuentro
      const arrived = npc.seg >= npc.pts.length - 1
      const gathered = arrived && npc.level === 'out'
      npc.fade = THREE.MathUtils.clamp(npc.fade + (arrived && !gathered ? -dt * 3 : dt * 3), 0, 1)
      if (arrived && npc.fade <= 0) {
        npc.active = false
        npc.wait = npc.ambient ? rand(0.5, 3) : Infinity
        continue
      }
      // fotograma de la caminata (más rápido si corren)
      npc.t += dt
      const frame = gathered ? 0 : Math.floor(npc.t / (npc.running ? 0.07 : 0.14)) % FRAMES
      npc.map.repeat.x = npc.facing / FRAMES
      npc.map.offset.set((frame + (npc.facing < 0 ? 1 : 0)) / FRAMES, 1 - (npc.type + 1) / TYPES)
      const y = npc.level === 's2' ? LEVEL.s2 : LEVEL.s1
      const shown = npc.level === view
      npc.sprite.visible = npc.shadow.visible = shown
      npc.sprite.position.set(npc.x, y, npc.z)
      npc.sprite.material.opacity = npc.fade
      npc.shadow.position.set(npc.x, y + 0.03, npc.z)
      npc.shadow.material.opacity = 0.3 * npc.fade
    }
  })

  return (
    <group ref={group}>
      {pool.map((npc, i) => (
        <group key={i}>
          <primitive object={npc.sprite} />
          <primitive object={npc.shadow} />
        </group>
      ))}
    </group>
  )
}

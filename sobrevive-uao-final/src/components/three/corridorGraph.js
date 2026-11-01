import * as THREE from 'three'
import { FIRES, GAS } from './basementLayout'

/**
 * Red de caminos por los pasillos de los sótanos: la usan los estudiantes que evacuan (Evacuees) y el personaje
 * cuando corre en pánico hacia un lugar (failTarget), para ir siempre por el piso y no en línea recta por el vacío.
 */

export const SAFE = 1.4 // los caminos pasan al menos a esta distancia del fuego o del gas de la emergencia

/*
 * Caminos por el centro de los pasillos de cada sótano (mismo plano en los dos pisos): nodos [x, z] y tramos.
 * Los pasillos de cruce tienen dos carriles (uno contra cada muro): se descartan los tramos que pasan cerca del
 * fuego o del gas de la emergencia actual. Las salidas (exits) son donde desaparecen.
 */
const GRAPH = {
  s2: {
    nodes: {
      wN: [-8.9, -31.5], wX1: [-8.9, -19.3], wM: [-8.9, -4], wX2: [-8.9, 12.4], wS: [-8.9, 21], sw: [-19.5, 21],
      // (carriles corridos para esquivar el fuego en zigzag del incendio y las mesas del corredor este)
      rp1: [-20, -30.1], rp2: [-31.9, -29.9], ramp: [-32, -23],
      nA1: [-2, -18.4], nA2: [24, -18.4],
      eX1: [29.2, -19], eN: [28.5, -32], eStN: [28.6, -13.4], stN: [32, -13.4], eM: [28.2, -4],
      eStS: [28.6, 6.6], stS: [32, 6.6], eX2: [28.5, 12.4], eS: [28.5, 30],
      sA1: [-2, 11], sA2: [24, 11], sB1: [-2, 13.65], sB2: [24, 13.65],
    },
    edges: [
      ['wN', 'wX1'], ['wX1', 'wM'], ['wM', 'wX2'], ['wX2', 'wS'], ['wS', 'sw'],
      ['wN', 'rp1'], ['rp1', 'rp2'], ['rp2', 'ramp'],
      ['wX1', 'nA1'], ['nA1', 'nA2'], ['nA2', 'eX1'],
      ['eN', 'eX1'], ['eX1', 'eStN'], ['eStN', 'stN'], ['eStN', 'eM'], ['eM', 'eStS'], ['eStS', 'stS'],
      ['eStS', 'eX2'], ['eX2', 'eS'],
      ['wX2', 'sA1'], ['sA1', 'sA2'], ['sA2', 'eX2'], ['wX2', 'sB1'], ['sB1', 'sB2'], ['sB2', 'eX2'],
    ],
    exits: ['ramp', 'stN', 'stS'],
  },
  s1: {
    nodes: {
      wN: [-8.8, -30], rampTop: [-12.7, -22.3], wX1: [-8.8, -18.75], wM: [-8.8, -4], wX2: [-8.8, 13.6],
      nA1: [-2, -18.75], nA2: [18, -18.75], nB: [22.5, -21.3], eX1: [28.5, -21.3], eX1b: [28.5, -18.9],
      stTopN: [30.5, -15], eM: [28.5, -4], exitIn: [35, -3.3], exit: [38.6, -3.3],
      stTopS: [31.2, 7.9], eX2: [28.5, 12.4], eS: [28.5, 28],
      sA1: [-2, 11], sA2: [14.5, 11], sB1: [-2, 13.6], sX: [3, 11], sB2: [14.5, 13.4], sC: [24.5, 13.4], sD: [24.5, 11],
    },
    edges: [
      ['wN', 'wX1'], ['rampTop', 'wX1'], ['wX1', 'wM'], ['wM', 'wX2'],
      ['wX1', 'nA1'], ['nA1', 'nA2'], ['nA2', 'nB'], ['nB', 'eX1'], ['nA2', 'eX1b'], ['eX1', 'eX1b'],
      ['eX1b', 'stTopN'], ['stTopN', 'eM'], ['eM', 'exitIn'], ['exitIn', 'exit'],
      ['eM', 'stTopS'], ['stTopS', 'eX2'], ['eX2', 'eS'],
      ['wX2', 'sA1'], ['sA1', 'sA2'], ['wX2', 'sB1'], ['sB1', 'sB2'], ['sB1', 'sX'], ['sX', 'sA2'], ['sA2', 'sB2'],
      ['sB2', 'sC'], ['sA2', 'sD'], ['sC', 'eX2'], ['sD', 'eX2'],
    ],
    exits: ['exit'],
  },
}

export const segDist = ([ax, az], [bx, bz], px, pz) => {
  const dx = bx - ax
  const dz = bz - az
  const t = THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1)
  return Math.hypot(ax + dx * t - px, az + dz * t - pz)
}

/** Distancias por los pasillos desde los nodos `sources` y, para cada nodo, el vecino por el que se sigue. */
function shortest(adj, sources) {
  const dist = Object.fromEntries(Object.keys(adj).map((k) => [k, Infinity]))
  const next = {}
  const open = new Set(sources)
  sources.forEach((k) => (dist[k] = 0))
  while (open.size) {
    const u = [...open].reduce((a, b) => (dist[a] <= dist[b] ? a : b))
    open.delete(u)
    for (const [v, len] of adj[u]) {
      if (dist[u] + len < dist[v]) {
        dist[v] = dist[u] + len
        next[v] = u
        open.add(v)
      }
    }
  }
  return { dist, next }
}

/** Grafo de un piso sin los tramos que pasan junto al peligro de la emergencia (lista de vecinos con su largo). */
export function buildGraph(level, hazard) {
  const { nodes, edges, exits } = GRAPH[level]
  const zones = hazard === 'fire' ? FIRES[level] : hazard === 'gas' ? GAS[level] : []
  const adj = Object.fromEntries(Object.keys(nodes).map((k) => [k, []]))
  for (const [a, b] of edges) {
    if (zones.some(([x, , z]) => segDist(nodes[a], nodes[b], x, z) < SAFE)) continue
    const len = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1])
    adj[a].push([b, len])
    adj[b].push([a, len])
  }
  // distancia (por los pasillos) de cada nodo a la salida más cercana, y por dónde seguir
  const { dist, next } = shortest(adj, exits)
  const spawnable = Object.keys(nodes).filter((k) => !exits.includes(k) && dist[k] < Infinity)
  return { nodes, adj, dist, next, exits, spawnable }
}

/** Camino (lista de [x, z]) desde un nodo hasta la salida más cercana. */
export function pathFrom(g, start) {
  const pts = [g.nodes[start]]
  for (let k = start; g.next[k]; k = g.next[k]) pts.push(g.nodes[g.next[k]])
  return pts
}

/**
 * Camino por los pasillos de `from` a `to` ([x, z]): entra a la red por el nodo más cercano al que se llega en
 * línea recta (`clear(desde, hasta)`), la recorre y termina en `to`. null si no hay cómo.
 */
export function routeBetween(g, from, to, clear = () => true) {
  const near = (p) =>
    Object.keys(g.nodes)
      .filter((k) => clear(p, g.nodes[k]))
      .sort((a, b) => Math.hypot(g.nodes[a][0] - p[0], g.nodes[a][1] - p[1]) - Math.hypot(g.nodes[b][0] - p[0], g.nodes[b][1] - p[1]))[0]
  const a = near(from)
  const b = near(to)
  if (!a || !b) return null
  const { dist, next } = shortest(g.adj, [b])
  if (dist[a] === Infinity) return null
  const pts = [from, g.nodes[a]]
  for (let k = a; next[k]; k = next[k]) pts.push(g.nodes[next[k]])
  pts.push(to)
  return pts
}

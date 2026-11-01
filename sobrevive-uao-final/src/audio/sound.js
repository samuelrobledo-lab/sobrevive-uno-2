/**
 * Motor de sonido 8‑bit generado con Web Audio (sin archivos externos).
 *
 *   sound.unlock()         → crea/reanuda el AudioContext (requiere un gesto del usuario)
 *   sound.sfx.<nombre>()   → efectos puntuales (click, paso, acierto, error, caos…)
 *   sound.music(on)        → música de menú en loop
 *   sound.ambient(hazard)  → ambiente de la emergencia ('fire' | 'gas' | 'quake' | null)
 *   sound.preview(hazard)  → muestra corta de la emergencia al pasar el cursor por su imagen (null la apaga)
 *   sound.setMuted(bool)   → silencia todo (se recuerda en este navegador)
 *
 * Para usar audios finales (.mp3/.ogg) basta con reemplazar el cuerpo de cada sfx
 * por la reproducción del archivo; la API pública puede quedarse igual.
 */

const STORAGE_KEY = 'sobrevive-uao:muted'
const readMuted = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let ctx = null
let master, sfxBus, musicBus, ambientBus
let noiseBuffer = null
let muted = readMuted()
const listeners = new Set()

/* ------------------------------------------------------------------ */
/* Infraestructura                                                     */
/* ------------------------------------------------------------------ */

function bus(volume) {
  const g = ctx.createGain()
  g.gain.value = volume
  g.connect(master)
  return g
}

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.9
    master.connect(ctx.destination)
    sfxBus = bus(0.55)
    musicBus = bus(0.16)
    ambientBus = bus(0.35)
    // aplica lo que se pidió antes de tener audio
    if (pending.music) startMusic()
    if (pending.ambient) startAmbient(pending.ambient)
  }
  if (ctx.state === 'suspended') ctx.resume()
}

const now = () => ctx.currentTime

function getNoise() {
  if (noiseBuffer) return noiseBuffer
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noiseBuffer.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noiseBuffer
}

/** Nota con envolvente. */
function tone({ freq, to, type = 'square', dur = 0.1, vol = 0.3, delay = 0, dest = sfxBus, attack = 0.005 }) {
  if (!ctx) return
  const t = now() + delay
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Ráfaga de ruido filtrado. */
function noise({ dur = 0.2, vol = 0.3, type = 'lowpass', freq = 1000, to, q = 1, delay = 0, dest = sfxBus }) {
  if (!ctx) return
  const t = now() + delay
  const src = ctx.createBufferSource()
  src.buffer = getNoise()
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(dest)
  src.start(t, Math.random())
  src.stop(t + dur + 0.05)
}

/* ------------------------------------------------------------------ */
/* Efectos                                                             */
/* ------------------------------------------------------------------ */

const NOTE = { C4: 262, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, C6: 1047 }

const sfx = {
  click: () => tone({ freq: 880, to: 1320, dur: 0.06, vol: 0.12 }),
  step: () => {
    noise({ dur: 0.05, vol: 0.18, type: 'bandpass', freq: 900, q: 0.8 })
    tone({ freq: 140, to: 90, type: 'triangle', dur: 0.05, vol: 0.12 })
  },
  decision: () => {
    tone({ freq: NOTE.A4, dur: 0.12, vol: 0.18 })
    tone({ freq: NOTE.E5, dur: 0.18, vol: 0.18, delay: 0.12 })
  },
  correct: () => [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone({ freq: f, dur: 0.12, vol: 0.2, delay: i * 0.08 })),
  wrong: () => {
    tone({ freq: 320, to: 70, type: 'sawtooth', dur: 0.55, vol: 0.25 })
    tone({ freq: 160, to: 60, type: 'square', dur: 0.45, vol: 0.15, delay: 0.05 })
  },
  jump: () => tone({ freq: 280, to: 760, dur: 0.16, vol: 0.12 }),
  /** Crujido del techo: aviso de que un pedazo grande se va a caer. */
  crack: () => {
    for (let i = 0; i < 4; i++) noise({ dur: 0.06, vol: 0.18, type: 'bandpass', freq: 1800 + Math.random() * 1500, q: 4, delay: i * 0.07 })
    tone({ freq: 160, to: 90, type: 'sawtooth', dur: 0.3, vol: 0.06 })
  },
  /** Golpe de un pedazo grande de techo contra el piso. */
  crash: () => {
    tone({ freq: 80, to: 30, type: 'triangle', dur: 0.4, vol: 0.55 })
    noise({ dur: 0.5, vol: 0.4, type: 'lowpass', freq: 900, to: 120 })
  },
  victory: () => {
    const melody = [
      [NOTE.C5, 0.12], [NOTE.E5, 0.12], [NOTE.G5, 0.12], [NOTE.C6, 0.24],
      [NOTE.G5, 0.12], [NOTE.C6, 0.4],
    ]
    let t = 0
    melody.forEach(([f, d]) => {
      tone({ freq: f, dur: d, vol: 0.22, delay: t })
      tone({ freq: f / 2, type: 'triangle', dur: d, vol: 0.18, delay: t })
      t += d
    })
  },
  /** Secuencia caótica según la amenaza. */
  chaos: (hazard) => {
    if (hazard === 'gas') {
      noise({ dur: 1.4, vol: 0.9, type: 'lowpass', freq: 1800, to: 60 })
      tone({ freq: 90, to: 28, type: 'sine', dur: 1.2, vol: 0.6 })
    } else if (hazard === 'fire') {
      noise({ dur: 1.2, vol: 0.5, type: 'bandpass', freq: 600, to: 2400, q: 0.7 })
      for (let i = 0; i < 14; i++) noise({ dur: 0.04, vol: 0.35, type: 'highpass', freq: 2500, delay: Math.random() * 1.8 })
    } else {
      noise({ dur: 2.2, vol: 0.8, type: 'lowpass', freq: 160, q: 2 })
      for (let i = 0; i < 8; i++) {
        const d = 0.2 + Math.random() * 1.6
        noise({ dur: 0.08, vol: 0.4, type: 'bandpass', freq: 500, q: 2, delay: d })
        tone({ freq: 120, to: 50, type: 'triangle', dur: 0.1, vol: 0.25, delay: d })
      }
    }
  },
}

/* ------------------------------------------------------------------ */
/* Música de menú (loop chiptune)                                      */
/* ------------------------------------------------------------------ */

const pending = { music: false, ambient: null }
let musicTimer = null
let nextBeat = 0
let beat = 0
// Progresión Am – F – C – G, arpegios a 8 pasos por acorde
const CHORDS = [
  [220, 262, 330, 440],
  [175, 220, 262, 349],
  [131, 196, 262, 330],
  [196, 247, 294, 392],
]
const STEP = 0.18

function scheduleMusic() {
  while (nextBeat < now() + 0.3) {
    const chord = CHORDS[Math.floor(beat / 8) % CHORDS.length]
    const i = beat % 8
    const lead = chord[[0, 1, 2, 3, 2, 1, 2, 3][i]] * 2
    const t = nextBeat - now()
    tone({ freq: lead, dur: STEP * 0.9, vol: 0.22, delay: t, dest: musicBus })
    if (i % 4 === 0) tone({ freq: chord[0] / 2, type: 'triangle', dur: STEP * 3.6, vol: 0.4, delay: t, dest: musicBus })
    nextBeat += STEP
    beat++
  }
}

function startMusic() {
  if (musicTimer || !ctx) return
  nextBeat = now() + 0.05
  musicTimer = setInterval(scheduleMusic, 100)
}

function music(on) {
  pending.music = on
  if (!ctx) return
  if (on) startMusic()
  else {
    clearInterval(musicTimer)
    musicTimer = null
  }
}

/* ------------------------------------------------------------------ */
/* Ambiente por emergencia                                             */
/* ------------------------------------------------------------------ */

let ambientNodes = []

function stopAmbient() {
  stopDebris()
  ambientNodes.forEach((n) => {
    try {
      n.stop()
    } catch {
      /* ya detenido */
    }
  })
  ambientNodes = []
}

function loopNoise({ type, freq, q = 1, vol, dest = ambientBus, list = ambientNodes }) {
  const src = ctx.createBufferSource()
  src.buffer = getNoise()
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(dest)
  src.start()
  list.push(src)
  return g
}

function startAmbient(hazard) {
  stopPreview()
  stopAmbient()
  if (!ctx || !hazard) return
  if (hazard === 'fire') {
    // alarma intermitente + crepitar
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = 950
    const gate = ctx.createGain()
    gate.gain.value = 0.05 // 0.05 ± 0.05 → pita y calla
    const lfo = ctx.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = 2.2
    const depth = ctx.createGain()
    depth.gain.value = 0.05
    lfo.connect(depth).connect(gate.gain)
    o.connect(gate).connect(ambientBus)
    o.start()
    lfo.start()
    ambientNodes.push(o, lfo)
    loopNoise({ type: 'bandpass', freq: 1400, q: 0.6, vol: 0.12 })
  } else if (hazard === 'gas') {
    const g = loopNoise({ type: 'highpass', freq: 3500, vol: 0.18 })
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.25
    const depth = ctx.createGain()
    depth.gain.value = 0.08
    lfo.connect(depth).connect(g.gain)
    lfo.start()
    ambientNodes.push(lfo)
  } else if (hazard === 'quake') {
    // retumbar de la tierra: dos capas graves + objetos cayendo al azar
    quakeGain = loopNoise({ type: 'lowpass', freq: 110, q: 3, vol: 1 })
    const deep = loopNoise({ type: 'lowpass', freq: 45, q: 1, vol: 1.2 })
    const wobble = ctx.createOscillator()
    wobble.frequency.value = 3.5
    const depth = ctx.createGain()
    depth.gain.value = 0.35
    wobble.connect(depth).connect(quakeGain.gain)
    wobble.start()
    ambientNodes.push(wobble)
    quakeWobble = wobble
    quakeLayers = [quakeGain, deep]
    startDebris()
  }
}

let quakeGain = null
let quakeLayers = []
let quakeWobble = null
let debrisTimer = null

/** Un objeto que cae: golpe seco + escombro, a veces vidrio o metal. */
function fallingObject() {
  if (!ctx) return
  const r = Math.random()
  const vol = 0.25 + Math.random() * 0.35
  tone({ freq: 90 + Math.random() * 60, to: 40, type: 'triangle', dur: 0.18, vol: vol * 1.4 })
  noise({ dur: 0.25 + Math.random() * 0.3, vol, type: 'bandpass', freq: 300 + Math.random() * 600, q: 1.5 })
  if (r < 0.25) {
    // vidrio que se rompe
    for (let i = 0; i < 6; i++) tone({ freq: 2500 + Math.random() * 2500, type: 'triangle', dur: 0.08, vol: 0.06, delay: 0.03 + i * 0.03 })
  } else if (r < 0.45) {
    // lámina metálica
    tone({ freq: 420 + Math.random() * 200, to: 380, type: 'square', dur: 0.4, vol: 0.06 })
  } else {
    // pedacitos que rebotan
    for (let i = 0; i < 3; i++) noise({ dur: 0.05, vol: vol * 0.5, type: 'bandpass', freq: 900, q: 2, delay: 0.12 + i * 0.09 })
  }
}

function startDebris() {
  stopDebris()
  const loop = () => {
    fallingObject()
    debrisTimer = setTimeout(loop, 350 + Math.random() * 900)
  }
  debrisTimer = setTimeout(loop, 300)
}

function stopDebris() {
  clearTimeout(debrisTimer)
  debrisTimer = null
}

function ambient(hazard) {
  pending.ambient = hazard
  if (ctx) startAmbient(hazard)
}

/* ------------------------------------------------------------------ */
/* Muestra de la emergencia (hover en la selección)                    */
/* ------------------------------------------------------------------ */

let preview = null // { gain, nodes, timer }

function stopPreview() {
  if (!preview) return
  const { gain, nodes, timer } = preview
  preview = null
  clearTimeout(timer)
  gain.gain.cancelScheduledValues(now())
  gain.gain.setTargetAtTime(0.0001, now(), 0.08)
  setTimeout(() => {
    nodes.forEach((n) => {
      try {
        n.stop()
      } catch {
        /* ya detenido */
      }
    })
    gain.disconnect()
  }, 500)
}

function startPreview(hazard) {
  stopPreview()
  if (!ctx || !hazard) return
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now())
  gain.gain.exponentialRampToValueAtTime(1, now() + 0.25)
  gain.connect(ambientBus)
  const nodes = []
  const p = { gain, nodes, timer: null }
  const layer = (opts) => loopNoise({ ...opts, dest: gain, list: nodes })
  if (hazard === 'quake') {
    // la tierra que ruge: dos capas graves que ondulan
    const rumble = layer({ type: 'lowpass', freq: 110, q: 3, vol: 1 })
    layer({ type: 'lowpass', freq: 45, q: 1, vol: 1.3 })
    const wobble = ctx.createOscillator()
    wobble.frequency.value = 3.5
    const depth = ctx.createGain()
    depth.gain.value = 0.4
    wobble.connect(depth).connect(rumble.gain)
    wobble.start()
    nodes.push(wobble)
  } else if (hazard === 'fire') {
    // fuego: rugido grave + crepitar continuo + chasquidos al azar
    layer({ type: 'lowpass', freq: 380, q: 0.7, vol: 0.55 })
    layer({ type: 'bandpass', freq: 1400, q: 0.6, vol: 0.16 })
    const crackle = () => {
      for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++)
        noise({ dur: 0.03, vol: 0.12 + Math.random() * 0.12, type: 'bandpass', freq: 2000 + Math.random() * 2500, q: 3, delay: Math.random() * 0.08, dest: gain })
      p.timer = setTimeout(crackle, 60 + Math.random() * 180)
    }
    crackle()
  } else if (hazard === 'gas') {
    // fuga de gas: siseo agudo que va y viene
    const hiss = layer({ type: 'highpass', freq: 3500, vol: 0.3 })
    layer({ type: 'bandpass', freq: 6000, q: 2, vol: 0.08 })
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.6
    const depth = ctx.createGain()
    depth.gain.value = 0.12
    lfo.connect(depth).connect(hiss.gain)
    lfo.start()
    nodes.push(lfo)
  }
  preview = p
}

function previewSound(hazard) {
  if (ctx) startPreview(hazard)
}

/** El personaje salió de los sótanos: se apaga el retumbar y dejan de caer cosas. */
function endQuake() {
  stopDebris()
  if (!ctx) return
  try {
    quakeWobble?.stop(now() + 2.5)
  } catch {
    /* ya detenido */
  }
  quakeLayers.forEach((g) => g.gain.setTargetAtTime(0.0001, now(), 0.8))
}

/* ------------------------------------------------------------------ */
/* Silencio                                                            */
/* ------------------------------------------------------------------ */

function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* almacenamiento no disponible */
  }
  if (ctx) master.gain.setTargetAtTime(value ? 0 : 0.9, now(), 0.05)
  listeners.forEach((l) => l())
}

export const sound = {
  unlock,
  sfx,
  music,
  ambient,
  preview: previewSound,
  endQuake,
  setMuted,
  isMuted: () => muted,
  subscribe: (l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

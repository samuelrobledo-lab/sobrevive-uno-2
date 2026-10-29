# Sobrevive a la UAO

Experiencia web 3D (pixel art / low‑poly) sobre gestión del riesgo y evacuación en la Universidad Autónoma de Occidente.

- **Portada:** escena 3D continua del campus que se recorre con scroll (amanecer → mapa → comenzar) mientras el cielo pasa del amanecer a un día soleado.
- **Módulo 1 – Simulador 3D:** elige personaje y emergencia (Terremoto, Incendio o Fuga de gas); mueve al personaje libremente por los sótanos con **flechas / W A S D** (cruceta en pantallas táctiles) y responde las preguntas al llegar a cada aro de luz amarillo. Cada emergencia tiene su propia ruta por los dos sótanos (con fuego o gas que no se puede tocar) hasta salir afuera de labs. Error → secuencia caótica + reflexión + **Reintentar**.
- **Módulo 2 – Mapa 3D:** campus con pins interactivos; al hacer clic la cámara se enfoca (GSAP) y abre la ficha *¿Qué lugar es? / ¿Por qué es riesgoso? / ¿Cómo evacuar?*

## Ver en línea (GitHub Pages)

La carpeta `docs/` contiene la versión ya compilada de la app, lista para publicarse.

1. Sube esta carpeta a un repositorio de GitHub.
2. En el repositorio ve a **Settings → Pages**.
3. En *Build and deployment* elige **Source: Deploy from a branch**, rama **main** y carpeta **/docs**. Guarda.
4. En 1–2 minutos la app queda publicada en `https://<tu-usuario>.github.io/<nombre-del-repo>/`.

Si cambias el código, vuelve a generar `docs/` antes de subir:

```bash
npm run build:pages
```

## Ejecutar en local

Requiere [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install
npm run dev
```

## Stack

React 19 · Vite · @react-three/fiber + drei · Zustand · GSAP · Tailwind CSS v4

## Estructura

```
src/
├── App.jsx                     # Router por estado (home | character | select | simulator)
├── config.js                   # Resolución de render, tiempos, velocidad, rutas a modelos GLB
├── store/
│   ├── useGameStore.js         # Máquina de estados (phase, currentStep, landingSection…)
│   └── landingProgress.js      # Posición del scroll de la portada (compartida con la escena 3D)
├── data/                       # emergencies (guion), zones (pins), characters (sprites), campusLayout (suelo)
├── utils/                      # pixelTextures, sprites, playerInput (teclado / cruceta)
├── audio/                      # Sonidos (Web Audio API)
├── assets/                     # models/mapa-uao.fbx · textures/ladrillo.png, concreto.png · personajes
├── views/                      # Landing, Home, CampusStage, MapView, StartSection, CharacterSelect, EmergencySelect, SimulatorView
└── components/
    ├── ui/                     # primitives, SimulatorOverlays, InfoCard
    └── three/                  # UaoCampus, CampusGround, CampusWindows, CourtyardDetails, BasementScene, basementLayout,
                                # Avatar, CheckpointBeacon, CameraRig, HazardEffects, Hotspot, pixelSky…
```

## Integrar assets finales

| Asset | Dónde |
| --- | --- |
| Modelo de sótanos `.glb` | `public/models/` → `MODELS.basement` en `src/config.js` |
| Modelo del campus | `src/assets/models/mapa-uao.fbx` (ya integrado en `UaoCampus.jsx`; texturas en `src/assets/textures/`) |
| Zonas caminables y puntos de pregunta | `src/components/three/basementLayout.js` (`AREAS`, `CHECKPOINTS`, `SAFE_ZONE`) — ajustar a las coordenadas del GLB |
| Posición de pins | `src/data/zones.js` (`position`, `cameraOffset`) |
| Fotos/renders de zonas | `public/images/` → campo `image` de cada zona |
| Spritesheet del personaje | `src/components/three/Avatar.jsx` (ver comentario) |
| Logo oficial UAO | reemplazar `UaoMark` en `src/components/ui/primitives.jsx` |

Los GLB pasan por `ModelSlot`, que aplica `NearestFilter` a sus texturas y vuelve al placeholder si falla la carga.

> ⚠️ Los textos de decisiones y fichas son recomendaciones generales de gestión del riesgo: validarlos con la Brigada / SST de la UAO antes de publicar.

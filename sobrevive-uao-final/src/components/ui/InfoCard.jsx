import { ZONES, RISK_LABEL } from '../../data/zones'
import { useGameStore } from '../../store/useGameStore'
import { CampusVignette, GlassPanel, IconButton } from './primitives'
import ZoneScene from './ZoneScene'

const RISK_COLOR = { alto: 'bg-uao-red', medio: 'bg-signal-amber text-carbon-950', bajo: 'bg-signal-green text-carbon-950' }

/**
 * Ficha informativa "Lugar" (wireframe 03): imagen/render + ¿Qué lugar es? / ¿Por qué es riesgoso? / ¿Cómo evacuar?
 * Panel lateral en escritorio, bottom-sheet en móvil.
 */
export default function InfoCard() {
  const { selectedZone, selectZone } = useGameStore()
  const index = ZONES.findIndex((z) => z.id === selectedZone)
  if (index < 0) return null
  const zone = ZONES[index]
  const go = (d) => selectZone(ZONES[(index + d + ZONES.length) % ZONES.length].id)

  return (
    <GlassPanel
      as="aside"
      key={zone.id}
      aria-labelledby="zone-title"
      className="anim-rise absolute inset-x-3 bottom-3 z-20 flex max-h-[62dvh] flex-col sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-4 sm:max-h-none sm:w-[400px]"
    >
      <div className="flex-1 overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-pixel text-[0.55rem] text-white/70 uppercase">Lugar</p>
            <h2 id="zone-title" className="mt-2 text-3xl leading-none font-bold">
              {zone.name}
            </h2>
          </div>
          <span className={`pixel-corners shrink-0 px-2 py-1.5 font-pixel text-[0.5rem] uppercase ${RISK_COLOR[zone.risk]}`}>
            {RISK_LABEL[zone.risk]}
          </span>
        </div>

        {/* Imagen / render 3D del lugar (placeholder pixel hasta tener el asset final) */}
        <figure className="pixel-corners mt-4 aspect-[4/3] overflow-hidden bg-carbon-800">
          {zone.scene ? (
            <ZoneScene name={zone.scene} label={`Vista 3D: ${zone.name}`} />
          ) : zone.image ? (
            <img src={zone.image} alt={`Render del ${zone.name}`} className="size-full object-cover" />
          ) : (
            <CampusVignette variant="base" className="size-full" />
          )}
        </figure>

        <section className="mt-5 space-y-4 text-[1.02rem] leading-snug">
          {zone.whatIs && (
            <div>
              <h3 className="font-pixel text-[0.6rem] text-signal-amber uppercase">¿Qué lugar es?</h3>
              <p className="mt-1.5 text-white/90">{zone.whatIs}</p>
            </div>
          )}
          <div>
            <h3 className="font-pixel text-[0.6rem] text-signal-amber uppercase">¿Por qué es riesgoso?</h3>
            <p className="mt-1.5 text-white/90">{zone.whyRisky}</p>
          </div>
          <div>
            <h3 className="font-pixel text-[0.6rem] text-signal-amber uppercase">¿Cómo evacuar?</h3>
            <ol className="mt-2 space-y-2">
              {zone.howToEvacuate.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="pixel-corners grid size-6 shrink-0 place-items-center bg-uao-red font-pixel text-[0.55rem]">
                    {i + 1}
                  </span>
                  <span className="text-white/90">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      <nav className="flex items-center justify-center gap-3 border-t border-white/15 p-3" aria-label="Navegación de zonas">
        <IconButton icon="back" label="Zona anterior" onClick={() => go(-1)} />
        <IconButton icon="close" label="Cerrar ficha" onClick={() => selectZone(null)} />
        <IconButton icon="next" label="Zona siguiente" onClick={() => go(1)} />
        {/* Casa: vuelve a la vista general del mapa (cierra la ficha y la cámara regresa a la vista aérea) */}
        <IconButton icon="home" label="Volver al mapa" onClick={() => selectZone(null)} />
      </nav>
    </GlassPanel>
  )
}

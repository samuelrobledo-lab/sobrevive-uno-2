import { useGameStore } from '../store/useGameStore'
import { CHARACTERS } from '../data/characters'
import { CharacterSprite, GlassPanel, PixelButton, ScrollHint, SoundToggle } from '../components/ui/primitives'

/**
 * Sección 2 de la portada: invitación a iniciar la experiencia
 * (luego: elegir personaje → elegir emergencia → simulación).
 */
/** @param onNext  pasar a la siguiente sección (el mapa 3D) */
export default function StartSection({ onNext }) {
  const goTo = useGameStore((s) => s.goTo)
  return (
    <section className="relative z-10 grid h-full place-items-center p-4">
      <SoundToggle className="absolute top-4 right-4 z-20" />
      <GlassPanel className="anim-pop flex w-full max-w-lg flex-col items-center px-6 py-8 text-center sm:px-10">
        <div className="flex items-end gap-3">
          {CHARACTERS.map((c) => (
            <CharacterSprite key={c.id} character={c} anim="jump" scale={3} />
          ))}
        </div>
        <h2 className="mt-5 font-pixel text-lg leading-relaxed sm:text-2xl">¿Listo para sobrevivir?</h2>
        <p className="mt-3 text-lg leading-snug text-white/90">
          Elige tu personaje, enfrenta una emergencia en los sótanos y toma las decisiones correctas para llegar al punto de
          encuentro.
        </p>
        <PixelButton className="mt-7 !px-8 !py-4 !text-[0.8rem]" onClick={() => goTo('character')}>
          Iniciar la experiencia
        </PixelButton>
      </GlassPanel>
      {/* Después de la experiencia viene el mapa 3D */}
      <ScrollHint label="Sigue bajando para ver el mapa 3D" onClick={onNext} />
    </section>
  )
}

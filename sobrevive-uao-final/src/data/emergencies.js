/**
 * Guion del Módulo 1. Cada emergencia tiene sus decisiones (momentos distintos del recorrido).
 *
 * Recorrido (opcional, si no se usan CHECKPOINTS / START / SAFE_ZONE de basementLayout.js):
 *   route.start  → lugar de inicio (clave de SPOTS); route.lying → empieza acostado y se despierta con la alarma;
 *                  route.calm → empieza caminando tranquilo y luego empieza a temblar (terremoto);
 *                  route.seated → empieza sentado estudiando en una mesita (fuga de gas)
 *   route.goal   → lugar final (clave de SPOTS) al que se llega después de la última decisión
 * Decisión:
 *   at           → 'start' (sale al despertar) o lista de lugares (claves de SPOTS): sale al llegar a cualquiera
 *                  (sin `at` se usa CHECKPOINTS[paso])
 *   label        → número que se muestra (p. ej. '3.2'); branch → pregunta de una rama (no cuenta en el progreso)
 *   variants     → ids de otras preguntas que pueden salir en su lugar según a dónde llegue (cada una con su `at`)
 *   transition   → al llegar, pantalla a negro y el personaje aparece en ese lugar (clave de SPOTS) antes de la pregunta
 * Opción (además):
 *   next         → id de la decisión que sigue (para las ramas; sin `next` sigue la siguiente de la lista)
 *   risky        → no es el camino seguro aunque la historia sigue: cuenta como error, sin reflexión
 *
 * Opción:
 *   correct      → true/false
 *   failTarget   → lugar opcional (clave de SPOTS en basementLayout.js, o lista: el más cercano) hacia donde corre el
 *                  avatar en la secuencia caótica
 *                  (si es null, el avatar entra en pánico dando vueltas en su sitio)
 *   chaosLine    → texto grande del overlay caótico
 *   feedback     → tarjeta reflexiva "Te equivocaste por…": qué pasó, qué aprendiste, cómo evitarlo
 *                  (o { reflection } con un solo texto de reflexión)
 *
 * ⚠️ Los textos son recomendaciones generales de gestión del riesgo.
 *    Validarlos con la Brigada de Emergencias / Seguridad y Salud en el Trabajo de la UAO.
 *
 * Los lugares (failTarget, route, at) están en SPOTS (basementLayout.js).
 */

export const EMERGENCIES = {
  terremoto: {
    id: 'terremoto',
    name: 'Terremoto / temblor',
    hazard: 'quake',
    accent: '#f0b44a',
    story: {
      title: 'Historia',
      lines: [
        'Son las 10:00 a.m. Vas caminando tranquilo por un pasillo del Sótano 2, cerca de los estudios.',
        'De repente el piso empieza a moverse.',
        'Tu misión: salir de los sótanos sano y salvo.',
      ],
    },
    // Empieza caminando tranquilo por un pasillo; al empezar a temblar sale la 1.ª pregunta, la 2.ª frente a
    // cualquiera de los ascensores (desde ahí empiezan a caer cosas), la 3.ª al llegar al corredor este o a la entrada
    // del pasillo de la rampa, la 4.ª al
    // llegar al Sótano 1 (una si sube por las escaleras y otra si sube por la rampa) y la 5.ª afuera de labs.
    route: { start: 'corridorS2', calm: true, goal: null },
    decisions: [
      {
        id: 'q1',
        at: 'start',
        moment: 'Empieza a temblar',
        prompt: 'Empieza a temblar, ¿Qué haces?',
        options: [
          {
            id: 'shelter',
            label: '¿Buscas dónde resguardarte?',
            correct: false,
            failTarget: null,
            chaosLine: '¡Se estallan los vidrios y te caen cosas encima!',
            feedback: {
              reflection:
                'No estás capando clase. Resguardarte en un espacio con muchos vidrios y estrecho es exponerte a salir lastimadx.',
            },
          },
          {
            id: 'exit',
            label: '¿Sigues el camino a la salida?',
            correct: true,
            successLine: '¡Bien! Sigue hacia la salida.',
          },
        ],
      },
      {
        id: 'q2',
        at: ['elevatorFrontNorthS2', 'elevatorFrontSouthS2'],
        moment: 'El ascensor',
        prompt: 'Estás caminando y piensas que puede ser buena idea subir por el ascensor.',
        options: [
          {
            id: 'exit',
            label: 'Sigues a la salida',
            correct: true,
            successLine: '¡Eso es! Sigue hacia la salida… ¡cuidado, empiezan a caer cosas!',
          },
          {
            id: 'elevator',
            label: 'Te subes en él, vas con afán',
            correct: false,
            failTarget: ['elevatorS2', 'elevatorS2South'], // corre al ascensor más cercano
            chaosLine: '¡El ascensor se descolgó!',
            feedback: {
              reflection:
                'No estás compitiendo por el último mio. Usar el ascensor en medio de un sismo es peligroso ya que se puede descolgar y puedes resultar lastimadx.',
            },
          },
        ],
      },
      {
        id: 'q3',
        at: ['crossNorthEastS2', 'crossSouthEastS2', 'rampWingS2'],
        moment: 'Tu casi algo',
        prompt: 'Recuerdas que ibas a verte con tu casi algo y no sabes nada de él.',
        options: [
          {
            id: 'protocol',
            label: 'Sigues con el protocolo de evacuación y esperas verlo en la salida.',
            correct: true,
            successLine: '¡Bien! Sube al Sótano 1 por una escalera o la rampa.',
          },
          {
            id: 'search',
            label: 'Vas a buscarlo y esperarlo, es el amor de tu vida.',
            correct: false,
            failTarget: null,
            chaosLine: '¡Empieza una estampida!',
            feedback: {
              reflection:
                'El reencuentro puede esperar. Quedarte en estos espacios por donde todxs evacuan puede interrumpir el flujo de la evacuación. Aparte te puedes exponer a estampidas o derrumbes.',
            },
          },
        ],
      },
      {
        id: 'q4s',
        // si sube por la rampa sale en cambio la otra pregunta 4 (q4r)
        at: ['stairsNorthTopS1', 'stairsSouthTopS1'],
        variants: ['q4r'],
        moment: 'Arriba de las escaleras',
        prompt: 'Sigue temblando y ves a algunos estudiantes corriendo. ¿Qué haces?',
        options: [
          {
            id: 'calm',
            label: 'Me mantengo calmadx y protegiéndome del pánico colectivo',
            correct: true,
            next: 'q5',
            successLine: '¡Bien! Ve hacia la salida de los sótanos.',
          },
          {
            id: 'follow',
            label: 'Los sigo, si todos corren por algo será.',
            correct: false,
            failTarget: null,
            chaosLine: '¡Te arrastra la estampida!',
            feedback: {
              reflection:
                'La estampida no es una estrategia de evacuación. No sigas multitudes sin pensar cómo y a dónde van, tratar de estar calmadxs ayuda a mantenerte a salvo.',
            },
          },
        ],
      },
      {
        id: 'q4r',
        label: '4', // la pregunta 4 de quien sube por la rampa
        branch: true,
        at: ['rampTopS1'],
        moment: 'Arriba de la rampa',
        prompt: 'Sigue temblando y se te resbala el celular de las manos.',
        options: [
          {
            id: 'phone',
            label: 'Me agacho a recogerlo, no voy a perder mi iPhone por un temblor.',
            correct: false,
            failTarget: null,
            chaosLine: '¡Te cayó un pedazo de techo encima!',
            feedback: {
              reflection:
                'El iPhone no viene con vida extra, no te expongas por salvar objetos. Mientras el movimiento continúa mantén la calma y sigue las indicaciones.',
            },
          },
          {
            id: 'leave',
            label: 'Lo dejo allí, me mantengo protegidx y sigo evacuando',
            correct: true,
            next: 'q5',
            successLine: '¡Bien! Ve hacia la salida de los sótanos.',
          },
        ],
      },
      {
        id: 'q5',
        // al llegar a la salida la pantalla se va a negro y el personaje aparece afuera de labs
        at: ['exitS1'],
        transition: 'outsideLabs',
        moment: 'Afuera',
        prompt: 'Saliste de sótanos y ya estás a salvo.',
        options: [
          {
            id: 'videos',
            label: 'Te quedas cerca de la salida grabando videos.',
            correct: false,
            failTarget: null,
            chaosLine: '¡Se desprende parte de la fachada!',
            feedback: {
              reflection:
                'Quedarse cerca de los edificios te vuelve vulnerable a que se puedan derrumbar sobre ti. Busca el punto de encuentro o lugares abiertos antes de hacer cualquier otra cosa.',
            },
          },
          {
            id: 'meet',
            label: 'Te vas al punto de encuentro.',
            correct: true,
            successLine: '¡Directo al punto de encuentro!',
          },
        ],
      },
    ],
  },

  incendio: {
    id: 'incendio',
    name: 'Incendio',
    hazard: 'fire',
    accent: '#ff6a1a',
    story: {
      title: 'Historia',
      lines: [
        'Son las 10:00 a.m. Estás descansando en los muebles del Sótano 2, junto al ascensor.',
        'De repente una alarma rompe el silencio y empieza a oler a quemado.',
        'Tu misión: salir de los sótanos sano y salvo.',
      ],
    },
    // Empieza acostado en los muebles; la 1.ª pregunta sale al despertar, la 2.ª en cualquier salida del Sótano 2,
    // la 3.ª al llegar al Sótano 1 (si va a las mesas sale la 3.2) y la 4.ª en la salida de los sótanos.
    // Al responder bien la última se gana (sin meta: `goal: null`). En los dos sótanos hay fuego: tocarlo quema (FIRES).
    route: { start: 'furnitureS2', lying: true, goal: null },
    decisions: [
      {
        id: 'f1',
        at: 'start',
        moment: 'Suena la alarma',
        prompt: '¿Estás en los muebles cerca del ascensor y suena la alarma?',
        options: [
          {
            id: 'elevator',
            label: 'Te subes al ascensor, para eso pagas matrícula.',
            correct: false,
            failTarget: 'elevatorS2South',
            chaosLine: '¡El ascensor se llenó de humo!',
            feedback: {
              reflection:
                'La matrícula no incluye evacuación VIP. Durante un incendio el ascensor puede fallar o exponerte al humo, utiliza la salida más cercana que tengas.',
            },
          },
          {
            id: 'exit',
            label: 'Buscas la salida más cerca para salir de labs 2.',
            correct: true,
            successLine: '¡Bien! Busca la salida más cercana: una escalera o la rampa.',
          },
        ],
      },
      {
        id: 'f2',
        at: ['rampS2', 'stairsNorthS2', 'stairsSouthS2'],
        moment: 'La salida más cercana',
        prompt: 'Llegas a la salida más cercana, te das cuenta que dejaste tu vape en los muebles ¿Qué haces?',
        options: [
          {
            id: 'protocol',
            label: 'Sigues con el protocolo de evacuación.',
            correct: true,
            successLine: '¡Eso es! Sube al Sótano 1.',
          },
          {
            id: 'vape',
            label: 'Te devuelves, costó mucho dinero no vale la pena perder otro.',
            correct: false,
            failTarget: 'furnitureS2',
            chaosLine: '¡Volviste al humo por el vape!',
            feedback: {
              reflection:
                '¡El vape no tiene una misión secundaria! Regresar por objetos personales puede exponerte al fuego y al humo, continúa el camino seguro o el indicado por los rescatistas.',
            },
          },
        ],
      },
      {
        id: 'f3',
        at: ['rampTopS1', 'stairsNorthTopS1', 'stairsSouthTopS1'],
        moment: 'Sótano 1',
        prompt:
          'Llegas al primer piso y te acuerdas que tu amix está en las mesas de labs 1, piensas en ir hasta allá ¿lo harías?',
        options: [
          {
            id: 'friend',
            label: 'Sí, crees que hay tiempo',
            // no es el camino seguro, pero no termina ahí: lleva a las mesas (pregunta 3.2) y cuenta como error
            correct: true,
            risky: true,
            next: 'f3b',
            successLine: 'Vas a las mesas del Sótano 1 a buscar a tu amix… ¡cuidado con el fuego!',
          },
          {
            id: 'keepGoing',
            label: 'No, decide seguir evacuando',
            correct: true,
            next: 'f4',
            successLine: '¡Bien! Sigue hacia la salida de los sótanos.',
          },
        ],
      },
      {
        id: 'f3b',
        label: '3.2', // solo si fue a las mesas
        branch: true,
        at: ['tablesS1'],
        moment: 'Las mesas',
        prompt: 'No ves a tu amix ¿evacuas o esperas a verle?',
        options: [
          {
            id: 'wait',
            label: 'Esperas a verle, es más importante que ponerte a salvo.',
            correct: false,
            failTarget: null,
            chaosLine: '¡El fuego y el humo te rodean!',
            feedback: {
              reflection:
                '¡No eres mal amigo!, es importante preocuparse por los tuyos, pero es primordial ponerte a ti a salvo, devolverte puede ponerte en riesgo por posible contacto con el fuego o humo.',
            },
          },
          {
            id: 'trust',
            label: 'Decide confiar en que tu amix se puso a salvo y evacuas.',
            correct: true,
            next: 'f4',
            successLine: '¡Bien! Ve hacia la salida de los sótanos.',
          },
        ],
      },
      {
        id: 'f4',
        at: ['exitS1'],
        moment: 'La salida',
        prompt: 'Te acercas a la salida de sótanos pero sigues esperando a ver a tu amix.',
        options: [
          {
            id: 'stay',
            label: 'Decides quedarte en la salida por si le ves',
            correct: false,
            failTarget: null,
            chaosLine: '¡La gente se amontona en la salida!',
            feedback: {
              reflection:
                'Quedarte en la salida puede ocasionar que pongas a otras personas en riesgo por obstaculizar o ponerte en riesgo por una posible estampida o explosión.',
            },
          },
          {
            id: 'meet',
            label: 'Decides irte al punto de encuentro',
            correct: true,
            successLine: '¡Directo al punto de encuentro!',
          },
        ],
      },
    ],
  },

  gas: {
    id: 'gas',
    name: 'Fuga de gas',
    hazard: 'gas',
    accent: '#7be35a',
    story: {
      title: 'Historia',
      lines: [
        'Son las 10:00 a.m. Estás estudiando en una mesita del Sótano 2.',
        'De repente empieza a oler algo raro, muy fuerte.',
        'Tu misión: salir de los sótanos sano y salvo.',
      ],
    },
    // Empieza sentado estudiando en una mesita; al oler el gas sale la 1.ª pregunta, la 2.ª en cualquier salida del
    // Sótano 2, la 3.ª al llegar al Sótano 1 y la 4.ª afuera de labs (transición a negro). El gas mata: tocarlo ahoga (GAS).
    route: { start: 'studyS2', seated: true, goal: null },
    decisions: [
      {
        id: 'g1',
        at: 'start',
        moment: 'Huele a gas',
        prompt: 'Empiezas a oler algo muy fuerte y escuchas la alarma de emergencias.',
        options: [
          {
            id: 'investigate',
            label: 'Te vas a investigar de dónde viene el olor',
            correct: false,
            failTarget: null,
            chaosLine: '¡El gas te marea!',
            feedback: {
              reflection:
                '¡No es momento para ser curiosx! Si escuchas una alarma y hueles algo fuera de lo común evacua cuanto antes puedas.',
            },
          },
          {
            id: 'evacuate',
            label: 'Evacuas, buscando la salida más cerca',
            correct: true,
            successLine: '¡Bien! Busca la salida más cercana… ¡no toques el gas!',
          },
        ],
      },
      {
        id: 'g2',
        at: ['rampWingS2', 'stairsNorthS2', 'stairsSouthS2'],
        moment: 'Todos corren',
        prompt: 'Vas a evacuar y hay muchas personas, todas empiezan a correr ¿las sigues?',
        options: [
          {
            id: 'calm',
            label: 'No, sigues los protocolos calmadx',
            correct: true,
            successLine: '¡Eso es! Sube al Sótano 1.',
          },
          {
            id: 'run',
            label: 'Sí, si todos corren es por algo',
            correct: false,
            failTarget: null,
            chaosLine: '¡Empujones en las escaleras!',
            feedback: {
              reflection:
                'No debes de seguir lo que hacen todos. Aparte estás en unas escaleras, tantas personas corriendo puede ser peligroso.',
            },
          },
        ],
      },
      {
        id: 'g3',
        at: ['rampTopS1', 'stairsNorthTopS1', 'stairsSouthTopS1'],
        moment: 'Sótano 1',
        prompt: 'Subes a sótanos 1, pero el recorrido de evacuación continúa.',
        options: [
          {
            id: 'route',
            label: 'Continúo por la ruta indicada',
            correct: true,
            successLine: '¡Bien! Ve hacia la salida de los sótanos.',
          },
          {
            id: 'friends',
            label: 'Te detienes a esperar a tus amigos para salir juntos',
            correct: false,
            failTarget: null,
            chaosLine: '¡El gas se acerca!',
            feedback: {
              reflection:
                'Esto no es una salida grupal a comer juntos. Detenerse puede retrasar la evacuación y exponerse a alguna explosión.',
            },
          },
        ],
      },
      {
        id: 'g4',
        // al llegar a la salida la pantalla se va a negro y el personaje aparece afuera de labs
        at: ['exitS1'],
        transition: 'outsideLabs',
        moment: 'Afuera',
        prompt: 'Ya estás afuera pero dejaste tu hoja de apuntes.',
        options: [
          {
            id: 'notes',
            label: 'Regresas por ella, la necesitas para repasar, igual es un simple gas',
            correct: false,
            failTarget: 'exitS1', // vuelve corriendo hacia la salida
            chaosLine: '¡Volviste a entrar al gas!',
            feedback: {
              reflection:
                'Ningún objeto personal justifica poner en riesgo tu vida reingresando a un edificio en peligro. Las fugas de gas son altamente inflamables e impredecibles, por lo que nunca debes minimizar el riesgo.',
            },
          },
          {
            id: 'wait',
            label: 'Te quedas afuera hasta que indiquen que se puede entrar',
            correct: true,
            successLine: '¡Así se hace!',
          },
        ],
      },
    ],
  },
}

/** Orden de las tarjetas en la pantalla de selección (según wireframe). */
export const EMERGENCY_ORDER = ['terremoto', 'incendio', 'gas']

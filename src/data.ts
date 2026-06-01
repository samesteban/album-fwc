/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Section, Card, CollectionState, CollectionStats } from './types';

// Metadatos oficiales de las secciones en el orden exacto especificado
export const SECTIONS_METADATA: { id: string; name: string; type: 'team' | 'special'; flag: string }[] = [
  // Especiales primero o países primero. Consistente con el orden del álbum.
  // El usuario dice: "en el orden exacto del álbum (MEX, RSA... PAN) además de las secciones FWC e Iniciales/Coca-Cola."
  { id: "MEX", name: "México", type: "team", flag: "🇲🇽" },
  { id: "RSA", name: "Sudáfrica", type: "team", flag: "🇿🇦" },
  { id: "KOR", name: "Corea del Sur", type: "team", flag: "🇰🇷" },
  { id: "CZE", name: "República Checa", type: "team", flag: "🇨🇿" },
  { id: "CAN", name: "Canadá", type: "team", flag: "🇨🇦" },
  { id: "BIH", name: "Bosnia y Herzegovina", type: "team", flag: "🇧🇦" },
  { id: "QAT", name: "Catar", type: "team", flag: "🇶🇦" },
  { id: "SUI", name: "Suiza", type: "team", flag: "🇨🇭" },
  { id: "BRA", name: "Brasil", type: "team", flag: "🇧🇷" },
  { id: "MAR", name: "Marruecos", type: "team", flag: "🇲🇦" },
  { id: "HAI", name: "Haití", type: "team", flag: "🇭🇹" },
  { id: "SCO", name: "Escocia", type: "team", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { id: "USA", name: "Estados Unidos", type: "team", flag: "🇺🇸" },
  { id: "PAR", name: "Paraguay", type: "team", flag: "🇵🇾" },
  { id: "AUS", name: "Australia", type: "team", flag: "🇦🇺" },
  { id: "TUR", name: "Turquía", type: "team", flag: "🇹🇷" },
  { id: "GER", name: "Alemania", type: "team", flag: "🇩🇪" },
  { id: "CUW", name: "Curazao", type: "team", flag: "🇨🇼" },
  { id: "CIV", name: "Costa de Marfil", type: "team", flag: "🇨🇮" },
  { id: "ECU", name: "Ecuador", type: "team", flag: "🇪🇨" },
  { id: "NED", name: "Países Bajos", type: "team", flag: "🇳🇱" },
  { id: "JPN", name: "Japón", type: "team", flag: "🇯🇵" },
  { id: "SWE", name: "Suecia", type: "team", flag: "🇸🇪" },
  { id: "TUN", name: "Túnez", type: "team", flag: "🇹🇳" },
  { id: "BEL", name: "Bélgica", type: "team", flag: "🇧🇪" },
  { id: "EGY", name: "Egipto", type: "team", flag: "🇪🇬" },
  { id: "IRN", name: "Irán", type: "team", flag: "🇮🇷" },
  { id: "NZL", name: "Nueva Zelanda", type: "team", flag: "🇳🇿" },
  { id: "ESP", name: "España", type: "team", flag: "🇪🇸" },
  { id: "CPV", name: "Cabo Verde", type: "team", flag: "🇨🇻" },
  { id: "KSA", name: "Arabia Saudita", type: "team", flag: "🇸🇦" },
  { id: "URU", name: "Uruguay", type: "team", flag: "🇺🇾" },
  { id: "FRA", name: "Francia", type: "team", flag: "🇫🇷" },
  { id: "SEN", name: "Senegal", type: "team", flag: "🇸🇳" },
  { id: "IRQ", name: "Irak", type: "team", flag: "🇮🇶" },
  { id: "NOR", name: "Noruega", type: "team", flag: "🇳🇴" },
  { id: "ARG", name: "Argentina", type: "team", flag: "🇦🇷" },
  { id: "ALG", name: "Argelia", type: "team", flag: "🇩🇿" },
  { id: "AUT", name: "Austria", type: "team", flag: "🇦🇹" },
  { id: "JOR", name: "Jordania", type: "team", flag: "🇯🇴" },
  { id: "PORT", name: "Portugal", type: "team", flag: "🇵🇹" },
  { id: "COD", name: "R. D. Congo", type: "team", flag: "🇨🇩" },
  { id: "UZB", name: "Uzbekistán", type: "team", flag: "🇺🇿" },
  { id: "COL", name: "Colombia", type: "team", flag: "🇨🇴" },
  { id: "ENG", name: "Inglaterra", type: "team", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "CRO", name: "Croacia", type: "team", flag: "🇭🇷" },
  { id: "GHA", name: "Ghana", type: "team", flag: "🇬🇭" },
  { id: "PAN", name: "Panamá", type: "team", flag: "🇵🇦" },
  { id: "FWC", name: "Especiales FWC", type: "special", flag: "🏆" },
  { id: "CC", name: "Iniciales / Coca-Cola", type: "special", flag: "🥤" }
];

// Genera el nombre de la lámina según el patrón de nombres especificado:
// La número 1 es "Escudo", la número 13 es "Selección", y todas las demás (2-12 y 14-20) son simplemente "Jugador".
function generatePlayerName(countryCode: string, inputNum: number): string {
  if (inputNum === 1) {
    return "Escudo";
  }
  if (inputNum === 13) {
    return "Selección";
  }
  return "Jugador";
}

// Inicializa las secciones completas del álbum vacío
export function buildInitialSections(): Section[] {
  return SECTIONS_METADATA.map(meta => {
    const cards: Card[] = [];

    if (meta.type === 'team') {
      // 20 láminas por selección (del 1 al 20)
      for (let i = 1; i <= 20; i++) {
        cards.push({
          id: `${meta.id}_${i}`,
          sectionId: meta.id,
          num: String(i),
          playerName: generatePlayerName(meta.id, i),
          count: 0
        });
      }
    } else if (meta.id === 'FWC') {
      // Especiales FWC: 00 y del 1 al 19
      cards.push({
        id: "FWC_00",
        sectionId: "FWC",
        num: "00",
        count: 0
      });
      for (let i = 1; i <= 19; i++) {
        cards.push({
          id: `FWC_${i}`,
          sectionId: "FWC",
          num: String(i),
          count: 0
        });
      }
    } else if (meta.id === 'CC') {
      // Coca-Cola: del 1 al 14
      for (let i = 1; i <= 14; i++) {
        cards.push({
          id: `CC_${i}`,
          sectionId: "CC",
          num: String(i),
          count: 0
        });
      }
    }

    return {
      id: meta.id,
      name: meta.name,
      type: meta.type,
      flag: meta.flag,
      cards
    };
  });
}

const LOCAL_STORAGE_KEY = 'album_mundial_48_collection_state_v1';

// Carga el estado guardado en LocalStorage
export function loadCollectionState(): CollectionState {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("Error al cargar localStorage, se usará estado vacío", error);
  }
  return {};
}

// Guarda de forma segura el estado en LocalStorage
export function saveCollectionState(state: CollectionState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error al guardar en localStorage", error);
  }
}

// Genera estadísticas consolidadas del álbum
export function calculateStats(sections: Section[], currentState: CollectionState): CollectionStats {
  let totalCards = 0;
  let uniquesPasted = 0;
  let repeatedCount = 0;

  sections.forEach(section => {
    section.cards.forEach(card => {
      totalCards++;
      const count = currentState[card.id] || 0;
      if (count >= 1) {
        uniquesPasted++;
      }
      if (count >= 2) {
        repeatedCount += (count - 1); // El primero está pegado, los demás se consideran copias repetidas
      }
    });
  });

  const missingCount = totalCards - uniquesPasted;
  const completionPercentage = totalCards > 0 ? parseFloat(((uniquesPasted / totalCards) * 100).toFixed(1)) : 0;

  return {
    totalCards,
    uniquesPasted,
    missingCount,
    repeatedCount,
    completionPercentage
  };
}

// Estructura de cartas repetidas ordenadas para el Top 10
export interface RepeatedCardItem {
  id: string;
  sectionId: string;
  num: string;
  playerName?: string;
  count: number;
  repeatedAmount: number; // count - 1
  flag?: string;
}

export function getTopRepeatedCards(sections: Section[], currentState: CollectionState, limit: number = 10): RepeatedCardItem[] {
  const repeatedList: RepeatedCardItem[] = [];

  sections.forEach(section => {
    section.cards.forEach(card => {
      const count = currentState[card.id] || 0;
      if (count >= 2) {
        repeatedList.push({
          id: card.id,
          sectionId: card.sectionId,
          num: card.num,
          playerName: card.playerName,
          count,
          repeatedAmount: count - 1,
          flag: section.flag
        });
      }
    });
  });

  // Ordenar de mayor a menor cantidad de repetidas (repeatedAmount DESC)
  return repeatedList
    .sort((a, b) => b.repeatedAmount - a.repeatedAmount)
    .slice(0, limit);
}

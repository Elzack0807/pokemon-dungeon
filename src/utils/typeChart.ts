import { PokemonType } from '../types/pokemon';

export const TYPE_COLORS: Record<PokemonType, { bg: string; text: string; border: string }> = {
  Normal: { bg: '#A8A878', text: '#FFFFFF', border: '#8A8A59' },
  Fire: { bg: '#F08030', text: '#FFFFFF', border: '#DD6610' },
  Water: { bg: '#6890F0', text: '#FFFFFF', border: '#386CEB' },
  Grass: { bg: '#78C850', text: '#FFFFFF', border: '#5CA935' },
  Electric: { bg: '#F8D030', text: '#1E293B', border: '#E0B515' },
  Ice: { bg: '#98D8D8', text: '#0F172A', border: '#69C6C6' },
  Fighting: { bg: '#C03028', text: '#FFFFFF', border: '#99241D' },
  Poison: { bg: '#A040A0', text: '#FFFFFF', border: '#802680' },
  Ground: { bg: '#E0C068', text: '#1E293B', border: '#CCA142' },
  Flying: { bg: '#A890F0', text: '#FFFFFF', border: '#8262EA' },
  Psychic: { bg: '#F85888', text: '#FFFFFF', border: '#F62764' },
  Bug: { bg: '#A8B820', text: '#FFFFFF', border: '#879416' },
  Rock: { bg: '#B8A038', text: '#FFFFFF', border: '#938024' },
  Ghost: { bg: '#705898', text: '#FFFFFF', border: '#553F77' },
  Dragon: { bg: '#7038F8', text: '#FFFFFF', border: '#4C0EE3' },
  Steel: { bg: '#B8B8D0', text: '#1E293B', border: '#9797BA' },
  Dark: { bg: '#705848', text: '#FFFFFF', border: '#513F34' },
  Fairy: { bg: '#EE99AC', text: '#1E293B', border: '#E76B85' },
};

export const TYPE_NAMES_ZH: Record<PokemonType, string> = {
  Normal: '一般',
  Fire: '火',
  Water: '水',
  Grass: '草',
  Electric: '電',
  Ice: '冰',
  Fighting: '格鬥',
  Poison: '毒',
  Ground: '地面',
  Flying: '飛行',
  Psychic: '超能力',
  Bug: '蟲',
  Rock: '岩石',
  Ghost: '幽靈',
  Dragon: '龍',
  Steel: '鋼',
  Dark: '惡',
  Fairy: '妖精',
};

// Attacker Type -> Defender Type -> Multiplier
const TYPE_CHART: Partial<Record<PokemonType, Partial<Record<PokemonType, number>>>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Electric: { Water: 2, Grass: 0.5, Electric: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Grass: 0.5, Electric: 2, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Grass: 2, Electric: 0.5, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

export function getTypeEffectiveness(attackType: PokemonType, defenderTypes: PokemonType[]): number {
  let multiplier = 1;
  const attackMap = TYPE_CHART[attackType] || {};
  for (const defType of defenderTypes) {
    if (defType in attackMap) {
      multiplier *= attackMap[defType]!;
    }
  }
  return multiplier;
}

export function getEffectivenessMessage(multiplier: number): { textZh: string; color: string; badge: string; bg: string } {
  if (multiplier >= 4) {
    return {
      textZh: '效果極佳！(4.0x)',
      color: 'text-emerald-400 font-bold',
      badge: '💥 x4.0 效果極佳',
      bg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    };
  } else if (multiplier >= 2) {
    return {
      textZh: '效果絕佳！(2.0x)',
      color: 'text-amber-400 font-bold',
      badge: '⚡ x2.0 效果絕佳',
      bg: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    };
  } else if (multiplier === 0) {
    return {
      textZh: '沒有任何效果...',
      color: 'text-slate-500',
      badge: '🛡️ x0 無效',
      bg: 'bg-slate-800 text-slate-500 border border-slate-700',
    };
  } else if (multiplier < 1) {
    return {
      textZh: '效果不太顯著...',
      color: 'text-slate-400',
      badge: `🔻 x${multiplier} 效果不理想`,
      bg: 'bg-rose-950/40 text-rose-300 border border-rose-500/30',
    };
  }
  return {
    textZh: '',
    color: 'text-slate-200',
    badge: 'x1.0 普通',
    bg: 'bg-slate-800 text-slate-400 border border-slate-700/50',
  };
}

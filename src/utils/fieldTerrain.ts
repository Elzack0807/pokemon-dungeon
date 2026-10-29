import { PokemonType } from '../types/pokemon';

export type FieldTerrainType =
  | 'none'
  | 'fire_cave'
  | 'water_lake'
  | 'grassy_meadow'
  | 'electric_storm'
  | 'sandstorm_ruin'
  | 'psychic_abyss'
  | 'ice_tundra';

export interface FieldTerrainData {
  id: FieldTerrainType;
  nameZh: string;
  badge: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  descriptionZh: string;
  boostedTypes: PokemonType[];
  nerfedTypes: PokemonType[];
  ambientColor: number;
  fogColor: number;
  particleColor: number;
  effectSummary: string;
}

export const FIELD_TERRAINS: Record<FieldTerrainType, FieldTerrainData> = {
  none: {
    id: 'none',
    nameZh: '常規古老地牢',
    badge: '🌌 中立領域',
    badgeBg: 'rgba(30, 41, 59, 0.8)',
    badgeBorder: '#475569',
    textColor: '#94a3b8',
    descriptionZh: '無特殊場地異常，所有屬性發揮正常威力。',
    boostedTypes: [],
    nerfedTypes: [],
    ambientColor: 0x222d42,
    fogColor: 0x0a0e17,
    particleColor: 0xffd27d,
    effectSummary: '常規無增減傷',
  },
  fire_cave: {
    id: 'fire_cave',
    nameZh: '熔岩熾熱窟',
    badge: '🔥 熔岩炎窟',
    badgeBg: 'rgba(153, 27, 27, 0.8)',
    badgeBorder: '#ef4444',
    textColor: '#fca5a5',
    descriptionZh: '滾燙岩漿散發逼人高溫！火屬性招式威力提升 30%，水屬性招式威力降低 20%。',
    boostedTypes: ['Fire'],
    nerfedTypes: ['Water'],
    ambientColor: 0x3d1814,
    fogColor: 0x1a0808,
    particleColor: 0xff4500,
    effectSummary: '火屬性 +30% · 水屬性 -20%',
  },
  water_lake: {
    id: 'water_lake',
    nameZh: '潮汐地下湖',
    badge: '💧 潮汐水窟',
    badgeBg: 'rgba(30, 58, 138, 0.8)',
    badgeBorder: '#38bdf8',
    textColor: '#bae6fd',
    descriptionZh: '地下湧泉水氣充沛！水屬性招式威力提升 30%，火屬性招式威力降低 20%。',
    boostedTypes: ['Water'],
    nerfedTypes: ['Fire'],
    ambientColor: 0x14283d,
    fogColor: 0x06111f,
    particleColor: 0x38bdf8,
    effectSummary: '水屬性 +30% · 火屬性 -20%',
  },
  grassy_meadow: {
    id: 'grassy_meadow',
    nameZh: '茂密地底草海',
    badge: '🌿 茂盛草海',
    badgeBg: 'rgba(20, 83, 45, 0.8)',
    badgeBorder: '#22c55e',
    textColor: '#bbf7d0',
    descriptionZh: '充滿生機的遠古草海！草屬性招式威力提升 30%，草系寶可夢每回合開始回復 6% HP。',
    boostedTypes: ['Grass'],
    nerfedTypes: [],
    ambientColor: 0x13301a,
    fogColor: 0x07170c,
    particleColor: 0x4ade80,
    effectSummary: '草屬性 +30% · 草系回合微回復',
  },
  electric_storm: {
    id: 'electric_storm',
    nameZh: '雷暴強磁場',
    badge: '⚡ 雷暴磁場',
    badgeBg: 'rgba(113, 63, 18, 0.8)',
    badgeBorder: '#eab308',
    textColor: '#fef08a',
    descriptionZh: '強烈電磁激盪！電屬性招式威力提升 30%，全體寶可夢無法陷入睡眠狀態。',
    boostedTypes: ['Electric'],
    nerfedTypes: [],
    ambientColor: 0x2e2912,
    fogColor: 0x141206,
    particleColor: 0xfacc15,
    effectSummary: '電屬性 +30% · 免疫睡眠',
  },
  sandstorm_ruin: {
    id: 'sandstorm_ruin',
    nameZh: '沙暴狂風廢墟',
    badge: '🪨 沙暴石窟',
    badgeBg: 'rgba(120, 53, 15, 0.8)',
    badgeBorder: '#f59e0b',
    textColor: '#fde68a',
    descriptionZh: '呼嘯的烈風夾雜碎石！岩石、地面、鋼屬性防禦/特防 +30%，其他屬性每回合受微量沙暴刮傷。',
    boostedTypes: ['Rock', 'Ground', 'Steel'],
    nerfedTypes: [],
    ambientColor: 0x362310,
    fogColor: 0x170e05,
    particleColor: 0xd97706,
    effectSummary: '岩地鋼防禦 +30% · 沙暴微損',
  },
  psychic_abyss: {
    id: 'psychic_abyss',
    nameZh: '超能精神領域',
    badge: '🔮 精神領域',
    badgeBg: 'rgba(88, 28, 135, 0.8)',
    badgeBorder: '#c084fc',
    textColor: '#f3e8ff',
    descriptionZh: '空間中扭曲著奇異的念力波！超能力屬性招式威力提升 30%，格鬥屬性招式防禦降低 15%。',
    boostedTypes: ['Psychic'],
    nerfedTypes: ['Fighting'],
    ambientColor: 0x2c143d,
    fogColor: 0x12061a,
    particleColor: 0xc084fc,
    effectSummary: '超能力 +30% · 格鬥減防',
  },
  ice_tundra: {
    id: 'ice_tundra',
    nameZh: '極寒冰雪苔原',
    badge: '❄️ 冰雪苔原',
    badgeBg: 'rgba(12, 74, 110, 0.8)',
    badgeBorder: '#38bdf8',
    textColor: '#e0f2fe',
    descriptionZh: '冰雪覆蓋的浩瀚極地！冰屬性招式威力提升 30%，冰晶飄落滋潤寒冰之力。',
    boostedTypes: ['Ice'],
    nerfedTypes: [],
    ambientColor: 0x1e3a5f,
    fogColor: 0x0f2338,
    particleColor: 0xbae6fd,
    effectSummary: '冰屬性 +30% · 寒冰領域',
  },
};

export function getRandomFieldTerrain(floor: number): FieldTerrainData {
  const keys: FieldTerrainType[] = [
    'fire_cave',
    'water_lake',
    'grassy_meadow',
    'electric_storm',
    'sandstorm_ruin',
    'psychic_abyss',
    'ice_tundra',
    'none',
  ];
  if (Math.random() < 0.12) return FIELD_TERRAINS.none;
  const picked = keys[Math.floor(Math.random() * (keys.length - 1))];
  return FIELD_TERRAINS[picked];
}

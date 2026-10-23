// Meta-progression and Roguelite persistent storage system

export interface MetaTalents {
  vitality: number;     // Level 0-5: +10% HP per level
  starterFunds: number; // Level 0-5: +60 starting coins per level
  catchRate: number;    // Level 0-5: +10% catch rate bonus per level
  expScholar: number;   // Level 0-5: +20% EXP gained per level
  trueStrike: number;   // Level 0-5: +6% move accuracy bonus per level
  indomitable: number;  // Level 0-5: +15% chance to endure lethal hit with 1 HP
}

export interface MetaProgressionState {
  badges: number;             // Adventure Badges (冒險勛章)
  unlockedPokedex: string[];  // Unlocked Pokémon species IDs for starter selection
  talents: MetaTalents;
  stats: {
    totalRuns: number;
    highestFloor: number;
    totalWins: number;
    totalCaught: number;
  };
}

const STORAGE_KEY = 'pokemon_rogue_meta_v1';

export const DEFAULT_UNLOCKED_SPECIES = [
  'charmander',
  'squirtle',
  'bulbasaur',
  'pikachu',
  'riolu',
  'gastly',
  'gible',
  'eevee',
];

export const INITIAL_META_STATE: MetaProgressionState = {
  badges: 50, // Give 50 starting badges as welcome gift!
  unlockedPokedex: [...DEFAULT_UNLOCKED_SPECIES],
  talents: {
    vitality: 0,
    starterFunds: 0,
    catchRate: 0,
    expScholar: 0,
    trueStrike: 0,
    indomitable: 0,
  },
  stats: {
    totalRuns: 0,
    highestFloor: 1,
    totalWins: 0,
    totalCaught: 0,
  },
};

export function loadMetaProgression(): MetaProgressionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_META_STATE };
    const parsed = JSON.parse(raw);
    return {
      badges: typeof parsed.badges === 'number' ? parsed.badges : 50,
      unlockedPokedex: Array.isArray(parsed.unlockedPokedex)
        ? Array.from(new Set([...DEFAULT_UNLOCKED_SPECIES, ...parsed.unlockedPokedex]))
        : [...DEFAULT_UNLOCKED_SPECIES],
      talents: {
        vitality: parsed.talents?.vitality || 0,
        starterFunds: parsed.talents?.starterFunds || 0,
        catchRate: parsed.talents?.catchRate || 0,
        expScholar: parsed.talents?.expScholar || 0,
        trueStrike: parsed.talents?.trueStrike || 0,
        indomitable: parsed.talents?.indomitable || 0,
      },
      stats: {
        totalRuns: parsed.stats?.totalRuns || 0,
        highestFloor: parsed.stats?.highestFloor || 1,
        totalWins: parsed.stats?.totalWins || 0,
        totalCaught: parsed.stats?.totalCaught || 0,
      },
    };
  } catch (e) {
    return { ...INITIAL_META_STATE };
  }
}

export function saveMetaProgression(state: MetaProgressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save meta-progression', e);
  }
}

export function unlockSpecies(speciesId: string): boolean {
  const current = loadMetaProgression();
  if (!current.unlockedPokedex.includes(speciesId)) {
    current.unlockedPokedex.push(speciesId);
    saveMetaProgression(current);
    return true;
  }
  return false;
}

export function addBadges(amount: number): number {
  const current = loadMetaProgression();
  current.badges += Math.max(0, amount);
  saveMetaProgression(current);
  return current.badges;
}

export const TALENT_MAX_LEVEL = 5;

// Cost formula for talent level: [30, 60, 100, 160, 240]
export function getTalentCost(talentKey: keyof MetaTalents, currentLevel: number): number {
  if (currentLevel >= TALENT_MAX_LEVEL) return 0;
  const costs = [30, 60, 100, 160, 240];
  return costs[currentLevel] || 300;
}

export interface TalentConfig {
  key: keyof MetaTalents;
  nameZh: string;
  nameEn: string;
  icon: string;
  description: string;
  getLevelEffectText: (lvl: number) => string;
}

export const TALENT_CONFIGS: TalentConfig[] = [
  {
    key: 'vitality',
    nameZh: '體魄強健 (Vitality)',
    nameEn: 'Team HP Boost',
    icon: 'Heart',
    description: '強化全隊寶可夢的生命力，全面提高基礎 HP 上限。',
    getLevelEffectText: (lvl) => (lvl === 0 ? '無加成' : `全隊最大 HP +${lvl * 10}%`),
  },
  {
    key: 'starterFunds',
    nameZh: '贊助資金 (Starter Gold)',
    nameEn: 'Starting Coins',
    icon: 'Coins',
    description: '每次開局時獲得探險家工會的起步贊助資金。',
    getLevelEffectText: (lvl) => (lvl === 0 ? '初始 100 🪙' : `開局金幣 +${lvl * 60} 🪙 (共 ${100 + lvl * 60} 🪙)`),
  },
  {
    key: 'catchRate',
    nameZh: '捕獲精通 (Capture Master)',
    nameEn: 'Catch Rate Bonus',
    icon: 'Sparkles',
    description: '投擲精靈球時提升收服機率，更容易收服強力野生夥伴。',
    getLevelEffectText: (lvl) => (lvl === 0 ? '基礎機率' : `精靈球捕獲成功率 +${lvl * 10}%`),
  },
  {
    key: 'expScholar',
    nameZh: '經驗增幅 (EXP Scholar)',
    nameEn: 'Exp Multiplier',
    icon: 'BookOpen',
    description: '戰鬥獲勝與收服獲得更多經驗值，等級快速提升。',
    getLevelEffectText: (lvl) => (lvl === 0 ? '基礎經驗' : `戰鬥經驗值獲得量 +${lvl * 20}%`),
  },
  {
    key: 'trueStrike',
    nameZh: '專注凝神 (True Strike)',
    nameEn: 'Accuracy Floor',
    icon: 'Zap',
    description: '招式命中率保底加成，大幅降低 MISS 與敵方迴避機率。',
    getLevelEffectText: (lvl) => (lvl === 0 ? '基礎命中' : `全招式命中率 +${lvl * 6}% (防 MISS 保底)`),
  },
  {
    key: 'indomitable',
    nameZh: '不屈意志 (Focus Will)',
    nameEn: 'Lethal Endure',
    icon: 'Shield',
    description: '受到致命一擊時，有一定機率保留 1 HP 殘血存活！',
    getLevelEffectText: (lvl) => (lvl === 0 ? '無保底' : `致命攻擊時有 ${lvl * 15}% 機率以 1 HP 存活`),
  },
];

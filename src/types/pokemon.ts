export type PokemonType =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Grass'
  | 'Electric'
  | 'Ice'
  | 'Fighting'
  | 'Poison'
  | 'Ground'
  | 'Flying'
  | 'Psychic'
  | 'Bug'
  | 'Rock'
  | 'Ghost'
  | 'Dragon'
  | 'Steel'
  | 'Dark'
  | 'Fairy';

export type MoveCategory = 'Physical' | 'Special' | 'Status';

export type StatusCondition = 'None' | 'Burn' | 'Poison' | 'Paralysis' | 'Sleep' | 'Freeze';

export interface MoveEffect {
  type: 'stat_buff' | 'stat_debuff' | 'status_condition' | 'heal' | 'drain';
  target: 'self' | 'target';
  stat?: 'atk' | 'def' | 'spa' | 'spd' | 'spe';
  amount?: number;
  condition?: StatusCondition;
  chance?: number; // 0 - 100%
  healPercent?: number;
}

export interface Move {
  id: string;
  name: string;
  nameZh: string;
  type: PokemonType;
  category: MoveCategory;
  power: number;
  accuracy: number; // 0-100
  pp: number;
  maxPp: number;
  description: string;
  effect?: MoveEffect;
}

export interface MoveInstance extends Move {
  currentPp: number;
}

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface StatStages {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface Ability {
  id: string;
  name: string;
  nameZh: string;
  description: string;
}

export interface EvolutionData {
  levelReq: number;
  evolvesToId: string;
  evolvesToName: string;
  evolvesToNameZh: string;
}

export interface SpeciesData {
  id: string;
  pokedexNo: number;
  name: string;
  nameZh: string;
  types: PokemonType[];
  baseStats: BaseStats;
  ability: Ability;
  spriteUrl?: string;
  evolution?: EvolutionData;
  learnableMoves: { level: number; moveId: string }[];
  accentColor: string;
  descriptionZh: string;
}

export interface Item {
  id: string;
  name: string;
  nameZh: string;
  type: 'medicine' | 'pokeball' | 'held_item' | 'tm' | 'evolution';
  price: number;
  description: string;
  evoStage?: 1 | 2;
  healAmount?: number;
  healPercent?: number;
  restorePpAmount?: number;
  restoreAllPp?: boolean;
  catchMultiplier?: number;
  tmMoveId?: string;
  heldEffect?: {
    type: 'type_boost' | 'leftovers' | 'stat_boost' | 'focus_sash' | 'exp_boost' | 'coin_boost';
    boostType?: PokemonType;
    multiplier?: number;
    stat?: 'atk' | 'def' | 'spe';
  };
}

export interface PokemonInstance {
  uid: string;
  speciesId: string;
  pokedexNo: number;
  name: string;
  nameZh: string;
  types: PokemonType[];
  level: number;
  exp: number;
  maxExp: number;
  currentHp: number;
  maxHp: number;
  stats: BaseStats;
  statStages: StatStages;
  moves: MoveInstance[];
  status: StatusCondition;
  isShiny: boolean;
  heldItem?: Item;
  ability: Ability;
  spriteUrl?: string;
  accentColor: string;
}

export interface Trainer {
  id: string;
  name: string;
  title: string;
  titleZh: string;
  isBoss: boolean;
  dialogueBefore: string;
  dialogueWin: string;
  team: PokemonInstance[];
  rewardCoins: number;
  rewardItem?: Item;
}

export type DungeonNodeType = 'battle' | 'trainer' | 'camp' | 'shop' | 'event' | 'boss';

export interface DungeonNode {
  id: string;
  floor: number;
  type: DungeonNodeType;
  title: string;
  description: string;
  completed: boolean;
  accessible: boolean;
  wildPokemon?: PokemonInstance;
  trainer?: Trainer;
  mysteryEventId?: string;
  connectedNextNodeIds: string[];
}

export interface MysteryEventOption {
  textZh: string;
  effectDescription: string;
  action: (state: any) => { message: string; coins?: number; hpDelta?: number; item?: Item };
}

export interface MysteryEvent {
  id: string;
  titleZh: string;
  storyZh: string;
  options: {
    labelZh: string;
    descriptionZh: string;
    outcomeType: 'heal' | 'item' | 'coins' | 'gamble' | 'curse_buff' | 'shiny';
  }[];
}

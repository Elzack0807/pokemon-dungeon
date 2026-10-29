import React, { useState } from 'react';
import { PokemonInstance, Item } from '../types/pokemon';
import { POKEMON_SPECIES, calculateStats } from '../data/pokemonData';
import { PokemonSprite } from './PokemonSprite';
import { TYPE_COLORS, TYPE_NAMES_ZH } from '../utils/typeChart';
import { sound } from '../utils/audio';
import { Sparkles, ArrowRight, X, ShieldAlert, Zap } from 'lucide-react';

interface EvolutionAltarModalProps {
  party: PokemonInstance[];
  inventory: { item: Item; count: number }[];
  onClose: () => void;
  onUpdatePartyAndInventory: (
    updatedParty: PokemonInstance[],
    updatedInventory: { item: Item; count: number }[]
  ) => void;
}

// Stage 1 Base Forms
const STAGE_1_SPECIES_IDS = [
  'charmander',
  'squirtle',
  'bulbasaur',
  'pikachu',
  'riolu',
  'gastly',
  'gible',
  'eevee',
  'machop',
  'abra',
  'magikarp',
  'bagon',
  'scyther',
];

// Stage 2 Middle Forms
const STAGE_2_SPECIES_IDS = [
  'charmeleon',
  'wartortle',
  'ivysaur',
  'haunter',
  'gabite',
  'machoke',
  'kadabra',
  'shelgon',
];

export const EvolutionAltarModal: React.FC<EvolutionAltarModalProps> = ({
  party: initialParty,
  inventory: initialInventory,
  onClose,
  onUpdatePartyAndInventory,
}) => {
  const [party, setParty] = useState<PokemonInstance[]>(initialParty);
  const [inventory, setInventory] = useState<{ item: Item; count: number }[]>(initialInventory);
  const [celebration, setCelebration] = useState<{
    active: boolean;
    oldName: string;
    newName: string;
    pkm: PokemonInstance | null;
  }>({
    active: false,
    oldName: '',
    newName: '',
    pkm: null,
  });

  const stage1StoneCount =
    inventory.find((i) => i.item.id === 'stage1_evo_stone')?.count || 0;
  const stage2StoneCount =
    inventory.find((i) => i.item.id === 'stage2_evo_stone')?.count || 0;

  const handleEvolve = (pkm: PokemonInstance) => {
    const species = POKEMON_SPECIES[pkm.speciesId];
    if (!species?.evolution) return;

    const isStage1 = STAGE_1_SPECIES_IDS.includes(pkm.speciesId);
    const isStage2 = STAGE_2_SPECIES_IDS.includes(pkm.speciesId);

    const requiredStoneId = isStage2 ? 'stage2_evo_stone' : 'stage1_evo_stone';
    const requiredLevel = isStage2 ? 10 : 6;

    // Check level & item requirement
    if (pkm.level < requiredLevel) return;

    const stoneIdx = inventory.findIndex((i) => i.item.id === requiredStoneId);
    if (stoneIdx === -1 || inventory[stoneIdx].count < 1) return;

    // Deduct stone from inventory
    const nextInventory = [...inventory];
    nextInventory[stoneIdx] = {
      ...nextInventory[stoneIdx],
      count: nextInventory[stoneIdx].count - 1,
    };
    if (nextInventory[stoneIdx].count <= 0) {
      nextInventory.splice(stoneIdx, 1);
    }

    // Evolve Pokemon
    const targetSpecies = POKEMON_SPECIES[species.evolution.evolvesToId];
    if (!targetSpecies) return;

    const oldNameZh = pkm.nameZh;
    const newNameZh = targetSpecies.nameZh;

    const nextParty = party.map((p) => {
      if (p.uid !== pkm.uid) return p;

      const newStats = calculateStats(targetSpecies.baseStats, p.level);
      const hpGain = Math.max(15, newStats.hp - p.maxHp);

      return {
        ...p,
        speciesId: targetSpecies.id,
        pokedexNo: targetSpecies.pokedexNo,
        name: targetSpecies.name,
        nameZh: targetSpecies.nameZh,
        types: [...targetSpecies.types],
        ability: { ...targetSpecies.ability },
        accentColor: targetSpecies.accentColor,
        stats: newStats,
        maxHp: newStats.hp,
        currentHp: Math.min(newStats.hp, p.currentHp + hpGain),
      };
    });

    setParty(nextParty);
    setInventory(nextInventory);
    onUpdatePartyAndInventory(nextParty, nextInventory);

    sound.playLevelUp();
    setCelebration({
      active: true,
      oldName: oldNameZh,
      newName: newNameZh,
      pkm: nextParty.find((p) => p.uid === pkm.uid) || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border-2 border-purple-500/60 max-w-2xl w-full rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>神聖進化祭壇</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                  Evolution Altar
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                注入古老結晶光輝，協助寶可夢突破等級與形態極限！
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inventory Stone Stock Status Banner */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <div className="p-3 rounded-2xl bg-sky-950/40 border border-sky-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 font-bold text-xs">
                石 I
              </div>
              <div>
                <div className="text-xs font-bold text-white">一階進化石</div>
                <div className="text-[10px] text-sky-300">需求：一階寶可夢 Lv.6+</div>
              </div>
            </div>
            <div className="font-mono font-bold text-sm text-sky-400">
              x{stage1StoneCount}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                石 II
              </div>
              <div>
                <div className="text-xs font-bold text-white">高階進化石</div>
                <div className="text-[10px] text-amber-300">需求：二階寶可夢 Lv.10+</div>
              </div>
            </div>
            <div className="font-mono font-bold text-sm text-amber-400">
              x{stage2StoneCount}
            </div>
          </div>
        </div>

        {/* Party Member Evolution List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <span className="text-xs font-bold text-slate-300 block">
            選擇隊伍寶可夢發動進化：
          </span>

          {party.map((pkm) => {
            const species = POKEMON_SPECIES[pkm.speciesId];
            const hasEvolution = !!species?.evolution;
            const targetSpecies = hasEvolution
              ? POKEMON_SPECIES[species.evolution!.evolvesToId]
              : null;

            const isStage1 = STAGE_1_SPECIES_IDS.includes(pkm.speciesId);
            const isStage2 = STAGE_2_SPECIES_IDS.includes(pkm.speciesId);

            const requiredStoneId = isStage2 ? 'stage2_evo_stone' : 'stage1_evo_stone';
            const requiredStoneName = isStage2 ? '高階進化石' : '一階進化石';
            const requiredLevel = isStage2 ? 10 : 6;
            const currentStoneCount = isStage2 ? stage2StoneCount : stage1StoneCount;

            const meetsLevel = pkm.level >= requiredLevel;
            const meetsStone = currentStoneCount >= 1;
            const canEvolve = hasEvolution && meetsLevel && meetsStone;

            return (
              <div
                key={pkm.uid}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/50 flex flex-col md:flex-row items-center justify-between gap-4 transition-all"
              >
                {/* Left: Current Pokemon */}
                <div className="flex items-center gap-3.5 w-full md:w-auto">
                  <div className="relative w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                    <PokemonSprite
                      speciesId={pkm.speciesId}
                      pokedexNo={pkm.pokedexNo}
                      nameZh={pkm.nameZh}
                      types={pkm.types}
                      isShiny={pkm.isShiny}
                      size="md"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{pkm.nameZh}</span>
                      <span className="text-xs font-mono text-amber-400 font-bold">
                        Lv.{pkm.level}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      {pkm.types.map((t) => {
                        const typeColor = TYPE_COLORS[t];
                        return (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.2 rounded font-bold"
                            style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
                          >
                            {TYPE_NAMES_ZH[t]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Center: Evolution Target Preview */}
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <ArrowRight className="w-4 h-4 text-purple-400 shrink-0" />

                  {targetSpecies ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/30">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <PokemonSprite
                          speciesId={targetSpecies.id}
                          pokedexNo={targetSpecies.pokedexNo}
                          nameZh={targetSpecies.nameZh}
                          types={targetSpecies.types}
                          size="sm"
                        />
                      </div>
                      <div className="text-purple-200">
                        <div>{targetSpecies.nameZh}</div>
                        <div className="text-[9px] text-purple-300 font-mono">
                          需求: {requiredStoneName} + Lv.{requiredLevel}+
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 font-normal">
                      已達最高階段形態
                    </span>
                  )}
                </div>

                {/* Right: Action Button / Requirement Status */}
                <div className="w-full md:w-auto text-right">
                  {!hasEvolution ? (
                    <span className="text-xs font-bold text-emerald-400 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 block text-center">
                      ✨ 最終形態已具備
                    </span>
                  ) : canEvolve ? (
                    <button
                      onClick={() => handleEvolve(pkm)}
                      className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
                      <span>發動進化 ({requiredStoneName} x1)</span>
                    </button>
                  ) : (
                    <div className="flex flex-col gap-1 items-end">
                      {!meetsLevel && (
                        <span className="text-[11px] font-medium text-rose-400 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-500/30 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>等級未達 Lv.{requiredLevel} (現 Lv.{pkm.level})</span>
                        </span>
                      )}
                      {!meetsStone && (
                        <span className="text-[11px] font-medium text-amber-400 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" />
                          <span>缺少【{requiredStoneName}】</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Close Button */}
        <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            離開進化祭壇
          </button>
        </div>

        {/* Celebration Overlay */}
        {celebration.active && celebration.pkm && (
          <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center space-y-5 animate-scale-in">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-500 to-amber-400 p-1 animate-spin">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                  <PokemonSprite
                    speciesId={celebration.pkm.speciesId}
                    pokedexNo={celebration.pkm.pokedexNo}
                    nameZh={celebration.pkm.nameZh}
                    types={celebration.pkm.types}
                    isShiny={celebration.pkm.isShiny}
                    size="lg"
                  />
                </div>
              </div>
              <Sparkles className="w-8 h-8 text-yellow-300 absolute -top-2 -right-2 animate-bounce" />
            </div>

            <div>
              <div className="text-xs font-bold text-purple-400 tracking-widest uppercase">
                EVOLUTION COMPLETE
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-white mt-1">
                {celebration.oldName} 成功進化為 {celebration.newName}！
              </h3>
              <p className="text-xs text-slate-300 mt-2 max-w-sm mx-auto">
                最大 HP 提升，基礎能力全面飛躍！獲得強大新戰鬥實力！
              </p>
            </div>

            <button
              onClick={() => setCelebration({ active: false, oldName: '', newName: '', pkm: null })}
              className="py-3 px-8 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-xl cursor-pointer"
            >
              太棒了！繼續冒險
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

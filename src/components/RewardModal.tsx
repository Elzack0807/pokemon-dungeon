import React, { useState } from 'react';
import { PokemonInstance, Item, Move } from '../types/pokemon';
import { MOVES } from '../data/movesData';
import { ITEMS } from '../data/itemsData';
import { POKEMON_SPECIES, calculateStats } from '../data/pokemonData';
import { PokemonSprite } from './PokemonSprite';
import { sound } from '../utils/audio';
import { Sparkles, ArrowRight, Award } from 'lucide-react';

interface RewardModalProps {
  party: PokemonInstance[];
  expGained: number;
  coinsEarned: number;
  rewardItem?: Item;
  caughtPokemon?: PokemonInstance;
  onContinue: (updatedParty: PokemonInstance[], updatedInventoryRewards: Item[]) => void;
}

export const RewardModal: React.FC<RewardModalProps> = ({
  party: initialParty,
  expGained,
  coinsEarned,
  rewardItem,
  caughtPokemon,
  onContinue,
}) => {
  // Apply EXP & handle automatic evolution seamlessly
  const [evolutionNotice, setEvolutionNotice] = useState<string | null>(null);

  const [party] = useState<PokemonInstance[]>(() => {
    let evoMsg = null;
    const updated = initialParty.map((p) => {
      let pkm = { ...p, moves: [...p.moves] };
      pkm.exp += expGained;

      while (pkm.exp >= pkm.maxExp) {
        pkm.exp -= pkm.maxExp;
        pkm.level += 1;
        pkm.maxExp = pkm.level * 25;

        // Check evolution
        const species = POKEMON_SPECIES[pkm.speciesId];
        if (species?.evolution && pkm.level >= species.evolution.levelReq) {
          const targetSpecies = POKEMON_SPECIES[species.evolution.evolvesToId];
          if (targetSpecies) {
            pkm.speciesId = targetSpecies.id;
            pkm.name = targetSpecies.name;
            pkm.nameZh = targetSpecies.nameZh;
            pkm.types = [...targetSpecies.types];
            pkm.ability = { ...targetSpecies.ability };
            pkm.accentColor = targetSpecies.accentColor;
            evoMsg = `🎉 ${species.nameZh} 進化成了 ${targetSpecies.nameZh}！`;
          }
        }

        const currentSpecies = POKEMON_SPECIES[pkm.speciesId];
        if (currentSpecies) {
          const newStats = calculateStats(currentSpecies.baseStats, pkm.level);
          const hpDiff = newStats.hp - pkm.maxHp;
          pkm.stats = newStats;
          pkm.maxHp = newStats.hp;
          pkm.currentHp = Math.min(pkm.maxHp, pkm.currentHp + Math.max(3, hpDiff));
        }
      }
      return pkm;
    });

    if (caughtPokemon && updated.length < 3) {
      updated.push(caughtPokemon);
    }
    if (evoMsg) {
      setEvolutionNotice(evoMsg);
      sound.playLevelUp();
    }
    return updated;
  });

  // 3 Roguelike Draft options
  const [draftOptions] = useState(() => {
    const candidateMoves = Object.values(MOVES).filter((m) => m.power >= 60 || m.category === 'Status');
    const randomMove = candidateMoves[Math.floor(Math.random() * candidateMoves.length)];

    const candidateItems = [
      ITEMS.leftovers,
      ITEMS.choice_scarf,
      ITEMS.muscle_band,
      ITEMS.focus_sash,
      ITEMS.charcoal,
      ITEMS.mystic_water,
      ITEMS.miracle_seed,
    ];
    const randomItem = candidateItems[Math.floor(Math.random() * candidateItems.length)];

    return [
      {
        id: 'opt_move',
        type: 'move',
        badge: '招式學習機 TM',
        titleZh: `學習新招式 · ${randomMove.nameZh}`,
        descZh: `${randomMove.description} (威力 ${randomMove.power} / 命中 ${randomMove.accuracy}%)`,
        move: randomMove,
      },
      {
        id: 'opt_item',
        type: 'item',
        badge: '核心遺物 Relic',
        titleZh: `獲得珍稀攜帶道具 · ${randomItem.nameZh}`,
        descZh: randomItem.description,
        item: randomItem,
      },
      {
        id: 'opt_stat',
        type: 'stat',
        badge: '永久強化 Blessing',
        titleZh: '隊伍全體能力突破',
        descZh: '全隊全員最大 HP +20，攻擊 +5，並回復 30% 生命值！',
      },
    ];
  });

  // Single-Click selection to continue immediately!
  const handleSelectDraft = (option: any) => {
    sound.playSelect();
    const rewards: Item[] = [];
    if (rewardItem) rewards.push(rewardItem);

    if (option.type === 'item' && option.item) {
      rewards.push(option.item);
    } else if (option.type === 'stat') {
      party.forEach((p) => {
        p.maxHp += 20;
        p.currentHp = Math.min(p.maxHp, p.currentHp + Math.floor(p.maxHp * 0.3));
        p.stats.atk += 5;
        p.stats.spa += 5;
      });
    } else if (option.type === 'move' && option.move) {
      const targetPkm = party[0];
      if (targetPkm) {
        if (targetPkm.moves.length < 4) {
          targetPkm.moves.push({ ...option.move, currentPp: option.move.maxPp });
        } else {
          targetPkm.moves[0] = { ...option.move, currentPp: option.move.maxPp };
        }
      }
    }

    onContinue(party, rewards);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 max-w-xl w-full rounded-2xl p-5 shadow-2xl space-y-4">
        {/* Top Header & EXP Banner */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
              戰鬥大獲全勝
            </span>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>戰果結算</span>
              <span className="text-xs font-mono text-sky-400 font-normal">+{expGained} EXP</span>
              <span className="text-xs font-mono text-amber-400 font-normal">+{coinsEarned} 🪙</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {party.map((p) => (
              <div key={p.uid} className="relative">
                <PokemonSprite
                  speciesId={p.speciesId}
                  nameZh={p.nameZh}
                  types={p.types}
                  isShiny={p.isShiny}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Evolution announcement if occurred */}
        {evolutionNotice && (
          <div className="p-3 bg-amber-500/20 border border-amber-400/50 rounded-xl text-center text-amber-300 font-bold text-xs flex items-center justify-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{evolutionNotice}</span>
          </div>
        )}

        {/* Caught notice if any */}
        {caughtPokemon && (
          <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center gap-2">
            <span>⭐ 成功收服 <strong>{caughtPokemon.nameZh}</strong> (Lv.{caughtPokemon.level}) 加入隊伍！</span>
          </div>
        )}

        {/* Direct 1-Click Roguelike 3-Choice */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            <span>點選以下任一項獎勵（點擊後直接出發）：</span>
          </span>

          <div className="grid grid-cols-1 gap-2.5">
            {draftOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSelectDraft(opt)}
                className="p-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-left transition-all active:scale-[0.99] group cursor-pointer flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    {opt.badge}
                  </span>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors mt-0.5">
                    {opt.titleZh}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 leading-snug">{opt.descZh}</div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transform group-hover:translate-x-1 transition-transform shrink-0 ml-3" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

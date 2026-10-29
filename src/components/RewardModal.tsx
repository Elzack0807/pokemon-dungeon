import React, { useState } from 'react';
import { PokemonInstance, Item, Move } from '../types/pokemon';
import { MOVES } from '../data/movesData';
import { ITEMS } from '../data/itemsData';
import { POKEMON_SPECIES, calculateStats } from '../data/pokemonData';
import { TYPE_COLORS, TYPE_NAMES_ZH } from '../utils/typeChart';
import { PokemonSprite } from './PokemonSprite';
import { sound } from '../utils/audio';
import { Sparkles, ArrowRight, Award, Zap, X, Users } from 'lucide-react';

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
  // Apply EXP to party members without automatic evolution (evolution now happens at Evolution Altar!)
  const [party] = useState<PokemonInstance[]>(() => {
    const updated = initialParty.map((p) => {
      let pkm = { ...p, moves: [...p.moves] };
      pkm.exp += expGained;

      while (pkm.exp >= pkm.maxExp) {
        pkm.exp -= pkm.maxExp;
        pkm.level += 1;
        pkm.maxExp = pkm.level * 25;

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
    return updated;
  });

  // 3 Roguelike Draft options
  const [draftOptions] = useState(() => {
    const candidateMoves = Object.values(MOVES).filter(
      (m) => m.power >= 60 || m.category === 'Status'
    );
    const randomMove =
      candidateMoves[Math.floor(Math.random() * candidateMoves.length)];

    const candidateItems = [
      ITEMS.leftovers,
      ITEMS.choice_scarf,
      ITEMS.muscle_band,
      ITEMS.focus_sash,
      ITEMS.charcoal,
      ITEMS.mystic_water,
      ITEMS.miracle_seed,
      ITEMS.stage1_evo_stone,
      ITEMS.stage2_evo_stone,
    ];
    const randomItem =
      candidateItems[Math.floor(Math.random() * candidateItems.length)];

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

  // Target party member selection modal for learning move
  const [selectMoveForParty, setSelectMoveForParty] = useState<Move | null>(null);

  // Move Forget / Replace Modal State
  const [replaceMoveModal, setReplaceMoveModal] = useState<{
    open: boolean;
    targetUid: string;
    newMove: Move | null;
  }>({
    open: false,
    targetUid: '',
    newMove: null,
  });

  const completeRewardStep = (extraRewards: Item[] = []) => {
    const rewards: Item[] = [];
    if (rewardItem) rewards.push(rewardItem);
    rewards.push(...extraRewards);
    onContinue(party, rewards);
  };

  // Single-Click selection to continue or choose party member for move
  const handleSelectDraft = (option: any) => {
    sound.playSelect();

    if (option.type === 'item' && option.item) {
      completeRewardStep([option.item]);
    } else if (option.type === 'stat') {
      party.forEach((p) => {
        p.maxHp += 20;
        p.currentHp = Math.min(p.maxHp, p.currentHp + Math.floor(p.maxHp * 0.3));
        p.stats.atk += 5;
        p.stats.spa += 5;
      });
      completeRewardStep();
    } else if (option.type === 'move' && option.move) {
      // Open party member selector modal so user can choose which team member learns the move!
      setSelectMoveForParty(option.move);
    } else {
      completeRewardStep();
    }
  };

  const handleChoosePartyMemberForMove = (pkmUid: string) => {
    sound.playSelect();
    if (!selectMoveForParty) return;

    const chosenPkm = party.find((p) => p.uid === pkmUid);
    if (!chosenPkm) return;

    if (chosenPkm.moves.length < 4) {
      chosenPkm.moves.push({ ...selectMoveForParty, currentPp: selectMoveForParty.maxPp });
      sound.playLevelUp();
      setSelectMoveForParty(null);
      completeRewardStep();
    } else {
      // Open Move Replace Modal specifically for this chosen Pokemon
      setReplaceMoveModal({
        open: true,
        targetUid: pkmUid,
        newMove: selectMoveForParty,
      });
      setSelectMoveForParty(null);
    }
  };

  const handleConfirmMoveReplace = (slotIndex: number | null) => {
    sound.playSelect();
    const targetPkm = party.find((p) => p.uid === replaceMoveModal.targetUid) || party[0];
    if (slotIndex !== null && targetPkm && replaceMoveModal.newMove) {
      targetPkm.moves[slotIndex] = {
        ...replaceMoveModal.newMove,
        currentPp: replaceMoveModal.newMove.maxPp,
      };
      sound.playLevelUp();
    }
    setReplaceMoveModal({ open: false, targetUid: '', newMove: null });
    completeRewardStep();
  };

  const targetReplacePkm = party.find((p) => p.uid === replaceMoveModal.targetUid) || party[0];

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

      {/* Choice of Party Member to Learn Move Modal Overlay */}
      {selectMoveForParty && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-sky-500/60 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                <h3 className="text-lg font-bold text-white">選擇要傳授招式的隊友</h3>
              </div>
              <button
                onClick={() => setSelectMoveForParty(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-xs text-sky-200">
              <div className="font-bold text-sky-300 text-sm">
                【新招式】{selectMoveForParty.nameZh} (威力 {selectMoveForParty.power || '—'} / 命中 {selectMoveForParty.accuracy}% / PP {selectMoveForParty.maxPp})
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">{selectMoveForParty.description}</div>
            </div>

            <span className="text-xs font-bold text-slate-300 block">
              請選擇哪一位隊友學習此招式：
            </span>

            <div className="space-y-2.5">
              {party.map((p) => {
                const isFull = p.moves.length >= 4;
                return (
                  <button
                    key={p.uid}
                    onClick={() => handleChoosePartyMemberForMove(p.uid)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-400 text-left transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center">
                        <PokemonSprite
                          speciesId={p.speciesId}
                          pokedexNo={p.pokedexNo}
                          nameZh={p.nameZh}
                          types={p.types}
                          isShiny={p.isShiny}
                          size="sm"
                        />
                      </div>

                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-sky-300 flex items-center gap-2">
                          <span>{p.nameZh}</span>
                          <span className="text-xs font-mono text-amber-400 font-bold">
                            Lv.{p.level}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          目前已學招式 ({p.moves.length}/4): {p.moves.map((m) => m.nameZh).join(', ')}
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-sky-400 group-hover:text-white px-3 py-1.5 rounded-lg bg-sky-950/60 border border-sky-500/30">
                      {isFull ? '替換舊招式 ➔' : '立即學習 ➔'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Move Forget / Replace Modal Overlay */}
      {replaceMoveModal.open && replaceMoveModal.newMove && targetReplacePkm && (
        <div className="fixed inset-0 z-70 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">招式遺忘與替換選擇</h3>
              </div>
              <button
                onClick={() => handleConfirmMoveReplace(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
                title="放棄學習"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 leading-relaxed">
              <strong>{targetReplacePkm.nameZh}</strong> 已經掌握了 4 個招式！請選擇要遺忘的舊招式以替換學習新招式：
              <div className="mt-1 font-bold text-amber-300">
                【新招式】{replaceMoveModal.newMove.nameZh} (威力 {replaceMoveModal.newMove.power || '—'} / PP {replaceMoveModal.newMove.maxPp})
              </div>
            </div>

            <div className="space-y-2">
              {targetReplacePkm.moves.map((m, idx) => {
                const typeColor = TYPE_COLORS[m.type];
                return (
                  <button
                    key={m.id + '_' + idx}
                    onClick={() => handleConfirmMoveReplace(idx)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-left transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 font-mono font-bold text-xs flex items-center justify-center border border-slate-700">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-amber-300 flex items-center gap-2">
                          <span>{m.nameZh}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded font-semibold"
                            style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
                          >
                            {TYPE_NAMES_ZH[m.type]}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          威力 {m.power || '—'} · 命中 {m.accuracy}% · PP {m.maxPp}/{m.maxPp}
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-rose-400 group-hover:text-rose-300 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-500/30">
                      遺忘此招式
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handleConfirmMoveReplace(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              放棄學習（保留原有招式）
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { PokemonInstance, MoveInstance, Trainer, Item } from '../types/pokemon';
import { PokemonSprite } from './PokemonSprite';
import { PixelBattleScene2D } from './PixelBattleScene2D';
import { TYPE_COLORS, TYPE_NAMES_ZH, getTypeEffectiveness, getEffectivenessMessage } from '../utils/typeChart';
import { sound } from '../utils/audio';
import { FieldTerrainData } from '../utils/fieldTerrain';
import { loadMetaProgression, unlockSpecies } from '../utils/metaProgression';
import {
  Swords,
  Backpack,
  Users,
  Footprints,
  Sparkles,
  Shield,
  Zap,
  Heart,
  X,
} from 'lucide-react';

interface BattleArenaProps {
  playerPokemon: PokemonInstance;
  playerParty: PokemonInstance[];
  wildPokemon?: PokemonInstance;
  trainer?: Trainer;
  inventory: { item: Item; count: number }[];
  fieldTerrain?: FieldTerrainData;
  onBattleEnd: (result: {
    victory: boolean;
    fled?: boolean;
    caughtPokemon?: PokemonInstance;
    expGained: number;
    coinsEarned: number;
    rewardItem?: Item;
    updatedParty: PokemonInstance[];
    updatedInventory: { item: Item; count: number }[];
  }) => void;
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  playerPokemon: initialPlayerPkm,
  playerParty: initialParty,
  wildPokemon: initialWild,
  trainer,
  inventory: initialInventory,
  fieldTerrain,
  onBattleEnd,
}) => {
  const [party, setParty] = useState<PokemonInstance[]>(() => {
    return (initialParty || []).map((p) => {
      const maxHp = p.maxHp > 0 ? p.maxHp : (p.stats?.hp || 40);
      const curHp = p.currentHp !== undefined ? p.currentHp : maxHp;
      return {
        ...p,
        maxHp,
        currentHp: curHp,
        moves: (p.moves || []).map((m) => {
          const maxPp = m.maxPp ?? m.pp ?? 20;
          const curPp = m.currentPp !== undefined ? m.currentPp : maxPp;
          return {
            ...m,
            maxPp,
            currentPp: curPp,
          };
        }),
      };
    });
  });
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [inventory, setInventory] = useState<{ item: Item; count: number }[]>(initialInventory);

  const [opponentTeam, setOpponentTeam] = useState<PokemonInstance[]>(() => {
    const raw = trainer ? trainer.team : initialWild ? [initialWild] : [];
    return raw.map((p) => {
      const maxHp = p.maxHp > 0 ? p.maxHp : (p.stats?.hp || 35);
      // Guarantee opponent never starts at 0 HP
      const curHp = p.currentHp && p.currentHp > 0 ? p.currentHp : maxHp;
      return {
        ...p,
        maxHp,
        currentHp: curHp,
        moves: (p.moves || []).map((m) => {
          const maxPp = m.maxPp ?? m.pp ?? 20;
          const curPp = m.currentPp !== undefined && m.currentPp > 0 ? m.currentPp : maxPp;
          return {
            ...m,
            maxPp,
            currentPp: curPp,
          };
        }),
      };
    });
  });
  const [activeOpponentIndex, setActiveOpponentIndex] = useState<number>(0);

  // Compact Status HUD by default (戰鬥說明欄縮小)
  const [isHudCompact, setIsHudCompact] = useState<boolean>(true);

  // Sub-drawers for bag or party
  const [drawer, setDrawer] = useState<'none' | 'bag' | 'party'>('none');
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [shakeTarget, setShakeTarget] = useState<'player' | 'opponent' | null>(null);

  // Catch Animation
  const [catchState, setCatchState] = useState<{
    inProgress: boolean;
    shakes: number;
    success: boolean | null;
  }>({
    inProgress: false,
    shakes: 0,
    success: null,
  });

  // Attack Visual Effect overlay
  const [attackFx, setAttackFx] = useState<{
    active: boolean;
    moveType?: string;
    target?: 'player' | 'opponent';
    damage?: number;
    isCrit?: boolean;
  }>({ active: false });

  const activePlayer = party[activePlayerIndex] || party[0];
  const activeOpponent = opponentTeam[activeOpponentIndex] || opponentTeam[0];

  // Auto-heal guard: Opponent must NEVER be at 0 HP when active
  useEffect(() => {
    if (activeOpponent && activeOpponent.currentHp <= 0) {
      const safeHp = activeOpponent.maxHp > 0 ? activeOpponent.maxHp : 35;
      activeOpponent.currentHp = safeHp;
      setOpponentTeam((prev) =>
        prev.map((p, idx) => (idx === activeOpponentIndex ? { ...p, currentHp: safeHp, maxHp: safeHp } : p))
      );
    }
  }, [activeOpponent, activeOpponentIndex]);

  // Real-time PP calculations for both combatants
  const oppTotalCurPp = (activeOpponent?.moves || []).reduce(
    (sum, m) => sum + (m.currentPp !== undefined ? m.currentPp : (m.maxPp ?? m.pp ?? 20)),
    0
  );
  const oppTotalMaxPp = (activeOpponent?.moves || []).reduce(
    (sum, m) => sum + (m.maxPp ?? m.pp ?? 20),
    0
  ) || 1;
  const oppPpPct = Math.round((oppTotalCurPp / oppTotalMaxPp) * 100);

  const playerTotalCurPp = (activePlayer?.moves || []).reduce(
    (sum, m) => sum + (m.currentPp !== undefined ? m.currentPp : (m.maxPp ?? m.pp ?? 20)),
    0
  );
  const playerTotalMaxPp = (activePlayer?.moves || []).reduce(
    (sum, m) => sum + (m.maxPp ?? m.pp ?? 20),
    0
  ) || 1;
  const playerPpPct = Math.round((playerTotalCurPp / playerTotalMaxPp) * 100);

  // Initial greeting log
  useEffect(() => {
    if (trainer && activeOpponent) {
      setBattleLog([
        `${trainer.name} 派出了 ${activeOpponent.nameZh}！`,
        `去吧，${activePlayer?.nameZh || '隊首寶可夢'}！`,
      ]);
    } else if (activeOpponent) {
      setBattleLog([
        `野生的 ${activeOpponent.isShiny ? '✨ 異色 ' : ''}${activeOpponent.nameZh} 出現了！`,
        `就決定是你了，${activePlayer?.nameZh || '隊首寶可夢'}！`,
      ]);
    }
  }, []);

  const addLog = (msg: string) => {
    setBattleLog((prev) => [...prev.slice(-4), msg]);
  };

  // Battle Keyboard Shortcuts: 1, 2, 3, 4 for Moves; B for Bag, P for Party, R for Flee
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return;
      const key = e.key.toLowerCase();

      if (drawer === 'none') {
        const moveNum = parseInt(key);
        if (moveNum >= 1 && moveNum <= 4 && activePlayer.moves[moveNum - 1]) {
          executePlayerMove(activePlayer.moves[moveNum - 1], moveNum - 1);
        } else if (key === 'b') {
          sound.playSelect();
          setDrawer('bag');
        } else if (key === 'p') {
          sound.playSelect();
          setDrawer('party');
        } else if (key === 'r') {
          handleFlee();
        }
      } else if (key === 'escape') {
        sound.playSelect();
        setDrawer('none');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProcessing, drawer, activePlayer]);

  // Execute Player Move Attack Action
  const executePlayerMove = async (move: MoveInstance, moveIdx?: number) => {
    if (isProcessing) return;
    if (activePlayer.currentHp <= 0) {
      addLog(`${activePlayer.nameZh} 已無戰鬥能力！請更換寶可夢！`);
      return;
    }
    // Safety auto-recover for opponent if it was somehow 0 HP
    if (activeOpponent.currentHp <= 0) {
      activeOpponent.currentHp = activeOpponent.maxHp > 0 ? activeOpponent.maxHp : 35;
    }
    setIsProcessing(true);
    setDrawer('none');

    // Start of Turn: Status Damage evaluated before attack
    if (activePlayer.status === 'Burn' || activePlayer.status === 'Poison') {
      const dmg = Math.floor(activePlayer.maxHp * 0.125);
      const nextHp = Math.max(0, activePlayer.currentHp - dmg);
      activePlayer.currentHp = nextHp;
      setParty((prev) => prev.map((p, idx) => (idx === activePlayerIndex ? { ...p, currentHp: nextHp } : p)));
      addLog(`${activePlayer.nameZh} 受到了 ${activePlayer.status === 'Burn' ? '灼傷' : '中毒'} 傷害！`);
      await sleep(1000);
      if (nextHp <= 0) {
        sound.playFaint();
        addLog(`${activePlayer.nameZh} 倒下了！`);

        const aliveIndex = party.findIndex((p, idx) => idx !== activePlayerIndex && p.currentHp > 0);
        if (aliveIndex !== -1) {
          await sleep(1000);
          setActivePlayerIndex(aliveIndex);
          addLog(`上吧！${party[aliveIndex].nameZh}！`);
          setIsProcessing(false);
          return;
        }

        await sleep(1200);
        onBattleEnd({
          victory: false,
          expGained: 0,
          coinsEarned: 0,
          updatedParty: party,
          updatedInventory: inventory,
        });
        return;
      }
    }

    const curPp = move.currentPp !== undefined ? move.currentPp : (move.maxPp ?? move.pp ?? 20);
    if (curPp <= 0) {
      sound.playSelect();
      addLog(`【${move.nameZh}】PP 已耗盡！請選擇其他招式！`);
      setIsProcessing(false);
      return;
    }

    const actualIdx = moveIdx !== undefined ? moveIdx : activePlayer.moves.findIndex((m) => m.id === move.id);

    // Deduct PP and update party state immediately so React re-renders PP in real-time
    const nextPp = Math.max(0, curPp - 1);
    move.currentPp = nextPp;
    setParty((prevParty) =>
      prevParty.map((pkm, pIdx) => {
        if (pIdx !== activePlayerIndex) return pkm;
        return {
          ...pkm,
          moves: pkm.moves.map((m, mIdx) =>
            mIdx === actualIdx || m.id === move.id ? { ...m, currentPp: nextPp, maxPp: m.maxPp ?? m.pp ?? 20 } : m
          ),
        };
      })
    );

    // Accuracy Check
    const hitSuccess = Math.random() * 100 <= move.accuracy;
    if (!hitSuccess) {
      sound.playHit(false, true);
      addLog(`${activePlayer.nameZh} 使用了【${move.nameZh}】，但沒有擊中！`);
      await sleep(1000);
      await processOpponentTurn();
      return;
    }

    // Type Effectiveness & Category Damage Calculation
    const multiplier = getTypeEffectiveness(move.type, activeOpponent.types);
    const effMsg = getEffectivenessMessage(multiplier);
    const isCrit = move.category !== 'Status' && Math.random() < 0.1;
    const critMult = isCrit ? 1.5 : 1.0;
    const stabMult = activePlayer.types.includes(move.type) ? 1.5 : 1.0;
    const randomMult = 0.85 + Math.random() * 0.15;

    // Field Terrain Boost
    let terrainMult = 1.0;
    if (fieldTerrain) {
      if (fieldTerrain.boostedTypes.includes(move.type)) terrainMult = 1.3;
      if (fieldTerrain.nerfedTypes.includes(move.type)) terrainMult = 0.8;
    }

    // Held Item Boost
    let heldItemMult = 1.0;
    if (activePlayer.heldItem?.heldEffect?.type === 'type_boost' && activePlayer.heldItem.heldEffect.boostType === move.type) {
      heldItemMult = activePlayer.heldItem.heldEffect.multiplier || 1.2;
    }

    let finalDamage = 0;

    if (move.category === 'Status' || move.power === 0) {
      finalDamage = 0;
      if (move.effect) {
        if (move.effect.type === 'status_condition' && move.effect.condition) {
          const chance = move.effect.chance ?? 100;
          if (Math.random() * 100 <= chance) {
            activeOpponent.status = move.effect.condition;
            addLog(`${activeOpponent.nameZh} 陷入了【${move.effect.condition}】狀態！`);
          }
        } else if (move.effect.type === 'stat_buff' && move.effect.stat) {
          addLog(`${activePlayer.nameZh} 的 ${move.effect.stat.toUpperCase()} 提升了！`);
        } else if (move.effect.type === 'stat_debuff' && move.effect.stat) {
          addLog(`${activeOpponent.nameZh} 的 ${move.effect.stat.toUpperCase()} 降低了！`);
        } else if (move.effect.type === 'heal') {
          const healAmt = Math.floor(activePlayer.maxHp * ((move.effect.healPercent || 50) / 100));
          activePlayer.currentHp = Math.min(activePlayer.maxHp, activePlayer.currentHp + healAmt);
          addLog(`${activePlayer.nameZh} 回復了 ${healAmt} HP！`);
        }
      }
    } else {
      // Physical vs Special Split
      const isSpecial = move.category === 'Special';
      const atkStat = isSpecial ? (activePlayer.stats?.spa || 20) : (activePlayer.stats?.atk || 20);
      const defStat = isSpecial ? (activeOpponent.stats?.spd || 20) : (activeOpponent.stats?.def || 20);

      const baseDmg = (((2 * activePlayer.level) / 5 + 2) * move.power * (atkStat / defStat)) / 50 + 2;
      finalDamage = Math.max(1, Math.floor(baseDmg * stabMult * multiplier * critMult * randomMult * terrainMult * heldItemMult));

      // Apply secondary move effect chance if any
      if (move.effect && move.effect.type === 'status_condition' && move.effect.condition) {
        const chance = move.effect.chance ?? 20;
        if (activeOpponent.status === 'None' && Math.random() * 100 <= chance) {
          activeOpponent.status = move.effect.condition;
          addLog(`✨ 附加效果！${activeOpponent.nameZh} 陷入了【${move.effect.condition}】狀態！`);
        }
      }
    }

    if (finalDamage > 0) {
      sound.playHit(multiplier > 1, multiplier < 1);
      setAttackFx({
        active: true,
        moveType: move.type,
        target: 'opponent',
        damage: finalDamage,
        isCrit,
      });
      setShakeTarget('opponent');
    }

    addLog(
      `${activePlayer.nameZh} 使用了【${move.nameZh}】！${effMsg.textZh ? ` (${effMsg.textZh})` : ''}${
        isCrit ? ' 💥 致命一擊！' : ''
      }`
    );

    await sleep(600);
    setShakeTarget(null);

    // Apply HP Reduction to Opponent with Immutable React State Update
    const nextHp = Math.max(0, activeOpponent.currentHp - finalDamage);
    activeOpponent.currentHp = nextHp;
    setOpponentTeam((prev) =>
      prev.map((p, idx) => (idx === activeOpponentIndex ? { ...p, currentHp: nextHp } : p))
    );

    await sleep(800);
    setAttackFx({ active: false });

    // Check Opponent Fainting
    if (nextHp <= 0) {
      sound.playFaint();
      addLog(`${activeOpponent.nameZh} 倒下了！`);

      // Unlock species in Pokedex
      unlockSpecies(activeOpponent.speciesId);

      // Check if opponent has more team members
      const nextOppIndex = opponentTeam.findIndex((p, idx) => idx > activeOpponentIndex && p.currentHp > 0);
      if (nextOppIndex !== -1) {
        await sleep(1000);
        setActiveOpponentIndex(nextOppIndex);
        addLog(`${trainer?.name || '對手'} 換上了 ${opponentTeam[nextOppIndex].nameZh}！`);
        setIsProcessing(false);
        return;
      }

      // Victory Achieved!
      await sleep(1200);
      sound.playLevelUp();

      // EXP & Coin Calculations
      const totalExpGained = Math.floor(activeOpponent.level * 28 * (trainer ? 1.5 : 1.0));
      const coinsEarned = Math.floor(activeOpponent.level * 18 + Math.random() * 20);

      // Apply EXP
      activePlayer.exp += totalExpGained;
      if (activePlayer.exp >= activePlayer.maxExp) {
        activePlayer.level += 1;
        activePlayer.maxExp = Math.floor(activePlayer.maxExp * 1.25);
        activePlayer.maxHp += 6;
        activePlayer.currentHp = Math.min(activePlayer.maxHp, activePlayer.currentHp + 6);
        if (activePlayer.stats) {
          activePlayer.stats.atk += 2;
          activePlayer.stats.def += 2;
          activePlayer.stats.spe += 2;
        }
        addLog(`🎉 ${activePlayer.nameZh} 等級提升到了 Lv.${activePlayer.level}！`);
      }

      const finalParty = party.map((p, idx) => (idx === activePlayerIndex ? { ...activePlayer } : p));
      onBattleEnd({
        victory: true,
        expGained: totalExpGained,
        coinsEarned,
        updatedParty: finalParty,
        updatedInventory: inventory,
      });
      return;
    }

    // Opponent's Turn
    await sleep(600);
    await processOpponentTurn();
  };

  // Opponent AI Turn
  const processOpponentTurn = async () => {
    if (activeOpponent.currentHp <= 0) {
      setIsProcessing(false);
      return;
    }

    // Start of Turn: Opponent Status Condition Damage (Burn / Poison) evaluated before next attack
    if (activeOpponent.status === 'Burn' || activeOpponent.status === 'Poison') {
      const dmg = Math.floor(activeOpponent.maxHp * 0.125);
      const nextHp = Math.max(0, activeOpponent.currentHp - dmg);
      activeOpponent.currentHp = nextHp;
      setOpponentTeam((prev) =>
        prev.map((p, idx) => (idx === activeOpponentIndex ? { ...p, currentHp: nextHp } : p))
      );
      addLog(`對手 ${activeOpponent.nameZh} 受到了 ${activeOpponent.status === 'Burn' ? '灼傷' : '中毒'} 傷害！`);
      await sleep(1000);
      if (nextHp <= 0) {
        sound.playFaint();
        addLog(`對手 ${activeOpponent.nameZh} 倒下了！`);
        unlockSpecies(activeOpponent.speciesId);

        const nextOppIndex = opponentTeam.findIndex((p, idx) => idx > activeOpponentIndex && p.currentHp > 0);
        if (nextOppIndex !== -1) {
          await sleep(1000);
          setActiveOpponentIndex(nextOppIndex);
          addLog(`${trainer?.name || '對手'} 換上了 ${opponentTeam[nextOppIndex].nameZh}！`);
          setIsProcessing(false);
          return;
        }

        await sleep(1200);
        sound.playLevelUp();
        const totalExpGained = Math.floor(activeOpponent.level * 28 * (trainer ? 1.5 : 1.0));
        const coinsEarned = Math.floor(activeOpponent.level * 18 + Math.random() * 20);
        activePlayer.exp += totalExpGained;
        if (activePlayer.exp >= activePlayer.maxExp) {
          activePlayer.level += 1;
          activePlayer.maxExp = Math.floor(activePlayer.maxExp * 1.25);
          activePlayer.maxHp += 6;
          activePlayer.currentHp = Math.min(activePlayer.maxHp, activePlayer.currentHp + 6);
          if (activePlayer.stats) {
            activePlayer.stats.atk += 2;
            activePlayer.stats.def += 2;
            activePlayer.stats.spe += 2;
          }
          addLog(`🎉 ${activePlayer.nameZh} 等級提升到了 Lv.${activePlayer.level}！`);
        }
        const finalParty = party.map((p, idx) => (idx === activePlayerIndex ? { ...activePlayer } : p));
        onBattleEnd({
          victory: true,
          expGained: totalExpGained,
          coinsEarned,
          updatedParty: finalParty,
          updatedInventory: inventory,
        });
        return;
      }
    }

    // Pick Random Move
    const validMoves = activeOpponent.moves.filter((m) => (m.currentPp !== undefined ? m.currentPp : (m.maxPp ?? m.pp ?? 20)) > 0);
    const selectedMove = validMoves.length > 0
      ? validMoves[Math.floor(Math.random() * validMoves.length)]
      : activeOpponent.moves[0];

    // Deduct PP from opponent move
    const curOppPp = selectedMove.currentPp !== undefined ? selectedMove.currentPp : (selectedMove.maxPp ?? selectedMove.pp ?? 20);
    const nextOppPp = Math.max(0, curOppPp - 1);
    selectedMove.currentPp = nextOppPp;

    setOpponentTeam((prev) =>
      prev.map((opp, oppIdx) => {
        if (oppIdx !== activeOpponentIndex) return opp;
        return {
          ...opp,
          moves: opp.moves.map((m) => (m.id === selectedMove.id ? { ...m, currentPp: nextOppPp } : m)),
        };
      })
    );

    const multiplier = getTypeEffectiveness(selectedMove.type, activePlayer.types);
    const effMsg = getEffectivenessMessage(multiplier);
    const isCrit = selectedMove.category !== 'Status' && Math.random() < 0.1;
    const critMult = isCrit ? 1.5 : 1.0;
    const stabMult = activeOpponent.types.includes(selectedMove.type) ? 1.5 : 1.0;
    const randomMult = 0.85 + Math.random() * 0.15;

    let terrainMult = 1.0;
    if (fieldTerrain) {
      if (fieldTerrain.boostedTypes.includes(selectedMove.type)) terrainMult = 1.3;
      if (fieldTerrain.nerfedTypes.includes(selectedMove.type)) terrainMult = 0.8;
    }

    let finalDamage = 0;

    if (selectedMove.category === 'Status' || selectedMove.power === 0) {
      finalDamage = 0;
      if (selectedMove.effect) {
        if (selectedMove.effect.type === 'status_condition' && selectedMove.effect.condition) {
          const chance = selectedMove.effect.chance ?? 100;
          if (activePlayer.status === 'None' && Math.random() * 100 <= chance) {
            activePlayer.status = selectedMove.effect.condition;
            addLog(`對手攻勢！${activePlayer.nameZh} 陷入了【${selectedMove.effect.condition}】狀態！`);
          }
        } else if (selectedMove.effect.type === 'stat_debuff' && selectedMove.effect.stat) {
          addLog(`${activePlayer.nameZh} 的 ${selectedMove.effect.stat.toUpperCase()} 被降低了！`);
        } else if (selectedMove.effect.type === 'stat_buff' && selectedMove.effect.stat) {
          addLog(`對手 ${activeOpponent.nameZh} 的 ${selectedMove.effect.stat.toUpperCase()} 提升了！`);
        }
      }
    } else {
      // Physical vs Special Split
      const isSpecial = selectedMove.category === 'Special';
      const atkStat = isSpecial ? (activeOpponent.stats?.spa || 20) : (activeOpponent.stats?.atk || 20);
      const defStat = isSpecial ? (activePlayer.stats?.spd || 20) : (activePlayer.stats?.def || 20);

      const baseDmg = (((2 * activeOpponent.level) / 5 + 2) * selectedMove.power * (atkStat / defStat)) / 50 + 2;
      finalDamage = Math.max(1, Math.floor(baseDmg * stabMult * multiplier * critMult * randomMult * terrainMult));

      // Apply secondary move effect
      if (selectedMove.effect && selectedMove.effect.type === 'status_condition' && selectedMove.effect.condition) {
        const chance = selectedMove.effect.chance ?? 20;
        if (activePlayer.status === 'None' && Math.random() * 100 <= chance) {
          activePlayer.status = selectedMove.effect.condition;
          addLog(`✨ 附加效果！${activePlayer.nameZh} 陷入了【${selectedMove.effect.condition}】狀態！`);
        }
      }
    }

    if (finalDamage > 0) {
      sound.playHit(multiplier > 1, multiplier < 1);
      setAttackFx({
        active: true,
        moveType: selectedMove.type,
        target: 'player',
        damage: finalDamage,
        isCrit,
      });
      setShakeTarget('player');
    }

    const oppMoveMaxPp = selectedMove.maxPp ?? selectedMove.pp ?? 20;
    addLog(
      `對手 ${activeOpponent.nameZh} 使用了【${selectedMove.nameZh}】！(剩餘 PP: ${nextOppPp}/${oppMoveMaxPp})${effMsg.textZh ? ` (${effMsg.textZh})` : ''}`
    );

    await sleep(600);
    setShakeTarget(null);

    // Apply HP Reduction to Player with Immutable React State Update
    const nextPlayerHp = Math.max(0, activePlayer.currentHp - finalDamage);
    activePlayer.currentHp = nextPlayerHp;
    setParty((prev) =>
      prev.map((p, idx) => (idx === activePlayerIndex ? { ...p, currentHp: nextPlayerHp } : p))
    );

    await sleep(800);
    setAttackFx({ active: false });

    // Check Player Fainting
    if (nextPlayerHp <= 0) {
      sound.playFaint();
      addLog(`${activePlayer.nameZh} 倒下了！`);

      // Check if player has alive bench members
      const aliveIndex = party.findIndex((p) => p.currentHp > 0);
      if (aliveIndex !== -1) {
        await sleep(1000);
        setActivePlayerIndex(aliveIndex);
        addLog(`上吧！${party[aliveIndex].nameZh}！`);
        setIsProcessing(false);
        return;
      }

      // Total Defeat
      await sleep(1200);
      onBattleEnd({
        victory: false,
        expGained: 0,
        coinsEarned: 0,
        updatedParty: party,
        updatedInventory: inventory,
      });
      return;
    }

    setIsProcessing(false);
  };

  // Attempt Catch Wild Pokemon
  const handleThrowPokeball = async (ballItem: Item) => {
    if (trainer) {
      sound.playSelect();
      addLog(`⚠️ 不能偷捕取訓練家的寶可夢！`);
      return;
    }
    if (isProcessing) return;
    setIsProcessing(true);
    setDrawer('none');

    // Deduct Pokeball
    setInventory((prev) =>
      prev.map((i) => (i.item.id === ballItem.id ? { ...i, count: i.count - 1 } : i))
    );

    addLog(`投擲了【${ballItem.nameZh}】！`);
    sound.playPokeballShake();

    // Catch rate formula
    const hpFactor = (3 * activeOpponent.maxHp - 2 * activeOpponent.currentHp) / (3 * activeOpponent.maxHp);
    const catchMultiplier = ballItem.id === 'ultra_ball' ? 2.0 : ballItem.id === 'great_ball' ? 1.5 : 1.0;
    const catchChance = Math.min(0.95, hpFactor * 0.45 * catchMultiplier);

    setCatchState({ inProgress: true, shakes: 1, success: null });
    await sleep(900);
    sound.playPokeballShake();
    setCatchState({ inProgress: true, shakes: 2, success: null });
    await sleep(900);
    sound.playPokeballShake();
    setCatchState({ inProgress: true, shakes: 3, success: null });
    await sleep(900);

    const isCaught = Math.random() < catchChance;

    if (isCaught) {
      sound.playLevelUp();
      setCatchState({ inProgress: false, shakes: 3, success: true });
      addLog(`✨ 太棒了！成功捕捉到了 ${activeOpponent.nameZh}！`);

      // Unlock species
      unlockSpecies(activeOpponent.speciesId);

      await sleep(1200);
      onBattleEnd({
        victory: true,
        caughtPokemon: activeOpponent,
        expGained: activeOpponent.level * 15,
        coinsEarned: 30,
        updatedParty: party,
        updatedInventory: inventory,
      });
    } else {
      sound.playFaint();
      setCatchState({ inProgress: false, shakes: 0, success: false });
      addLog(`可惡！野生 ${activeOpponent.nameZh} 掙脫了精靈球！`);
      await sleep(800);
      await processOpponentTurn();
    }
  };

  // Attempt Fleeing
  const handleFlee = async () => {
    if (trainer) {
      sound.playSelect();
      addLog(`⚠️ 正式訓練家對戰中無法逃跑！`);
      return;
    }
    if (isProcessing) return;
    setIsProcessing(true);

    const fleeSuccess = Math.random() < 0.75;
    if (fleeSuccess) {
      sound.playSelect();
      addLog(`成功逃跑了！`);
      await sleep(800);
      onBattleEnd({
        victory: false,
        fled: true,
        expGained: 0,
        coinsEarned: 0,
        updatedParty: party,
        updatedInventory: inventory,
      });
    } else {
      sound.playHit(false, true);
      addLog(`逃跑失敗！被迫留下戰鬥！`);
      await sleep(800);
      await processOpponentTurn();
    }
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const getHpColor = (cur: number, max: number) => {
    const pct = (cur / max) * 100;
    if (pct > 50) return 'bg-emerald-400';
    if (pct > 20) return 'bg-amber-400';
    return 'bg-rose-500 animate-pulse';
  };

  return (
    <div className="relative w-full h-[calc(100dvh-1rem)] sm:h-[650px] md:h-[750px] max-h-[100dvh] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 flex flex-col select-none animate-pop">
      {/* Pure 2D Biome Battle Scene Background (NO CHARACTERS IN BACKGROUND) */}
      <PixelBattleScene2D fieldTerrain={fieldTerrain} />

      {/* Top Header HUD Bar */}
      <div className="relative z-20 w-full px-3 py-2 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Swords className="w-4 h-4 text-rose-400 animate-pulse" />
          <span className="font-bold text-xs sm:text-sm text-white">
            {trainer ? `訓練家對決 · ${trainer.name}` : `野生遭遇戰 · ${activeOpponent.nameZh}`}
          </span>
        </div>

        {/* HUD Compact Toggle */}
        <button
          onClick={() => {
            sound.playSelect();
            setIsHudCompact((prev) => !prev);
          }}
          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 font-semibold cursor-pointer transition-all"
        >
          {isHudCompact ? '🔍 展開' : '📐 縮小'}
        </button>
      </div>

      {/* Weather Overlay */}
      {fieldTerrain && (
        <div className="absolute inset-0 z-15 pointer-events-none opacity-30">
          {fieldTerrain.id === 'ice_tundra' && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
          {fieldTerrain.id === 'sandstorm_ruin' && <div className="absolute inset-0 bg-amber-600/30 animate-pulse" />}
          {fieldTerrain.id === 'water_lake' && <div className="absolute inset-0 bg-sky-600/30 animate-pulse" />}
          {fieldTerrain.id === 'fire_cave' && <div className="absolute inset-0 bg-orange-600/30 animate-pulse" />}
        </div>
      )}

      {/* Attack Damage Floating Banner Effect */}
      {attackFx.active && attackFx.damage !== undefined && (

        <div
          className={`absolute z-40 transition-all pointer-events-none ${
            attackFx.target === 'opponent'
              ? 'top-16 right-16 md:right-36 animate-shake'
              : 'bottom-32 left-16 md:left-36 animate-shake'
          }`}
        >
          <div className="relative flex flex-col items-center justify-center animate-pop">
            {attackFx.isCrit && (
              <span className="text-[9px] md:text-xs font-black tracking-widest text-rose-400 uppercase bg-black/80 px-2 py-0.5 rounded border border-rose-500 shadow-md mb-0.5">
                ⚡ CRITICAL!
              </span>
            )}
            <span className="text-3xl md:text-5xl font-black font-mono tracking-tight text-amber-300 drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)]">
              -{attackFx.damage}
            </span>
          </div>
        </div>
      )}

      {/* Main Battle Field (Pure 2D Pokemon Sprites Layer) */}
      <div className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-3 flex flex-col justify-between py-2 sm:py-4">
        {/* Opponent Area (Top Right) */}
        <div className="flex items-end justify-end gap-2 sm:gap-6">
          <div
            className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1.5 sm:p-2.5 min-w-[140px] sm:min-w-[210px] shadow-none !shadow-none drop-shadow-none"
            style={{ boxShadow: 'none', filter: 'none' }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold text-white text-[11px] sm:text-sm truncate max-w-[90px] sm:max-w-[130px]">
                {activeOpponent.nameZh}
              </span>
              <span className="font-mono text-[10px] sm:text-xs text-amber-400 font-bold shrink-0">Lv.{activeOpponent.level}</span>
            </div>

            <div className="space-y-0.5 sm:space-y-1">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-400">
                <span className="font-bold">HP</span>
                <span className="font-mono tabular-nums text-white">
                  {Math.max(0, activeOpponent.currentHp)} / {Math.max(1, activeOpponent.maxHp)}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1 sm:h-1.5 overflow-hidden border border-slate-700/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getHpColor(
                    activeOpponent.currentHp,
                    activeOpponent.maxHp
                  )}`}
                  style={{ width: `${Math.min(100, Math.max(0, (activeOpponent.currentHp / (activeOpponent.maxHp || 1)) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Opponent 2D Sprite */}
          <div className={`transition-transform duration-150 scale-90 sm:scale-100 ${shakeTarget === 'opponent' ? 'animate-bounce' : ''}`}>
            {catchState.inProgress ? (
              <div className="w-20 h-20 flex flex-col items-center justify-center">
                <div
                  className={`w-10 h-10 rounded-full border-2 border-white flex flex-col overflow-hidden shadow-2xl ${
                    catchState.shakes > 0 ? 'animate-spin' : ''
                  }`}
                >
                  <div className="bg-rose-600 h-1/2 w-full" />
                  <div className="bg-white h-1/2 w-full flex items-center justify-center relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-900 absolute -top-1 shadow" />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-300 mt-1">
                  第 {catchState.shakes} 次...
                </span>
              </div>
            ) : (
              <PokemonSprite
                speciesId={activeOpponent.speciesId}
                nameZh={activeOpponent.nameZh}
                types={activeOpponent.types}
                isShiny={activeOpponent.isShiny}
                size="lg"
                condition={activeOpponent.status}
              />
            )}
          </div>
        </div>

        {/* Player Area (Bottom Left) */}
        <div className="flex items-start justify-start gap-2 sm:gap-6 mt-1">
          {/* Player 2D Back Sprite */}
          <div className={`transition-transform duration-150 scale-90 sm:scale-100 ${shakeTarget === 'player' ? 'animate-pulse scale-95' : ''}`}>
            <PokemonSprite
              speciesId={activePlayer.speciesId}
              nameZh={activePlayer.nameZh}
              types={activePlayer.types}
              isShiny={activePlayer.isShiny}
              isBack={true}
              size="lg"
              condition={activePlayer.status}
            />
          </div>

          {/* Player Status HUD */}
          <div
            className={`bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl transition-all shadow-none !shadow-none drop-shadow-none ${
              isHudCompact ? 'p-1.5 min-w-[150px]' : 'p-2.5 min-w-[210px]'
            }`}
            style={{ boxShadow: 'none', filter: 'none' }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1">
                <span className={`font-bold text-white ${isHudCompact ? 'text-[11px]' : 'text-sm'}`}>
                  {activePlayer.nameZh}
                </span>
                {activePlayer.heldItem && !isHudCompact && (
                  <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {activePlayer.heldItem.nameZh}
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-sky-400 font-bold">Lv.{activePlayer.level}</span>
            </div>

            {!isHudCompact && (
              <div className="flex gap-1 mb-1">
                {activePlayer.types.map((t) => (
                  <span
                    key={t}
                    className="text-[8px] px-1.5 py-0.2 rounded font-semibold"
                    style={{ backgroundColor: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].text }}
                  >
                    {TYPE_NAMES_ZH[t]}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-bold">HP</span>
                <span className="font-mono tabular-nums text-white text-[10px]">
                  {Math.max(0, activePlayer.currentHp)} / {Math.max(1, activePlayer.maxHp)}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getHpColor(
                    activePlayer.currentHp,
                    activePlayer.maxHp
                  )}`}
                  style={{ width: `${Math.min(100, Math.max(0, (activePlayer.currentHp / (activePlayer.maxHp || 1)) * 100))}%` }}
                />
              </div>
            </div>

            {!isHudCompact && (
              <div className="space-y-0.5 mt-1.5">
                <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (activePlayer.exp / activePlayer.maxExp) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STREAMLINED Action Pad: Direct 1-Click Move Execution & Keyboard Shortcuts */}
      <div className="relative z-20 w-full bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-2 sm:p-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-2 sm:gap-3 items-stretch">
          {/* Quick Battle Narrative (Left) */}
          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col justify-between min-h-[70px]">
            <div className="text-xs text-slate-200 font-medium space-y-1">
              {battleLog.slice(-2).map((log, i) => (
                <div key={i} className="flex items-center gap-1.5 animate-fadeIn">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>{log}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>快捷鍵: 1-4 招式 · B 背包 · P 隊伍 · R 逃跑</span>
              <span className="text-amber-400/80 font-mono">回合即時交戰</span>
            </div>
          </div>

          {/* Direct 4 Moves Grid (Center/Right) */}
          <div className="flex-[2] grid grid-cols-2 gap-2">
            {activePlayer.moves.map((move, idx) => {
              const typeColor = TYPE_COLORS[move.type] || TYPE_COLORS.Normal;
              const curPp = move.currentPp !== undefined ? move.currentPp : (move.maxPp ?? move.pp ?? 20);
              const maxPp = move.maxPp ?? move.pp ?? 20;
              const hasPp = curPp > 0;

              return (
                <button
                  key={move.id || idx}
                  disabled={isProcessing || !hasPp}
                  onClick={() => executePlayerMove(move, idx)}
                  className={`relative overflow-hidden p-2.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                    hasPp
                      ? 'bg-slate-900/90 hover:bg-slate-800/90 hover:border-white border-slate-700/80'
                      : 'bg-slate-950/80 border-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold font-mono flex items-center justify-center border border-slate-700">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-white">{move.nameZh}</span>
                    </div>

                    <span
                      className="text-[9px] px-1.5 py-0.2 rounded font-semibold shadow-sm"
                      style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
                    >
                      {TYPE_NAMES_ZH[move.type]}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span>威力: {move.power}</span>
                    <span className={hasPp ? 'text-amber-300 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30' : 'text-rose-400 font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30'}>
                      PP {curPp}/{maxPp}
                    </span>
                  </div>
                  {/* Visual Mini PP Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full transition-all ${
                        curPp / maxPp > 0.5 ? 'bg-emerald-400' : curPp / maxPp > 0.2 ? 'bg-amber-400' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, (curPp / maxPp) * 100))}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Item / Party / Flee Buttons (Right) */}
          <div className="flex md:flex-col gap-2 min-w-[120px]">
            <button
              disabled={isProcessing}
              onClick={() => {
                sound.playSelect();
                setDrawer('bag');
              }}
              className="flex-1 py-2 px-3 rounded-2xl bg-sky-950/80 hover:bg-sky-900/90 border border-sky-500/40 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Backpack className="w-3.5 h-3.5 text-sky-400" />
              <span>背包 (B)</span>
            </button>

            <button
              disabled={isProcessing}
              onClick={() => {
                sound.playSelect();
                setDrawer('party');
              }}
              className="flex-1 py-2 px-3 rounded-2xl bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>隊伍 (P)</span>
            </button>

            <button
              disabled={isProcessing || !!trainer}
              onClick={handleFlee}
              className="flex-1 py-2 px-3 rounded-2xl bg-rose-950/80 hover:bg-rose-900/90 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Footprints className="w-3.5 h-3.5 text-rose-400" />
              <span>逃跑 (R)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bag Small Modal Window */}
      {drawer === 'bag' && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <Backpack className="w-5 h-5" />
                <span>戰鬥道具小視窗 · 使用道具或投擲精靈球</span>
              </div>
              <button
                onClick={() => setDrawer('none')}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
                title="關閉 (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[55vh]">
              {inventory.filter((i) => i.count > 0).length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  背包中暫無可用道具
                </div>
              ) : (
                inventory
                  .filter((i) => i.count > 0)
                  .map((inv) => (
                    <button
                      key={inv.item.id}
                      disabled={isProcessing}
                      onClick={() => {
                        if (inv.item.type === 'pokeball') {
                          handleThrowPokeball(inv.item);
                        } else if (inv.item.restorePpAmount || inv.item.restoreAllPp || inv.item.id === 'ether' || inv.item.id === 'elixir' || inv.item.id === 'max_elixir') {
                          // PP Recovery Item Usage
                          const restorePp = inv.item.restorePpAmount || (inv.item.id === 'max_elixir' ? 999 : 6);
                          const updatedMoves = activePlayer.moves.map((m) => {
                            const maxMpp = m.maxPp ?? m.pp ?? 12;
                            const curMpp = m.currentPp !== undefined ? m.currentPp : maxMpp;
                            const newPp = inv.item.restoreAllPp ? maxMpp : Math.min(maxMpp, curMpp + restorePp);
                            return { ...m, currentPp: newPp };
                          });
                          activePlayer.moves = updatedMoves;
                          setParty((prev) =>
                            prev.map((p, pIdx) => (pIdx === activePlayerIndex ? { ...activePlayer, moves: updatedMoves } : p))
                          );
                          inv.count -= 1;
                          sound.playRest();
                          addLog(`使用了【${inv.item.nameZh}】，為 ${activePlayer.nameZh} 恢復了招式 PP 能量！`);
                          setDrawer('none');
                          processOpponentTurn();
                        } else {
                          // Healing Item Usage
                          if (activePlayer.currentHp >= activePlayer.maxHp) {
                            sound.playSelect();
                            addLog(`${activePlayer.nameZh} 生命值已滿！`);
                            return;
                          }
                          const healAmt = inv.item.healAmount || 50;
                          activePlayer.currentHp = Math.min(activePlayer.maxHp, activePlayer.currentHp + healAmt);
                          inv.count -= 1;
                          sound.playRest();
                          addLog(`使用了【${inv.item.nameZh}】，回復了 ${healAmt} HP！`);
                          setDrawer('none');
                          processOpponentTurn();
                        }
                      }}
                      className="w-full p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-sky-500/60 text-left transition-all cursor-pointer flex items-center justify-between shadow-sm active:scale-98"
                    >
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-bold text-xs text-white">{inv.item.nameZh}</div>
                          <div className="text-[10px] text-slate-400 leading-tight">{inv.item.description}</div>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 shrink-0">
                        x{inv.count}
                      </span>
                    </button>
                  ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setDrawer('none')}
                className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold transition-colors cursor-pointer"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Party Small Modal Window */}
      {drawer === 'party' && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Users className="w-5 h-5" />
                <span>替換隊員小視窗 · 選擇登場寶可夢</span>
              </div>
              <button
                onClick={() => setDrawer('none')}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
                title="關閉 (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[55vh]">
              {party.map((pkm, idx) => {
                const isCurrent = idx === activePlayerIndex;
                const isFainted = pkm.currentHp <= 0;

                return (
                  <button
                    key={pkm.uid || idx}
                    disabled={isCurrent || isFainted || isProcessing}
                    onClick={async () => {
                      sound.playSelect();
                      setActivePlayerIndex(idx);
                      setDrawer('none');
                      addLog(`回來吧！換上 ${pkm.nameZh}！`);
                      setIsProcessing(true);
                      await sleep(800);
                      processOpponentTurn();
                    }}
                    className={`w-full p-2.5 rounded-xl border transition-all text-left flex items-center justify-between ${
                      isCurrent
                        ? 'bg-slate-950 border-rose-500/60 ring-1 ring-rose-500/20'
                        : isFainted
                        ? 'bg-slate-950/60 border-slate-900 opacity-50 cursor-not-allowed'
                        : 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/60 cursor-pointer active:scale-98'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 flex items-center justify-center shrink-0">
                        <PokemonSprite
                          speciesId={pkm.speciesId}
                          pokedexNo={pkm.pokedexNo}
                          nameZh={pkm.nameZh}
                          types={pkm.types}
                          isShiny={pkm.isShiny}
                          isFainted={isFainted}
                          size="sm"
                        />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-1.5">
                          <span>{pkm.nameZh}</span>
                          <span className="text-[10px] text-amber-400 font-mono">Lv.{pkm.level}</span>
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                              出戰中
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          HP {pkm.currentHp} / {pkm.maxHp}
                        </div>
                      </div>
                    </div>

                    {isFainted ? (
                      <span className="text-xs font-bold text-rose-500">瀕死</span>
                    ) : isCurrent ? (
                      <span className="text-xs font-bold text-slate-500">出戰中</span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400">登場 ➔</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setDrawer('none')}
                className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold transition-colors cursor-pointer"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

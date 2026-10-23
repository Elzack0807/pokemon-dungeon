import React, { useState, useEffect, useRef } from 'react';
import { PokemonInstance, MoveInstance, Trainer, Item } from '../types/pokemon';
import { PokemonSprite } from './PokemonSprite';
import { HD2DBattleScene, CameraPreset } from './HD2DBattleScene';
import { TYPE_COLORS, TYPE_NAMES_ZH, getTypeEffectiveness, getEffectivenessMessage } from '../utils/typeChart';
import { sound } from '../utils/audio';
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
  onBattleEnd,
}) => {
  const [party, setParty] = useState<PokemonInstance[]>(initialParty);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [inventory, setInventory] = useState<{ item: Item; count: number }[]>(initialInventory);

  const [opponentTeam, setOpponentTeam] = useState<PokemonInstance[]>(
    trainer ? trainer.team : initialWild ? [initialWild] : []
  );
  const [activeOpponentIndex, setActiveOpponentIndex] = useState<number>(0);

  // Visual mode: HD-2D 3D vs Classic 2D
  const [renderMode, setRenderMode] = useState<'hd2d' | 'classic'>('hd2d');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');

  const cycleCameraPreset = () => {
    sound.playSelect();
    setCameraPreset((prev) => {
      if (prev === 'isometric') return 'action';
      if (prev === 'action') return 'tactical';
      return 'isometric';
    });
  };

  // Sub-drawers for bag or party (only when opened; moves are directly visible!)
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

  const activePlayer = party[activePlayerIndex];
  const activeOpponent = opponentTeam[activeOpponentIndex];

  // Initial greeting log
  useEffect(() => {
    if (trainer) {
      setBattleLog([
        `${trainer.name} 派出了 ${activeOpponent.nameZh}！`,
        `去吧，${activePlayer.nameZh}！`,
      ]);
    } else if (activeOpponent) {
      setBattleLog([
        `野生的 ${activeOpponent.isShiny ? '✨ 異色 ' : ''}${activeOpponent.nameZh} 出現了！`,
        `就決定是你了，${activePlayer.nameZh}！`,
      ]);
    }
  }, []);

  const addLog = (msg: string) => {
    setBattleLog((prev) => [...prev.slice(-4), msg]);
  };

  // Keyboard shortcut for 1, 2, 3, 4 moves
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing || drawer !== 'none') return;
      const key = parseInt(e.key);
      if (key >= 1 && key <= 4 && activePlayer.moves[key - 1]) {
        executePlayerMove(activePlayer.moves[key - 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProcessing, drawer, activePlayer]);

  // Damage formula
  const calculateDamage = (
    attacker: PokemonInstance,
    defender: PokemonInstance,
    move: MoveInstance
  ) => {
    if (move.category === 'Status' || move.power === 0) {
      return { damage: 0, typeMult: 1, isCrit: false };
    }

    const isPhysical = move.category === 'Physical';
    const atkStat = isPhysical ? attacker.stats.atk : attacker.stats.spa;
    const defStat = isPhysical ? defender.stats.def : defender.stats.spd;

    const atkStage = isPhysical ? attacker.statStages.atk : attacker.statStages.spa;
    const defStage = isPhysical ? defender.statStages.def : defender.statStages.spd;
    const getStageMult = (s: number) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

    const effectiveAtk = atkStat * getStageMult(atkStage);
    const effectiveDef = defStat * getStageMult(defStage);

    const levelFactor = (2 * attacker.level) / 5 + 2;
    let baseDamage = ((levelFactor * move.power * (effectiveAtk / Math.max(1, effectiveDef))) / 50) + 2;

    const isStab = attacker.types.includes(move.type);
    const stabMultiplier = isStab ? (attacker.ability.id === 'adaptability' ? 2.0 : 1.5) : 1.0;
    baseDamage *= stabMultiplier;

    const typeMult = getTypeEffectiveness(move.type, defender.types);
    baseDamage *= typeMult;

    if (attacker.heldItem?.heldEffect?.type === 'type_boost' && attacker.heldItem.heldEffect.boostType === move.type) {
      baseDamage *= (attacker.heldItem.heldEffect.multiplier || 1.25);
    }
    if (attacker.heldItem?.heldEffect?.type === 'stat_boost' && attacker.heldItem.heldEffect.stat === 'atk') {
      baseDamage *= (attacker.heldItem.heldEffect.multiplier || 1.2);
    }

    const hpRatio = attacker.currentHp / attacker.maxHp;
    if (hpRatio < 0.35) {
      if (attacker.ability.id === 'blaze' && move.type === 'Fire') baseDamage *= 1.5;
      if (attacker.ability.id === 'torrent' && move.type === 'Water') baseDamage *= 1.5;
      if (attacker.ability.id === 'overgrow' && move.type === 'Grass') baseDamage *= 1.5;
    }

    const isCrit = Math.random() < (move.id === 'slash' || move.id === 'razor_leaf' ? 0.25 : 0.08);
    if (isCrit) {
      baseDamage *= 1.5;
    }

    // Underdog damage boost when player is lower level than opponent
    const isPlayerAttacking = attacker.uid === activePlayer.uid;
    if (isPlayerAttacking && attacker.level < defender.level) {
      const levelDiff = defender.level - attacker.level;
      baseDamage *= (1 + Math.min(0.5, levelDiff * 0.15));
    }

    const variance = 0.88 + Math.random() * 0.12;
    const finalDamage = Math.max(1, Math.floor(baseDamage * variance));

    return { damage: finalDamage, typeMult, isCrit };
  };

  // Turn execution
  const executePlayerMove = async (move: MoveInstance) => {
    if (isProcessing || move.currentPp <= 0) return;
    setIsProcessing(true);
    setDrawer('none');

    // Deduct PP
    const updatedMoves = activePlayer.moves.map((m) =>
      m.id === move.id ? { ...m, currentPp: m.currentPp - 1 } : m
    );
    activePlayer.moves = updatedMoves;

    const playerSpeed = activePlayer.stats.spe * (activePlayer.heldItem?.heldEffect?.stat === 'spe' ? 1.35 : 1.0);
    const opponentSpeed = activeOpponent.stats.spe;
    const playerGoesFirst = playerSpeed >= opponentSpeed;

    if (playerGoesFirst) {
      await performAttack(activePlayer, activeOpponent, move, 'opponent');
      if (activeOpponent.currentHp > 0) {
        await new Promise((r) => setTimeout(r, 450));
        await performOpponentTurn();
      } else {
        await handleOpponentFaint();
      }
    } else {
      await performOpponentTurn();
      if (activePlayer.currentHp > 0) {
        await new Promise((r) => setTimeout(r, 450));
        await performAttack(activePlayer, activeOpponent, move, 'opponent');
        if (activeOpponent.currentHp <= 0) {
          await handleOpponentFaint();
        }
      } else {
        await handlePlayerFaint();
      }
    }

    handleTurnEndEffects();
    setIsProcessing(false);
  };

  const performAttack = async (
    attacker: PokemonInstance,
    defender: PokemonInstance,
    move: MoveInstance,
    targetKey: 'player' | 'opponent'
  ) => {
    addLog(`${attacker.nameZh} 使出了【${move.nameZh}】！`);

    // True strike accuracy floor & bonus for player
    const meta = loadMetaProgression();
    const trueStrikeLvl = meta.talents.trueStrike || 0;
    const accuracyBonus = trueStrikeLvl * 6;
    const effectiveAccuracy = targetKey === 'opponent'
      ? Math.min(100, Math.max(92, move.accuracy + accuracyBonus))
      : move.accuracy;

    if (Math.random() * 100 > effectiveAccuracy) {
      await new Promise((r) => setTimeout(r, 300));
      addLog(`招式未命中！`);
      return;
    }

    if (move.category === 'Status') {
      if (move.effect?.type === 'stat_buff' && move.effect.stat) {
        attacker.statStages[move.effect.stat] = Math.min(6, (attacker.statStages[move.effect.stat] || 0) + (move.effect.amount || 1));
        sound.playSelect();
        addLog(`${attacker.nameZh} 攻擊力大幅提升！`);
      } else if (move.effect?.type === 'heal') {
        const healAmt = Math.floor(attacker.maxHp * ((move.effect.healPercent || 50) / 100));
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmt);
        sound.playRest();
        addLog(`${attacker.nameZh} 回復了 ${healAmt} HP！`);
      }
      return;
    }

    const { damage, typeMult, isCrit } = calculateDamage(attacker, defender, move);

    setShakeTarget(targetKey);
    sound.playHit(typeMult >= 2, typeMult < 1);
    await new Promise((r) => setTimeout(r, 180));
    setShakeTarget(null);

    if (defender.currentHp - damage <= 0) {
      if (defender.heldItem?.heldEffect?.type === 'focus_sash' && defender.currentHp === defender.maxHp) {
        defender.currentHp = 1;
        defender.heldItem = undefined;
        addLog(`${defender.nameZh} 靠氣勢披帶撐住了！`);
      } else if (targetKey === 'player' && Math.random() < (meta.talents.indomitable || 0) * 0.15) {
        defender.currentHp = 1;
        sound.playRest();
        addLog(`✨ ${defender.nameZh} 憑藉不屈意志撐住了致命打擊！殘留 1 HP！`);
      } else {
        defender.currentHp = Math.max(0, defender.currentHp - damage);
      }
    } else {
      defender.currentHp = Math.max(0, defender.currentHp - damage);
    }

    const effMsg = getEffectivenessMessage(typeMult);
    if (effMsg.textZh) {
      addLog(`${isCrit ? '要害擊中！' : ''} ${effMsg.textZh}`);
    }

    if (move.effect?.type === 'drain' && move.effect.healPercent) {
      const drainHeal = Math.floor(damage * (move.effect.healPercent / 100));
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + drainHeal);
    }

    setParty([...party]);
    setOpponentTeam([...opponentTeam]);
  };

  const performOpponentTurn = async () => {
    if (activeOpponent.currentHp <= 0) return;
    const availableMoves = activeOpponent.moves.filter((m) => m.currentPp > 0);
    const chosenMove = availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : activeOpponent.moves[0];

    if (chosenMove) {
      chosenMove.currentPp = Math.max(0, chosenMove.currentPp - 1);
      await performAttack(activeOpponent, activePlayer, chosenMove, 'player');
    }

    if (activePlayer.currentHp <= 0) {
      await handlePlayerFaint();
    }
  };

  const handleTurnEndEffects = () => {
    [activePlayer, activeOpponent].forEach((pkm) => {
      if (!pkm || pkm.currentHp <= 0) return;
      if (pkm.heldItem?.heldEffect?.type === 'leftovers') {
        const heal = Math.floor(pkm.maxHp * (pkm.heldItem.heldEffect.multiplier || 0.08));
        pkm.currentHp = Math.min(pkm.maxHp, pkm.currentHp + heal);
      }
      if (pkm.status === 'Burn') {
        const burnDmg = Math.max(1, Math.floor(pkm.maxHp * 0.06));
        pkm.currentHp = Math.max(0, pkm.currentHp - burnDmg);
      }
    });

    setParty([...party]);
    setOpponentTeam([...opponentTeam]);
  };

  const handleOpponentFaint = async () => {
    sound.playFaint();
    addLog(`對手的 ${activeOpponent.nameZh} 倒下了！`);

    // Record unlocked in Pokedex
    unlockSpecies(activeOpponent.speciesId);

    const nextOpponentIdx = opponentTeam.findIndex((p, idx) => idx > activeOpponentIndex && p.currentHp > 0);

    if (nextOpponentIdx !== -1) {
      await new Promise((r) => setTimeout(r, 600));
      setActiveOpponentIndex(nextOpponentIdx);
      const nextOpp = opponentTeam[nextOpponentIdx];
      addLog(`對手派出了 ${nextOpp.nameZh}！`);
    } else {
      await new Promise((r) => setTimeout(r, 500));
      sound.playVictory();
      addLog(`戰鬥勝利！`);

      const meta = loadMetaProgression();
      const expBonus = 1 + (meta.talents.expScholar || 0) * 0.2;
      const underdogExpMult = activeOpponent.level > activePlayer.level ? (1 + (activeOpponent.level - activePlayer.level) * 0.3) : 1.0;
      const baseExp = Math.floor(activeOpponent.level * 45 * expBonus * underdogExpMult);
      const baseCoins = trainer ? trainer.rewardCoins : Math.floor(activeOpponent.level * 18);
      const coinMultiplier = activePlayer.heldItem?.heldEffect?.type === 'coin_boost' ? 1.5 : 1.0;
      const finalCoins = Math.floor(baseCoins * coinMultiplier);

      setTimeout(() => {
        onBattleEnd({
          victory: true,
          expGained: baseExp,
          coinsEarned: finalCoins,
          rewardItem: trainer?.rewardItem,
          updatedParty: party,
          updatedInventory: inventory,
        });
      }, 900);
    }
  };

  const handlePlayerFaint = async () => {
    sound.playFaint();
    addLog(`${activePlayer.nameZh} 倒下了！`);

    const nextAliveIdx = party.findIndex((p) => p.currentHp > 0);
    const escapeRopeIndex = inventory.findIndex((i) => i.item.id === 'escape_rope' && i.count > 0);

    if (nextAliveIdx !== -1) {
      await new Promise((r) => setTimeout(r, 600));
      setActivePlayerIndex(nextAliveIdx);
      addLog(`換上 ${party[nextAliveIdx].nameZh}！`);
    } else if (escapeRopeIndex !== -1) {
      // Emergency Rescue via Escape Rope!
      await new Promise((r) => setTimeout(r, 600));
      addLog(`🚨 全體倒下！背包中的【脫離繩】緊急自動發動救援！`);
      sound.playRest();
      const copy = [...inventory];
      copy[escapeRopeIndex] = { ...copy[escapeRopeIndex], count: copy[escapeRopeIndex].count - 1 };
      const nextInv = copy.filter((i) => i.count > 0);
      const savedParty = party.map((p) => ({ ...p, currentHp: 1 }));
      setInventory(nextInv);
      setParty(savedParty);

      setTimeout(() => {
        onBattleEnd({
          victory: false,
          fled: true,
          expGained: 0,
          coinsEarned: 0,
          updatedParty: savedParty,
          updatedInventory: nextInv,
        });
      }, 1200);
    } else {
      await new Promise((r) => setTimeout(r, 800));
      addLog(`眼前一片漆黑...隊伍全滅！`);
      setTimeout(() => {
        onBattleEnd({
          victory: false,
          expGained: 0,
          coinsEarned: 0,
          updatedParty: party,
          updatedInventory: inventory,
        });
      }, 1100);
    }
  };

  const handleSwitchPokemon = (idx: number) => {
    if (idx === activePlayerIndex || party[idx].currentHp <= 0 || isProcessing) return;
    setIsProcessing(true);
    setDrawer('none');
    sound.playSelect();

    const newPkm = party[idx];
    addLog(`換上 ${newPkm.nameZh}！`);
    setActivePlayerIndex(idx);

    setTimeout(async () => {
      await performOpponentTurn();
      handleTurnEndEffects();
      setIsProcessing(false);
    }, 450);
  };

  const handleUseMedicine = (item: Item) => {
    if (isProcessing) return;
    const invSlot = inventory.find((i) => i.item.id === item.id);
    if (!invSlot || invSlot.count <= 0) return;

    setIsProcessing(true);
    setDrawer('none');
    sound.playRest();

    let healed = 0;
    if (item.id === 'revive') {
      const faintedPkm = party.find((p) => p.currentHp <= 0);
      if (faintedPkm) {
        faintedPkm.currentHp = Math.floor(faintedPkm.maxHp * 0.5);
        faintedPkm.status = 'None';
        addLog(`使用了【活力碎片】，${faintedPkm.nameZh} 復活並回復了 50% HP！`);
      } else {
        activePlayer.currentHp = Math.min(activePlayer.maxHp, activePlayer.currentHp + Math.floor(activePlayer.maxHp * 0.5));
        addLog(`使用了【活力碎片】回復了生命值！`);
      }
    } else if (item.healAmount) {
      healed = Math.min(activePlayer.maxHp - activePlayer.currentHp, item.healAmount);
      activePlayer.currentHp = Math.min(activePlayer.maxHp, activePlayer.currentHp + item.healAmount);
      addLog(`使用了【${item.nameZh}】回復了 ${healed} HP！`);
    } else if (item.healPercent) {
      const amt = Math.floor(activePlayer.maxHp * (item.healPercent / 100));
      healed = Math.min(activePlayer.maxHp - activePlayer.currentHp, amt);
      activePlayer.currentHp = Math.min(activePlayer.maxHp, activePlayer.currentHp + amt);
      addLog(`使用了【${item.nameZh}】回復了 ${healed} HP！`);
    } else if (item.restorePpAmount) {
      activePlayer.moves.forEach((m) => {
        m.currentPp = Math.min(m.maxPp, m.currentPp + item.restorePpAmount!);
      });
      addLog(`${activePlayer.nameZh} 招式 PP 回復了！`);
    }

    const updatedInv = inventory
      .map((i) => (i.item.id === item.id ? { ...i, count: i.count - 1 } : i))
      .filter((i) => i.count > 0);
    setInventory(updatedInv);

    setTimeout(async () => {
      await performOpponentTurn();
      handleTurnEndEffects();
      setIsProcessing(false);
    }, 500);
  };

  const handleThrowBall = async (item: Item) => {
    if (trainer) {
      addLog(`無法收服其他訓練家的寶可夢！`);
      return;
    }
    if (isProcessing) return;

    const invSlot = inventory.find((i) => i.item.id === item.id);
    if (!invSlot || invSlot.count <= 0) return;

    setIsProcessing(true);
    setDrawer('none');
    sound.playSelect();

    const updatedInv = inventory
      .map((i) => (i.item.id === item.id ? { ...i, count: i.count - 1 } : i))
      .filter((i) => i.count > 0);
    setInventory(updatedInv);

    addLog(`投擲了【${item.nameZh}】！`);

    const meta = loadMetaProgression();
    const catchBonus = (meta.talents.catchRate || 0) * 0.1;
    const hpFactor = (3 * activeOpponent.maxHp - 2 * activeOpponent.currentHp) / (3 * activeOpponent.maxHp);
    const ballMult = item.catchMultiplier || 1.0;
    const statusBonus = activeOpponent.status !== 'None' ? 1.5 : 1.0;
    const catchChance = Math.min(0.95, (0.4 * hpFactor * ballMult * statusBonus) + catchBonus);
    const willCatch = item.id === 'master_ball' || Math.random() < catchChance;

    setCatchState({ inProgress: true, shakes: 0, success: null });

    for (let s = 1; s <= 3; s++) {
      await new Promise((r) => setTimeout(r, 450));
      sound.playPokeballShake();
      setCatchState((prev) => ({ ...prev, shakes: s }));

      if (!willCatch && s === Math.floor(Math.random() * 2) + 1) {
        await new Promise((r) => setTimeout(r, 350));
        setCatchState({ inProgress: false, shakes: 0, success: false });
        addLog(`哎呀！${activeOpponent.nameZh} 掙脫了！`);
        await performOpponentTurn();
        setIsProcessing(false);
        return;
      }
    }

    await new Promise((r) => setTimeout(r, 400));
    sound.playCaught();
    setCatchState((prev) => ({ ...prev, success: true }));
    addLog(`⭐ 成功收服了 ${activeOpponent.nameZh}！`);

    // Permanently record into unlocked Pokedex
    unlockSpecies(activeOpponent.speciesId);

    setTimeout(() => {
      onBattleEnd({
        victory: true,
        caughtPokemon: activeOpponent,
        expGained: activeOpponent.level * 30,
        coinsEarned: Math.floor(activeOpponent.level * 15),
        updatedParty: party,
        updatedInventory: updatedInv,
      });
    }, 900);
  };

  const handleFlee = () => {
    const escapeRopeIndex = inventory.findIndex((i) => i.item.id === 'escape_rope' && i.count > 0);
    const hasEscapeRope = escapeRopeIndex !== -1;

    if (trainer && !hasEscapeRope) {
      addLog(`道館館主與強敵無法直接逃跑！可使用【脫離繩】展開戰術撤退！`);
      sound.playSelect();
      return;
    }

    let nextInventory = inventory;
    if (hasEscapeRope && trainer) {
      const copy = [...inventory];
      copy[escapeRopeIndex] = { ...copy[escapeRopeIndex], count: copy[escapeRopeIndex].count - 1 };
      nextInventory = copy.filter((i) => i.count > 0);
      setInventory(nextInventory);
      addLog(`消耗【脫離繩】展開緊急戰術撤退！全隊安全脫離！`);
    } else {
      addLog(`順利逃脫了！`);
    }

    sound.playSelect();
    setTimeout(() => {
      onBattleEnd({
        victory: false,
        fled: true,
        expGained: 0,
        coinsEarned: 0,
        updatedParty: party,
        updatedInventory: nextInventory,
      });
    }, 600);
  };

  const getHpColor = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio > 0.5) return 'bg-emerald-500';
    if (ratio > 0.2) return 'bg-amber-500';
    return 'bg-rose-500 animate-pulse';
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between font-sans overflow-hidden select-none">
      {/* Background: HD-2D 3D Canvas OR Classic 2D Arena */}
      {renderMode === 'hd2d' ? (
        <HD2DBattleScene
          playerPokemon={activePlayer}
          opponentPokemon={activeOpponent}
          shakeTarget={shakeTarget}
          isCatching={catchState.inProgress}
          catchShakes={catchState.shakes}
          cameraPreset={cameraPreset}
          onCycleCamera={cycleCameraPreset}
        />
      ) : (
        <div className="absolute inset-0 z-0">
          <img
            src="/src/assets/images/dungeon_battle_arena_1792647581274.jpg"
            alt="Battle Arena"
            className="w-full h-full object-cover filter brightness-75 scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/70" />
        </div>
      )}

      {/* Top Banner */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 text-xs shadow-md">
            {trainer ? (
              <>
                <span className="font-bold text-amber-400">{trainer.titleZh}</span>
                <span className="text-white font-medium">{trainer.name}</span>
              </>
            ) : (
              <span className="text-rose-400 font-medium">野生地牢遭遇戰</span>
            )}
          </div>

          {/* HD-2D Mode Toggle */}
          <button
            onClick={() => {
              sound.playSelect();
              setRenderMode((m) => (m === 'hd2d' ? 'classic' : 'hd2d'));
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-md ${
              renderMode === 'hd2d'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <span>{renderMode === 'hd2d' ? '🌟 HD-2D 3D' : '🕹️ 經典 2D'}</span>
          </button>
        </div>

        {trainer && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 shadow-md">
            <span className="text-[10px] text-slate-400 mr-1">剩餘:</span>
            {opponentTeam.map((p, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full border ${
                  p.currentHp > 0 ? 'bg-rose-500 border-white/60' : 'bg-slate-700 border-slate-600 opacity-40'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Battle Field */}
      <div className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 flex flex-col justify-between py-4">
        {/* Opponent Area (Top Right) */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-4 md:gap-8">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl min-w-[240px] sm:min-w-[280px]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-white text-base">{activeOpponent.nameZh}</span>
              <span className="font-mono text-xs text-amber-400 font-bold">Lv.{activeOpponent.level}</span>
            </div>

            <div className="flex gap-1 mb-1.5">
              {activeOpponent.types.map((t) => (
                <span
                  key={t}
                  className="text-[9px] px-1.5 py-0.2 rounded font-semibold"
                  style={{ backgroundColor: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].text }}
                >
                  {TYPE_NAMES_ZH[t]}
                </span>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>HP</span>
                <span className="font-mono tabular-nums text-white">
                  {activeOpponent.currentHp} / {activeOpponent.maxHp}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getHpColor(
                    activeOpponent.currentHp,
                    activeOpponent.maxHp
                  )}`}
                  style={{ width: `${Math.max(0, (activeOpponent.currentHp / activeOpponent.maxHp) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Opponent Animated Sprite (Displayed in Classic 2D mode; in HD-2D mode it renders in 3D WebGL) */}
          {renderMode === 'classic' && (
            <div className={`transition-transform duration-150 ${shakeTarget === 'opponent' ? 'animate-bounce' : ''}`}>
              {catchState.inProgress ? (
                <div className="w-24 h-24 flex flex-col items-center justify-center">
                  <div className={`w-12 h-12 rounded-full border-2 border-white flex flex-col overflow-hidden shadow-2xl ${
                    catchState.shakes > 0 ? 'animate-spin' : ''
                  }`}>
                    <div className="bg-rose-600 h-1/2 w-full" />
                    <div className="bg-white h-1/2 w-full flex items-center justify-center relative">
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-slate-900 absolute -top-1.5 shadow" />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-300 mt-2">
                    晃動第 {catchState.shakes} 次...
                  </span>
                </div>
              ) : (
                <PokemonSprite
                  speciesId={activeOpponent.speciesId}
                  nameZh={activeOpponent.nameZh}
                  types={activeOpponent.types}
                  isShiny={activeOpponent.isShiny}
                  size="xl"
                />
              )}
            </div>
          )}
        </div>

        {/* Player Area (Bottom Left) */}
        <div className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-start gap-4 md:gap-8 mt-2">
          {/* Player Back Animated Sprite (Classic 2D mode) */}
          {renderMode === 'classic' && (
            <div className={`transition-transform duration-150 ${shakeTarget === 'player' ? 'animate-pulse scale-95' : ''}`}>
              <PokemonSprite
                speciesId={activePlayer.speciesId}
                nameZh={activePlayer.nameZh}
                types={activePlayer.types}
                isShiny={activePlayer.isShiny}
                isBack={true}
                size="xl"
              />
            </div>
          )}

          {/* Player Status HUD */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl min-w-[240px] sm:min-w-[300px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-base">{activePlayer.nameZh}</span>
                {activePlayer.heldItem && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {activePlayer.heldItem.nameZh}
                  </span>
                )}
              </div>
              <span className="font-mono text-xs text-sky-400 font-bold">Lv.{activePlayer.level}</span>
            </div>

            <div className="flex gap-1 mb-1.5">
              {activePlayer.types.map((t) => (
                <span
                  key={t}
                  className="text-[9px] px-1.5 py-0.2 rounded font-semibold"
                  style={{ backgroundColor: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].text }}
                >
                  {TYPE_NAMES_ZH[t]}
                </span>
              ))}
            </div>

            <div className="space-y-1 mb-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>HP</span>
                <span className="font-mono tabular-nums text-white">
                  {activePlayer.currentHp} / {activePlayer.maxHp}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getHpColor(
                    activePlayer.currentHp,
                    activePlayer.maxHp
                  )}`}
                  style={{ width: `${Math.max(0, (activePlayer.currentHp / activePlayer.maxHp) * 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                <div
                  className="h-full bg-sky-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (activePlayer.exp / activePlayer.maxExp) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STREAMLINED Action Pad: Direct 1-Click Move Execution! */}
      <div className="relative z-20 w-full bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-3 sm:p-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-3 items-stretch">
          {/* Quick Battle Narrative (Left / Compact) */}
          <div className="md:w-5/12 h-24 md:h-auto bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 overflow-y-auto flex flex-col justify-end text-xs font-mono">
            {battleLog.map((log, i) => (
              <div key={i} className="text-slate-300 leading-tight py-0.5">
                <span className="text-rose-500 mr-1">▶</span>
                {log}
              </div>
            ))}
          </div>

          {/* Action Area (Right / Main) */}
          <div className="md:w-7/12 flex flex-col justify-between gap-2">
            {/* If Drawer (Bag / Party) is open, show quick drawer */}
            {drawer === 'bag' && (
              <div className="p-3 bg-slate-950/90 rounded-xl border border-sky-500/40">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-sky-400">點擊道具直接使用 / 投擲捕捉</span>
                  <button
                    onClick={() => setDrawer('none')}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    ✕ 關閉
                  </button>
                </div>
                {inventory.length === 0 ? (
                  <div className="text-xs text-slate-500 py-3 text-center">背包內無可用消耗道具</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-24 overflow-y-auto">
                    {inventory.map((inv) => {
                      const isBall = inv.item.type === 'pokeball';
                      return (
                        <button
                          key={inv.item.id}
                          disabled={isProcessing || (isBall && !!trainer)}
                          onClick={() => (isBall ? handleThrowBall(inv.item) : handleUseMedicine(inv.item))}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-left border border-slate-700 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-white">
                            <span>{inv.item.nameZh}</span>
                            <span className="text-amber-400 font-mono">x{inv.count}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {drawer === 'party' && (
              <div className="p-3 bg-slate-950/90 rounded-xl border border-emerald-500/40">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-emerald-400">點擊直接輪換上場</span>
                  <button
                    onClick={() => setDrawer('none')}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    ✕ 關閉
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {party.map((pkm, idx) => {
                    const isActive = idx === activePlayerIndex;
                    const isFainted = pkm.currentHp <= 0;
                    return (
                      <button
                        key={pkm.uid}
                        disabled={isProcessing || isActive || isFainted}
                        onClick={() => handleSwitchPokemon(idx)}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-rose-950/40 border-rose-500/50 opacity-60'
                            : isFainted
                            ? 'bg-slate-900 border-slate-800 opacity-40 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
                        }`}
                      >
                        <PokemonSprite
                          speciesId={pkm.speciesId}
                          nameZh={pkm.nameZh}
                          types={pkm.types}
                          size="sm"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-white truncate">{pkm.nameZh}</div>
                          <div className="text-[10px] text-slate-400 font-mono">HP {pkm.currentHp}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DIRECT 1-CLICK 4-MOVES GRID (No nested menus!) */}
            <div className="grid grid-cols-2 gap-2">
              {activePlayer.moves.map((m, idx) => {
                const typeColor = TYPE_COLORS[m.type];
                const eff = getTypeEffectiveness(m.type, activeOpponent.types);
                const effBadge = getEffectivenessMessage(eff).badge;

                return (
                  <button
                    key={m.id}
                    disabled={isProcessing || m.currentPp <= 0}
                    onClick={() => executePlayerMove(m)}
                    className={`relative p-3 rounded-xl border text-left transition-all active:scale-[0.98] cursor-pointer flex flex-col justify-between group shadow-md ${
                      m.currentPp <= 0
                        ? 'bg-slate-900/60 border-slate-800 opacity-40 cursor-not-allowed'
                        : 'bg-slate-800/90 hover:bg-slate-750 border-slate-700 hover:border-amber-400/80'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-1 py-0.2 rounded font-mono font-bold bg-slate-700 text-slate-300">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-sm text-white group-hover:text-amber-300">
                          {m.nameZh}
                        </span>
                      </div>

                      <span
                        className="text-[10px] px-1.5 py-0.2 rounded font-semibold"
                        style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
                      >
                        {TYPE_NAMES_ZH[m.type]}
                      </span>
                    </div>

                    <div className="flex items-center justify-between w-full mt-2 text-xs">
                      <span className="text-slate-400 text-[11px] font-mono">
                        PP {m.currentPp}/{m.maxPp}
                      </span>
                      <span className={`text-[11px] font-bold ${
                        eff >= 2 ? 'text-amber-400' : eff === 0 ? 'text-slate-500' : eff < 1 ? 'text-slate-400' : 'text-slate-300'
                      }`}>
                        {effBadge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom 3 Quick Utility Controls */}
            <div className="flex items-center gap-2">
              <button
                disabled={isProcessing}
                onClick={() => setDrawer(drawer === 'bag' ? 'none' : 'bag')}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-white bg-sky-600/80 hover:bg-sky-500 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Backpack className="w-3.5 h-3.5" />
                <span>背包 / 捕捉</span>
              </button>

              <button
                disabled={isProcessing}
                onClick={() => setDrawer(drawer === 'party' ? 'none' : 'party')}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600/80 hover:bg-emerald-500 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>換人 ({party.filter((p) => p.currentHp > 0).length})</span>
              </button>

              {(() => {
                const hasEscapeRope = inventory.some((i) => i.item.id === 'escape_rope' && i.count > 0);
                const canFlee = !trainer || hasEscapeRope;
                return (
                  <button
                    disabled={isProcessing || !canFlee}
                    onClick={handleFlee}
                    className={`py-2 px-4 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors ${
                      !canFlee
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                        : hasEscapeRope && trainer
                        ? 'bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-md'
                        : 'bg-slate-700 hover:bg-slate-600 cursor-pointer'
                    }`}
                    title={hasEscapeRope ? '使用脫離繩戰術撤退' : trainer ? '關主戰無法直接逃跑（需脫離繩）' : '逃離戰鬥'}
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    <span>{hasEscapeRope && trainer ? '脫離繩撤退' : '逃跑'}</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

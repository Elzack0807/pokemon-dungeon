import React, { useState } from 'react';
import { PokemonInstance } from '../types/pokemon';
import { PokemonSprite } from './PokemonSprite';
import { calculateStats, POKEMON_SPECIES } from '../data/pokemonData';
import { sound } from '../utils/audio';
import { Flame, Sparkles, Heart, Zap, CheckCircle, ArrowRight, TrendingUp } from 'lucide-react';

interface RestCampProps {
  party: PokemonInstance[];
  onCompleteCamp: (updatedParty: PokemonInstance[]) => void;
}

export const RestCamp: React.FC<RestCampProps> = ({ party: initialParty, onCompleteCamp }) => {
  const [party, setParty] = useState<PokemonInstance[]>(initialParty);
  const [chosenOption, setChosenOption] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string>('');

  const handleFullHeal = () => {
    sound.playRest();
    const updated = party.map((p) => {
      return {
        ...p,
        currentHp: p.maxHp,
        status: 'None' as const,
        moves: p.moves.map((m) => ({ ...m, currentPp: m.maxPp })),
      };
    });
    setParty(updated);
    setChosenOption('heal');
    setResultMessage('全體寶可夢在溫暖的營地溫泉中放鬆休息，HP 完全回復，解除所有異常狀態，所有招式 PP 補滿！');
  };

  const handleCurryCook = () => {
    sound.playRest();
    const updated = party.map((p) => {
      const extraHp = Math.floor(p.maxHp * 0.15);
      return {
        ...p,
        maxHp: p.maxHp + extraHp,
        currentHp: Math.min(p.maxHp + extraHp, p.currentHp + Math.floor(p.maxHp * 0.5)),
        status: 'None' as const,
      };
    });
    setParty(updated);
    setChosenOption('curry');
    setResultMessage('烹飪了香氣濃郁的樹果咖哩！全隊全員最大 HP 永久提升 15%，並回復了大量生命值！');
  };

  const handleTeamLevelUp = () => {
    sound.playCaught();
    const updated = party.map((p) => {
      const nextLvl = p.level + 1;
      const species = POKEMON_SPECIES[p.speciesId];
      const stats = species ? calculateStats(species.baseStats, nextLvl) : p.stats;
      return {
        ...p,
        level: nextLvl,
        stats,
        maxHp: stats.hp,
        currentHp: stats.hp,
        status: 'None' as const,
        moves: p.moves.map((m) => ({ ...m, currentPp: m.maxPp })),
      };
    });
    setParty(updated);
    setChosenOption('level_up');
    setResultMessage('進行了高強度的實戰模擬對練！隊伍全體全員直接等級提升 +1 (Lv Up)，全員 HP/PP 全滿！');
  };

  const handleMoveTrain = () => {
    sound.playSelect();
    const lead = party[0];
    if (lead && lead.moves.length > 0) {
      lead.moves.forEach((m) => {
        if (m.power > 0) m.power += 10;
      });
      setParty([...party]);
      setChosenOption('train');
      setResultMessage(`${lead.nameZh} 進行了冥想與招式深化特訓，所有攻擊招式威力永久 +10！`);
    } else {
      handleFullHeal();
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between font-sans overflow-hidden select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <img
          src="/src/assets/images/dungeon_shop_camp_1792647581229.jpg"
          alt="Rest Campfire Sanctuary"
          className="w-full h-full object-cover filter brightness-70"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/80" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
          <span className="font-bold text-white text-base">地底休息營地 · 避難所</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold mb-2">
            <span>避難休憩營火</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            在溫暖火光旁調整步調
          </h1>
          <p className="text-xs md:text-sm text-slate-300">
            地牢中的安全庇護所。選擇一項休整活動為下一階段的探險做準備。
          </p>
        </div>

        {/* Camp Options or Result */}
        {!chosenOption ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Option 1: Full Heal */}
            <button
              onClick={handleFullHeal}
              className="p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 backdrop-blur-md border border-emerald-500/40 hover:border-emerald-400 text-left transition-all duration-200 group cursor-pointer shadow-xl hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-3 text-emerald-400">
                  <Heart className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors mb-1">
                  溫泉沐浴修養
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  全體寶可夢 HP 100% 完全回復，解除異常狀態並補滿 PP。
                </p>
              </div>
            </button>

            {/* Option 2: Curry Cook */}
            <button
              onClick={handleCurryCook}
              className="p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 backdrop-blur-md border border-amber-500/40 hover:border-amber-400 text-left transition-all duration-200 group cursor-pointer shadow-xl hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3 text-amber-400">
                  <Flame className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors mb-1">
                  烹煮美味咖哩
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  隊伍全員最大 HP 永久增長 15%，並回復 50% 生命值！
                </p>
              </div>
            </button>

            {/* Option 3: Team Level-Up Training */}
            <button
              onClick={handleTeamLevelUp}
              className="p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 backdrop-blur-md border border-purple-500/40 hover:border-purple-400 text-left transition-all duration-200 group cursor-pointer shadow-xl hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mb-3 text-purple-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors mb-1">
                  全員極限特訓
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  隊伍全員直接提升 1 級 (Lv Up)，數值全面暴漲並滿血！
                </p>
              </div>
            </button>

            {/* Option 4: Move Training */}
            <button
              onClick={handleMoveTrain}
              className="p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 backdrop-blur-md border border-sky-500/40 hover:border-sky-400 text-left transition-all duration-200 group cursor-pointer shadow-xl hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center mb-3 text-sky-400">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors mb-1">
                  招式冥想特訓
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  領頭寶可夢沉浸冥想，攻擊招式基礎威力永久提升 +10 點！
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl p-6 text-center space-y-4 max-w-lg mx-auto shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">休整完畢</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{resultMessage}</p>

            <button
              onClick={() => onCompleteCamp(party)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              <span>繼續深入地牢探險</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Current Party Health Strip */}
        <div className="mt-8 flex justify-center gap-4">
          {party.map((pkm) => (
            <div
              key={pkm.uid}
              className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3"
            >
              <PokemonSprite
                speciesId={pkm.speciesId}
                nameZh={pkm.nameZh}
                types={pkm.types}
                isShiny={pkm.isShiny}
                size="sm"
              />
              <div className="text-xs text-left">
                <div className="font-bold text-white">{pkm.nameZh}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  HP {pkm.currentHp}/{pkm.maxHp}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { PokemonInstance } from '../types/pokemon';
import { PokemonSprite } from './PokemonSprite';
import { sound } from '../utils/audio';
import { addBadges } from '../utils/metaProgression';
import { Trophy, Sparkles, Award, RotateCcw, Coins } from 'lucide-react';

interface VictoryModalProps {
  party: PokemonInstance[];
  battlesWon: number;
  caughtCount: number;
  coins: number;
  onRestart: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  party,
  battlesWon,
  caughtCount,
  coins,
  onRestart,
}) => {
  const awardedRef = useRef<boolean>(false);
  const badgesEarned = 150 + battlesWon * 6 + caughtCount * 15;

  useEffect(() => {
    if (!awardedRef.current) {
      awardedRef.current = true;
      addBadges(badgesEarned);
    }
  }, [badgesEarned]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-amber-500/50 max-w-xl w-full rounded-2xl p-6 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 animate-bounce">
          <Trophy className="w-8 h-8" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>地牢終極征服者 · 名人堂傳奇</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white">地牢登頂大獲全勝！</h2>
          <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-md mx-auto">
            恭喜！你突破了全 15 層地牢，擊敗道館館主並平定了傳說寶可夢超夢的怒火，成為傳奇地牢探險大師！
          </p>
        </div>

        {/* Adventure Badges Reward Ribbon */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 flex items-center justify-center gap-3">
          <Award className="w-6 h-6 text-amber-400" />
          <div className="text-left text-xs">
            <span className="text-slate-300 block text-[11px]">登頂傳奇結算獎勵：</span>
            <span className="font-extrabold text-amber-400 font-mono text-base">
              +{badgesEarned} 枚冒險勛章！
            </span>
            <span className="text-slate-400 text-[10px] ml-1.5">
              (可在博士研究所升級頂尖天賦)
            </span>
          </div>
        </div>

        {/* Hall of Fame Party Lineup */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-amber-400 tracking-wider">
            ★ 榮譽名人堂隊伍陣容 ★
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {party.map((pkm) => (
              <div
                key={pkm.uid}
                className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/30 flex flex-col items-center text-center shadow-lg"
              >
                <PokemonSprite
                  speciesId={pkm.speciesId}
                  nameZh={pkm.nameZh}
                  types={pkm.types}
                  isShiny={pkm.isShiny}
                  size="md"
                />
                <span className="font-bold text-white text-xs mt-2 truncate w-full">{pkm.nameZh}</span>
                <span className="text-[11px] text-amber-400 font-mono font-bold">Lv.{pkm.level}</span>
                {pkm.heldItem && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 mt-1">
                    {pkm.heldItem.nameZh}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Run Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">擊倒強敵</span>
            <span className="font-bold text-white font-mono text-sm">{battlesWon} 場</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">成功收服</span>
            <span className="font-bold text-white font-mono text-sm">{caughtCount} 隻</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">結餘金幣</span>
            <span className="font-bold text-amber-400 font-mono text-sm">{coins} 🪙</span>
          </div>
        </div>

        <button
          onClick={() => {
            sound.playSelect();
            onRestart();
          }}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/50"
        >
          <RotateCcw className="w-4 h-4 fill-slate-950" />
          <span>展開新的探險 (解鎖自選初始夥伴)</span>
        </button>
      </div>
    </div>
  );
};

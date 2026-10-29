import React, { useEffect, useRef } from 'react';
import { PokemonInstance } from '../types/pokemon';
import { PokemonSprite } from './PokemonSprite';
import { sound } from '../utils/audio';
import { addBadges } from '../utils/metaProgression';
import { RotateCcw, Skull, Award, Coins, MapPin, Sparkles } from 'lucide-react';

interface GameOverModalProps {
  floorReached: number;
  totalFloors: number;
  battlesWon: number;
  caughtCount: number;
  coins: number;
  party: PokemonInstance[];
  onRestart: () => void;
  onRetainLevelRestart?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  floorReached,
  totalFloors,
  battlesWon,
  caughtCount,
  coins,
  party,
  onRestart,
  onRetainLevelRestart,
}) => {
  const mvp = party[0] || party[0];
  const awardedRef = useRef<boolean>(false);

  // Calculate Badges: floors * 8 + battles * 5 + caught * 12 + base 20
  const badgesEarned = Math.max(20, floorReached * 8 + battlesWon * 5 + caughtCount * 12 + 20);

  useEffect(() => {
    if (!awardedRef.current) {
      awardedRef.current = true;
      addBadges(badgesEarned);
    }
  }, [badgesEarned]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-rose-900/60 max-w-lg w-full rounded-2xl p-6 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-500">
          <Skull className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">眼前一片漆黑...</h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            隊伍全員在地牢深處力竭倒下。請選擇是否保留當前寶可夢等級重返第 1 層，或重新開局！
          </p>
        </div>

        {/* Adventure Badges Reward Ribbon */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-amber-500/15 border border-amber-500/30 flex items-center justify-center gap-2.5">
          <Award className="w-5 h-5 text-amber-400 animate-bounce" />
          <div className="text-xs text-left">
            <span className="text-slate-300 block text-[11px]">獲得探險結算遺產：</span>
            <span className="font-extrabold text-amber-400 font-mono text-sm">
              +{badgesEarned} 枚冒險勛章
            </span>
            <span className="text-slate-400 text-[10px] ml-1.5">
              (可在標題畫面「博士的研究所」永久強化)
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block">到達層數</span>
              <span className="font-bold text-white font-mono text-sm">
                第 {floorReached} 層 / {totalFloors} 層
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
            <Award className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block">獲勝場次</span>
              <span className="font-bold text-white font-mono text-sm">{battlesWon} 場</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border border-white/60 bg-rose-600 flex items-center justify-center text-[8px] font-bold">
              ●
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">成功收服</span>
              <span className="font-bold text-white font-mono text-sm">{caughtCount} 隻</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
            <Coins className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block">累積金幣</span>
              <span className="font-bold text-white font-mono text-sm">{coins} 🪙</span>
            </div>
          </div>
        </div>

        {/* MVP Pokemon */}
        {mvp && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center gap-3">
            <PokemonSprite
              speciesId={mvp.speciesId}
              nameZh={mvp.nameZh}
              types={mvp.types}
              isShiny={mvp.isShiny}
              size="sm"
            />
            <div className="text-left text-xs">
              <span className="text-[10px] text-amber-400 font-semibold block">本輪主力夥伴</span>
              <span className="font-bold text-white">{mvp.nameZh} (Lv.{mvp.level})</span>
            </div>
          </div>
        )}

        {/* Action Choice Buttons */}
        <div className="space-y-2.5 pt-1">
          {onRetainLevelRestart && (
            <button
              onClick={() => {
                sound.playSelect();
                onRetainLevelRestart();
              }}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50 transition-all border border-emerald-400/30"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>繼承等級與隊伍 · 全員滿血重返第 1 層</span>
            </button>
          )}

          <button
            onClick={() => {
              sound.playSelect();
              onRestart();
            }}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-semibold flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition-all text-xs md:text-sm"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>完全重新開始 · 返回標題選單 (可進入研究所強化)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

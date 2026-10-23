import React, { useState } from 'react';
import { DungeonNode, PokemonInstance, Item } from '../types/pokemon';
import { PokemonSprite } from './PokemonSprite';
import { HD2DDungeonScene } from './HD2DDungeonScene';
import { TYPE_COLORS, TYPE_NAMES_ZH } from '../utils/typeChart';
import { sound } from '../utils/audio';
import {
  Swords,
  Shield,
  Tent,
  ShoppingBag,
  Sparkles,
  HelpCircle,
  Coins,
  Backpack,
  Users,
  Volume2,
  VolumeX,
  ChevronRight,
  Flame,
  Award,
} from 'lucide-react';

interface DungeonMapProps {
  currentFloor: number;
  totalFloors: number;
  nodes: DungeonNode[];
  party: PokemonInstance[];
  coins: number;
  inventory: { item: Item; count: number }[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSelectNode: (node: DungeonNode) => void;
  onOpenParty: () => void;
  onOpenBag: () => void;
}

export const DungeonMap: React.FC<DungeonMapProps> = ({
  currentFloor,
  totalFloors,
  nodes,
  party,
  coins,
  inventory,
  soundEnabled,
  onToggleSound,
  onSelectNode,
  onOpenParty,
  onOpenBag,
}) => {
  const [show3DDiorama, setShow3DDiorama] = useState<boolean>(true);
  const activeLead = party[0] || party.find((p) => p.currentHp > 0);

  // Sector title calculation
  const getSectorName = (floor: number) => {
    if (floor <= 3) return '深谷地底迴廊 (岩石荒原)';
    if (floor <= 6) return '水之潮汐地下湖 (藍色水窟)';
    if (floor <= 9) return '火箭隊秘密挖掘場 (地下要塞)';
    if (floor <= 12) return '龍之試煉巨石峰 (古代遺跡)';
    return '終極聖域 · 傳說神殿 (世界盡頭)';
  };

  const getNodeIcon = (type: DungeonNode['type']) => {
    switch (type) {
      case 'battle':
        return <Swords className="w-5 h-5 text-rose-400" />;
      case 'trainer':
        return <Award className="w-5 h-5 text-amber-400" />;
      case 'camp':
        return <Tent className="w-5 h-5 text-emerald-400" />;
      case 'shop':
        return <ShoppingBag className="w-5 h-5 text-sky-400" />;
      case 'event':
        return <HelpCircle className="w-5 h-5 text-purple-400" />;
      case 'boss':
        return <Flame className="w-6 h-6 text-rose-500 animate-bounce" />;
    }
  };

  const getNodeBorder = (type: DungeonNode['type']) => {
    switch (type) {
      case 'battle':
        return 'border-rose-500/40 hover:border-rose-400 hover:shadow-rose-950/40';
      case 'trainer':
        return 'border-amber-500/40 hover:border-amber-400 hover:shadow-amber-950/40';
      case 'camp':
        return 'border-emerald-500/40 hover:border-emerald-400 hover:shadow-emerald-950/40';
      case 'shop':
        return 'border-sky-500/40 hover:border-sky-400 hover:shadow-sky-950/40';
      case 'event':
        return 'border-purple-500/40 hover:border-purple-400 hover:shadow-purple-950/40';
      case 'boss':
        return 'border-rose-500 hover:border-rose-300 ring-2 ring-rose-500/40 shadow-rose-950/60';
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
        <img
          src="/src/assets/images/hero_pokemon_dungeon_1792647580651.jpg"
          alt="Dungeon Map Texture"
          className="w-full h-full object-cover filter brightness-50"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-slate-950/90" />
      </div>

      {/* Top HUD Bar */}
      <header className="relative z-20 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-3 flex items-center justify-between">
        {/* Left: Floor and Sector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Floor {currentFloor} / {totalFloors}
            </span>
            <div className="hidden sm:block text-sm font-bold text-white">
              {getSectorName(currentFloor)}
            </div>
          </div>
        </div>

        {/* Right HUD Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* PokéCoins */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-bold">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="tabular-nums">{coins}</span>
          </div>

          {/* Bag Button */}
          <button
            onClick={() => {
              sound.playSelect();
              onOpenBag();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <Backpack className="w-3.5 h-3.5 text-sky-400" />
            <span>背包</span>
            <span className="text-[10px] text-slate-400 font-mono">({inventory.reduce((a, b) => a + b.count, 0)})</span>
          </button>

          {/* Party Button */}
          <button
            onClick={() => {
              sound.playSelect();
              onOpenParty();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>隊伍</span>
            <span className="text-[10px] text-slate-400 font-mono">({party.length}/3)</span>
          </button>

          {/* HD-2D Diorama Toggle */}
          <button
            onClick={() => {
              sound.playSelect();
              setShow3DDiorama((s) => !s);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              show3DDiorama
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <span>{show3DDiorama ? '🌟 HD-2D 沙盤' : '🗺️ 簡約地圖'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            aria-label="Toggle Sound"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Floor Route Navigator */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 py-6 flex flex-col justify-center space-y-6">
        {/* Floor Progress Bar */}
        <div className="w-full">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>探索進度</span>
            <span className="font-mono tabular-nums">第 {currentFloor} 層 / 共 {totalFloors} 層</span>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-2 p-0.5 border border-slate-700/60 overflow-hidden">
            <div
              className="bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${(currentFloor / totalFloors) * 100}%` }}
            />
          </div>
        </div>

        {/* HD-2D 3D Sandplay Diorama */}
        {show3DDiorama && (
          <div className="w-full animate-fade-in">
            <HD2DDungeonScene
              currentFloor={currentFloor}
              totalFloors={totalFloors}
              nodes={nodes}
              leadPokemon={activeLead}
              onSelectNode={onSelectNode}
            />
          </div>
        )}

        {/* Section Heading */}
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1.5">
            選擇本層前進路線
          </h2>
          <p className="text-xs md:text-sm text-slate-400">
            地牢的前方分岔出多條未知道路，謹慎選擇每一步以維護隊伍戰力！
          </p>
        </div>

        {/* Branching Nodes Grid */}
        <div className={`grid gap-4 ${nodes.length === 1 ? 'grid-cols-1 max-w-lg mx-auto' : nodes.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
          {nodes.map((node) => {
            return (
              <button
                key={node.id}
                onClick={() => {
                  sound.playSelect();
                  onSelectNode(node);
                }}
                className={`group relative p-6 rounded-2xl bg-slate-900/90 backdrop-blur-md border ${getNodeBorder(
                  node.type
                )} shadow-xl text-left transition-all duration-200 hover:-translate-y-1 cursor-pointer flex flex-col justify-between`}
              >
                <div>
                  {/* Node Type Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                      {getNodeIcon(node.type)}
                    </div>

                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {node.type === 'battle' && '野外遭遇'}
                      {node.type === 'trainer' && '訓練家決鬥'}
                      {node.type === 'camp' && '整補修憩'}
                      {node.type === 'shop' && '友誼補給'}
                      {node.type === 'event' && '未知奇遇'}
                      {node.type === 'boss' && '首領決戰'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors mb-2">
                    {node.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {node.description}
                  </p>

                  {/* Visual Teaser for Encounter */}
                  {node.wildPokemon && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-2">
                      <PokemonSprite
                        speciesId={node.wildPokemon.speciesId}
                        nameZh={node.wildPokemon.nameZh}
                        types={node.wildPokemon.types}
                        isShiny={node.wildPokemon.isShiny}
                        size="sm"
                      />
                      <div className="text-xs">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>野生 {node.wildPokemon.nameZh}</span>
                          {node.wildPokemon.isShiny && (
                            <span className="text-[10px] text-amber-400 font-bold">✨ 異色</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Lv.{node.wildPokemon.level} · 可收服
                        </div>
                      </div>
                    </div>
                  )}

                  {node.trainer && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-2">
                      <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm">
                        🥋
                      </div>
                      <div className="text-xs">
                        <div className="font-semibold text-white">
                          {node.trainer.name}
                        </div>
                        <div className="text-[11px] text-amber-400 font-mono">
                          懸賞金 🪙 {node.trainer.rewardCoins}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Hint */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 group-hover:text-white transition-colors">
                  <span>踏入此區域</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Party Strip */}
        <div className="mt-10 p-4 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">目前出戰隊伍:</span>
            <div className="flex items-center gap-3">
              {party.map((pkm, idx) => {
                const hpPercent = Math.max(0, Math.min(100, (pkm.currentHp / pkm.maxHp) * 100));
                const isLead = idx === 0;

                return (
                  <div
                    key={pkm.uid}
                    onClick={() => {
                      sound.playSelect();
                      onOpenParty();
                    }}
                    className={`flex items-center gap-2 p-1.5 pr-3 rounded-xl border cursor-pointer hover:bg-slate-800 transition-colors ${
                      isLead ? 'bg-slate-800/90 border-rose-500/50' : 'bg-slate-950/40 border-slate-800'
                    }`}
                  >
                    <PokemonSprite
                      speciesId={pkm.speciesId}
                      nameZh={pkm.nameZh}
                      types={pkm.types}
                      isShiny={pkm.isShiny}
                      isFainted={pkm.currentHp <= 0}
                      size="sm"
                    />
                    <div className="text-left">
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{pkm.nameZh}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Lv.{pkm.level}</span>
                      </div>
                      <div className="w-16 bg-slate-700 rounded-full h-1 mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${hpPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => {
              sound.playSelect();
              onOpenParty();
            }}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium underline underline-offset-4 cursor-pointer"
          >
            檢視招式與攜帶道具 →
          </button>
        </div>
      </main>
    </div>
  );
};

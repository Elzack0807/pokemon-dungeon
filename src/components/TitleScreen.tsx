import React, { useState, useEffect } from 'react';
import { STARTER_IDS, POKEMON_SPECIES, createPokemon } from '../data/pokemonData';
import { TYPE_COLORS, TYPE_NAMES_ZH } from '../utils/typeChart';
import { PokemonSprite } from './PokemonSprite';
import { sound } from '../utils/audio';
import {
  loadMetaProgression,
  MetaProgressionState,
  DEFAULT_UNLOCKED_SPECIES,
} from '../utils/metaProgression';
import { ProfessorLabModal } from './ProfessorLabModal';
import {
  Sparkles,
  Swords,
  Zap,
  Heart,
  Info,
  BookOpen,
  Volume2,
  VolumeX,
  Play,
  Award,
  Lock,
  ChevronRight,
  X,
} from 'lucide-react';
import { PokemonInstance, SpeciesData, PokemonType } from '../types/pokemon';

interface TitleScreenProps {
  onStartGame: (starter: PokemonInstance) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  soundEnabled,
  onToggleSound,
}) => {
  const [metaState, setMetaState] = useState<MetaProgressionState>(() => loadMetaProgression());
  const [activeTab, setActiveTab] = useState<'starters' | 'pokedex'>('starters');
  const [isShiny, setIsShiny] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showLabModal, setShowLabModal] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  // Floating explanation state (懸浮視窗說明)
  const [hoveredSpecies, setHoveredSpecies] = useState<SpeciesData | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [mobileModalSpecies, setMobileModalSpecies] = useState<SpeciesData | null>(null);

  useEffect(() => {
    setMetaState(loadMetaProgression());
  }, []);

  const handleShare = () => {
    sound.playSelect();
    if (navigator.share) {
      navigator.share({
        title: 'Pokémon Rogue Dungeon',
        text: '來挑戰這個寶可夢地牢 Roguelike 冒險遊戲吧！',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  // Direct start game with chosen species (點選角色即可出發！)
  const handleStartWithSpecies = (speciesId: string) => {
    sound.playSelect();
    const starter = createPokemon(speciesId, 5, isShiny);
    // Apply vitality talent bonus
    if (metaState.talents.vitality > 0) {
      const extraHpRatio = 1 + metaState.talents.vitality * 0.1;
      const boostedHp = Math.floor(starter.maxHp * extraHpRatio);
      starter.maxHp = boostedHp;
      starter.currentHp = boostedHp;
      starter.stats.hp = boostedHp;
    }
    onStartGame(starter);
  };

  const allSpeciesIds = Object.keys(POKEMON_SPECIES);
  const unlockedIds = metaState.unlockedPokedex || DEFAULT_UNLOCKED_SPECIES;

  const handleMouseEnterCard = (e: React.MouseEvent, species: SpeciesData) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPos({
      x: Math.min(window.innerWidth - 320, rect.right + 12),
      y: Math.max(80, Math.min(window.innerHeight - 380, rect.top)),
    });
    setHoveredSpecies(species);
  };

  const handleMouseLeaveCard = () => {
    setHoveredSpecies(null);
    setHoverPos(null);
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-between overflow-x-hidden font-sans">
      {/* Background Graphic */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/src/assets/images/hero_pokemon_dungeon_1792647580651.jpg"
          alt="Pokémon Mystery Dungeon"
          className="w-full h-full object-cover opacity-30 filter brightness-75 scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center border-2 border-white/40 shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </div>
          <span className="text-lg md:text-xl font-bold tracking-tight text-white">
            Pokémon Rogue Dungeon
          </span>
          <span className="hidden sm:inline-block text-xs text-slate-400 border-l border-slate-700 pl-2.5">
            寶可夢地牢 Roguelike 冒險
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Professor's Lab Button */}
          <button
            onClick={() => {
              setShowLabModal(true);
              sound.playSelect();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-300 hover:text-white bg-gradient-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 rounded-xl border border-amber-500/40 transition-all cursor-pointer shadow-md"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">博士研究所</span>
            <span className="font-mono text-amber-400 font-bold bg-slate-900/90 px-1.5 py-0.5 rounded border border-amber-500/30 text-[11px]">
              {metaState.badges} 勛章
            </span>
          </button>

          <button
            onClick={handleShare}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/30 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>分享</span>
          </button>

          <button
            onClick={() => {
              setShowGuide(true);
              sound.playSelect();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700/80 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">冒險指南</span>
          </button>

          <button
            onClick={onToggleSound}
            aria-label="Toggle Sound"
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700/80 transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 py-5 flex-1 flex flex-col justify-start items-center">
        {/* Copied Toast Banner */}
        {copiedToast && (
          <div className="fixed top-16 z-50 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-xl animate-bounce flex items-center gap-2">
            <span>✓ 遊戲網址已複製！快傳給朋友一起挑戰！</span>
          </div>
        )}

        {/* Title & Tagline */}
        <div className="text-center max-w-2xl mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>點選角色即可即刻啟程 · 懸浮說明檢視特質</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white mb-1.5">
            選擇初始夥伴，直奔地牢！
          </h1>
          <p className="text-xs md:text-sm text-slate-300">
            滑鼠懸停（或點擊 ℹ️）可查看屬性特質；點選卡片直接啟程！
          </p>
        </div>

        {/* Tab & Filter Bar */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4 p-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('starters');
                sound.playSelect();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'starters'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              經典推薦初始 (8 隻)
            </button>

            <button
              onClick={() => {
                setActiveTab('pokedex');
                sound.playSelect();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pokedex'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>已解鎖圖鑑自選</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-200 border border-purple-500/40">
                {unlockedIds.length} / {allSpeciesIds.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => {
              setIsShiny(!isShiny);
              sound.playSelect();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isShiny
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 ring-2 ring-amber-400/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isShiny ? '✨ 異色閃光模式' : '普通外觀'}</span>
          </button>
        </div>

        {/* Full-Width Starters Grid (點選即可出發！) */}
        <div className="w-full">
          {activeTab === 'starters' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {STARTER_IDS.map((id) => {
                const pkm = POKEMON_SPECIES[id];
                if (!pkm) return null;

                return (
                  <div
                    key={id}
                    onMouseEnter={(e) => handleMouseEnterCard(e, pkm)}
                    onMouseLeave={handleMouseLeaveCard}
                    onClick={() => handleStartWithSpecies(id)}
                    className="group relative p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-rose-500/80 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-rose-950/50 cursor-pointer flex flex-col justify-between"
                  >
                    {/* Top Type Badges & Info Trigger */}
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex gap-1">
                        {pkm.types.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded font-semibold"
                            style={{
                              backgroundColor: `${TYPE_COLORS[t].bg}33`,
                              color: TYPE_COLORS[t].bg,
                            }}
                          >
                            {TYPE_NAMES_ZH[t]}
                          </span>
                        ))}
                      </div>

                      {/* Mobile info button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileModalSpecies(pkm);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                        title="查看詳細說明"
                      >
                        <Info className="w-4 h-4 text-sky-400" />
                      </button>
                    </div>

                    {/* Animated Sprite */}
                    <div className="py-2 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <PokemonSprite
                        speciesId={id}
                        nameZh={pkm.nameZh}
                        types={pkm.types}
                        isShiny={isShiny}
                        size="lg"
                      />
                    </div>

                    {/* Name & Ability */}
                    <div className="text-center w-full">
                      <div className="text-base font-bold text-white group-hover:text-rose-400 transition-colors">
                        {pkm.nameZh}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{pkm.name}</div>
                      <div className="mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 inline-block font-semibold">
                        特性 · {pkm.ability.nameZh}
                      </div>
                    </div>

                    {/* Click-to-Start Prompt */}
                    <div className="mt-3 w-full py-2 px-3 rounded-xl bg-rose-600/20 group-hover:bg-rose-600 text-rose-300 group-hover:text-white border border-rose-500/30 group-hover:border-rose-400 text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-md">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>點選立即出發</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'pokedex' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {allSpeciesIds.map((id) => {
                const pkm = POKEMON_SPECIES[id];
                const isUnlocked = unlockedIds.includes(id);

                if (!isUnlocked) {
                  return (
                    <div
                      key={id}
                      className="p-3.5 rounded-2xl border border-slate-800/80 bg-slate-950/40 text-center flex flex-col items-center justify-center opacity-40 select-none"
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-2">
                        <Lock className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-slate-500">??? 未解鎖</span>
                      <span className="text-[10px] text-slate-600 mt-0.5">在地牢收服後解鎖</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={id}
                    onMouseEnter={(e) => handleMouseEnterCard(e, pkm)}
                    onMouseLeave={handleMouseLeaveCard}
                    onClick={() => handleStartWithSpecies(id)}
                    className="group relative p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-purple-500/80 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-purple-950/50 cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex gap-1">
                        {pkm.types.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                            style={{
                              backgroundColor: `${TYPE_COLORS[t].bg}33`,
                              color: TYPE_COLORS[t].bg,
                            }}
                          >
                            {TYPE_NAMES_ZH[t]}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileModalSpecies(pkm);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Info className="w-3.5 h-3.5 text-purple-400" />
                      </button>
                    </div>

                    <div className="py-1.5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <PokemonSprite
                        speciesId={id}
                        nameZh={pkm.nameZh}
                        types={pkm.types}
                        isShiny={isShiny}
                        size="md"
                      />
                    </div>

                    <div className="text-center w-full">
                      <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                        {pkm.nameZh}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{pkm.name}</div>
                    </div>

                    <div className="mt-2.5 w-full py-1.5 px-2 rounded-xl bg-purple-600/20 group-hover:bg-purple-600 text-purple-300 group-hover:text-white border border-purple-500/30 group-hover:border-purple-400 text-[11px] font-bold flex items-center justify-center gap-1 transition-all">
                      <Play className="w-3 h-3 fill-current" />
                      <span>啟程出發</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Floating Hover Explanation Tooltip (懸浮式說明視窗) */}
      {hoveredSpecies && hoverPos && (
        <div
          className="fixed z-50 w-72 pointer-events-none transition-all duration-100 ease-out hidden md:block"
          style={{ left: `${hoverPos.x}px`, top: `${hoverPos.y}px` }}
        >
          <div className="p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-rose-500/50 shadow-2xl text-slate-200 space-y-2.5 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <div className="text-[10px] text-slate-400 font-mono">
                  No.{String(hoveredSpecies.pokedexNo).padStart(3, '0')}
                </div>
                <div className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>{hoveredSpecies.nameZh}</span>
                  <span className="text-xs text-slate-400 font-normal">({hoveredSpecies.name})</span>
                </div>
              </div>

              <div className="flex gap-1">
                {hoveredSpecies.types.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded font-bold"
                    style={{ backgroundColor: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].text }}
                  >
                    {TYPE_NAMES_ZH[t]}
                  </span>
                ))}
              </div>
            </div>

            {/* Lore */}
            <p className="text-xs text-slate-300 leading-relaxed">
              {hoveredSpecies.descriptionZh}
            </p>

            {/* Ability */}
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="font-bold text-amber-300">
                特性 · {hoveredSpecies.ability.nameZh}：
              </span>
              <span className="text-slate-300 text-[11px] block mt-0.5">
                {hoveredSpecies.ability.description}
              </span>
            </div>

            {/* Evolution info */}
            {hoveredSpecies.evolution && (
              <div className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Lv.{hoveredSpecies.evolution.levelReq} 進化為{' '}
                  <strong>{hoveredSpecies.evolution.evolvesToNameZh}</strong>
                </span>
              </div>
            )}

            {/* Base Stats Bar */}
            <div className="space-y-1 text-[11px] pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-400">
                  <Heart className="w-3 h-3 text-rose-400" /> HP (生命)
                </span>
                <span className="font-mono text-white font-bold">
                  {hoveredSpecies.baseStats.hp}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, (hoveredSpecies.baseStats.hp / 120) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-400">
                  <Swords className="w-3 h-3 text-amber-400" /> 攻擊 / 特攻
                </span>
                <span className="font-mono text-white font-bold">
                  {hoveredSpecies.baseStats.atk} / {hoveredSpecies.baseStats.spa}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (Math.max(hoveredSpecies.baseStats.atk, hoveredSpecies.baseStats.spa) / 120) * 100
                    )}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-slate-400">
                  <Zap className="w-3 h-3 text-sky-400" /> 速度
                </span>
                <span className="font-mono text-white font-bold">
                  {hoveredSpecies.baseStats.spe}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full"
                  style={{ width: `${Math.min(100, (hoveredSpecies.baseStats.spe / 120) * 100)}%` }}
                />
              </div>
            </div>

            <div className="text-[10px] text-center text-slate-400 font-semibold pt-1">
              點選卡片立即出發 ➔
            </div>
          </div>
        </div>
      )}

      {/* Mobile Detailed Info Modal (when clicking ℹ️ on mobile) */}
      {mobileModalSpecies && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-sm w-full rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">{mobileModalSpecies.nameZh}</span>
                <span className="text-xs text-slate-400">({mobileModalSpecies.name})</span>
              </div>
              <button
                onClick={() => setMobileModalSpecies(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {mobileModalSpecies.descriptionZh}
            </p>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
              <strong className="text-amber-300">特性 · {mobileModalSpecies.ability.nameZh}</strong>
              <p className="text-slate-300 mt-1">{mobileModalSpecies.ability.description}</p>
            </div>

            {mobileModalSpecies.evolution && (
              <div className="text-xs text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Lv.{mobileModalSpecies.evolution.levelReq} 進化為{' '}
                  <strong>{mobileModalSpecies.evolution.evolvesToNameZh}</strong>
                </span>
              </div>
            )}

            <button
              onClick={() => {
                const id = mobileModalSpecies.id;
                setMobileModalSpecies(null);
                handleStartWithSpecies(id);
              }}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-900/40"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>攜帶 {mobileModalSpecies.nameZh} 立即出發</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-3 text-center text-xs text-slate-500 border-t border-slate-800/60">
        <span>Pokémon Rogue Dungeon · 屬性相剋 · 招式學習 · 隨機奇遇 · 戰術競技</span>
      </footer>

      {/* Professor's Lab Modal */}
      {showLabModal && (
        <ProfessorLabModal
          metaState={metaState}
          onUpdateMetaState={(updated) => setMetaState(updated)}
          onClose={() => setShowLabModal(false)}
        />
      )}

      {/* Adventure Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-xl w-full rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                冒險指南與規則說明
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded-md text-sm cursor-pointer"
              >
                ✕ 關閉
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <strong className="text-amber-300 block mb-1">1. 屬性相剋機制</strong>
                火剋草、草剋水、水剋火、電剋水與飛行、地面剋電與火、格鬥剋一般與岩石等。掌握屬性剋制能造成 2 倍效果絕佳傷害！
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <strong className="text-emerald-300 block mb-1">2. 接觸式戰鬥與敵人主動追逐</strong>
                地牢中直接生成巡邏敵人！靠近時敵人會主動發起追擊，玩家可靈活操控走位閃躲繞開，或主動迎戰！
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <strong className="text-purple-300 block mb-1">3. 隨機地牢物件</strong>
                每層地牢的營火、寶箱、流浪商人與古代石碑隨機出現，隨時留意右上角實時探測雷達！
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <strong className="text-sky-300 block mb-1">4. 收服野生寶可夢與解鎖圖鑑</strong>
                在對戰中將野生寶可夢 HP 壓低後可投擲精靈球收服！成功收服的寶可夢會永久解鎖，下輪開局可直接挑選！
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              我知道了，開始冒險！
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

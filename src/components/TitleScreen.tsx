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
  Shield,
  Zap,
  Heart,
  Info,
  BookOpen,
  Volume2,
  VolumeX,
  Play,
  Award,
  Lock,
} from 'lucide-react';
import { PokemonInstance } from '../types/pokemon';

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
  const [selectedId, setSelectedId] = useState<string>('charmander');
  const [isShiny, setIsShiny] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showLabModal, setShowLabModal] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  // Sync latest meta-progression
  useEffect(() => {
    setMetaState(loadMetaProgression());
  }, []);

  const selectedSpecies = POKEMON_SPECIES[selectedId] || POKEMON_SPECIES.charmander;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    sound.playSelect();
  };

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

  const handleStart = () => {
    sound.playSelect();
    const starter = createPokemon(selectedId, 5, isShiny);
    // Apply vitality talent
    if (metaState.talents.vitality > 0) {
      const extraHpRatio = 1 + metaState.talents.vitality * 0.1;
      const boostedHp = Math.floor(starter.maxHp * extraHpRatio);
      starter.maxHp = boostedHp;
      starter.currentHp = boostedHp;
      starter.stats.hp = boostedHp;
    }
    onStartGame(starter);
  };

  // List of all species in database
  const allSpeciesIds = Object.keys(POKEMON_SPECIES);
  const unlockedIds = metaState.unlockedPokedex || DEFAULT_UNLOCKED_SPECIES;

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-between overflow-x-hidden font-sans">
      {/* Background Graphic with overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/src/assets/images/hero_pokemon_dungeon_1792647580651.jpg"
          alt="Pokémon Mystery Dungeon"
          className="w-full h-full object-cover opacity-35 filter brightness-75 scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center border-2 border-white/40 shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Pokémon Rogue Dungeon</span>
          <span className="hidden sm:inline-block text-xs text-slate-400 border-l border-slate-700 pl-3">
            寶可夢地牢 Roguelike 冒險
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Professor's Lab Button */}
          <button
            onClick={() => {
              setShowLabModal(true);
              sound.playSelect();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-300 hover:text-white bg-gradient-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 rounded-xl border border-amber-500/40 transition-all cursor-pointer shadow-md"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>博士研究所</span>
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
            <span>冒險指南</span>
          </button>

          <button
            onClick={onToggleSound}
            aria-label="Toggle Sound"
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700/80 transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 py-6 flex-1 flex flex-col justify-center items-center">
        {/* Copied Toast Banner */}
        {copiedToast && (
          <div className="fixed top-16 z-50 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-xl animate-bounce flex items-center gap-2">
            <span>✓ 遊戲網址已複製！快傳給朋友一起挑戰！</span>
          </div>
        )}

        {/* Title & Tagline */}
        <div className="text-center max-w-2xl mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium mb-2.5">
            <span>Roguelike 地牢爬塔 · 永久研究所天賦 · 圖鑑解鎖自選初始</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-2">
            選擇你的夥伴寶可夢
          </h1>
          <p className="text-xs md:text-sm text-slate-300">
            全新平衡調整：道館館主等級自適應、防 MISS 保底、全員營地特訓升級與脫離繩救援機制！
          </p>
        </div>

        {/* Starter Selection & Details Split Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Starters Grid (7 Columns) */}
          <div className="lg:col-span-7 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
            <div>
              {/* Category Tabs: Recommended vs Unlocked Pokedex */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                  <button
                    onClick={() => {
                      setActiveTab('starters');
                      sound.playSelect();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'starters'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    經典推薦 (8 隻)
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('pokedex');
                      sound.playSelect();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors self-start sm:self-auto cursor-pointer ${
                    isShiny
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 ring-1 ring-amber-400/30'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isShiny ? '✨ 異色模式' : '普通模式'}</span>
                </button>
              </div>

              {/* Grid 1: Standard Starters */}
              {activeTab === 'starters' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {STARTER_IDS.map((id) => {
                    const pkm = POKEMON_SPECIES[id];
                    const isSelected = selectedId === id;

                    return (
                      <button
                        key={id}
                        onClick={() => handleSelect(id)}
                        className={`relative p-2.5 rounded-xl border text-left transition-all duration-150 flex flex-col items-center group cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800 border-rose-500 shadow-lg shadow-rose-950/40 ring-2 ring-rose-500/30'
                            : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
                        }`}
                      >
                        <PokemonSprite
                          speciesId={id}
                          nameZh={pkm.nameZh}
                          types={pkm.types}
                          isShiny={isShiny}
                          size="md"
                        />
                        <div className="mt-2 text-center w-full">
                          <div className="text-sm font-bold text-white truncate">{pkm.nameZh}</div>
                          <div className="text-[11px] text-slate-400 truncate">{pkm.name}</div>
                          <div className="flex justify-center gap-1 mt-1">
                            {pkm.types.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.2 rounded font-medium"
                                style={{ backgroundColor: `${TYPE_COLORS[t].bg}33`, color: TYPE_COLORS[t].bg }}
                              >
                                {TYPE_NAMES_ZH[t]}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Grid 2: All Pokédex Roster (Unlocked vs Locked) */}
              {activeTab === 'pokedex' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {allSpeciesIds.map((id) => {
                    const pkm = POKEMON_SPECIES[id];
                    const isUnlocked = unlockedIds.includes(id);
                    const isSelected = selectedId === id;

                    if (!isUnlocked) {
                      return (
                        <div
                          key={id}
                          className="relative p-2.5 rounded-xl border border-slate-800 bg-slate-950/50 text-center flex flex-col items-center justify-center opacity-50"
                        >
                          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-1.5">
                            <Lock className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-medium text-slate-500">???</span>
                          <span className="text-[9px] text-slate-600">收服後解鎖選用</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={id}
                        onClick={() => handleSelect(id)}
                        className={`relative p-2.5 rounded-xl border text-left transition-all duration-150 flex flex-col items-center group cursor-pointer ${
                          isSelected
                            ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-950/40 ring-2 ring-purple-500/30'
                            : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
                        }`}
                      >
                        <PokemonSprite
                          speciesId={id}
                          nameZh={pkm.nameZh}
                          types={pkm.types}
                          isShiny={isShiny}
                          size="md"
                        />
                        <div className="mt-2 text-center w-full">
                          <div className="text-sm font-bold text-white truncate">{pkm.nameZh}</div>
                          <div className="text-[11px] text-slate-400 truncate">{pkm.name}</div>
                          <div className="flex justify-center gap-1 mt-1">
                            {pkm.types.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.2 rounded font-medium"
                                style={{ backgroundColor: `${TYPE_COLORS[t].bg}33`, color: TYPE_COLORS[t].bg }}
                              >
                                {TYPE_NAMES_ZH[t]}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Starter Tips */}
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                {activeTab === 'pokedex'
                  ? '在地牢中用精靈球成功收服的任何野生寶可夢，都會永久解鎖在此圖鑑中，下輪可自由選擇作為開局初始夥伴！'
                  : '所有初始寶可夢都能在地牢冒險中透過戰鬥與營地特訓升級進化，解鎖專屬強力大招！'}
              </span>
            </div>
          </div>

          {/* Selected Pokémon Detail Card (5 Columns) */}
          <div className="lg:col-span-5 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-xl">
            {selectedSpecies && (
              <>
                <div>
                  {/* Top Header of Selected Card */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-slate-400 font-mono">
                        No.{String(selectedSpecies.pokedexNo).padStart(3, '0')}
                      </div>
                      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {selectedSpecies.nameZh}
                        <span className="text-sm font-normal text-slate-400">{selectedSpecies.name}</span>
                      </h2>
                    </div>

                    <div className="flex gap-1.5">
                      {selectedSpecies.types.map((t) => (
                        <span
                          key={t}
                          className="px-2.5 py-1 rounded text-xs font-semibold shadow-sm"
                          style={{ backgroundColor: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].text }}
                        >
                          {TYPE_NAMES_ZH[t]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Visual Portrait */}
                  <div className="my-3 py-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-center relative overflow-hidden">
                    <PokemonSprite
                      speciesId={selectedSpecies.id}
                      nameZh={selectedSpecies.nameZh}
                      types={selectedSpecies.types}
                      isShiny={isShiny}
                      size="xl"
                      useArtwork={true}
                    />
                  </div>

                  {/* Lore Description */}
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {selectedSpecies.descriptionZh}
                  </p>

                  {/* Ability & Evolution Tag */}
                  <div className="space-y-2 mb-3">
                    <div className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs">
                      <div className="font-semibold text-amber-300 mb-0.5">
                        特性 · {selectedSpecies.ability.nameZh} ({selectedSpecies.ability.name})
                      </div>
                      <div className="text-slate-300">{selectedSpecies.ability.description}</div>
                    </div>

                    {selectedSpecies.evolution && (
                      <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          達到 Lv.{selectedSpecies.evolution.levelReq} 可進化為{' '}
                          <strong>{selectedSpecies.evolution.evolvesToNameZh}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Base Stats Preview */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-rose-400" /> HP (生命)
                      </span>
                      <span className="font-mono text-white tabular-nums">
                        {selectedSpecies.baseStats.hp}
                        {metaState.talents.vitality > 0 && (
                          <span className="text-emerald-400 text-[10px] ml-1">
                            (+{metaState.talents.vitality * 10}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, (selectedSpecies.baseStats.hp / 120) * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Swords className="w-3.5 h-3.5 text-amber-400" /> 攻擊 / 特攻
                      </span>
                      <span className="font-mono text-white tabular-nums">
                        {selectedSpecies.baseStats.atk} / {selectedSpecies.baseStats.spa}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (Math.max(selectedSpecies.baseStats.atk, selectedSpecies.baseStats.spa) / 120) * 100
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-sky-400" /> 速度
                      </span>
                      <span className="font-mono text-white tabular-nums">
                        {selectedSpecies.baseStats.spe}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-sky-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, (selectedSpecies.baseStats.spe / 120) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  onClick={handleStart}
                  className="mt-5 w-full py-3.5 px-6 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-rose-900/40 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>攜帶 {selectedSpecies.nameZh} 啟程出發</span>
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-3.5 text-center text-xs text-slate-500 border-t border-slate-800/60">
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

      {/* Guide Modal */}
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
                <strong className="text-emerald-300 block mb-1">2. 動態平衡與營地特訓升級</strong>
                道館首領等級會自適應隊伍實力，避免等級差距懸殊！避難營地新增「全員極限特訓」，全隊可直接升級滿血。
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <strong className="text-purple-300 block mb-1">3. 脫離繩戰術救援</strong>
                遇到致命危機或關主陷入絕境時，可使用【脫離繩】撤退；當全員倒下時，背包中的脫離繩會自動救援脫離，保全進度！
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <strong className="text-sky-300 block mb-1">4. 收服野生寶可夢與解鎖圖鑑</strong>
                在「野生寶可夢氣息」關卡中將對方 HP 壓低後可投擲精靈球收服！成功收服的寶可夢會永久登錄圖鑑，下輪開局可直接挑選！
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <strong className="text-rose-300 block mb-1">5. 博士研究所 · 永久天賦</strong>
                每一次探險結算的冒險勛章可用於永久強化：全隊 HP 上限、開局金幣、捕獲率、經驗增幅、命中率保底與不屈意志！
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

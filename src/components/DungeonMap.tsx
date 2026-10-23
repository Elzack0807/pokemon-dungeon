import React, { useState, useEffect } from 'react';
import { DungeonNode, PokemonInstance, Item } from '../types/pokemon';
import { PokemonSprite } from './PokemonSprite';
import { HD2DDungeonScene } from './HD2DDungeonScene';
import { TYPE_COLORS, TYPE_NAMES_ZH } from '../utils/typeChart';
import { sound } from '../utils/audio';
import {
  Coins,
  Backpack,
  Users,
  Volume2,
  VolumeX,
  Compass,
  Flame,
  ArrowRight,
  Sparkles,
  Swords,
  Home,
  AlertTriangle,
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
  onAdvanceFloor: () => void;
  onLootChest: (coins: number, item?: Item) => void;
  onReturnToTitle: () => void;
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
  onAdvanceFloor,
  onLootChest,
  onReturnToTitle,
  onOpenParty,
  onOpenBag,
}) => {
  const [defeatedEnemyIds, setDefeatedEnemyIds] = useState<string[]>([]);
  const [hasLootedChest, setHasLootedChest] = useState<boolean>(false);
  const [lootToast, setLootToast] = useState<{ message: string; sub?: string } | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  // Reset floor state when changing floors
  useEffect(() => {
    setDefeatedEnemyIds([]);
    setHasLootedChest(false);
  }, [currentFloor]);

  const activeLead = party[0] || party.find((p) => p.currentHp > 0);
  const isBossFloor = currentFloor % 3 === 0 || nodes.some((n) => n.type === 'boss');
  const playerPartyLevel = party.length > 0 ? Math.max(...party.map((p) => p.level), 5) : 5;

  const getSectorName = (floor: number) => {
    if (floor <= 3) return '深谷地底迴廊 (岩石荒原)';
    if (floor <= 6) return '水之潮汐地下湖 (藍色水窟)';
    if (floor <= 9) return '火箭隊秘密挖掘場 (地下要塞)';
    if (floor <= 12) return '龍之試煉巨石峰 (古代遺跡)';
    return '終極聖域 · 傳說神殿 (世界盡頭)';
  };

  const handleLootChestInternal = (earnedCoins: number, item?: Item) => {
    onLootChest(earnedCoins, item);
    sound.playSelect();
    setLootToast({
      message: `🎉 開啟古代寶箱！獲得 ${earnedCoins} 金幣`,
      sub: item ? `額外獲得道具：【${item.nameZh}】！` : undefined,
    });
    setTimeout(() => {
      setLootToast(null);
    }, 3800);
  };

  const handleTriggerBattleFromMap = (node: DungeonNode, enemyId?: string) => {
    if (enemyId) {
      setDefeatedEnemyIds((prev) => (prev.includes(enemyId) ? prev : [...prev, enemyId]));
    }
    onSelectNode(node);
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
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
      <header className="relative z-20 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 md:px-6 py-2.5 flex items-center justify-between gap-2 shadow-xl">
        {/* Left: Floor & Sector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold">
            <Compass className="w-3.5 h-3.5 text-rose-400" />
            <span>
              Floor {currentFloor} / {totalFloors}
            </span>
          </div>
          <div className="hidden sm:block text-xs md:text-sm font-bold text-white tracking-wide">
            {getSectorName(currentFloor)}
          </div>
        </div>

        {/* Center: Objective Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs">
          {isBossFloor ? (
            <>
              <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span className="font-semibold text-rose-300">
                【首領聖域】深入迴廊挑戰鎮守首領！(接觸即可交戰)
              </span>
            </>
          ) : (
            <>
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300">
                怪物直接生成，主動追逐可走位閃躲；營火寶箱商人隨機出現！
              </span>
            </>
          )}
        </div>

        {/* Right HUD Controls */}
        <div className="flex items-center gap-2">
          {/* Return to Home / Title */}
          <button
            onClick={() => {
              sound.playSelect();
              setShowExitConfirm(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            title="返回首頁"
          >
            <Home className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">回首頁</span>
          </button>

          {/* PokéCoins */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-bold">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="tabular-nums">{coins}</span>
          </div>

          {/* Bag Button */}
          <button
            onClick={() => {
              sound.playSelect();
              onOpenBag();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <Backpack className="w-3.5 h-3.5 text-sky-400" />
            <span>背包</span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({inventory.reduce((a, b) => a + b.count, 0)})
            </span>
          </button>

          {/* Party Button */}
          <button
            onClick={() => {
              sound.playSelect();
              onOpenParty();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>隊伍</span>
            <span className="text-[10px] text-slate-400 font-mono">({party.length}/3)</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            aria-label="Toggle Sound"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Floating Loot Notification Toast */}
      {lootToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce pointer-events-none">
          <div className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-2xl border border-amber-300 text-center">
            <div className="text-sm md:text-base">{lootToast.message}</div>
            {lootToast.sub && (
              <div className="text-xs text-amber-100 font-normal mt-0.5">{lootToast.sub}</div>
            )}
          </div>
        </div>
      )}

      {/* Return to Title Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-sm w-full rounded-2xl p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>返回遊戲首頁確認</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              確定要返回遊戲首頁嗎？當前地牢進度將會重置，但博士研究所的天賦勛章與已收服圖鑑將永久保留。
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                繼續冒險
              </button>
              <button
                onClick={() => {
                  sound.playSelect();
                  setShowExitConfirm(false);
                  onReturnToTitle();
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                確認返回首頁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Exploration Body */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-2 md:px-6 py-2.5 flex flex-col justify-start gap-2.5">
        {/* Party Mini Health Dock */}
        <div className="w-full flex items-center justify-between gap-2 overflow-x-auto py-1">
          <div className="flex items-center gap-2">
            {party.map((p, idx) => {
              const hpPct = Math.round((p.currentHp / p.maxHp) * 100);
              const isFainted = p.currentHp <= 0;
              return (
                <div
                  key={p.uid || idx}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all ${
                    idx === 0
                      ? 'bg-slate-900/90 border-rose-500/50 shadow-md ring-1 ring-rose-500/20'
                      : 'bg-slate-900/60 border-slate-800'
                  } ${isFainted ? 'opacity-50 grayscale' : ''}`}
                >
                  <div className="w-7 h-7 flex items-center justify-center">
                    <PokemonSprite
                      speciesId={p.speciesId}
                      pokedexNo={p.pokedexNo}
                      nameZh={p.nameZh}
                      types={p.types}
                      isShiny={p.isShiny}
                      isFainted={isFainted}
                      size="sm"
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-white leading-tight">
                      <span>{p.nameZh}</span>
                      <span className="text-[9px] text-amber-400 font-mono">Lv.{p.level}</span>
                      {idx === 0 && (
                        <span className="text-[9px] px-1 rounded bg-rose-500/30 text-rose-300">
                          隊首
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            hpPct > 50 ? 'bg-emerald-400' : hpPct > 20 ? 'bg-amber-400' : 'bg-rose-500'
                          }`}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 tabular-nums">
                        {p.currentHp}/{p.maxHp}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Descent Button */}
          {!isBossFloor && (
            <button
              onClick={() => {
                sound.playSelect();
                onAdvanceFloor();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer whitespace-nowrap shadow-md"
            >
              <span>前往第 {currentFloor + 1} 層階梯</span>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          )}
        </div>

        {/* 3D HD-2D Explorable Scene */}
        <div className="w-full">
          <HD2DDungeonScene
            currentFloor={currentFloor}
            totalFloors={totalFloors}
            nodes={nodes}
            leadPokemon={activeLead}
            playerPartyLevel={playerPartyLevel}
            defeatedEnemyIds={defeatedEnemyIds}
            onTriggerBattle={handleTriggerBattleFromMap}
            onOpenCamp={() => {
              const campNode = nodes.find((n) => n.type === 'camp') || {
                id: `camp_${currentFloor}`,
                floor: currentFloor,
                type: 'camp' as const,
                title: '地底休息營地',
                description: '溫暖的火堆與甘甜泉水',
                completed: false,
                accessible: true,
                connectedNextNodeIds: [],
              };
              onSelectNode(campNode);
            }}
            onOpenShop={() => {
              const shopNode = nodes.find((n) => n.type === 'shop') || {
                id: `shop_${currentFloor}`,
                floor: currentFloor,
                type: 'shop' as const,
                title: '地牢友誼商店',
                description: '神秘商人販售道具',
                completed: false,
                accessible: true,
                connectedNextNodeIds: [],
              };
              onSelectNode(shopNode);
            }}
            onTriggerEvent={(evId) => {
              const eventNode = nodes.find((n) => n.type === 'event') || {
                id: `event_${currentFloor}`,
                floor: currentFloor,
                type: 'event' as const,
                title: '地牢遠古奇遇',
                description: '神秘石碑遺跡',
                mysteryEventId: evId,
                completed: false,
                accessible: true,
                connectedNextNodeIds: [],
              };
              onSelectNode(eventNode);
            }}
            onAdvanceFloor={onAdvanceFloor}
            onLootChest={handleLootChestInternal}
            hasLootedChest={hasLootedChest}
            setHasLootedChest={setHasLootedChest}
          />
        </div>
      </main>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { DungeonNode, PokemonInstance, Item } from '../types/pokemon';
import { PokemonSprite } from './PokemonSprite';
import { PixelDungeonScene2D } from './PixelDungeonScene2D';
import { TYPE_COLORS, TYPE_NAMES_ZH } from '../utils/typeChart';
import { sound } from '../utils/audio';
import { FieldTerrainData } from '../utils/fieldTerrain';
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
  Zap,
  CloudRain,
  Cloud,
} from 'lucide-react';

import grassyBg from '../assets/images/pixel_battle_grassy_meadow_1792859746328.jpg';
import fireBg from '../assets/images/pixel_battle_fire_cave_1792859746341.jpg';
import iceBg from '../assets/images/pixel_battle_ice_tundra_1792859745380.jpg';

import { EvolutionAltarModal } from './EvolutionAltarModal';
import { DungeonWeatherEffect, WeatherType } from './DungeonWeatherEffect';

interface DungeonMapProps {
  currentFloor: number;
  totalFloors: number;
  nodes: DungeonNode[];
  party: PokemonInstance[];
  coins: number;
  inventory: { item: Item; count: number }[];
  fieldTerrain: FieldTerrainData;
  soundEnabled: boolean;
  volume: number;
  onToggleSound: () => void;
  onVolumeChange: (vol: number) => void;
  onSelectNode: (node: DungeonNode) => void;
  onAdvanceFloor: () => void;
  onLootChest: (coins: number, item?: Item) => void;
  onReturnToTitle: () => void;
  onOpenParty: () => void;
  onOpenBag: () => void;
  onUpdatePartyAndInventory?: (
    updatedParty: PokemonInstance[],
    updatedInventory: { item: Item; count: number }[]
  ) => void;
}

export const DungeonMap: React.FC<DungeonMapProps> = ({
  currentFloor,
  totalFloors,
  nodes,
  party,
  coins,
  inventory,
  fieldTerrain,
  soundEnabled,
  volume,
  onToggleSound,
  onVolumeChange,
  onSelectNode,
  onAdvanceFloor,
  onLootChest,
  onReturnToTitle,
  onOpenParty,
  onOpenBag,
  onUpdatePartyAndInventory,
}) => {
  const [defeatedEnemyIds, setDefeatedEnemyIds] = useState<string[]>([]);
  const [hasLootedChest, setHasLootedChest] = useState<boolean>(false);
  const [lootToast, setLootToast] = useState<{ message: string; sub?: string } | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [showEvolutionAltarModal, setShowEvolutionAltarModal] = useState<boolean>(false);
  const [weatherType, setWeatherType] = useState<WeatherType>('auto');

  const weatherConfig: Record<WeatherType, { name: string; desc: string }> = {
    auto: { name: '動態環境', desc: '依地牢層數與地形自動調整探險氛圍' },
    rain: { name: '細雨連綿', desc: '幽暗洞窟中的清涼細雨與地面積水漣漪' },
    fog: { name: '幽谷迷霧', desc: '層層飄動的深谷地牢煙嵐與神秘霧氣' },
    torch: { name: '閃爍火光', desc: '洞窟壁火搖曳生輝與緩緩升騰的火星' },
    spores: { name: '螢光微塵', desc: '地底奇異發光孢子與幽暗靈動微光' },
  };

  const handleCycleWeather = () => {
    sound.playSelect();
    const order: WeatherType[] = ['auto', 'rain', 'fog', 'torch', 'spores'];
    const nextIdx = (order.indexOf(weatherType) + 1) % order.length;
    const nextWeather = order[nextIdx];
    setWeatherType(nextWeather);
    setLootToast({
      message: `🌤️ 地牢氛圍切換：【${weatherConfig[nextWeather].name}】`,
      sub: weatherConfig[nextWeather].desc,
    });
    setTimeout(() => setLootToast(null), 2500);
  };

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
    // Chest loot popup window cancelled per user directive
  };

  const handleTriggerBattleFromMap = (node: DungeonNode, enemyId?: string) => {
    if (enemyId) {
      setDefeatedEnemyIds((prev) => (prev.includes(enemyId) ? prev : [...prev, enemyId]));
    }
    onSelectNode(node);
  };

  const handleQuickItemUse = (item: Item) => {
    const invSlot = inventory.find((i) => i.item.id === item.id || (item.type === 'pokeball' && i.item.type === 'pokeball'));
    if (!invSlot || invSlot.count <= 0) {
      sound.playSelect();
      setLootToast({ message: `背包中無可用【${item.nameZh}】！可在友誼商店採購。` });
      setTimeout(() => setLootToast(null), 2500);
      return;
    }

    if (item.type === 'pokeball') {
      sound.playPokeballShake();
      setLootToast({ message: `🔴 持有精靈球 x${invSlot.count}！遭遇野怪即可投擲捕捉。` });
      setTimeout(() => setLootToast(null), 2500);
      return;
    }

    if (item.id === 'escape_rope') {
      sound.playSelect();
      setLootToast({ message: `📜 脫離繩隨身就緒！隊伍瀕死或遇險時將自動展開救援。` });
      setTimeout(() => setLootToast(null), 2500);
      return;
    }

    if (item.id === 'revive') {
      const faintedPkm = party.find((p) => p.currentHp <= 0);
      if (faintedPkm) {
        faintedPkm.currentHp = Math.floor(faintedPkm.maxHp * 0.5);
        faintedPkm.status = 'None';
        invSlot.count -= 1;
        sound.playRest();
        setLootToast({ message: `✨ 【活力碎片】使用了！${faintedPkm.nameZh} 復活並回復 50% HP！` });
        setTimeout(() => setLootToast(null), 3000);
      } else {
        sound.playSelect();
        setLootToast({ message: `全隊尚無倒下的寶可夢，無需使用活力碎片！` });
        setTimeout(() => setLootToast(null), 2500);
      }
      return;
    }

    // Health Potions / Berries
    const lead = party[0];
    if (lead) {
      if (lead.currentHp < lead.maxHp) {
        const healAmt = item.healAmount || Math.floor(lead.maxHp * ((item.healPercent || 50) / 100));
        const actualHeal = Math.min(lead.maxHp - lead.currentHp, healAmt);
        lead.currentHp = Math.min(lead.maxHp, lead.currentHp + actualHeal);
        invSlot.count -= 1;
        sound.playRest();
        setLootToast({ message: `💊 使用了【${item.nameZh}】！${lead.nameZh} 回復了 ${actualHeal} HP！` });
        setTimeout(() => setLootToast(null), 3000);
      } else {
        sound.playSelect();
        setLootToast({ message: `${lead.nameZh} 生命值已滿，無需使用傷藥！` });
        setTimeout(() => setLootToast(null), 2500);
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Background Ambience Matching Battle Scene */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-25">
        <img
          src={
            fieldTerrain.id === 'ice_tundra'
              ? iceBg
              : fieldTerrain.id === 'fire_cave'
              ? fireBg
              : grassyBg
          }
          alt="Dungeon Map Texture"
          className="w-full h-full object-cover filter brightness-50"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-slate-950/85" />
      </div>

      {/* Screen-Wide Ambient Weather Atmosphere Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <DungeonWeatherEffect
          weatherType={weatherType}
          currentFloor={currentFloor}
          fieldTerrainId={fieldTerrain.id}
          isBossFloor={isBossFloor}
        />
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

        {/* Center: Objective & Field Terrain Badge (Streamlined) */}
        <div className="hidden lg:flex items-center gap-2">
          {fieldTerrain.id !== 'none' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700/80 text-[11px]">
              <span className="font-bold text-amber-300">{fieldTerrain.badge}</span>
            </div>
          )}

          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-[11px]">
            <Flame className="w-3 h-3 text-rose-400 animate-pulse" />
            <span className="font-semibold text-rose-300">擊敗 BOSS 即可通關</span>
          </div>
        </div>

        {/* Right HUD Controls */}
        <div className="flex items-center gap-2">
          {/* Weather Effect Selector Button */}
          <button
            onClick={handleCycleWeather}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            title="點擊切換地牢環境/天氣效果 (細雨、迷霧、火光、螢光、自動)"
          >
            {weatherType === 'rain' ? (
              <CloudRain className="w-3.5 h-3.5 text-sky-400" />
            ) : weatherType === 'fog' ? (
              <Cloud className="w-3.5 h-3.5 text-slate-300" />
            ) : weatherType === 'torch' ? (
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            ) : weatherType === 'spores' ? (
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span className="hidden xl:inline">{weatherConfig[weatherType].name}</span>
          </button>

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

          {/* Sound & Volume Control */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 shadow-sm">
            <button
              onClick={onToggleSound}
              aria-label="Toggle Sound"
              className="text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center"
              title={soundEnabled ? '靜音' : '開啟聲音'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
              )}
            </button>
            {soundEnabled && (
              <div className="flex items-center gap-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-16 sm:w-20 h-1.5 accent-emerald-400 cursor-pointer bg-slate-700 rounded-lg"
                  title={`音量: ${Math.round(volume * 100)}%`}
                />
                <span className="text-[10px] font-mono text-slate-400 w-6 text-right">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            )}
          </div>
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
        {/* Pure 2D Pixel Art Explorable Map */}
        <div className="w-full">
          <PixelDungeonScene2D
            currentFloor={currentFloor}
            totalFloors={totalFloors}
            nodes={nodes}
            leadPokemon={activeLead}
            playerPartyLevel={playerPartyLevel}
            fieldTerrain={fieldTerrain}
            defeatedEnemyIds={defeatedEnemyIds}
            inventory={inventory}
            party={party}
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
            onOpenEvolutionAltar={() => setShowEvolutionAltarModal(true)}
            onAdvanceFloor={onAdvanceFloor}
            onLootChest={handleLootChestInternal}
            hasLootedChest={hasLootedChest}
            setHasLootedChest={setHasLootedChest}
            isModalOpen={showEvolutionAltarModal || showExitConfirm}
            weatherType={weatherType}
          />
        </div>
      </main>

      {/* Evolution Altar Modal Overlay */}
      {showEvolutionAltarModal && (
        <EvolutionAltarModal
          party={party}
          inventory={inventory}
          onClose={() => setShowEvolutionAltarModal(false)}
          onUpdatePartyAndInventory={(upParty, upInv) => {
            if (onUpdatePartyAndInventory) {
              onUpdatePartyAndInventory(upParty, upInv);
            }
          }}
        />
      )}
    </div>
  );
};

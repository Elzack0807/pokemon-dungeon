import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { DungeonNode, PokemonInstance, Item, Trainer } from '../types/pokemon';
import { POKEMON_SPECIES } from '../data/pokemonData';
import { generateWildPokemon, generateTrainer, generateDioramaMapLayout } from '../data/dungeonGenerator';
import { ITEMS } from '../data/itemsData';
import { sound } from '../utils/audio';
import { FieldTerrainData } from '../utils/fieldTerrain';
import { TYPE_COLORS } from '../utils/typeChart';
import {
  Compass,
  Flame,
  Clock,
  Sparkles,
} from 'lucide-react';
import { DungeonWeatherEffect, WeatherType } from './DungeonWeatherEffect';
import {
  HD2D_DIORAMA_ASSET_PACK,
  HD2D_TILE_MAP,
  HD2D_TILE_ID_MAP,
  HD2D_DIORAMA_TILESET,
} from '../data/hd2dDioramaAssetPack';

export interface RoamingEnemy2D {
  id: string;
  type: 'wild' | 'trainer' | 'boss';
  pkm: PokemonInstance;
  trainer?: Trainer;
  x: number; // tile coordinates (0 to 49)
  y: number; // tile coordinates (0 to 49)
  px: number; // pixel coordinates
  py: number; // pixel coordinates
  basePx: number;
  basePy: number;
  targetPx?: number;
  targetPy?: number;
  patrolRadius: number;
  patrolAngle: number;
  patrolSpeed: number;
  chaseSpeed: number;
  aiState: 'patrol' | 'chase' | 'cooldown';
  alertTimer: number;
  defeated: boolean;
}

export interface FloorProp2D {
  type: 'camp' | 'shop' | 'chest' | 'stele' | 'house' | 'sign' | 'evolution_altar';
  id: string;
  tileX: number;
  tileY: number;
  tileId?: number;
  isUsed?: boolean;
  respawnAt?: number;
}

// Persistent player position store across battle/modals
const floorPlayerPosCache2D: Record<number, { px: number; py: number }> = {};

// Persistent roaming enemies store across battle/modals (prevents identical respawns in place)
const floorEnemiesCache2D: Record<number, RoamingEnemy2D[]> = {};
let globalLastEncounterEnemyId: string | null = null;

// Persistent elapsed seconds & boss spawned status across battle/modals
const floorElapsedSecondsCache2D: Record<number, number> = {};
const floorBossSpawnedCache2D: Record<number, boolean> = {};
const floorPropsCache2D: Record<number, FloorProp2D[]> = {};

// Global interaction cooldown across component unmount/remount (fixes functional window multi-click bug)
let globalPropCooldown = 0;

/** Clears 2D dungeon caches so new runs / floor restarts generate level-appropriate enemies */
export function resetDungeonSceneCaches2D() {
  for (const key of Object.keys(floorPlayerPosCache2D)) delete floorPlayerPosCache2D[Number(key)];
  for (const key of Object.keys(floorEnemiesCache2D)) delete floorEnemiesCache2D[Number(key)];
  for (const key of Object.keys(floorElapsedSecondsCache2D)) delete floorElapsedSecondsCache2D[Number(key)];
  for (const key of Object.keys(floorBossSpawnedCache2D)) delete floorBossSpawnedCache2D[Number(key)];
  for (const key of Object.keys(floorPropsCache2D)) delete floorPropsCache2D[Number(key)];
  globalLastEncounterEnemyId = null;
  globalPropCooldown = 0;
}

const MAP_GRID_SIZE = 50; // 50x50 map grid
const TILE_PX = 64; // 64px per tile
const BOSS_SPAWN_SECONDS = 180; // 3 minutes = 180 seconds

interface PixelDungeonScene2DProps {
  currentFloor: number;
  totalFloors: number;
  nodes: DungeonNode[];
  leadPokemon?: PokemonInstance;
  playerPartyLevel: number;
  fieldTerrain: FieldTerrainData;
  defeatedEnemyIds: string[];
  inventory?: { item: Item; count: number }[];
  party?: PokemonInstance[];
  onTriggerBattle: (node: DungeonNode, enemyId?: string) => void;
  onOpenCamp: () => void;
  onOpenShop: () => void;
  onTriggerEvent: (eventId: string) => void;
  onOpenEvolutionAltar: () => void;
  onAdvanceFloor: () => void;
  onLootChest: (coins: number, item?: Item) => void;
  hasLootedChest: boolean;
  setHasLootedChest: (looted: boolean) => void;
  isModalOpen?: boolean;
  weatherType?: WeatherType;
}

export const PixelDungeonScene2D: React.FC<PixelDungeonScene2DProps> = ({
  currentFloor,
  totalFloors,
  nodes,
  leadPokemon,
  playerPartyLevel,
  fieldTerrain,
  defeatedEnemyIds,
  onTriggerBattle,
  onOpenCamp,
  onOpenShop,
  onTriggerEvent,
  onOpenEvolutionAltar,
  onAdvanceFloor,
  onLootChest,
  hasLootedChest,
  setHasLootedChest,
  isModalOpen = false,
  weatherType = 'auto',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Floor dwell time & 3-minute Boss spawn state (persisted across battles/modals)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    return floorElapsedSecondsCache2D[currentFloor] || 0;
  });
  const [bossSpawned, setBossSpawned] = useState<boolean>(() => {
    return !!floorBossSpawnedCache2D[currentFloor];
  });
  const [bossDefeated, setBossDefeated] = useState<boolean>(false);

  // Encounter & Toast Alerts
  const [encounterAlert, setEncounterAlert] = useState<{ active: boolean; title: string }>({
    active: false,
    title: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sprint / Dash state
  const [isSprintActive, setIsSprintActive] = useState<boolean>(false);
  const isSprintingRef = useRef<boolean>(false);

  // Control keys & joystick & click-to-move
  const keysPressed = useRef<Record<string, boolean>>({});
  const joystickVector = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState<boolean>(false);
  const [joystickKnobPos, setJoystickKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchId = useRef<number | null>(null);
  const isMouseDraggingJoystick = useRef<boolean>(false);
  const targetClickPos = useRef<{ px: number; py: number } | null>(null);

  // Player position in pixels (spawn at tile 25, 42 on the central dirt highway)
  const initialPos = floorPlayerPosCache2D[currentFloor] || {
    px: 25 * TILE_PX + 32,
    py: 42 * TILE_PX + 32,
  };
  const playerPosRef = useRef<{ px: number; py: number; facing: 'left' | 'right' }>({
    px: initialPos.px,
    py: initialPos.py,
    facing: 'right',
  });

  const isTransitioningRef = useRef<boolean>(false);
  const interactCooldownRef = useRef<number>(Math.max(Date.now() + 2000, globalPropCooldown));

  // Sprite image cache
  const spriteImageMap = useRef<Record<string, HTMLImageElement>>({});

  const loadSpriteImage = useCallback((url: string): HTMLImageElement => {
    if (spriteImageMap.current[url]) return spriteImageMap.current[url];
    const img = new Image();
    img.src = url;
    spriteImageMap.current[url] = img;
    return img;
  }, []);

  const getSpriteUrl = useCallback((pkm?: PokemonInstance) => {
    if (!pkm) return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';
    const dexNo = POKEMON_SPECIES[pkm.speciesId]?.pokedexNo || pkm.pokedexNo || 25;
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pkm.isShiny ? 'shiny/' : ''}${dexNo}.png`;
  }, []);

  // Preload lead sprite
  useEffect(() => {
    const leadUrl = getSpriteUrl(leadPokemon);
    loadSpriteImage(leadUrl);
  }, [leadPokemon, getSpriteUrl, loadSpriteImage]);

  // Ambient Weather Particles
  const weatherParticles = useRef<
    { x: number; y: number; s: number; vx: number; vy: number; alpha: number }[]
  >([]);

  useEffect(() => {
    const particles = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * 960,
        y: Math.random() * 960,
        s: Math.random() * 3 + 2,
        vx: (Math.random() - 0.5) * 0.8,
        vy: Math.random() * 0.8 + 0.5,
        alpha: Math.random() * 0.5 + 0.4,
      });
    }
    weatherParticles.current = particles;
  }, []);

  // Boss node resolution
  const isBossFloor = currentFloor % 3 === 0 || nodes.some((n) => n.type === 'boss');
  const bossNode = useMemo(() => {
    return (
      nodes.find((n) => n.type === 'boss') || {
        id: `boss_${currentFloor}`,
        floor: currentFloor,
        type: 'boss' as const,
        title: currentFloor === totalFloors ? '終極聖域 · 傳說之戰' : `第 ${currentFloor} 層守護者`,
        description: '迎戰駐守在地牢聖域的強大首領！',
        completed: false,
        accessible: true,
        trainer: generateTrainer(currentFloor, true, playerPartyLevel),
        connectedNextNodeIds: [],
      }
    );
  }, [currentFloor, nodes, playerPartyLevel, totalFloors]);

  // -------------------------------------------------------------
  // HD-2D DIORAMA MASTER MAP LAYOUT (Generated via dungeonGenerator.ts)
  // Automatically generates procedural layout from HD2D_DIORAMA_ASSET_PACK
  // -------------------------------------------------------------
  const dioramaMapLayout = useMemo(() => {
    return generateDioramaMapLayout(currentFloor, MAP_GRID_SIZE);
  }, [currentFloor]);

  const {
    tileGrid,
    boundaryTreeGrid,
    waterGrid,
    waterShoreGrid,
    bridgeTiles,
    fordTiles,
    dirtPathGrid,
    tallGrassGrid,
    obstacleGrid,
    cliffGrid,
    floorProps: generatedFloorProps,
  } = dioramaMapLayout;

  // Floor Props Generation (Placed safely on dirt path or clear plains, 0 water collision)
  const propsRef = useRef<FloorProp2D[]>([]);

  // Helper: Find a random valid walkable terrain tile for respawning functional props (30s)
  const getRandomValidPropTile = useCallback((): { x: number; y: number } => {
    const curPx = playerPosRef.current.px;
    const curPy = playerPosRef.current.py;
    const curTx = Math.floor(curPx / TILE_PX);
    const curTy = Math.floor(curPy / TILE_PX);

    const candidates: { x: number; y: number }[] = [];
    for (let r = 5; r <= 43; r++) {
      for (let c = 5; c <= 43; c++) {
        const key = `${c},${r}`;
        // Must not be in water, boundary trees, cliffs, or obstacles
        if (
          !boundaryTreeGrid.has(key) &&
          !waterGrid.has(key) &&
          !obstacleGrid.has(key) &&
          !cliffGrid.has(key)
        ) {
          // Distance from player at least 5 tiles away
          const distToPlayer = Math.hypot(c - curTx, r - curTy);
          // Do not overlap another active prop
          const overlapsProp = propsRef.current.some(
            (p) => !p.isUsed && p.tileX === c && p.tileY === r
          );
          if (distToPlayer >= 5 && !overlapsProp) {
            candidates.push({ x: c, y: r });
          }
        }
      }
    }
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return { x: 25, y: 30 };
  }, [boundaryTreeGrid, waterGrid, obstacleGrid, cliffGrid]);

  useEffect(() => {
    if (!floorPropsCache2D[currentFloor]) {
      floorPropsCache2D[currentFloor] = generatedFloorProps;
    }

    propsRef.current = floorPropsCache2D[currentFloor];

    // Maintain elapsed seconds and boss spawned status across battles
    if (floorElapsedSecondsCache2D[currentFloor] === undefined) {
      floorElapsedSecondsCache2D[currentFloor] = 0;
    }
    setElapsedSeconds(floorElapsedSecondsCache2D[currentFloor]);
    setBossSpawned(!!floorBossSpawnedCache2D[currentFloor]);
    setBossDefeated(false);
  }, [currentFloor]);

  // Roaming Enemies Setup & Post-Battle Relocation
  const roamingEnemiesRef = useRef<RoamingEnemy2D[]>([]);

  useEffect(() => {
    // 1. Initialize floor enemies in cache if not yet created
    if (!floorEnemiesCache2D[currentFloor]) {
      const spawnConfigs = [
        { id: 1, type: 'wild' as const, x: 18, y: 38, r: 75, s: 0.8 },
        { id: 2, type: 'wild' as const, x: 34, y: 38, r: 85, s: 0.8 },
        { id: 3, type: 'trainer' as const, x: 12, y: 26, r: 70, s: 0.9 },
        { id: 4, type: 'wild' as const, x: 38, y: 26, r: 65, s: 0.8 },
        { id: 5, type: 'trainer' as const, x: 14, y: 14, r: 75, s: 0.9 },
        { id: 6, type: 'wild' as const, x: 36, y: 14, r: 70, s: 0.85 },
        { id: 7, type: 'wild' as const, x: 42, y: 10, r: 80, s: 0.8 },
        { id: 8, type: 'trainer' as const, x: 8, y: 32, r: 75, s: 0.9 },
        { id: 9, type: 'wild' as const, x: 25, y: 22, r: 70, s: 0.85 },
        { id: 10, type: 'wild' as const, x: 42, y: 38, r: 65, s: 0.8 },
        { id: 11, type: 'trainer' as const, x: 8, y: 12, r: 60, s: 0.85 },
        { id: 12, type: 'wild' as const, x: 30, y: 32, r: 80, s: 0.8 },
        { id: 13, type: 'wild' as const, x: 22, y: 44, r: 70, s: 0.85 },
      ];

      const initialEnemies: RoamingEnemy2D[] = spawnConfigs.map((cfg) => {
        let pkm: PokemonInstance;
        let trainerInstance: Trainer | undefined;
        if (cfg.type === 'trainer') {
          trainerInstance = generateTrainer(currentFloor, false, playerPartyLevel);
          trainerInstance.team = trainerInstance.team.map((tp) => {
            const maxHp = tp.maxHp > 0 ? tp.maxHp : (tp.stats?.hp || 35);
            return {
              ...tp,
              maxHp,
              currentHp: maxHp,
              moves: (tp.moves || []).map((m) => {
                const maxPp = m.maxPp ?? m.pp ?? 20;
                return {
                  ...m,
                  maxPp,
                  currentPp: maxPp,
                };
              }),
            };
          });
          pkm = trainerInstance.team[0];
        } else {
          pkm = generateWildPokemon(currentFloor, playerPartyLevel);
          const maxHp = pkm.maxHp > 0 ? pkm.maxHp : (pkm.stats?.hp || 35);
          pkm.maxHp = maxHp;
          pkm.currentHp = maxHp;
          pkm.moves = (pkm.moves || []).map((m) => {
            const maxPp = m.maxPp ?? m.pp ?? 20;
            return {
              ...m,
              maxPp,
              currentPp: maxPp,
            };
          });
        }

        return {
          id: `e_${currentFloor}_${cfg.id}`,
          type: cfg.type,
          pkm,
          trainer: trainerInstance,
          x: cfg.x,
          y: cfg.y,
          px: cfg.x * TILE_PX + 32,
          py: cfg.y * TILE_PX + 32,
          basePx: cfg.x * TILE_PX + 32,
          basePy: cfg.y * TILE_PX + 32,
          patrolRadius: cfg.r,
          patrolAngle: Math.random() * Math.PI * 2,
          patrolSpeed: cfg.s,
          chaseSpeed: 2.2,
          aiState: 'patrol',
          alertTimer: 0,
          defeated: false,
        };
      });

      // On Boss floors, spawn the active moving BOSS from the start!
      if (isBossFloor) {
        const rawBossPkm = bossNode.wildPokemon || bossNode.trainer?.team[0] || generateWildPokemon(currentFloor, playerPartyLevel + 5);
        const bossMaxHp = rawBossPkm.maxHp > 0 ? rawBossPkm.maxHp : (rawBossPkm.stats?.hp || 60);
        const bossPkm: PokemonInstance = {
          ...rawBossPkm,
          maxHp: bossMaxHp,
          currentHp: bossMaxHp,
          moves: (rawBossPkm.moves || []).map((m) => {
            const maxPp = m.maxPp ?? m.pp ?? 20;
            return {
              ...m,
              maxPp,
              currentPp: maxPp,
            };
          }),
        };
        initialEnemies.push({
          id: `boss_active_${currentFloor}`,
          type: 'boss',
          pkm: bossPkm,
          trainer: bossNode.trainer,
          x: 25,
          y: 8,
          px: 25 * TILE_PX + 32,
          py: 8 * TILE_PX + 32,
          basePx: 25 * TILE_PX + 32,
          basePy: 8 * TILE_PX + 32,
          patrolRadius: 180,
          patrolAngle: 0,
          patrolSpeed: 0.7,
          chaseSpeed: 2.2,
          aiState: 'patrol',
          alertTimer: 0,
          defeated: false,
        });
        setBossSpawned(true);
      }

      floorEnemiesCache2D[currentFloor] = initialEnemies;
    }

    const enemies = floorEnemiesCache2D[currentFloor];

    // Helper: Find a random tall grass tile at least 320px away from the player
    const getFarTallGrassTile = (): { x: number; y: number } => {
      const curPx = playerPosRef.current.px;
      const curPy = playerPosRef.current.py;
      const candidates: { x: number; y: number }[] = [];
      tallGrassGrid.forEach((key) => {
        const [gx, gy] = key.split(',').map(Number);
        const dist = Math.hypot(gx * TILE_PX + 32 - curPx, gy * TILE_PX + 32 - curPy);
        if (dist >= 320) {
          candidates.push({ x: gx, y: gy });
        }
      });
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
      return { x: 31, y: 26 };
    };

    // 2. If returning from battle, dynamically relocate the fought enemy to a distant grass tile with a fresh Pokémon!
    if (globalLastEncounterEnemyId) {
      const foughtEnemy = enemies.find((e) => e.id === globalLastEncounterEnemyId);
      if (foughtEnemy) {
        if (foughtEnemy.type === 'boss') {
          const isBossDefeatedInNodes = nodes.some((n) => n.type === 'boss' && n.completed);
          if (isBossDefeatedInNodes) {
            foughtEnemy.defeated = true;
            setBossDefeated(true);
          } else {
            // Player fled: Reset Boss back to central north sanctum with cooldown
            foughtEnemy.px = 25 * TILE_PX + 32;
            foughtEnemy.py = 8 * TILE_PX + 32;
            foughtEnemy.basePx = foughtEnemy.px;
            foughtEnemy.basePy = foughtEnemy.py;
            foughtEnemy.aiState = 'cooldown';
            foughtEnemy.alertTimer = 180;
          }
        } else {
          // Wild or Trainer: Randomly assign to far-away tall grass with a brand new randomized Pokémon or Trainer!
          const farTile = getFarTallGrassTile();
          foughtEnemy.x = farTile.x;
          foughtEnemy.y = farTile.y;
          foughtEnemy.px = farTile.x * TILE_PX + 32;
          foughtEnemy.py = farTile.y * TILE_PX + 32;
          foughtEnemy.basePx = foughtEnemy.px;
          foughtEnemy.basePy = foughtEnemy.py;
          if (foughtEnemy.type === 'trainer') {
            const newTrainer = generateTrainer(currentFloor, false, playerPartyLevel);
            newTrainer.team = newTrainer.team.map((tp) => {
              const maxHp = tp.maxHp > 0 ? tp.maxHp : (tp.stats?.hp || 35);
              return {
                ...tp,
                maxHp,
                currentHp: maxHp,
                moves: (tp.moves || []).map((m) => ({
                  ...m,
                  maxPp: m.maxPp ?? m.pp ?? 20,
                  currentPp: m.maxPp ?? m.pp ?? 20,
                })),
              };
            });
            foughtEnemy.trainer = newTrainer;
            foughtEnemy.pkm = newTrainer.team[0];
          } else {
            const newWild = generateWildPokemon(currentFloor, playerPartyLevel);
            const maxHp = newWild.maxHp > 0 ? newWild.maxHp : (newWild.stats?.hp || 35);
            newWild.maxHp = maxHp;
            newWild.currentHp = maxHp;
            newWild.moves = (newWild.moves || []).map((m) => ({
              ...m,
              maxPp: m.maxPp ?? m.pp ?? 20,
              currentPp: m.maxPp ?? m.pp ?? 20,
            }));
            foughtEnemy.pkm = newWild;
          }
          foughtEnemy.aiState = 'patrol';
          foughtEnemy.patrolAngle = Math.random() * Math.PI * 2;
          foughtEnemy.defeated = false;
        }
      }

      // Safety check: Push away any other enemies currently too close (< 220px) to player
      const curPx = playerPosRef.current.px;
      const curPy = playerPosRef.current.py;
      enemies.forEach((e) => {
        if (!e.defeated && Math.hypot(e.px - curPx, e.py - curPy) < 220) {
          const farTile = getFarTallGrassTile();
          e.px = farTile.x * TILE_PX + 32;
          e.py = farTile.y * TILE_PX + 32;
          e.basePx = e.px;
          e.basePy = e.py;
          e.aiState = 'patrol';
        }
      });

      // Grant player 3.5s grace period to move freely without instant re-trigger
      const graceTime = Date.now() + 3500;
      interactCooldownRef.current = graceTime;
      globalPropCooldown = graceTime;
      targetClickPos.current = null;
      globalLastEncounterEnemyId = null;
    }

    roamingEnemiesRef.current = enemies;
  }, [currentFloor, isBossFloor, bossNode, playerPartyLevel, tallGrassGrid, nodes]);

  // Trigger Battle Callback (Directly maps the EXACT Pokémon to battle)
  const triggerBattle = useCallback(
    (enemy: RoamingEnemy2D) => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      // Play battle contact trigger sound
      sound.playBattleTriggerSound();

      // Screen Flash/Zoom Effect focused on contact point
      if (canvasRef.current) {
        canvasRef.current.style.transition = 'transform 0.12s ease-out, filter 0.12s ease-out';
        const normX = Math.max(10, Math.min(90, (enemy.px / (MAP_GRID_SIZE * TILE_PX)) * 100));
        const normY = Math.max(10, Math.min(90, (enemy.py / (MAP_GRID_SIZE * TILE_PX)) * 100));
        canvasRef.current.style.transformOrigin = `${normX}% ${normY}%`;
        canvasRef.current.style.transform = 'scale(1.15)';
        canvasRef.current.style.filter = 'brightness(1.3)';
      }

      // Track the encountered enemy for post-battle random relocation
      globalLastEncounterEnemyId = enemy.id;

      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current.style.transform = 'scale(1)';
          canvasRef.current.style.filter = 'none';
        }
        isTransitioningRef.current = false;

        // Guaranteed positive HP and fresh clone for combat
        const safePkm: PokemonInstance = {
          ...enemy.pkm,
          maxHp: enemy.pkm.maxHp > 0 ? enemy.pkm.maxHp : (enemy.pkm.stats?.hp || 35),
          currentHp: enemy.pkm.currentHp > 0 ? enemy.pkm.currentHp : (enemy.pkm.maxHp || 35),
          moves: (enemy.pkm.moves || []).map((m) => ({
            ...m,
            maxPp: m.maxPp ?? m.pp ?? 20,
            currentPp: m.currentPp !== undefined && m.currentPp > 0 ? m.currentPp : (m.maxPp ?? m.pp ?? 20),
          })),
        };

        let safeTrainer: Trainer | undefined = undefined;
        if (enemy.trainer) {
          safeTrainer = {
            ...enemy.trainer,
            team: enemy.trainer.team.map((tp) => {
              const maxHp = tp.maxHp > 0 ? tp.maxHp : (tp.stats?.hp || 35);
              return {
                ...tp,
                maxHp,
                currentHp: tp.currentHp > 0 ? tp.currentHp : maxHp,
                moves: (tp.moves || []).map((m) => ({
                  ...m,
                  maxPp: m.maxPp ?? m.pp ?? 20,
                  currentPp: m.currentPp !== undefined && m.currentPp > 0 ? m.currentPp : (m.maxPp ?? m.pp ?? 20),
                })),
              };
            }),
          };
        }

        const targetNode: DungeonNode = {
          id: `battle_${enemy.id}_${Date.now()}`,
          floor: currentFloor,
          type: enemy.type === 'boss' ? 'boss' : enemy.type === 'trainer' ? 'trainer' : 'battle',
          title:
            enemy.type === 'boss'
              ? `👑 聖域守護者 · ${safePkm.nameZh}`
              : safeTrainer
              ? safeTrainer.name
              : `野生 ${safePkm.nameZh}`,
          description:
            enemy.type === 'boss'
              ? '深入地牢聖域的強大守護者！'
              : safeTrainer
              ? '在地牢中相遇的精靈訓練家！'
              : '高草叢中跳出的野生寶可夢！',
          completed: false,
          accessible: true,
          wildPokemon: enemy.type === 'trainer' ? undefined : safePkm,
          trainer: safeTrainer,
          connectedNextNodeIds: [],
        };

        onTriggerBattle(targetNode, enemy.id);
      }, 150);
    },
    [currentFloor, onTriggerBattle]
  );

  // 3-Minute Boss Countdown & Dynamic Monster Spawner
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const nextSec = prev + 1;

        // Persist elapsed seconds across battles and modals
        floorElapsedSecondsCache2D[currentFloor] = nextSec;

        // Check functional objects (camp, shop, chest, stele) 30s randomized respawn
        const nowMs = Date.now();
        const FUNCTIONAL_PROP_TYPES = ['camp', 'shop', 'chest', 'stele', 'evolution_altar'];
        propsRef.current.forEach((prop) => {
          // Decorative non-functional props (house, sign) never respawn or reset
          if (!FUNCTIONAL_PROP_TYPES.includes(prop.type)) return;

          if (prop.isUsed && prop.respawnAt && nowMs >= prop.respawnAt) {
            const newPos = getRandomValidPropTile();
            prop.tileX = newPos.x;
            prop.tileY = newPos.y;
            prop.isUsed = false;
            prop.respawnAt = undefined;

            if (prop.type === 'chest') {
              setTimeout(() => setHasLootedChest(false), 0);
            }
            // Object reset notification popup cancelled per user directive
          }
        });

        // Periodic wild monster spawning every 30 seconds (up to 18 enemies)
        if (nextSec % 30 === 0 && roamingEnemiesRef.current.length < 18) {
          const spawnGrassTiles = [
            { x: 21, y: 39 },
            { x: 30, y: 39 },
            { x: 19, y: 24 },
            { x: 33, y: 28 },
          ];
          const chosenTile = spawnGrassTiles[Math.floor(Math.random() * spawnGrassTiles.length)];
          const newWildPkm = generateWildPokemon(currentFloor, playerPartyLevel);
          const maxHp = newWildPkm.maxHp > 0 ? newWildPkm.maxHp : (newWildPkm.stats?.hp || 35);
          newWildPkm.maxHp = maxHp;
          newWildPkm.currentHp = maxHp;
          newWildPkm.moves = (newWildPkm.moves || []).map((m) => ({
            ...m,
            maxPp: m.maxPp ?? m.pp ?? 20,
            currentPp: m.maxPp ?? m.pp ?? 20,
          }));

          const newEnemy: RoamingEnemy2D = {
            id: `spawn_${currentFloor}_${nextSec}`,
            type: 'wild',
            pkm: newWildPkm,
            x: chosenTile.x,
            y: chosenTile.y,
            px: chosenTile.x * TILE_PX + 32,
            py: chosenTile.y * TILE_PX + 32,
            basePx: chosenTile.x * TILE_PX + 32,
            basePy: chosenTile.y * TILE_PX + 32,
            patrolRadius: 65,
            patrolAngle: Math.random() * Math.PI * 2,
            patrolSpeed: 0.8,
            chaseSpeed: 2.2,
            aiState: 'patrol',
            alertTimer: 0,
            defeated: false,
          };
          roamingEnemiesRef.current.push(newEnemy);
          if (floorEnemiesCache2D[currentFloor]) {
            floorEnemiesCache2D[currentFloor].push(newEnemy);
          }
        }

        // 3-Minute Boss Summon at central sanctum (25, 8) if not already spawned
        if (nextSec >= BOSS_SPAWN_SECONDS && !bossSpawned && !isBossFloor) {
          setBossSpawned(true);
          floorBossSpawnedCache2D[currentFloor] = true;
          sound.playSelect();

          const bossPkm = bossNode.wildPokemon || bossNode.trainer?.team[0] || generateWildPokemon(currentFloor, playerPartyLevel + 15);
          bossPkm.level = playerPartyLevel + 15;
          const bossEnemy: RoamingEnemy2D = {
            id: `boss_active_${currentFloor}`,
            type: 'boss',
            pkm: bossPkm,
            trainer: bossNode.trainer,
            x: 25,
            y: 8,
            px: 25 * TILE_PX + 32,
            py: 8 * TILE_PX + 32,
            basePx: 25 * TILE_PX + 32,
            basePy: 8 * TILE_PX + 32,
            patrolRadius: 180,
            patrolAngle: 0,
            patrolSpeed: 0.7,
            chaseSpeed: 2.2,
            aiState: 'patrol',
            alertTimer: 0,
            defeated: false,
          };
          roamingEnemiesRef.current.push(bossEnemy);
          if (floorEnemiesCache2D[currentFloor]) {
            floorEnemiesCache2D[currentFloor].push(bossEnemy);
          }

          setToastMessage(`👑 BOSS【${bossPkm.nameZh} Lv.${bossPkm.level}】已降臨！`);
          setTimeout(() => setToastMessage(null), 2500);
        }

        return nextSec;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bossNode, bossSpawned, currentFloor, isBossFloor, playerPartyLevel, getRandomValidPropTile, setHasLootedChest]);

  // Touch & Mouse Joystick Helper
  const updateJoystickFromCoord = (clientX: number, clientY: number, target: HTMLElement) => {
    const baseRect = target.getBoundingClientRect();
    const centerX = baseRect.left + baseRect.width / 2;
    const centerY = baseRect.top + baseRect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxR = 40;
    const clampedR = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedR;
    const knobY = Math.sin(angle) * clampedR;

    setJoystickKnobPos({ x: knobX, y: knobY });
    joystickVector.current = { x: knobX / maxR, y: knobY / maxR };
    targetClickPos.current = null;
  };

  const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    sound.unlockAudio();
    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;
    setIsJoystickActive(true);
    updateJoystickFromCoord(touch.clientX, touch.clientY, e.currentTarget);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isJoystickActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        updateJoystickFromCoord(touch.clientX, touch.clientY, e.currentTarget);
        break;
      }
    }
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        setIsJoystickActive(false);
        joystickTouchId.current = null;
        setJoystickKnobPos({ x: 0, y: 0 });
        joystickVector.current = { x: 0, y: 0 };
        break;
      }
    }
  };

  const handleJoystickMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isMouseDraggingJoystick.current = true;
    setIsJoystickActive(true);
    updateJoystickFromCoord(e.clientX, e.clientY, e.currentTarget);
  };

  const handleJoystickMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDraggingJoystick.current) return;
    updateJoystickFromCoord(e.clientX, e.clientY, e.currentTarget);
  };

  const handleJoystickMouseUp = () => {
    isMouseDraggingJoystick.current = false;
    setIsJoystickActive(false);
    setJoystickKnobPos({ x: 0, y: 0 });
    joystickVector.current = { x: 0, y: 0 };
  };

  // Canvas Click-to-Move Handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const totalMapWidth = MAP_GRID_SIZE * TILE_PX;
    const totalMapHeight = MAP_GRID_SIZE * TILE_PX;
    const camX = Math.max(0, Math.min(totalMapWidth - canvas.width, playerPosRef.current.px - canvas.width / 2));
    const camY = Math.max(0, Math.min(totalMapHeight - canvas.height, playerPosRef.current.py - canvas.height / 2));

    targetClickPos.current = {
      px: Math.max(32, Math.min(totalMapWidth - 32, clickX + camX)),
      py: Math.max(32, Math.min(totalMapHeight - 32, clickY + camY)),
    };
  };

  // Keyboard Listeners
  useEffect(() => {
    keysPressed.current = {};
    targetClickPos.current = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysPressed.current[e.key.toLowerCase()] = true;
      targetClickPos.current = null;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // -------------------------------------------------------------
  // MAIN LAYERED 2D CANVAS ENGINE
  // Layer 1: Base Ground, Shorelines & Dirt Paths
  // Layer 2: Natural Water Bodies, Bridges & Clustered Tall Grass
  // Layer 3: Y-Sorted Trees, Boulders, Props, Characters & Canopies
  // Layer 4: Weather Atmosphere & HUD Overlays
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let animFrameId: number;
    let walkAnimFrame = 0;

    const render = () => {
      animFrameId = requestAnimationFrame(render);
      walkAnimFrame += 0.12;

      const viewW = canvas.width;
      const viewH = canvas.height;

      // 1. Calculate Player Movement Input
      let moveDx = 0;
      let moveDy = 0;

      if (keysPressed.current['w'] || keysPressed.current['arrowup']) moveDy -= 1;
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) moveDy += 1;
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) moveDx -= 1;
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) moveDx += 1;

      if (joystickVector.current.x !== 0 || joystickVector.current.y !== 0) {
        moveDx += joystickVector.current.x;
        moveDy += joystickVector.current.y;
      }

      // Click-to-move navigation
      if (moveDx === 0 && moveDy === 0 && targetClickPos.current) {
        const dx = targetClickPos.current.px - playerPosRef.current.px;
        const dy = targetClickPos.current.py - playerPosRef.current.py;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          moveDx = dx / dist;
          moveDy = dy / dist;
        } else {
          targetClickPos.current = null;
        }
      }

      const isShiftSprint = !!(keysPressed.current['shift'] || keysPressed.current[' ']);
      const activeSprint = isShiftSprint || isSprintingRef.current;
      const moveSpeed = activeSprint ? 5.8 : 3.8;

      if (moveDx !== 0 || moveDy !== 0) {
        const len = Math.hypot(moveDx, moveDy);
        const normX = (moveDx / len) * moveSpeed;
        const normY = (moveDy / len) * moveSpeed;

        if (normX < -0.2) playerPosRef.current.facing = 'right';
        if (normX > 0.2) playerPosRef.current.facing = 'left';

        const isBlockedTile = (tx: number, ty: number): boolean => {
          if (tx < 1 || tx >= MAP_GRID_SIZE - 1 || ty < 1 || ty >= MAP_GRID_SIZE - 1) return true;
          const k = `${tx},${ty}`;
          if (boundaryTreeGrid.has(k)) return true;
          if (waterGrid.has(k) && !bridgeTiles.has(k) && !fordTiles.has(k)) return true;
          if (obstacleGrid.has(k) || cliffGrid.has(k)) return true;
          return false;
        };

        // 2-Axis Smooth Sliding Collision Check (X Axis)
        const checkPxX = playerPosRef.current.px + normX;
        const testX = checkPxX + (normX > 0 ? 10 : -10);
        const nextTx = Math.floor(testX / TILE_PX);
        const curTyTop = Math.floor((playerPosRef.current.py - 6) / TILE_PX);
        const curTyBottom = Math.floor((playerPosRef.current.py + 8) / TILE_PX);

        if (!isBlockedTile(nextTx, curTyTop) && !isBlockedTile(nextTx, curTyBottom)) {
          playerPosRef.current.px = checkPxX;
        }

        // 2-Axis Smooth Sliding Collision Check (Y Axis)
        const checkPxY = playerPosRef.current.py + normY;
        const testY = checkPxY + (normY > 0 ? 10 : -10);
        const nextTy = Math.floor(testY / TILE_PX);
        const curTxLeft = Math.floor((playerPosRef.current.px - 8) / TILE_PX);
        const curTxRight = Math.floor((playerPosRef.current.px + 8) / TILE_PX);

        if (!isBlockedTile(curTxLeft, nextTy) && !isBlockedTile(curTxRight, nextTy)) {
          playerPosRef.current.py = checkPxY;
        }

        // Auto-Unstuck Watchdog: If player somehow ends up inside a blocked tile, nudge to nearest walkable tile
        const curCenterTx = Math.floor(playerPosRef.current.px / TILE_PX);
        const curCenterTy = Math.floor(playerPosRef.current.py / TILE_PX);
        if (isBlockedTile(curCenterTx, curCenterTy)) {
          let unstuck = false;
          for (let r = 1; r <= 3 && !unstuck; r++) {
            for (let dx = -r; dx <= r && !unstuck; dx++) {
              for (let dy = -r; dy <= r && !unstuck; dy++) {
                if (Math.abs(dx) === r || Math.abs(dy) === r) {
                  const safeTx = curCenterTx + dx;
                  const safeTy = curCenterTy + dy;
                  if (!isBlockedTile(safeTx, safeTy)) {
                    playerPosRef.current.px = safeTx * TILE_PX + 32;
                    playerPosRef.current.py = safeTy * TILE_PX + 32;
                    unstuck = true;
                  }
                }
              }
            }
          }
        }
      }

      const playerPx = playerPosRef.current.px;
      const playerPy = playerPosRef.current.py;
      floorPlayerPosCache2D[currentFloor] = { px: playerPx, py: playerPy };

      // Camera Centering on Player
      const totalMapWidth = MAP_GRID_SIZE * TILE_PX;
      const totalMapHeight = MAP_GRID_SIZE * TILE_PX;
      const camX = Math.max(0, Math.min(totalMapWidth - viewW, playerPx - viewW / 2));
      const camY = Math.max(0, Math.min(totalMapHeight - viewH, playerPy - viewH / 2));

      ctx.clearRect(0, 0, viewW, viewH);

      ctx.save();
      try {
        ctx.translate(-camX, -camY);

        const isIceTundra = fieldTerrain.id === 'ice_tundra';
        const isFireCave = fieldTerrain.id === 'fire_cave';

        const startCol = Math.max(0, Math.floor(camX / TILE_PX) - 1);
        const endCol = Math.min(MAP_GRID_SIZE - 1, Math.ceil((camX + viewW) / TILE_PX) + 1);
        const startRow = Math.max(0, Math.floor(camY / TILE_PX) - 1);
        const endRow = Math.min(MAP_GRID_SIZE - 1, Math.ceil((camY + viewH) / TILE_PX) + 1);

        const playerTx = Math.floor(playerPx / TILE_PX);
        const playerTy = Math.floor(playerPy / TILE_PX);

        // =========================================================
        // LAYER 1: BASE GROUND, SHORELINES & DIRT HIGHWAY TRAILS
        // =========================================================
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const tileKey = `${c},${r}`;
            const tileX = c * TILE_PX;
            const tileY = r * TILE_PX;

            // Subtle Depth Adjustment (Diorama Effect)
            const dist = Math.hypot(c - playerTx, r - playerTy);
            const depthScale = Math.max(0.92, 1 - Math.max(0, dist - 4) * 0.015);
            const depthDarkness = Math.min(0.45, Math.max(0, dist - 5) * 0.08);

            ctx.save();
            // Apply subtle scale-down from tile center
            ctx.translate(tileX + TILE_PX / 2, tileY + TILE_PX / 2);
            ctx.scale(depthScale, depthScale);
            ctx.translate(-(tileX + TILE_PX / 2), -(tileY + TILE_PX / 2));

            const isWater = waterGrid.has(tileKey);
            const isShore = waterShoreGrid.has(tileKey);
            const isPath = dirtPathGrid.has(tileKey);
            const isCliff = cliffGrid.has(tileKey);

            // 1. Base Terrain Surface (HD-2D Diorama Base with micro-relief bevels & physical texture)
            if (isIceTundra) {
              const checker = (c + r) % 2 === 0;
              ctx.fillStyle = checker ? '#edf5fb' : '#e3eef8';
              ctx.fillRect(tileX, tileY, TILE_PX, TILE_PX);

              // Diorama micro-bevel edge relief
              ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
              ctx.fillRect(tileX, tileY, TILE_PX, 1);
              ctx.fillRect(tileX, tileY, 1, TILE_PX);
              ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
              ctx.fillRect(tileX, tileY + TILE_PX - 1, TILE_PX, 1);
              ctx.fillRect(tileX + TILE_PX - 1, tileY, 1, TILE_PX);

              // Crystalline frost sparkles & snow dune drifts
              if ((c * 3 + r * 7) % 3 === 0) {
                ctx.fillStyle = '#d5e7f5';
                ctx.beginPath();
                ctx.ellipse(tileX + 32, tileY + 48, 22, 9, 0, 0, Math.PI * 2);
                ctx.fill();
                // Diamond ice glint
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(tileX + 28, tileY + 46, 2, 2);
              }
            } else if (isFireCave) {
              const checker = (c + r) % 2 === 0;
              ctx.fillStyle = checker ? '#1c1917' : '#292524';
              ctx.fillRect(tileX, tileY, TILE_PX, TILE_PX);

              // Stone slab bevel
              ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
              ctx.fillRect(tileX, tileY, TILE_PX, 1);
              ctx.fillRect(tileX, tileY, 1, TILE_PX);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
              ctx.fillRect(tileX, tileY + TILE_PX - 1, TILE_PX, 1);
              ctx.fillRect(tileX + TILE_PX - 1, tileY, 1, TILE_PX);

              // Glowing magma fissure with ambient heat
              if ((c * 5 + r * 7) % 4 === 0) {
                ctx.fillStyle = '#7f1d1d';
                ctx.fillRect(tileX + 10, tileY + 28, 22, 5);
                ctx.fillStyle = '#ea580c';
                ctx.fillRect(tileX + 12, tileY + 29, 18, 3);
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(tileX + 16, tileY + 30, 8, 1);
              }
            } else {
              // Vibrant HD-2D Diorama Grass (deep_grass #1e3d2f with bevelHighlight and noise_grass pattern)
              const deepGrass = HD2D_TILE_MAP['deep_grass']?.hd2dStyle;
              const grassBg = deepGrass?.backgroundColor || '#1e3d2f';
              const checker = (c + r) % 2 === 0;
              ctx.fillStyle = checker ? grassBg : '#173025';
              ctx.fillRect(tileX, tileY, TILE_PX, TILE_PX);

              // Diorama tile micro-relief bevel (hd2dStyle.bevelHighlight)
              ctx.fillStyle = deepGrass?.bevelHighlight || 'rgba(255, 255, 255, 0.15)';
              ctx.fillRect(tileX, tileY, TILE_PX, 1);
              ctx.fillRect(tileX, tileY, 1, TILE_PX);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
              ctx.fillRect(tileX, tileY + TILE_PX - 1, TILE_PX, 1);
              ctx.fillRect(tileX + TILE_PX - 1, tileY, 1, TILE_PX);

              // noise_grass texture pattern specks & blades
              ctx.fillStyle = '#2d5a45';
              ctx.fillRect(tileX + 8, tileY + 12, 2, 4);
              ctx.fillRect(tileX + 10, tileY + 14, 3, 2);
              ctx.fillRect(tileX + 38, tileY + 36, 2, 4);
              ctx.fillRect(tileX + 40, tileY + 38, 3, 2);
              ctx.fillStyle = '#0f2018';
              ctx.fillRect(tileX + 8, tileY + 16, 2, 1);
              ctx.fillRect(tileX + 38, tileY + 40, 2, 1);

              // Colorful Wildflowers (Pink, yellow, lavender) with petal depth
              if ((c * 13 + r * 11) % 4 === 0) {
                const fx = tileX + 22;
                const fy = tileY + 40;
                // Petals
                ctx.fillStyle = '#f43f5e';
                ctx.beginPath();
                ctx.arc(fx + 2, fy + 2, 3.5, 0, Math.PI * 2);
                ctx.fill();
                // Stamen core
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(fx + 1, fy + 1, 2, 2);
              }
              if ((c * 17 + r * 7) % 5 === 0) {
                const fx2 = tileX + 48;
                const fy2 = tileY + 20;
                ctx.fillStyle = '#facc15';
                ctx.beginPath();
                ctx.arc(fx2 + 2, fy2 + 2, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ea580c';
                ctx.fillRect(fx2 + 1, fy2 + 1, 2, 2);
              }
            }

            // 2. Sandy Lake Shore / Coastline Transition (Natural curving bank with granular texture)
            if (isShore && !isWater && !isPath) {
              const sandBorder = isIceTundra ? '#bce0f8' : isFireCave ? '#44403c' : '#ca8a04';
              const sandBody = isIceTundra ? '#dcf0fd' : isFireCave ? '#292524' : '#fef08a';

              // Sandy shore fringe towards water
              ctx.fillStyle = sandBorder;
              ctx.fillRect(tileX + 2, tileY + 2, TILE_PX - 4, TILE_PX - 4);
              ctx.fillStyle = sandBody;
              ctx.fillRect(tileX + 5, tileY + 5, TILE_PX - 10, TILE_PX - 10);

              // Wet sand edge shadow
              ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
              ctx.fillRect(tileX + 5, tileY + TILE_PX - 8, TILE_PX - 10, 3);

              // Shore smooth rounded pebbles
              ctx.fillStyle = '#78350f';
              ctx.beginPath();
              ctx.ellipse(tileX + 14, tileY + 47, 3, 2, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.ellipse(tileX + 46, tileY + 17, 2.5, 1.8, 0, 0, Math.PI * 2);
              ctx.fill();
            }

            // 3. Dirt Highway & Trails (cobblestone_path #3a3b45 & groutColor #1a1b22)
            if (isPath && !isWater) {
              const pathStyle = HD2D_TILE_MAP['cobblestone_path']?.hd2dStyle;
              const stoneBg = pathStyle?.backgroundColor || '#3a3b45';
              const groutCol = pathStyle?.groutColor || '#1a1b22';

              const pathBorder = isIceTundra ? '#4b8ebc' : isFireCave ? '#292524' : groutCol;
              const pathFill = isIceTundra ? '#cce3f5' : isFireCave ? '#44403c' : stoneBg;
              const stoneBase = isIceTundra ? '#93c5fd' : isFireCave ? '#57534e' : '#454754';
              const stoneHighlight = isIceTundra ? '#ffffff' : isFireCave ? '#a8a29e' : '#6b6e82';

              // Base stone highway bed
              ctx.fillStyle = pathBorder;
              ctx.fillRect(tileX + 2, tileY + 2, TILE_PX - 4, TILE_PX - 4);
              ctx.fillStyle = pathFill;
              ctx.fillRect(tileX + 4, tileY + 4, TILE_PX - 8, TILE_PX - 8);

              // HD-2D Individual Rounded Cobblestone Pavers with grout crevices
              const pavers = [
                { x: 6, y: 6, w: 23, h: 23 },
                { x: 33, y: 6, w: 25, h: 23 },
                { x: 6, y: 33, w: 25, h: 25 },
                { x: 35, y: 33, w: 23, h: 25 },
              ];

              pavers.forEach((st) => {
                const sx = tileX + st.x;
                const sy = tileY + st.y;
                // Deep grout crevice shadow
                ctx.fillStyle = groutCol;
                ctx.fillRect(sx, sy, st.w, st.h);
                // Stone body
                ctx.fillStyle = stoneBase;
                ctx.fillRect(sx + 1, sy + 1, st.w - 2, st.h - 2);
                // Top stone bevel highlight
                ctx.fillStyle = stoneHighlight;
                ctx.fillRect(sx + 2, sy + 2, st.w - 4, 3);
                // Bottom stone shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(sx + 2, sy + st.h - 4, st.w - 4, 2);
              });

              // Micro pebble scatter along path edges
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(tileX + 30, tileY + 18, 2, 2);
              ctx.fillRect(tileX + 18, tileY + 30, 2, 2);
            }

            // 4. Elevation Cliff Formations (Stratified Rock with Overhanging Turf)
            if (isCliff) {
              // Deep shadow face
              ctx.fillStyle = isIceTundra ? '#2c608e' : isFireCave ? '#0c0a09' : '#451a03';
              ctx.fillRect(tileX, tileY + 12, TILE_PX, TILE_PX - 12);
              // Midtone rock cliff body
              ctx.fillStyle = isIceTundra ? '#6fa8d5' : isFireCave ? '#292524' : '#78350f';
              ctx.fillRect(tileX + 2, tileY + 15, TILE_PX - 4, TILE_PX - 18);
              // Rock fissures
              ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
              ctx.fillRect(tileX + 18, tileY + 22, 2, 16);
              ctx.fillRect(tileX + 42, tileY + 28, 2, 14);
              // Overhanging turf plateau top
              ctx.fillStyle = isIceTundra ? '#ffffff' : isFireCave ? '#44403c' : '#15803d';
              ctx.fillRect(tileX, tileY, TILE_PX, 14);
              // Turf rim highlight
              ctx.fillStyle = isIceTundra ? '#dbeafe' : isFireCave ? '#78716c' : '#4ade80';
              ctx.fillRect(tileX, tileY + 12, TILE_PX, 2);
            }

            // Finalize Depth Darkness (Layer 1)
            if (depthDarkness > 0) {
              ctx.fillStyle = `rgba(0, 10, 20, ${depthDarkness})`;
              ctx.fillRect(tileX, tileY, TILE_PX, TILE_PX);
            }
            ctx.restore();
          }
        }

        // =========================================================
        // LAYER 2: NATURAL WATER BODIES, BRIDGES & TALL GRASS
        // =========================================================
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const tileKey = `${c},${r}`;
            const tileX = c * TILE_PX;
            const tileY = r * TILE_PX;

            // Subtle Depth Adjustment (Layer 2)
            const dist = Math.hypot(c - playerTx, r - playerTy);
            const depthScale = Math.max(0.92, 1 - Math.max(0, dist - 4) * 0.015);
            const depthDarkness = Math.min(0.45, Math.max(0, dist - 5) * 0.08);

            ctx.save();
            ctx.translate(tileX + TILE_PX / 2, tileY + TILE_PX / 2);
            ctx.scale(depthScale, depthScale);
            ctx.translate(-(tileX + TILE_PX / 2), -(tileY + TILE_PX / 2));

            const isWater = waterGrid.has(tileKey);
            const isBridge = bridgeTiles.has(tileKey);
            const isFord = fordTiles.has(tileKey);
            const isGrass = tallGrassGrid.has(tileKey);

            // 1. Natural Organic Water Body (Crystal Azure Gradient + Waves + Foam)
            if (isWater) {
              if (isFireCave) {
                // Molten Lava
                ctx.fillStyle = '#7f1d1d';
                ctx.fillRect(tileX, tileY, TILE_PX, TILE_PX);
                const lavaWave = Math.sin(walkAnimFrame * 1.8 + c * 0.6 + r * 0.8) * 6;
                ctx.fillStyle = '#ea580c';
                ctx.fillRect(tileX + 2, tileY + 8 + lavaWave, TILE_PX - 4, 18);
              } else {
                // Organic Lake Deep Water Gradient
                const waterGrad = ctx.createLinearGradient(tileX, tileY, tileX, tileY + TILE_PX);
                waterGrad.addColorStop(0, '#0284c7');
                waterGrad.addColorStop(1, '#0369a1');
                ctx.fillStyle = waterGrad;
                ctx.fillRect(tileX, tileY, TILE_PX, TILE_PX);

                // Animated gentle wave ripples
                const waveOffset = Math.sin(walkAnimFrame * 1.6 + c * 0.7 + r * 0.9) * 5;
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(tileX + 4, tileY + 14 + waveOffset, TILE_PX - 8, 5);
                ctx.fillRect(tileX + 8, tileY + 38 - waveOffset, TILE_PX - 16, 4);

                // Soft white foam crests along shoreline
                ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
                ctx.beginPath();
                for (let wx = 0; wx < TILE_PX; wx += 16) {
                  ctx.arc(tileX + wx + 8, tileY + 6 + waveOffset, 4, 0, Math.PI);
                }
                ctx.fill();

                // Floating green water lily pads
                if ((c * 7 + r * 13) % 5 === 0) {
                  ctx.fillStyle = '#15803d';
                  ctx.beginPath();
                  ctx.arc(tileX + 24, tileY + 24, 7, 0, Math.PI * 1.7);
                  ctx.fill();
                  ctx.fillStyle = '#f43f5e';
                  ctx.beginPath();
                  ctx.arc(tileX + 24, tileY + 22, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }

            // 2. Wooden Bridge Crossing over Lake
            if (isBridge) {
              // Planks
              ctx.fillStyle = '#451a03';
              ctx.fillRect(tileX, tileY + 4, TILE_PX, TILE_PX - 8);
              ctx.fillStyle = '#92400e';
              ctx.fillRect(tileX + 2, tileY + 8, TILE_PX - 4, TILE_PX - 16);

              // Plank dividers
              ctx.fillStyle = '#291202';
              ctx.fillRect(tileX, tileY + 16, TILE_PX, 3);
              ctx.fillRect(tileX, tileY + 30, TILE_PX, 3);
              ctx.fillRect(tileX, tileY + 44, TILE_PX, 3);

              // Railings & Golden Posts
              ctx.fillStyle = '#78350f';
              ctx.fillRect(tileX, tileY + 2, TILE_PX, 5);
              ctx.fillRect(tileX, tileY + TILE_PX - 7, TILE_PX, 5);
              ctx.fillStyle = '#fde047';
              ctx.fillRect(tileX + 4, tileY + 2, 6, 6);
              ctx.fillRect(tileX + TILE_PX - 10, tileY + 2, 6, 6);
            }

            // 3. Stepping Stone Crossings
            if (isFord && isWater) {
              ctx.fillStyle = '#1e3a5f';
              ctx.beginPath();
              ctx.arc(tileX + 32, tileY + 34, 18, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#64748b';
              ctx.beginPath();
              ctx.arc(tileX + 30, tileY + 30, 15, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(tileX + 26, tileY + 26, 5, 0, Math.PI * 2);
              ctx.fill();
            }

            // 4. Clustered Pokémon Tall Grass (高草叢成群佈置, 玩家遇怪專用區域)
            if (isGrass) {
              const sway = Math.sin(walkAnimFrame * 2 + c * 0.8 + r * 0.6) * 2;

              // Render multiple dense grass tufts per tile
              const tufts = [
                { x: 12, y: 16 },
                { x: 38, y: 14 },
                { x: 24, y: 32 },
                { x: 10, y: 46 },
                { x: 42, y: 44 },
              ];

              tufts.forEach((t) => {
                const gx = tileX + t.x;
                const gy = tileY + t.y;

                // Base Shadow
                ctx.fillStyle = '#0f401b';
                ctx.beginPath();
                ctx.ellipse(gx, gy + 8, 12, 5, 0, 0, Math.PI * 2);
                ctx.fill();

                // Blade 1 (Left)
                ctx.fillStyle = '#15803d';
                ctx.beginPath();
                ctx.moveTo(gx - 8, gy + 8);
                ctx.lineTo(gx - 4 + sway, gy - 12);
                ctx.lineTo(gx - 1, gy + 8);
                ctx.closePath();
                ctx.fill();

                // Blade 2 (Center)
                ctx.fillStyle = '#16a34a';
                ctx.beginPath();
                ctx.moveTo(gx - 4, gy + 8);
                ctx.lineTo(gx + sway * 1.2, gy - 16);
                ctx.lineTo(gx + 4, gy + 8);
                ctx.closePath();
                ctx.fill();

                // Blade 3 (Right)
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.moveTo(gx + 1, gy + 8);
                ctx.lineTo(gx + 6 + sway, gy - 10);
                ctx.lineTo(gx + 9, gy + 8);
                ctx.closePath();
                ctx.fill();

                // Bright Highlight Tips
                ctx.fillStyle = '#86efac';
                ctx.fillRect(gx + sway * 1.2 - 1, gy - 16, 2, 4);
                ctx.fillRect(gx - 4 + sway - 1, gy - 12, 2, 3);
                ctx.fillRect(gx + 6 + sway - 1, gy - 10, 2, 3);
              });
            }

            // Finalize Depth Darkness
            if (depthDarkness > 0) {
              ctx.fillStyle = `rgba(0, 10, 20, ${depthDarkness})`;
              ctx.fillRect(tileX, tileY, TILE_PX, TILE_PX);
            }
            ctx.restore();
          }
        }

        // =========================================================
        // LAYER 3: Y-SORTED OBSTACLES, PROPS, CHARACTERS & TREES
        // Strict depth-sorting so trees, rocks, characters, and props
        // naturally layer with proper perspective (never glitched stacking!)
        // =========================================================
        interface RenderableEntity {
          renderY: number;
          draw: () => void;
        }
        const entityQueue: RenderableEntity[] = [];

        // 1. Dense Boundary Trees & Standalone Oak Trees
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const tileKey = `${c},${r}`;
            const tileX = c * TILE_PX;
            const tileY = r * TILE_PX;

            if (boundaryTreeGrid.has(tileKey)) {
              entityQueue.push({
                renderY: tileY + 48,
                draw: () => {
                  const tx = tileX + 32;
                  const ty = tileY + 38;

                  // HD-2D Tree Base Radial Drop Shadow
                  const treeShadow = ctx.createRadialGradient(tx, ty + 18, 0, tx, ty + 18, 28);
                  treeShadow.addColorStop(0, 'rgba(15, 23, 42, 0.6)');
                  treeShadow.addColorStop(0.55, 'rgba(15, 23, 42, 0.25)');
                  treeShadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
                  ctx.fillStyle = treeShadow;
                  ctx.beginPath();
                  ctx.ellipse(tx, ty + 18, 28, 13, 0, 0, Math.PI * 2);
                  ctx.fill();

                  // Occlusion Detection: forest_canopy_obstacle (hd2dStyle.opacityWhenCovered: 0.38)
                  const canopyTile = HD2D_TILE_MAP['forest_canopy_obstacle']?.hd2dStyle;
                  const canopyCoverAlpha = canopyTile?.opacityWhenCovered ?? 0.38;
                  const canopyBaseBg = canopyTile?.backgroundColor || '#14281d';

                  const isPlayerBehindTree = Math.abs(playerPx - tx) < 32 && playerPy < ty + 10 && playerPy > ty - 42;
                  ctx.save();
                  if (isPlayerBehindTree) {
                    ctx.globalAlpha = canopyCoverAlpha;
                  }

                  if (isIceTundra) {
                    // Frosted Pine
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(tx - 5, ty + 2, 10, 16);
                    ctx.fillStyle = '#334155';
                    ctx.beginPath();
                    ctx.moveTo(tx, ty - 26);
                    ctx.lineTo(tx + 22, ty + 6);
                    ctx.lineTo(tx - 22, ty + 6);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.moveTo(tx, ty - 26);
                    ctx.lineTo(tx + 10, ty - 12);
                    ctx.lineTo(tx - 10, ty - 12);
                    ctx.closePath();
                    ctx.fill();
                  } else {
                    // Pokémon Classic Oak Tree Canopy
                    // Trunk
                    ctx.fillStyle = '#451a03';
                    ctx.fillRect(tx - 6, ty - 4, 12, 22);
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(tx - 4, ty - 2, 8, 18);

                    // 3 Overlapping Canopy Domes (hd2dStyle.backgroundColor #14281d)
                    ctx.fillStyle = canopyBaseBg; // Shadow crown (#14281d)
                    ctx.beginPath();
                    ctx.arc(tx, ty - 16, 26, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#1e3d2f'; // Midtone foliage
                    ctx.beginPath();
                    ctx.arc(tx - 4, ty - 20, 20, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#2e5b44'; // Highlight dome
                    ctx.beginPath();
                    ctx.arc(tx - 8, ty - 24, 11, 0, Math.PI * 2);
                    ctx.fill();
                  }
                  ctx.restore();
                },
              });
            }

            // 2. Boulders & Smashable Rocks (strictly on land, never in water)
            if (obstacleGrid.has(tileKey)) {
              entityQueue.push({
                renderY: tileY + 42,
                draw: () => {
                  const bx = tileX + 32;
                  const by = tileY + 36;

                  // HD-2D Ground Contact Shadow
                  const rockShadow = ctx.createRadialGradient(bx, by + 16, 0, bx, by + 16, 24);
                  rockShadow.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
                  rockShadow.addColorStop(0.55, 'rgba(15, 23, 42, 0.22)');
                  rockShadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
                  ctx.fillStyle = rockShadow;
                  ctx.beginPath();
                  ctx.ellipse(bx, by + 16, 24, 11, 0, 0, Math.PI * 2);
                  ctx.fill();

                  // Occlusion Detection: stone_pillar_obstacle (hd2dStyle.opacityWhenCovered: 0.40)
                  const pillarStyle = HD2D_TILE_MAP['stone_pillar_obstacle']?.hd2dStyle;
                  const pillarCoverAlpha = pillarStyle?.opacityWhenCovered ?? 0.40;
                  const pillarBg = pillarStyle?.backgroundColor || '#2c2d38';

                  const isPlayerBehindRock = Math.abs(playerPx - bx) < 28 && playerPy < by + 8 && playerPy > by - 32;
                  ctx.save();
                  if (isPlayerBehindRock) {
                    ctx.globalAlpha = pillarCoverAlpha;
                  }

                  // 3D Faceted Boulder (stone_pillar_obstacle #2c2d38)
                  ctx.fillStyle = pillarBg; // Dark outline
                  ctx.beginPath();
                  ctx.moveTo(bx, by - 24);
                  ctx.lineTo(bx + 22, by + 12);
                  ctx.lineTo(bx - 22, by + 12);
                  ctx.closePath();
                  ctx.fill();

                  ctx.fillStyle = '#6b7280'; // Left lit facet
                  ctx.beginPath();
                  ctx.moveTo(bx, by - 22);
                  ctx.lineTo(bx, by + 10);
                  ctx.lineTo(bx - 20, by + 10);
                  ctx.closePath();
                  ctx.fill();

                  ctx.fillStyle = '#374151'; // Right shadow facet
                  ctx.beginPath();
                  ctx.moveTo(bx, by - 22);
                  ctx.lineTo(bx + 20, by + 10);
                  ctx.lineTo(bx, by + 10);
                  ctx.closePath();
                  ctx.fill();

                  // Rock Highlight Crack
                  ctx.strokeStyle = '#d1d5db';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.moveTo(bx - 6, by - 4);
                  ctx.lineTo(bx - 2, by + 2);
                  ctx.lineTo(bx + 4, by);
                  ctx.stroke();
                  ctx.restore();
                },
              });
            }
          }
        }

        // 3. Interactive Props
        propsRef.current.forEach((prop) => {
          const px = prop.tileX * TILE_PX;
          const py = prop.tileY * TILE_PX;
          const cx = px + 32;
          const cy = py + 32;

          entityQueue.push({
            renderY: py + 36,
            draw: () => {
              ctx.save();
              const isUsedProp = !!prop.isUsed;
              const remainingSec = prop.respawnAt ? Math.max(1, Math.ceil((prop.respawnAt - Date.now()) / 1000)) : 30;

              // Occlusion Detection: when player is behind tall props (house, shop, stele, altar), make it translucent!
              let isPlayerBehindProp = false;
              if (prop.type === 'house') {
                isPlayerBehindProp = playerPx >= px && playerPx <= px + 64 && playerPy < py + 48 && playerPy > py - 18;
              } else if (prop.type === 'shop') {
                isPlayerBehindProp = playerPx >= px && playerPx <= px + 64 && playerPy < py + 40 && playerPy > py - 14;
              } else if (prop.type === 'stele') {
                isPlayerBehindProp = Math.abs(playerPx - cx) < 26 && playerPy < cy + 18 && playerPy > cy - 34;
              } else if (prop.type === 'evolution_altar') {
                isPlayerBehindProp = Math.abs(playerPx - cx) < 28 && playerPy < cy + 16 && playerPy > cy - 34;
              } else if (prop.type === 'camp') {
                isPlayerBehindProp = Math.abs(playerPx - cx) < 24 && playerPy < cy + 14 && playerPy > cy - 26;
              }

              if (isUsedProp) {
                ctx.globalAlpha = 0.38;
              } else if (isPlayerBehindProp) {
                ctx.globalAlpha = prop.type === 'house'
                  ? (HD2D_TILE_MAP['wooden_house_front']?.hd2dStyle?.opacityWhenCovered ?? 0.35)
                  : 0.38;
              }

              // HD-2D Ground Contact Shadow (Soft Radial Falloff)
              const shadowRadius = prop.type === 'shop' || prop.type === 'house' ? 32 : 24;
              const propShadow = ctx.createRadialGradient(cx, cy + 20, 0, cx, cy + 20, shadowRadius);
              propShadow.addColorStop(0, 'rgba(10, 15, 30, 0.65)');
              propShadow.addColorStop(0.55, 'rgba(10, 15, 30, 0.25)');
              propShadow.addColorStop(1, 'rgba(10, 15, 30, 0)');
              ctx.fillStyle = propShadow;
              ctx.beginPath();
              ctx.ellipse(cx, cy + 20, shadowRadius, 11, 0, 0, Math.PI * 2);
              ctx.fill();

              if (prop.type === 'camp') {
                // camp_fire (hd2d_diorama_tileset id 4: glowColor rgba(255, 140, 40, 0.8), bloomRadius 88px)
                const campTile = HD2D_TILE_MAP['camp_fire']?.hd2dStyle;
                const campGlow = campTile?.glowColor || 'rgba(255, 140, 40, 0.8)';
                const campRadius = typeof campTile?.bloomRadius === 'number' ? campTile.bloomRadius : parseInt(String(campTile?.bloomRadius || 88), 10);
                const glowR = campRadius + Math.sin(walkAnimFrame * 3) * 8;

                const grad = ctx.createRadialGradient(cx, cy + 8, 4, cx, cy + 8, glowR);
                grad.addColorStop(0, campGlow);
                grad.addColorStop(0.35, 'rgba(249, 115, 22, 0.45)');
                grad.addColorStop(0.7, 'rgba(234, 88, 12, 0.15)');
                grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy + 8, glowR, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.arc(cx, cy + 12, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.arc(cx, cy + 12, 13, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#78350f';
                ctx.fillRect(cx - 14, cy + 9, 28, 6);

                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(cx, cy + 6, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.arc(cx, cy, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fef08a';
                ctx.beginPath();
                ctx.arc(cx, cy - 4, 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fed7aa';
                ctx.font = 'bold 12px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('🔥 營火庇護所', cx, py - 6);
              } else if (prop.type === 'shop') {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(px + 6, py + 22, 52, 26);
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(px + 8, py + 24, 48, 4);

                const stripes = ['#ef4444', '#ffffff', '#ef4444', '#ffffff', '#ef4444', '#ffffff'];
                stripes.forEach((color, idx) => {
                  ctx.fillStyle = color;
                  ctx.fillRect(px + 4 + idx * 9, py + 6, 9, 18);
                });

                ctx.fillStyle = '#fde047';
                ctx.fillRect(px + 20, py + 18, 24, 8);
                ctx.fillStyle = '#78350f';
                ctx.font = 'bold 9px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('MART', cx, py + 25);

                ctx.fillStyle = '#fde047';
                ctx.font = 'bold 12px system-ui';
                ctx.fillText('🛒 友誼商店', cx, py - 6);
              } else if (prop.type === 'chest') {
                if (hasLootedChest || isUsedProp) {
                  ctx.fillStyle = '#475569';
                  ctx.fillRect(px + 12, py + 20, 40, 26);
                  ctx.fillStyle = '#1e293b';
                  ctx.fillRect(px + 16, py + 24, 32, 10);
                  ctx.fillStyle = '#94a3b8';
                  ctx.font = 'bold 11px system-ui';
                  ctx.textAlign = 'center';
                  ctx.fillText('(已開啟)', cx, py + 12);
                } else {
                  // HD-2D Golden Chest Glow
                  const chestGlow = ctx.createRadialGradient(cx, cy + 10, 2, cx, cy + 10, 32);
                  chestGlow.addColorStop(0, 'rgba(250, 204, 21, 0.45)');
                  chestGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
                  ctx.fillStyle = chestGlow;
                  ctx.beginPath();
                  ctx.arc(cx, cy + 10, 32, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.fillStyle = '#b45309';
                  ctx.fillRect(px + 12, py + 18, 40, 28);
                  ctx.fillStyle = '#f59e0b';
                  ctx.fillRect(px + 12, py + 14, 40, 10);
                  ctx.fillStyle = '#fef08a';
                  ctx.fillRect(px + 28, py + 22, 8, 10);

                  ctx.fillStyle = '#fef08a';
                  ctx.font = 'bold 12px system-ui';
                  ctx.textAlign = 'center';
                  ctx.fillText('✨ 遠古寶箱', cx, py - 4);
                }
              } else if (prop.type === 'stele') {
                // Mystical Violet Ground Bloom
                const steleGlow = ctx.createRadialGradient(cx, cy + 20, 2, cx, cy + 20, 52);
                steleGlow.addColorStop(0, 'rgba(192, 132, 252, 0.55)');
                steleGlow.addColorStop(0.6, 'rgba(168, 85, 247, 0.2)');
                steleGlow.addColorStop(1, 'rgba(168, 85, 247, 0)');
                ctx.fillStyle = steleGlow;
                ctx.beginPath();
                ctx.arc(cx, cy + 20, 52, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#334155';
                ctx.fillRect(px + 20, py + 10, 24, 40);
                ctx.fillStyle = '#c084fc';
                ctx.fillRect(px + 26, py + 16, 12, 4);
                ctx.fillRect(px + 30, py + 24, 4, 12);
                ctx.fillRect(px + 26, py + 38, 12, 4);

                ctx.fillStyle = '#e9d5ff';
                ctx.font = 'bold 12px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('🔮 神秘祭壇', cx, py - 4);
              } else if (prop.type === 'evolution_altar') {
                // Altar Pedestal Base
                ctx.fillStyle = '#1e1b4b';
                ctx.fillRect(px + 14, py + 22, 36, 26);
                ctx.fillStyle = '#312e81';
                ctx.fillRect(px + 10, py + 18, 44, 8);
                ctx.fillStyle = '#a855f7';
                ctx.fillRect(px + 12, py + 20, 40, 3);

                // sacred_altar (hd2d_diorama_tileset id 3: glowColor rgba(180, 100, 255, 0.7), bloomRadius 64px)
                const altarTile = HD2D_TILE_MAP['sacred_altar']?.hd2dStyle;
                const altarGlow = altarTile?.glowColor || 'rgba(180, 100, 255, 0.7)';
                const altarRadius = typeof altarTile?.bloomRadius === 'number' ? altarTile.bloomRadius : parseInt(String(altarTile?.bloomRadius || 64), 10);

                const floatY = Math.sin(walkAnimFrame * 2) * 5;
                const glowR = altarRadius + Math.sin(walkAnimFrame * 3) * 6;
                const grad = ctx.createRadialGradient(cx, cy - 6 + floatY, 4, cx, cy - 6 + floatY, glowR);
                grad.addColorStop(0, altarGlow);
                grad.addColorStop(0.4, 'rgba(168, 85, 247, 0.45)');
                grad.addColorStop(0.8, 'rgba(147, 51, 234, 0.15)');
                grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy - 6 + floatY, glowR, 0, Math.PI * 2);
                ctx.fill();

                // Diamond Crystal
                ctx.fillStyle = '#f3e8ff';
                ctx.beginPath();
                ctx.moveTo(cx, cy - 18 + floatY);
                ctx.lineTo(cx + 10, cy - 6 + floatY);
                ctx.lineTo(cx, cy + 6 + floatY);
                ctx.lineTo(cx - 10, cy - 6 + floatY);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#c084fc';
                ctx.font = 'bold 12px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('✨ 進化祭壇', cx, py - 6);
              } else if (prop.type === 'house') {
                // wooden_house_front (hd2d_diorama_master_tileset id 6: backgroundColor #422814)
                const houseStyle = HD2D_TILE_MAP['wooden_house_front']?.hd2dStyle;
                const houseBg = houseStyle?.backgroundColor || '#422814';

                ctx.fillStyle = houseBg;
                ctx.fillRect(px + 10, py + 24, 44, 28);
                ctx.fillStyle = '#b45309';
                ctx.beginPath();
                ctx.moveTo(cx, py + 6);
                ctx.lineTo(px + 58, py + 26);
                ctx.lineTo(px + 6, py + 26);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(px + 18, py + 32, 10, 10);
                ctx.fillStyle = '#1e1108';
                ctx.fillRect(px + 34, py + 34, 12, 18);
              } else if (prop.type === 'sign') {
                // stone_signpost (hd2d_diorama_master_tileset id 7: backgroundColor #333538)
                const signStyle = HD2D_TILE_MAP['stone_signpost']?.hd2dStyle;
                const signBg = signStyle?.backgroundColor || '#333538';

                ctx.fillStyle = signBg;
                ctx.fillRect(cx - 3, py + 20, 6, 26);
                ctx.fillStyle = '#475569';
                ctx.fillRect(px + 12, py + 14, 40, 16);
                ctx.fillStyle = '#fef3c7';
                ctx.font = 'bold 9px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText('指示路標', cx, py + 26);
              }

              if (isUsedProp) {
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = '#fde047';
                ctx.font = 'bold 11px system-ui';
                ctx.textAlign = 'center';
                ctx.fillText(`⏳ 隨機刷新 (${remainingSec}s)`, cx, py - 18);
              }
              ctx.restore();
            },
          });
        });

        // Sprite drawing helper
        const drawCharacterSprite = (
          pkm: PokemonInstance | undefined,
          x: number,
          y: number,
          size: number,
          facing: 'left' | 'right',
          isBoss: boolean,
          bounce: number
        ) => {
          const spriteUrl = getSpriteUrl(pkm);
          const img = loadSpriteImage(spriteUrl);

          ctx.save();
          const s = size * 1.5;
          // PokeAPI sprites have significant padding. Sink the image box further (bottom at y + s/2)
          // so the visual feet of the centered Pokemon align with the ground shadow.
          const drawY = y + (s * 0.48) - s + bounce;

          if (img.complete && img.naturalWidth > 0) {
            ctx.imageSmoothingEnabled = false;
            if (facing === 'left') {
              ctx.translate(x, y);
              ctx.scale(-1, 1);
              ctx.drawImage(img, -s / 2, drawY - y, s, s);
            } else {
              ctx.drawImage(img, x - s / 2, drawY, s, s);
            }
          } else {
            const typeName = pkm?.types[0] || 'Normal';
            const typeColor = TYPE_COLORS[typeName]?.bg || '#f59e0b';
            ctx.strokeStyle = isBoss ? '#ef4444' : typeColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y - 4 + bounce, s / 2 - 2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(x, y - 4 + bounce, s / 2 - 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = `bold ${Math.round(size * 0.44)}px system-ui`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isBoss ? '#ef4444' : '#38bdf8';
            ctx.fillText(isBoss ? '👑' : '🐾', x, y - 4 + bounce);
          }
          ctx.restore();
        };

        // 4. Roaming Enemies (Dynamic AI & Depth-Sorted Drawing)
        roamingEnemiesRef.current.forEach((enemy) => {
          if (enemy.defeated) return;

          const distToPlayer = Math.hypot(playerPx - enemy.px, playerPy - enemy.py);

          if (enemy.type === 'boss') {
            // BOSS Movement AI: Full-Map Random Roaming across 50x50 dungeon
            if (enemy.aiState === 'patrol') {
              if (distToPlayer <= 360) {
                enemy.aiState = 'chase';
              } else {
                // Check if target is set or reached
                if (
                  enemy.targetPx === undefined ||
                  enemy.targetPy === undefined ||
                  Math.hypot(enemy.px - enemy.targetPx, enemy.py - enemy.targetPy) < 28
                ) {
                  // Pick new random walkable tile across the entire map
                  let rTx = 25;
                  let rTy = 25;
                  for (let attempt = 0; attempt < 40; attempt++) {
                    const rx = Math.floor(Math.random() * 42) + 4;
                    const ry = Math.floor(Math.random() * 42) + 4;
                    const key = `${rx},${ry}`;
                    if (!boundaryTreeGrid.has(key) && !waterGrid.has(key) && !cliffGrid.has(key)) {
                      rTx = rx;
                      rTy = ry;
                      break;
                    }
                  }
                  enemy.targetPx = rTx * TILE_PX + 32;
                  enemy.targetPy = rTy * TILE_PX + 32;
                }

                // Move smoothly toward random target
                const angleToTarget = Math.atan2(enemy.targetPy - enemy.py, enemy.targetPx - enemy.px);
                enemy.px += Math.cos(angleToTarget) * (enemy.patrolSpeed * 1.8);
                enemy.py += Math.sin(angleToTarget) * (enemy.patrolSpeed * 1.8);
              }
            } else if (enemy.aiState === 'chase') {
              if (distToPlayer > 480) {
                enemy.aiState = 'cooldown';
                enemy.alertTimer = 150;
              } else {
                const angle = Math.atan2(playerPy - enemy.py, playerPx - enemy.px);
                enemy.px += Math.cos(angle) * enemy.chaseSpeed;
                enemy.py += Math.sin(angle) * enemy.chaseSpeed;
              }
            } else if (enemy.aiState === 'cooldown') {
              enemy.alertTimer -= 1;
              if (enemy.alertTimer <= 0) {
                enemy.aiState = 'patrol';
                enemy.targetPx = undefined;
              }
            }
          } else {
            // Standard Wild / Trainer Enemies AI (Random Multi-directional Roaming with Increased Range)
            if (enemy.aiState === 'patrol') {
              if (distToPlayer <= 298) {
                enemy.aiState = 'chase';
              } else {
                // Pick new target waypoint if none or reached current destination
                if (
                  enemy.targetPx === undefined ||
                  enemy.targetPy === undefined ||
                  Math.hypot(enemy.px - enemy.targetPx, enemy.py - enemy.targetPy) < 24
                ) {
                  let foundValid = false;
                  for (let attempt = 0; attempt < 25; attempt++) {
                    const randomRadius = 260 + Math.random() * 420; // Greatly increased range (260px - 680px) across map
                    const randomAngle = Math.random() * Math.PI * 2;
                    // Shift basePx/basePy slightly to prevent circular looping
                    enemy.basePx = Math.max(128, Math.min((MAP_GRID_SIZE - 2) * TILE_PX, enemy.basePx + (Math.random() - 0.5) * 160));
                    enemy.basePy = Math.max(128, Math.min((MAP_GRID_SIZE - 2) * TILE_PX, enemy.basePy + (Math.random() - 0.5) * 160));
                    
                    const candidatePx = enemy.basePx + Math.cos(randomAngle) * randomRadius;
                    const candidatePy = enemy.basePy + Math.sin(randomAngle) * randomRadius;

                    const tileX = Math.floor(candidatePx / TILE_PX);
                    const tileY = Math.floor(candidatePy / TILE_PX);
                    const key = `${tileX},${tileY}`;

                    if (
                      tileX >= 2 &&
                      tileX < MAP_GRID_SIZE - 2 &&
                      tileY >= 2 &&
                      tileY < MAP_GRID_SIZE - 2 &&
                      !boundaryTreeGrid.has(key) &&
                      !waterGrid.has(key) &&
                      !cliffGrid.has(key)
                    ) {
                      enemy.targetPx = candidatePx;
                      enemy.targetPy = candidatePy;
                      foundValid = true;
                      break;
                    }
                  }

                  if (!foundValid) {
                    enemy.targetPx = Math.max(3, Math.min(MAP_GRID_SIZE - 3, Math.floor(enemy.px / TILE_PX) + (Math.random() - 0.5) * 16)) * TILE_PX + 32;
                    enemy.targetPy = Math.max(3, Math.min(MAP_GRID_SIZE - 3, Math.floor(enemy.py / TILE_PX) + (Math.random() - 0.5) * 16)) * TILE_PX + 32;
                  }
                }

                // Move smoothly towards random target
                const destPx = enemy.targetPx ?? enemy.basePx;
                const destPy = enemy.targetPy ?? enemy.basePy;
                const moveAngle = Math.atan2(destPy - enemy.py, destPx - enemy.px);
                const stepSpeed = enemy.patrolSpeed * 1.3;
                enemy.px += Math.cos(moveAngle) * stepSpeed;
                enemy.py += Math.sin(moveAngle) * stepSpeed;
              }
            } else if (enemy.aiState === 'chase') {
              if (distToPlayer > 408) {
                enemy.aiState = 'cooldown';
                enemy.alertTimer = 120;
              } else {
                const angle = Math.atan2(playerPy - enemy.py, playerPx - enemy.px);
                enemy.px += Math.cos(angle) * enemy.chaseSpeed;
                enemy.py += Math.sin(angle) * enemy.chaseSpeed;
              }
            } else if (enemy.aiState === 'cooldown') {
              enemy.alertTimer -= 1;
              if (enemy.alertTimer <= 0) {
                enemy.aiState = 'patrol';
                enemy.targetPx = undefined;
                enemy.targetPy = undefined;
              }
            }
          }

          entityQueue.push({
            renderY: enemy.py + (enemy.type === 'boss' ? 24 : 0),
            draw: () => {
              if (enemy.type === 'boss') {
                // ==========================================
                // MASSIVE BOSS VISUAL RENDERING (圖示加大)
                // ==========================================
                const bossPulse = Math.sin(walkAnimFrame * 3) * 8;
                const bossBounce = 0;

                // 1. Heavy Colossal Ground Shadow
                ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
                ctx.beginPath();
                ctx.ellipse(enemy.px, enemy.py + 44, 52, 18, 0, 0, Math.PI * 2);
                ctx.fill();

                // 2. Radiant Pulsing Crimson & Golden Boss Flame Aura
                const auraGrad = ctx.createRadialGradient(
                  enemy.px,
                  enemy.py - 10,
                  20,
                  enemy.px,
                  enemy.py - 10,
                  88 + bossPulse
                );
                auraGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
                auraGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.25)');
                auraGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                ctx.fillStyle = auraGrad;
                ctx.beginPath();
                ctx.arc(enemy.px, enemy.py - 10, 88 + bossPulse, 0, Math.PI * 2);
                ctx.fill();

                // 3. Rotating Golden Flame Orbs Orbiting Boss
                const orbitR = 72 + bossPulse * 0.5;
                for (let i = 0; i < 6; i++) {
                  const angle = walkAnimFrame * 1.5 + (i * Math.PI) / 3;
                  const ox = enemy.px + Math.cos(angle) * orbitR;
                  const oy = enemy.py - 10 + Math.sin(angle) * (orbitR * 0.55);
                  ctx.fillStyle = '#fde047';
                  ctx.beginPath();
                  ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.fillStyle = '#ea580c';
                  ctx.beginPath();
                  ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                }

                // 4. Pulsing Boss Shockwave Barrier Ring
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(enemy.px, enemy.py - 10, 68 + bossPulse * 0.6, 0, Math.PI * 2);
                ctx.stroke();

                // 5. Draw Doubled Size Boss Sprite (128px!)
                const bossSprSize = 128;
                const facing = enemy.px > playerPx ? 'left' : 'right';
                drawCharacterSprite(
                  enemy.pkm,
                  enemy.px,
                  enemy.py,
                  bossSprSize,
                  facing,
                  true,
                  bossBounce
                );

                // 6. Prominent Grand Boss Overhead Banner
                const bannerY = enemy.py - 86 + bossBounce;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(enemy.px - 105, bannerY - 14, 210, 26, 12);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#fef08a';
                ctx.font = 'bold 12px system-ui';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                  `👑 BOSS 守護者 · ${enemy.pkm.nameZh} Lv.${enemy.pkm.level}`,
                  enemy.px,
                  bannerY - 1
                );
              } else {
                // HD-2D Regular Enemy Ground Contact Shadow (Soft Radial Falloff)
                const eShadow = ctx.createRadialGradient(enemy.px, enemy.py + 20, 0, enemy.px, enemy.py + 20, 22);
                eShadow.addColorStop(0, 'rgba(10, 15, 30, 0.65)');
                eShadow.addColorStop(0.55, 'rgba(10, 15, 30, 0.22)');
                eShadow.addColorStop(1, 'rgba(10, 15, 30, 0)');
                ctx.fillStyle = eShadow;
                ctx.beginPath();
                ctx.ellipse(enemy.px, enemy.py + 20, 22, 10, 0, 0, Math.PI * 2);
                ctx.fill();

                const sprSize = 56;
                const enemyBounce = 0;
                const facing = enemy.px > playerPx ? 'left' : 'right';

                drawCharacterSprite(
                  enemy.pkm,
                  enemy.px,
                  enemy.py,
                  sprSize,
                  facing,
                  false,
                  enemyBounce
                );
              }
            },
          });
        });

        // 5. Player Character (Queued for Depth Drawing with Lantern Glow & Occlusion Silhouette)
        entityQueue.push({
          renderY: playerPy,
          draw: () => {
            // HD-2D Ground Contact Shadow (Dual-layer soft radial falloff)
            const pShadow = ctx.createRadialGradient(playerPx, playerPy + 22, 0, playerPx, playerPy + 22, 24);
            pShadow.addColorStop(0, 'rgba(10, 15, 30, 0.75)');
            pShadow.addColorStop(0.55, 'rgba(10, 15, 30, 0.25)');
            pShadow.addColorStop(1, 'rgba(10, 15, 30, 0)');
            ctx.fillStyle = pShadow;
            ctx.beginPath();
            ctx.ellipse(playerPx, playerPy + 22, 24, 11, 0, 0, Math.PI * 2);
            ctx.fill();

            // HD-2D Octopath Adventurer's Lantern Ambient Light Glow
            const lanternGrad = ctx.createRadialGradient(playerPx, playerPy + 6, 4, playerPx, playerPy + 6, 80);
            lanternGrad.addColorStop(0, 'rgba(254, 240, 138, 0.22)');
            lanternGrad.addColorStop(0.4, 'rgba(251, 146, 60, 0.08)');
            lanternGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
            ctx.fillStyle = lanternGrad;
            ctx.beginPath();
            ctx.arc(playerPx, playerPy + 6, 80, 0, Math.PI * 2);
            ctx.fill();

            // Occlusion Silhouette: check if player is positioned behind trees, rocks, or buildings
            let isPlayerOccluded = false;
            let occludingTileName: 'forest_canopy_obstacle' | 'stone_pillar_obstacle' | 'wooden_house_front' = 'forest_canopy_obstacle';
            const pCol = Math.floor(playerPx / TILE_PX);
            const pRow = Math.floor(playerPy / TILE_PX);
            for (let r = pRow; r <= pRow + 1; r++) {
              for (let c = pCol - 1; c <= pCol + 1; c++) {
                const key = `${c},${r}`;
                if (boundaryTreeGrid.has(key)) {
                  const tx = c * TILE_PX + 32;
                  const ty = r * TILE_PX + 38;
                  if (Math.abs(playerPx - tx) < 32 && playerPy < ty + 10 && playerPy > ty - 42) {
                    isPlayerOccluded = true;
                    occludingTileName = 'forest_canopy_obstacle';
                    break;
                  }
                }
                if (obstacleGrid.has(key)) {
                  const bx = c * TILE_PX + 32;
                  const by = r * TILE_PX + 36;
                  if (Math.abs(playerPx - bx) < 28 && playerPy < by + 8 && playerPy > by - 32) {
                    isPlayerOccluded = true;
                    occludingTileName = 'stone_pillar_obstacle';
                    break;
                  }
                }
              }
              if (isPlayerOccluded) break;
            }
            if (!isPlayerOccluded) {
              for (const prop of propsRef.current) {
                const px = prop.tileX * TILE_PX;
                const py = prop.tileY * TILE_PX;
                const cx = px + 32;
                const cy = py + 32;
                if (prop.type === 'house' && playerPx >= px && playerPx <= px + 64 && playerPy < py + 48 && playerPy > py - 18) {
                  isPlayerOccluded = true;
                  occludingTileName = 'wooden_house_front';
                  break;
                }
                if (prop.type === 'shop' && playerPx >= px && playerPx <= px + 64 && playerPy < py + 40 && playerPy > py - 14) {
                  isPlayerOccluded = true;
                  occludingTileName = 'wooden_house_front';
                  break;
                }
                if ((prop.type === 'stele' || prop.type === 'evolution_altar') && Math.abs(playerPx - cx) < 28 && playerPy < cy + 18 && playerPy > cy - 34) {
                  isPlayerOccluded = true;
                  occludingTileName = 'stone_pillar_obstacle';
                  break;
                }
              }
            }

            if (isPlayerOccluded) {
              // Luminous silhouette ring from specific occluding tile's hd2dStyle.silhouetteRingColor
              const silhouetteColor = HD2D_TILE_MAP[occludingTileName]?.hd2dStyle?.silhouetteRingColor || 'rgba(120, 220, 255, 0.6)';
              ctx.save();
              ctx.strokeStyle = silhouetteColor;
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(playerPx, playerPy - 2, 26, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = silhouetteColor.replace(/[\d.]+\)$/, '0.18)');
              ctx.fill();
              ctx.restore();
            }

            const bounceY = 0;
            const playerSprSize = 64;

            drawCharacterSprite(
              leadPokemon,
              playerPx,
              playerPy,
              playerSprSize,
              playerPosRef.current.facing,
              false,
              bounceY
            );
          },
        });

        // 6. Execute Y-Sorted Rendering of All Entities with Depth-Based Fade
        entityQueue.sort((a, b) => a.renderY - b.renderY);
        entityQueue.forEach((item) => {
          // Depth-based transparency for entities (Fog of War proxy)
          const distY = Math.abs(item.renderY - playerPy) / TILE_PX;
          const depthAlpha = Math.max(0.65, 1 - Math.max(0, distY - 5) * 0.08);

          ctx.save();
          ctx.globalAlpha *= depthAlpha;
          item.draw();
          ctx.restore();
        });

        // =========================================================
        // LAYER 4: WEATHER ATMOSPHERE & HUD OVERLAYS
        // =========================================================
        // Click-to-Move Target Beacon
        if (targetClickPos.current) {
          const tpx = targetClickPos.current.px;
          const tpy = targetClickPos.current.py;
          const r = 12 + Math.sin(walkAnimFrame * 3) * 4;
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(tpx, tpy, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(tpx, tpy, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Weather particles
        weatherParticles.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > viewH) {
            p.y = 0;
            p.x = Math.random() * viewW;
          }
          if (p.x < 0) p.x = viewW;
          if (p.x > viewW) p.x = 0;

          const screenX = p.x + camX;
          const screenY = p.y + camY;

          if (isIceTundra) {
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, p.s, 0, Math.PI * 2);
            ctx.fill();
          } else if (isFireCave) {
            ctx.fillStyle = `rgba(249, 115, 22, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, p.s * 0.8, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Floating petals / leaves
            ctx.fillStyle = `rgba(74, 222, 128, ${p.alpha * 0.7})`;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY, p.s * 1.5, p.s * 0.8, walkAnimFrame, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Contact Collision Interactions
        const nowMs = Date.now();
        if (isModalOpen) {
          interactCooldownRef.current = nowMs + 6000;
        } else if (nowMs > interactCooldownRef.current && !isTransitioningRef.current) {
          let propTriggeredThisFrame = false;

          // 1. Contact with Functional Props (HIGHEST PRIORITY)
          for (const prop of propsRef.current) {
            // Non-functional decorative objects (house, sign) have no trigger and never reset
            if (prop.type === 'house' || prop.type === 'sign') continue;
            if (prop.isUsed) continue; // Skip props undergoing respawn cooldown

            const propPx = prop.tileX * TILE_PX + 32;
            const propPy = prop.tileY * TILE_PX + 32;
            const dist = Math.hypot(playerPx - propPx, playerPy - propPy);

            if (dist <= 48) {
              propTriggeredThisFrame = true;
              prop.isUsed = true;
              prop.respawnAt = nowMs + 30000;
              floorPropsCache2D[currentFloor] = propsRef.current;
              targetClickPos.current = null;
              keysPressed.current = {};
              globalPropCooldown = nowMs + 6000;
              interactCooldownRef.current = nowMs + 6000;

              // Do NOT teleport player to avoid pushing into boundary trees or obstacles!
              floorPlayerPosCache2D[currentFloor] = { px: playerPosRef.current.px, py: playerPosRef.current.py };

              // Repel all nearby enemies far away from the functional prop area
              roamingEnemiesRef.current.forEach((e) => {
                const eDist = Math.hypot(e.px - propPx, e.py - propPy);
                if (eDist < 250) {
                  const angle = Math.atan2(e.py - propPy, e.px - propPx);
                  e.px = propPx + Math.cos(angle) * 220;
                  e.py = propPy + Math.sin(angle) * 220;
                  e.aiState = 'cooldown';
                  e.alertTimer = 200;
                }
              });

              if (prop.type === 'chest' && !hasLootedChest) {
                sound.playSelect();
                const earnedCoins = Math.floor(Math.random() * 50) + 50;
                const itemReward = Math.random() > 0.5 ? ITEMS.potion : ITEMS.oran_berry;
                setTimeout(() => {
                  setHasLootedChest(true);
                  onLootChest(earnedCoins, itemReward);
                }, 0);
                // Chest loot popup window cancelled per user directive
                break;
              } else if (prop.type === 'camp') {
                sound.playSelect();
                setToastMessage('🔥 進入營火庇護所！');
                setTimeout(() => setToastMessage(null), 3000);
                setTimeout(() => onOpenCamp(), 0);
                break;
              } else if (prop.type === 'shop') {
                sound.playSelect();
                setToastMessage('🛒 進入友誼商店！');
                setTimeout(() => setToastMessage(null), 3000);
                setTimeout(() => onOpenShop(), 0);
                break;
              } else if (prop.type === 'stele') {
                sound.playSelect();
                setToastMessage('🔮 觸動神秘祭壇！');
                setTimeout(() => setToastMessage(null), 3000);
                const evId = nodes.find((n) => n.type === 'event')?.mysteryEventId || 'fossil_altar';
                setTimeout(() => onTriggerEvent(evId), 0);
                break;
              } else if (prop.type === 'evolution_altar') {
                sound.playLevelUp();
                setToastMessage('✨ 觸碰啟動神聖進化祭壇！');
                setTimeout(() => setToastMessage(null), 3000);
                setTimeout(() => onOpenEvolutionAltar(), 0);
                break;
              }
            }
          }

          // 2. Contact with Enemies (ONLY if NO prop was triggered and NO modal is open; sorted by distance for closest-first priority)
          if (!propTriggeredThisFrame && !isModalOpen) {
            const sortedEnemies = roamingEnemiesRef.current
              .filter((e) => !e.defeated)
              .map((e) => ({ e, dist: Math.hypot(playerPx - e.px, playerPy - e.py) }))
              .sort((a, b) => a.dist - b.dist);

            for (const { e, dist } of sortedEnemies) {
              if (dist <= 32) {
                triggerBattle(e);
                break;
              }
            }
          }


          // Northern Boss Sanctum Altar (x: 25, y: 6) - Touch to awaken Boss early if not yet spawned
          const distToSanctum = Math.hypot(playerPx - (25 * TILE_PX + 32), playerPy - (6 * TILE_PX + 32));
          if (distToSanctum <= 48 && !bossSpawned) {
            setBossSpawned(true);
            floorBossSpawnedCache2D[currentFloor] = true;
            sound.playSelect();
            const bossPkm = bossNode.wildPokemon || bossNode.trainer?.team[0] || generateWildPokemon(currentFloor, playerPartyLevel + 15);
            bossPkm.level = playerPartyLevel + 15;
            const bossEnemy: RoamingEnemy2D = {
              id: `boss_active_${currentFloor}`,
              type: 'boss',
              pkm: bossPkm,
              trainer: bossNode.trainer,
              x: 25,
              y: 8,
              px: 25 * TILE_PX + 32,
              py: 8 * TILE_PX + 32,
              basePx: 25 * TILE_PX + 32,
              basePy: 8 * TILE_PX + 32,
              patrolRadius: 180,
              patrolAngle: 0,
              patrolSpeed: 0.7,
              chaseSpeed: 2.2,
              aiState: 'patrol',
              alertTimer: 0,
              defeated: false,
            };
            roamingEnemiesRef.current.push(bossEnemy);
            if (floorEnemiesCache2D[currentFloor]) {
              floorEnemiesCache2D[currentFloor].push(bossEnemy);
            }
            interactCooldownRef.current = nowMs + 2500;
            setToastMessage(`👑 BOSS【${bossPkm.nameZh} Lv.${bossPkm.level}】已喚醒！`);
            setTimeout(() => setToastMessage(null), 2500);
          }
        }
      } finally {
        ctx.restore();
      }
    };

    animFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId);
  }, [
    boundaryTreeGrid,
    bridgeTiles,
    cliffGrid,
    currentFloor,
    dirtPathGrid,
    fieldTerrain,
    fordTiles,
    hasLootedChest,
    isBossFloor,
    bossDefeated,
    leadPokemon,
    nodes,
    obstacleGrid,
    onAdvanceFloor,
    onLootChest,
    onOpenCamp,
    onOpenShop,
    onTriggerEvent,
    setHasLootedChest,
    tallGrassGrid,
    triggerBattle,
    waterGrid,
    waterShoreGrid,
    getSpriteUrl,
    loadSpriteImage,
    bossNode,
    bossSpawned,
    playerPartyLevel,
  ]);

  // Format 3-minute Boss timer mm:ss
  const remainingSecs = Math.max(0, BOSS_SPAWN_SECONDS - elapsedSeconds);
  const minutesStr = String(Math.floor(remainingSecs / 60)).padStart(2, '0');
  const secondsStr = String(remainingSecs % 60).padStart(2, '0');

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[720px] aspect-square mx-auto rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-700/60 bg-slate-950 select-none touch-none ring-1 ring-white/10"
    >
      {/* 2D HTML5 Canvas Map */}
      <canvas
        ref={canvasRef}
        width={680}
        height={680}
        onClick={handleCanvasClick}
        className="w-full h-full object-cover cursor-crosshair"
      />

      {/* HD-2D Diorama Cinematic Visual Upgrades (Octopath-style Tilt-Shift Blur, Dynamic Vignette & Ambient Bloom) */}
      <div className="hd2d-tilt-shift-top" />
      <div className="hd2d-tilt-shift-bottom" />
      <div className="absolute inset-0 hd2d-vignette pointer-events-none z-10" />
      <div className="absolute inset-0 hd2d-bloom-overlay pointer-events-none z-10" />

      {/* Weather & Environmental Visual Effects Overlay (Pure CSS Animations) */}
      <DungeonWeatherEffect
        weatherType={weatherType}
        currentFloor={currentFloor}
        fieldTerrainId={fieldTerrain?.id}
        isBossFloor={isBossFloor}
      />

      {/* Floating Notice Toast */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 animate-bounce pointer-events-none">
          <div className="px-5 py-2.5 rounded-2xl bg-amber-500/95 text-slate-950 text-xs font-bold shadow-2xl border border-amber-300">
            {toastMessage}
          </div>
        </div>
      )}

      {/* Top Left: Floor Status */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs shadow-lg">
        <Compass className="w-3.5 h-3.5 text-rose-400" />
        <span className="font-bold text-white">第 {currentFloor} 層</span>
      </div>

      {/* Top Right: Streamlined Boss Countdown */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs font-mono font-bold text-rose-400">
        <span>👑 {remainingSecs > 0 ? `${minutesStr}:${secondsStr}` : '已降臨'}</span>
      </div>

      {/* Bottom Left: Touch & Mouse Virtual Joystick */}
      <div
        onTouchStart={handleJoystickTouchStart}
        onTouchMove={handleJoystickTouchMove}
        onTouchEnd={handleJoystickTouchEnd}
        onMouseDown={handleJoystickMouseDown}
        onMouseMove={handleJoystickMouseMove}
        onMouseUp={handleJoystickMouseUp}
        onMouseLeave={handleJoystickMouseUp}
        className="absolute bottom-5 left-5 z-30 w-28 h-28 rounded-full bg-slate-900/80 backdrop-blur-md border-2 border-slate-700/80 shadow-2xl flex items-center justify-center touch-none select-none active:border-rose-500 transition-colors cursor-grab active:cursor-grabbing"
      >
        <div className="absolute w-full h-[1px] bg-slate-800 pointer-events-none" />
        <div className="absolute h-full w-[1px] bg-slate-800 pointer-events-none" />

        <div
          className={`w-12 h-12 rounded-full border-2 shadow-lg transition-transform pointer-events-none flex items-center justify-center ${
            isJoystickActive
              ? 'bg-gradient-to-br from-rose-500 to-rose-600 border-white ring-4 ring-rose-500/40'
              : 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-500'
          }`}
          style={{
            transform: `translate(${joystickKnobPos.x}px, ${joystickKnobPos.y}px)`,
          }}
        >
          <div className="w-3 h-3 rounded-full bg-white/80" />
        </div>
      </div>

      {/* Bottom Right: Sprint / Dash Button */}
      <div className="absolute bottom-5 right-5 z-30 flex flex-col items-end gap-2">
        <button
          onClick={() => {
            sound.playSelect();
            const next = !isSprintActive;
            setIsSprintActive(next);
            isSprintingRef.current = next;
          }}
          className={`px-4 py-3 rounded-2xl border-2 shadow-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer select-none active:scale-95 ${
            isSprintActive
              ? 'bg-amber-500 text-slate-950 border-white ring-4 ring-amber-500/40 shadow-amber-500/30'
              : 'bg-slate-900/90 hover:bg-slate-800 text-amber-300 border-amber-500/60 backdrop-blur-md'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{isSprintActive ? '⚡ 衝刺中 (+50% 移動)' : '⚡ 衝刺 Sprint (Shift)'}</span>
        </button>
      </div>

    </div>
  );
};

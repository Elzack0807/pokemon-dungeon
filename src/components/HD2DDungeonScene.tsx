import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DungeonNode, PokemonInstance, Item, Trainer } from '../types/pokemon';
import { POKEMON_SPECIES, createPokemon } from '../data/pokemonData';
import { generateWildPokemon, generateTrainer } from '../data/dungeonGenerator';
import { ITEMS } from '../data/itemsData';
import { sound } from '../utils/audio';
import {
  isSoftwareGl,
  createStoneFloorTexture,
  createStoneWallTexture,
  createBattlePedestalTexture,
  createContactShadowTexture,
  createTorchFlameTexture,
  createGrassTexture,
  createBossAuraTexture,
  createPortalRuneTexture,
} from '../utils/hd2dTextures';
import {
  Swords,
  Tent,
  ShoppingBag,
  Sparkles,
  HelpCircle,
  Compass,
  Flame,
  Radio,
  Eye,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export interface RoamingEnemy {
  id: string;
  type: 'wild' | 'trainer';
  pkm: PokemonInstance;
  trainer?: Trainer;
  x: number;
  z: number;
  baseX: number;
  baseZ: number;
  patrolRadius: number;
  patrolAngle: number;
  patrolSpeed: number;
  chaseSpeed: number;
  aiState: 'patrol' | 'chase' | 'cooldown';
  alertTimer: number;
  defeated: boolean;
}

export interface FloorProp {
  type: 'camp' | 'shop' | 'chest' | 'stele';
  id: string;
  x: number;
  z: number;
}

interface HD2DDungeonSceneProps {
  currentFloor: number;
  totalFloors: number;
  nodes: DungeonNode[];
  leadPokemon?: PokemonInstance;
  playerPartyLevel: number;
  defeatedEnemyIds: string[];
  onTriggerBattle: (node: DungeonNode, enemyId?: string) => void;
  onOpenCamp: () => void;
  onOpenShop: () => void;
  onTriggerEvent: (eventId: string) => void;
  onAdvanceFloor: () => void;
  onLootChest: (coins: number, item?: Item) => void;
  hasLootedChest: boolean;
  setHasLootedChest: (looted: boolean) => void;
}

export const HD2DDungeonScene: React.FC<HD2DDungeonSceneProps> = ({
  currentFloor,
  totalFloors,
  nodes,
  leadPokemon,
  playerPartyLevel,
  defeatedEnemyIds,
  onTriggerBattle,
  onOpenCamp,
  onOpenShop,
  onTriggerEvent,
  onAdvanceFloor,
  onLootChest,
  hasLootedChest,
  setHasLootedChest,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);

  // Active interaction prompt in UI
  const [activePrompt, setActivePrompt] = useState<{
    text: string;
    subText?: string;
    type: 'enemy' | 'boss' | 'camp' | 'shop' | 'event' | 'chest' | 'portal';
    action: () => void;
  } | null>(null);

  // Encounter flash effect
  const [encounterAlert, setEncounterAlert] = useState<{ active: boolean; title: string }>({
    active: false,
    title: '',
  });

  // Joystick visual state for mobile
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState<boolean>(false);
  const joystickTouchId = useRef<number | null>(null);

  // Live Minimap radar state for UI
  const [radarState, setRadarState] = useState<{
    player: { x: number; z: number };
    enemies: { id: string; x: number; z: number; name: string; isChasing: boolean }[];
    props: FloorProp[];
  }>({
    player: { x: 0, z: 14 },
    enemies: [],
    props: [],
  });

  // Control keys & virtual movement vectors
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const virtualMovement = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  // Player position in 3D world
  const playerPos = useRef<{ x: number; z: number; vx: number; vz: number }>({
    x: 0,
    z: 14,
    vx: 0,
    vz: 0,
  });

  // Click / Tap destination marker
  const clickTarget = useRef<{ x: number; z: number; active: boolean }>({
    x: 0,
    z: 0,
    active: false,
  });

  const isEncounterTransitioning = useRef<boolean>(false);

  // Resolve Boss node
  const isBossFloor = currentFloor % 3 === 0 || nodes.some((n) => n.type === 'boss');
  const bossNode = useMemo(() => {
    return (
      nodes.find((n) => n.type === 'boss') ||
      (isBossFloor
        ? {
            id: `boss_${currentFloor}`,
            floor: currentFloor,
            type: 'boss' as const,
            title: currentFloor === totalFloors ? '終極聖域 · 傳說之戰' : `第 ${currentFloor} 層守護者`,
            description: '迎戰駐守在聖域的強大首領！',
            completed: false,
            accessible: true,
            trainer: generateTrainer(currentFloor, true, playerPartyLevel),
            connectedNextNodeIds: [],
          }
        : null)
    );
  }, [currentFloor, isBossFloor, nodes, playerPartyLevel, totalFloors]);

  // 1. RANDOMIZED DUNGEON PROPS GENERATION (營火/寶箱/商人 隨機出現)
  const spawnedPropsRef = useRef<FloorProp[]>([]);

  useEffect(() => {
    // 6 candidate alcove positions in the dungeon
    const candidateSlots = [
      { x: -11, z: 10 },
      { x: 11, z: 10 },
      { x: -11, z: -10 },
      { x: 11, z: -10 },
      { x: -9, z: 0 },
      { x: 9, z: 0 },
    ];
    // Deterministic or pseudo-random shuffle per floor
    const shuffled = [...candidateSlots].sort(() => Math.random() - 0.5);
    const props: FloorProp[] = [];

    // Campfire: 60% chance, or guaranteed if floor node is 'camp'
    const spawnCamp = nodes.some((n) => n.type === 'camp') || Math.random() < 0.65;
    if (spawnCamp && shuffled.length > 0) {
      const slot = shuffled.pop()!;
      props.push({ type: 'camp', id: `camp_${currentFloor}`, x: slot.x, z: slot.z });
    }

    // Merchant Shop: 50% chance, or guaranteed if floor node is 'shop'
    const spawnShop = nodes.some((n) => n.type === 'shop') || Math.random() < 0.55;
    if (spawnShop && shuffled.length > 0) {
      const slot = shuffled.pop()!;
      props.push({ type: 'shop', id: `shop_${currentFloor}`, x: slot.x, z: slot.z });
    }

    // Treasure Chest: 85% chance
    const spawnChest = Math.random() < 0.85;
    if (spawnChest && shuffled.length > 0) {
      const slot = shuffled.pop()!;
      props.push({ type: 'chest', id: `chest_${currentFloor}`, x: slot.x, z: slot.z });
    }

    // Ancient Mystery Stele: 45% chance, or guaranteed if floor node is 'event'
    const spawnStele = nodes.some((n) => n.type === 'event') || Math.random() < 0.45;
    if (spawnStele && shuffled.length > 0) {
      const slot = shuffled.pop()!;
      props.push({ type: 'stele', id: `stele_${currentFloor}`, x: slot.x, z: slot.z });
    }

    spawnedPropsRef.current = props;
  }, [currentFloor, nodes]);

  // 2. VISIBLE ROAMING ENEMIES WITH ACTIVE AGGRESSION (敵人主動攻擊性)
  const roamingEnemiesRef = useRef<RoamingEnemy[]>([]);

  useEffect(() => {
    const enemyConfigs = [
      { id: `enemy_${currentFloor}_1`, type: 'wild' as const, baseX: -6.5, baseZ: 5, radius: 2.2, pSpeed: 1.1, cSpeed: 4.2 },
      { id: `enemy_${currentFloor}_2`, type: 'wild' as const, baseX: 6.5, baseZ: 3, radius: 2.5, pSpeed: 0.9, cSpeed: 4.4 },
      { id: `enemy_${currentFloor}_3`, type: 'trainer' as const, baseX: -5.5, baseZ: -4, radius: 1.8, pSpeed: 1.3, cSpeed: 4.5 },
      { id: `enemy_${currentFloor}_4`, type: 'wild' as const, baseX: 5.5, baseZ: -6, radius: 2.0, pSpeed: 1.0, cSpeed: 4.3 },
    ];

    const generated: RoamingEnemy[] = enemyConfigs.map((cfg, idx) => {
      if (cfg.type === 'trainer') {
        const trainer = generateTrainer(currentFloor, false, playerPartyLevel);
        return {
          id: cfg.id,
          type: 'trainer',
          pkm: trainer.team[0],
          trainer,
          x: cfg.baseX,
          z: cfg.baseZ,
          baseX: cfg.baseX,
          baseZ: cfg.baseZ,
          patrolRadius: cfg.radius,
          patrolAngle: idx * 1.5,
          patrolSpeed: cfg.pSpeed,
          chaseSpeed: cfg.cSpeed,
          aiState: 'patrol',
          alertTimer: 0,
          defeated: defeatedEnemyIds.includes(cfg.id),
        };
      } else {
        const wild = generateWildPokemon(currentFloor, playerPartyLevel);
        return {
          id: cfg.id,
          type: 'wild',
          pkm: wild,
          x: cfg.baseX,
          z: cfg.baseZ,
          baseX: cfg.baseX,
          baseZ: cfg.baseZ,
          patrolRadius: cfg.radius,
          patrolAngle: idx * 1.5,
          patrolSpeed: cfg.pSpeed,
          chaseSpeed: cfg.cSpeed,
          aiState: 'patrol',
          alertTimer: 0,
          defeated: defeatedEnemyIds.includes(cfg.id),
        };
      }
    });

    roamingEnemiesRef.current = generated;
  }, [currentFloor, defeatedEnemyIds, playerPartyLevel]);

  // Sync defeated enemies
  useEffect(() => {
    roamingEnemiesRef.current.forEach((e) => {
      if (defeatedEnemyIds.includes(e.id)) {
        e.defeated = true;
      }
    });
  }, [defeatedEnemyIds]);

  const getSpriteUrl = (pkm?: PokemonInstance) => {
    if (!pkm) return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';
    const dexNo = pkm.pokedexNo || POKEMON_SPECIES[pkm.speciesId]?.pokedexNo || 25;
    return pkm.isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${dexNo}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNo}.png`;
  };

  // Trigger Contact Encounter with an enemy
  const triggerContactBattle = useCallback(
    (enemy: RoamingEnemy) => {
      if (isEncounterTransitioning.current) return;
      isEncounterTransitioning.current = true;
      sound.playSelect();

      const encounterTitle =
        enemy.type === 'trainer'
          ? `⚔️ ${enemy.trainer?.name || '遊蕩訓練家'} 抓住了你！`
          : `🌿 接觸交戰！野生 ${enemy.pkm.nameZh} Lv.${enemy.pkm.level}！`;

      setEncounterAlert({ active: true, title: encounterTitle });

      setTimeout(() => {
        const node: DungeonNode =
          enemy.type === 'trainer' && enemy.trainer
            ? {
                id: enemy.id,
                floor: currentFloor,
                type: 'trainer',
                title: enemy.trainer.name,
                description: enemy.trainer.dialogueBefore,
                completed: false,
                accessible: true,
                trainer: enemy.trainer,
                connectedNextNodeIds: [],
              }
            : {
                id: enemy.id,
                floor: currentFloor,
                type: 'battle',
                title: `野生 ${enemy.pkm.nameZh}`,
                description: `地牢中主動撲來的野生 ${enemy.pkm.nameZh}！`,
                completed: false,
                accessible: true,
                wildPokemon: enemy.pkm,
                connectedNextNodeIds: [],
              };

        onTriggerBattle(node, enemy.id);
      }, 550);
    },
    [currentFloor, onTriggerBattle]
  );

  // Trigger Boss confrontation
  const triggerBossBattle = useCallback(() => {
    if (!bossNode || isEncounterTransitioning.current) return;
    isEncounterTransitioning.current = true;
    sound.playSelect();

    setEncounterAlert({
      active: true,
      title: `👑 【首領決戰】${bossNode.trainer?.name || '層級守護者'} 降臨！`,
    });

    setTimeout(() => {
      onTriggerBattle(bossNode);
    }, 600);
  }, [bossNode, onTriggerBattle]);

  // Touch Virtual Joystick Handlers (Fluid 360-degree mobile thumbstick)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!joystickBaseRef.current) return;
    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;
    setIsJoystickActive(true);

    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 40;

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setJoystickPos({ x: knobX, y: knobY });
    virtualMovement.current = {
      x: knobX / maxRadius,
      z: knobY / maxRadius,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isJoystickActive || !joystickBaseRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        const rect = joystickBaseRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const dist = Math.hypot(dx, dy);
        const maxRadius = 40;

        const clampedDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;

        setJoystickPos({ x: knobX, y: knobY });
        virtualMovement.current = {
          x: knobX / maxRadius,
          z: knobY / maxRadius,
        };
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        setIsJoystickActive(false);
        joystickTouchId.current = null;
        setJoystickPos({ x: 0, y: 0 });
        virtualMovement.current = { x: 0, z: 0 };
        break;
      }
    }
  };

  // Main Three.js Scene Setup & Animation Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Atmosphere (52° Isometric RPG Perspective)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.032);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 13.5, 23.5);
    camera.lookAt(0, 0.8, 14);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 2. Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Lighting Setup
    const ambientLight = new THREE.HemisphereLight(0x334155, 0x0f172a, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff3e0, 2.0);
    sunLight.position.set(10, 24, 15);
    sunLight.castShadow = !isSoftwareGl;
    if (sunLight.castShadow) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 60;
      sunLight.shadow.camera.left = -20;
      sunLight.shadow.camera.right = 20;
      sunLight.shadow.camera.top = 25;
      sunLight.shadow.camera.bottom = -25;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    // 4. Ground Geometry
    const floorTex = createStoneFloorTexture();
    floorTex.repeat.set(12, 16);
    floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const floorGeo = new THREE.PlaneGeometry(36, 44);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.82,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    // 5. Perimeter Stone Walls
    const wallTex = createStoneWallTexture();
    wallTex.repeat.set(8, 2);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });

    const northWall = new THREE.Mesh(new THREE.BoxGeometry(36, 6, 1.5), wallMat);
    northWall.position.set(0, 3, -21.5);
    northWall.receiveShadow = !isSoftwareGl;
    scene.add(northWall);

    const southWall = new THREE.Mesh(new THREE.BoxGeometry(36, 5, 1.5), wallMat);
    southWall.position.set(0, 2.5, 21.5);
    southWall.receiveShadow = !isSoftwareGl;
    scene.add(southWall);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5, 44), wallMat);
    westWall.position.set(-17.5, 2.5, 0);
    westWall.receiveShadow = !isSoftwareGl;
    scene.add(westWall);

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5, 44), wallMat);
    eastWall.position.set(17.5, 2.5, 0);
    eastWall.receiveShadow = !isSoftwareGl;
    scene.add(eastWall);

    // 6. Ancient Columns & Wall Sconces
    const torchLights: { light: THREE.PointLight; flame: THREE.Mesh; baseIntensity: number }[] = [];
    const flameTex = createTorchFlameTexture();
    const flameMat = new THREE.MeshBasicMaterial({
      map: flameTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const columnPositions = [
      { x: -8, z: -10 },
      { x: 8, z: -10 },
      { x: -8, z: 2 },
      { x: 8, z: 2 },
      { x: -8, z: 12 },
      { x: 8, z: 12 },
    ];

    columnPositions.forEach((pos) => {
      const colGroup = new THREE.Group();
      colGroup.position.set(pos.x, 0, pos.z);

      const shaftMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 4.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.88 })
      );
      shaftMesh.position.y = 2.1;
      shaftMesh.castShadow = !isSoftwareGl;
      shaftMesh.receiveShadow = !isSoftwareGl;
      colGroup.add(shaftMesh);

      const isWest = pos.x < 0;
      const flameMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.85), flameMat);
      flameMesh.position.set(isWest ? 0.85 : -0.85, 2.8, 0);
      colGroup.add(flameMesh);

      const pLight = new THREE.PointLight(0xf97316, 2.0, 9, 1.4);
      pLight.position.set(isWest ? 0.95 : -0.95, 2.8, 0);
      colGroup.add(pLight);

      torchLights.push({ light: pLight, flame: flameMesh, baseIntensity: 2.0 });
      scene.add(colGroup);
    });

    // 7. Boss Sanctum Dais & Physical Boss Entity
    let bossAuraMesh: THREE.Mesh | undefined;
    let bossSpriteMesh: THREE.Mesh | undefined;
    const bossPosition = { x: 0, y: 0.6, z: -15.5 };

    const daisGroup = new THREE.Group();
    daisGroup.position.set(bossPosition.x, 0, bossPosition.z);

    const daisBase = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.6, 0.6, 24),
      new THREE.MeshStandardMaterial({ map: createStoneFloorTexture(), roughness: 0.8 })
    );
    daisBase.position.y = 0.3;
    daisBase.receiveShadow = !isSoftwareGl;
    daisGroup.add(daisBase);

    const runeTex = createBattlePedestalTexture('#e11d48');
    const runeDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 7.2),
      new THREE.MeshStandardMaterial({ map: runeTex, transparent: true, roughness: 0.6 })
    );
    runeDisc.rotation.x = -Math.PI / 2;
    runeDisc.position.y = 0.61;
    daisGroup.add(runeDisc);

    [-3.6, 3.6].forEach((bx) => {
      const bCol = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 1.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
      );
      bCol.position.set(bx, 0.9, 0);
      daisGroup.add(bCol);

      const bFlame = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.2), flameMat);
      bFlame.position.set(bx, 2.2, 0);
      daisGroup.add(bFlame);

      const bLight = new THREE.PointLight(0xf43f5e, 2.5, 8, 1.5);
      bLight.position.set(bx, 2.2, 0);
      daisGroup.add(bLight);
      torchLights.push({ light: bLight, flame: bFlame, baseIntensity: 2.5 });
    });

    scene.add(daisGroup);

    if (bossNode) {
      const bossPkm = bossNode.trainer?.team[0] || createPokemon('onix', 10, false);
      const bossSpriteUrl = getSpriteUrl(bossPkm);

      const auraTex = createBossAuraTexture();
      const auraGeo = new THREE.PlaneGeometry(4.2, 4.2);
      const auraMat = new THREE.MeshBasicMaterial({
        map: auraTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      bossAuraMesh = new THREE.Mesh(auraGeo, auraMat);
      bossAuraMesh.rotation.x = -Math.PI / 2;
      bossAuraMesh.position.set(bossPosition.x, bossPosition.y + 0.05, bossPosition.z);
      scene.add(bossAuraMesh);

      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(bossSpriteUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;

        const bossMat = new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          roughness: 0.4,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
        const bSprite = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), bossMat);
        bSprite.position.set(bossPosition.x, bossPosition.y + 1.6, bossPosition.z);
        bSprite.castShadow = !isSoftwareGl;
        scene.add(bSprite);
        bossSpriteMesh = bSprite;
      });

      const nameplateCanvas = document.createElement('canvas');
      nameplateCanvas.width = 384;
      nameplateCanvas.height = 96;
      const npCtx = nameplateCanvas.getContext('2d')!;
      npCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      npCtx.roundRect(12, 12, 360, 72, 16);
      npCtx.fill();
      npCtx.strokeStyle = '#f43f5e';
      npCtx.lineWidth = 4;
      npCtx.roundRect(12, 12, 360, 72, 16);
      npCtx.stroke();

      npCtx.fillStyle = '#fecdd3';
      npCtx.font = 'bold 22px system-ui, sans-serif';
      npCtx.textAlign = 'center';
      const bossTitle = bossNode.trainer?.name || '深層守護者';
      npCtx.fillText(`👑 【層級首領】${bossTitle}`, 192, 42);

      npCtx.fillStyle = '#fda4af';
      npCtx.font = 'bold 16px monospace';
      npCtx.fillText(`Lv.${bossPkm.level} · 接觸即刻決戰`, 192, 66);

      const npTex = new THREE.CanvasTexture(nameplateCanvas);
      npTex.colorSpace = THREE.SRGBColorSpace;
      const npMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 0.8),
        new THREE.MeshBasicMaterial({ map: npTex, transparent: true })
      );
      npMesh.position.set(bossPosition.x, bossPosition.y + 3.8, bossPosition.z);
      scene.add(npMesh);
    }

    // 8. Descent Portal
    const portalPosition = { x: 0, y: 0.05, z: -19.5 };
    const portalTex = createPortalRuneTexture();
    const portalMat = new THREE.MeshBasicMaterial({
      map: portalTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), portalMat);
    portalMesh.rotation.x = -Math.PI / 2;
    portalMesh.position.set(portalPosition.x, portalPosition.y, portalPosition.z);
    scene.add(portalMesh);

    // 9. INSTANTIATE DYNAMIC RANDOMIZED PROPS (營火/寶箱/商人 隨機出現)
    let chestLidMesh: THREE.Mesh | undefined;

    spawnedPropsRef.current.forEach((prop) => {
      if (prop.type === 'camp') {
        const campGroup = new THREE.Group();
        campGroup.position.set(prop.x, 0, prop.z);
        const cRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.0, 0.22, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })
        );
        cRing.rotation.x = -Math.PI / 2;
        cRing.position.y = 0.15;
        campGroup.add(cRing);
        const cFlame = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), flameMat);
        cFlame.position.y = 0.85;
        campGroup.add(cFlame);
        const cLight = new THREE.PointLight(0xf97316, 2.8, 8, 1.5);
        cLight.position.y = 1.0;
        campGroup.add(cLight);
        torchLights.push({ light: cLight, flame: cFlame, baseIntensity: 2.8 });
        scene.add(campGroup);
      } else if (prop.type === 'shop') {
        const shopGroup = new THREE.Group();
        shopGroup.position.set(prop.x, 0, prop.z);
        const counter = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 1.1, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
        );
        counter.position.y = 0.55;
        shopGroup.add(counter);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 0.25, 1.8),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 })
        );
        roof.position.y = 2.4;
        shopGroup.add(roof);
        scene.add(shopGroup);
      } else if (prop.type === 'stele') {
        const steleGroup = new THREE.Group();
        steleGroup.position.set(prop.x, 0, prop.z);
        const steleMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 3.2, 0.6),
          new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.75,
            emissive: 0x0e7490,
            emissiveIntensity: 0.25,
          })
        );
        steleMesh.position.y = 1.6;
        steleMesh.castShadow = !isSoftwareGl;
        steleGroup.add(steleMesh);
        scene.add(steleGroup);
      } else if (prop.type === 'chest') {
        const chestGroup = new THREE.Group();
        chestGroup.position.set(prop.x, 0, prop.z);
        const chestBase = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.7, 0.9),
          new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8, metalness: 0.2 })
        );
        chestBase.position.y = 0.35;
        chestBase.castShadow = !isSoftwareGl;
        chestGroup.add(chestBase);

        const lid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 1.4, 12, 1, false, 0, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75, metalness: 0.3 })
        );
        lid.rotation.z = Math.PI / 2;
        lid.position.set(0, 0.7, 0);
        chestGroup.add(lid);
        chestLidMesh = lid;

        if (hasLootedChest) {
          lid.rotation.x = -Math.PI / 3;
        }

        const chestLight = new THREE.PointLight(0xf59e0b, hasLootedChest ? 0.3 : 2.2, 5);
        chestLight.position.set(0, 1.0, 0);
        chestGroup.add(chestLight);
        scene.add(chestGroup);
      }
    });

    // 10. VISIBLE ROAMING ENEMIES WITH ACTIVE CHASE AI & ALERT CUES
    const enemySceneObjects: {
      enemy: RoamingEnemy;
      group: THREE.Group;
      spriteMesh?: THREE.Mesh;
      tagMesh: THREE.Mesh;
      alertMesh: THREE.Mesh;
    }[] = [];

    const contactShadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1.4, 1.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    // Exclamation Mark Alert Texture
    const alertCanvas = document.createElement('canvas');
    alertCanvas.width = 64;
    alertCanvas.height = 64;
    const aCtx = alertCanvas.getContext('2d')!;
    aCtx.fillStyle = '#ef4444';
    aCtx.beginPath();
    aCtx.arc(32, 32, 28, 0, Math.PI * 2);
    aCtx.fill();
    aCtx.strokeStyle = '#ffffff';
    aCtx.lineWidth = 4;
    aCtx.stroke();
    aCtx.fillStyle = '#ffffff';
    aCtx.font = 'bold 38px sans-serif';
    aCtx.textAlign = 'center';
    aCtx.textBaseline = 'middle';
    aCtx.fillText('!', 32, 34);

    const alertTex = new THREE.CanvasTexture(alertCanvas);
    alertTex.colorSpace = THREE.SRGBColorSpace;
    const alertMat = new THREE.MeshBasicMaterial({ map: alertTex, transparent: true });

    const enemyTexLoader = new THREE.TextureLoader();

    roamingEnemiesRef.current.forEach((enemy) => {
      if (enemy.defeated) return;

      const eGroup = new THREE.Group();
      eGroup.position.set(enemy.x, 0, enemy.z);

      const eShadow = new THREE.Mesh(shadowGeo, shadowMat);
      eShadow.rotation.x = -Math.PI / 2;
      eShadow.position.y = 0.03;
      eGroup.add(eShadow);

      const spriteUrl = getSpriteUrl(enemy.pkm);
      let sMesh: THREE.Mesh | undefined;

      enemyTexLoader.load(spriteUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;

        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          roughness: 0.45,
          metalness: 0.05,
          side: THREE.DoubleSide,
        });
        sMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), mat);
        sMesh.position.y = 0.8;
        sMesh.castShadow = !isSoftwareGl;
        eGroup.add(sMesh);

        const entry = enemySceneObjects.find((o) => o.enemy.id === enemy.id);
        if (entry) entry.spriteMesh = sMesh;
      });

      // Name & Level Tag Billboard
      const tagCanvas = document.createElement('canvas');
      tagCanvas.width = 256;
      tagCanvas.height = 64;
      const tCtx = tagCanvas.getContext('2d')!;
      tCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      tCtx.roundRect(8, 8, 240, 48, 12);
      tCtx.fill();
      tCtx.strokeStyle = enemy.type === 'trainer' ? '#f59e0b' : '#ef4444';
      tCtx.lineWidth = 3;
      tCtx.roundRect(8, 8, 240, 48, 12);
      tCtx.stroke();

      tCtx.fillStyle = '#ffffff';
      tCtx.font = 'bold 20px system-ui, sans-serif';
      tCtx.textAlign = 'center';
      tCtx.fillText(`${enemy.pkm.nameZh} Lv.${enemy.pkm.level}`, 128, 40);

      const tagTex = new THREE.CanvasTexture(tagCanvas);
      tagTex.colorSpace = THREE.SRGBColorSpace;
      const tagMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.45),
        new THREE.MeshBasicMaterial({ map: tagTex, transparent: true })
      );
      tagMesh.position.y = 1.85;
      eGroup.add(tagMesh);

      // Chasing Alert Badge Mesh
      const alertMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), alertMat);
      alertMesh.position.y = 2.45;
      alertMesh.visible = false;
      eGroup.add(alertMesh);

      scene.add(eGroup);
      enemySceneObjects.push({ enemy, group: eGroup, tagMesh, alertMesh });
    });

    // 11. Player Billboard Sprite
    const playerGroup = new THREE.Group();
    playerGroup.position.set(playerPos.current.x, 0, playerPos.current.z);

    const pShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      })
    );
    pShadow.rotation.x = -Math.PI / 2;
    pShadow.position.y = 0.03;
    playerGroup.add(pShadow);

    let playerSpriteMesh: THREE.Mesh | undefined;
    const playerSpriteUrl = getSpriteUrl(leadPokemon);
    enemyTexLoader.load(playerSpriteUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;

      const pMat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        roughness: 0.4,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), pMat);
      pMesh.position.y = 0.9;
      pMesh.castShadow = !isSoftwareGl;
      playerGroup.add(pMesh);
      playerSpriteMesh = pMesh;
    });

    scene.add(playerGroup);

    // 12. Click / Tap Destination Ripple Ring
    const clickRingGeo = new THREE.RingGeometry(0.35, 0.52, 24);
    const clickRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const clickRingMesh = new THREE.Mesh(clickRingGeo, clickRingMat);
    clickRingMesh.rotation.x = -Math.PI / 2;
    clickRingMesh.position.y = 0.05;
    clickRingMesh.visible = false;
    scene.add(clickRingMesh);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasPointerDown = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      if (joystickBaseRef.current) {
        const jRect = joystickBaseRef.current.getBoundingClientRect();
        if (
          clientX >= jRect.left - 20 &&
          clientX <= jRect.right + 20 &&
          clientY >= jRect.top - 20 &&
          clientY <= jRect.bottom + 20
        ) {
          return;
        }
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(floorMesh);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        clickTarget.current = {
          x: Math.max(-14, Math.min(14, pt.x)),
          z: Math.max(-18, Math.min(18, pt.z)),
          active: true,
        };
        clickRingMesh.position.set(clickTarget.current.x, 0.05, clickTarget.current.z);
        clickRingMesh.visible = true;
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasPointerDown);

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 13. Animation & Physics Loop
    let clock = new THREE.Clock();
    let animFrameId: number;
    let walkTimer = 0;
    let radarUpdateCounter = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      torchLights.forEach((tl, i) => {
        const noise = Math.sin(time * 8 + i * 2.3) * 0.2 + Math.sin(time * 15 + i) * 0.15;
        tl.light.intensity = tl.baseIntensity + noise;
        tl.flame.scale.set(1 + noise * 0.2, 1 + noise * 0.35, 1);
      });

      if (bossAuraMesh) bossAuraMesh.rotation.z = time * 0.8;
      portalMesh.rotation.z = -time * 0.6;
      portalMesh.scale.setScalar(1 + Math.sin(time * 3) * 0.08);

      const px = playerPos.current.x;
      const pz = playerPos.current.z;

      // 14. ENEMY ACTIVE AGGRESSION & EVASION AI (敵人主動追蹤 & 操控閃躲)
      enemySceneObjects.forEach(({ enemy, group, spriteMesh, tagMesh, alertMesh }) => {
        if (enemy.defeated) {
          group.visible = false;
          return;
        }

        const distToPlayer = Math.hypot(px - enemy.x, pz - enemy.z);

        // AI State Transitions
        if (enemy.aiState === 'patrol') {
          // If player steps into detection zone (5.8 units) -> Start actively chasing!
          if (distToPlayer <= 5.8) {
            enemy.aiState = 'chase';
          } else {
            // Normal patrol pacing
            enemy.patrolAngle += delta * enemy.patrolSpeed;
            const targetX = enemy.baseX + Math.cos(enemy.patrolAngle) * enemy.patrolRadius;
            const targetZ = enemy.baseZ + Math.sin(enemy.patrolAngle) * (enemy.patrolRadius * 0.7);
            enemy.x = targetX;
            enemy.z = targetZ;
          }
        } else if (enemy.aiState === 'chase') {
          // If player skillfully dodges and breaks line of sight/distance (> 8.5 units) -> Chase lost!
          if (distToPlayer > 8.5) {
            enemy.aiState = 'cooldown';
            enemy.alertTimer = 2.2; // 2.2s cooldown
          } else {
            // Actively chase player!
            const normX = (px - enemy.x) / distToPlayer;
            const normZ = (pz - enemy.z) / distToPlayer;
            enemy.x += normX * enemy.chaseSpeed * delta;
            enemy.z += normZ * enemy.chaseSpeed * delta;
          }
        } else if (enemy.aiState === 'cooldown') {
          enemy.alertTimer -= delta;
          // Slowly walk back to patrol anchor
          const distToBase = Math.hypot(enemy.baseX - enemy.x, enemy.baseZ - enemy.z);
          if (distToBase > 0.5) {
            enemy.x += ((enemy.baseX - enemy.x) / distToBase) * 2.2 * delta;
            enemy.z += ((enemy.baseZ - enemy.z) / distToBase) * 2.2 * delta;
          }
          if (enemy.alertTimer <= 0) {
            enemy.aiState = 'patrol';
          }
        }

        // Clamp to room bounds
        enemy.x = Math.max(-14, Math.min(14, enemy.x));
        enemy.z = Math.max(-18, Math.min(18, enemy.z));
        group.position.set(enemy.x, 0, enemy.z);

        // Visual feedback based on state
        if (spriteMesh) {
          if (enemy.aiState === 'chase') {
            const faceDx = px - enemy.x;
            spriteMesh.scale.x = faceDx < 0 ? -1 : 1;
            // Aggressive hopping while chasing
            spriteMesh.position.y = 0.8 + Math.abs(Math.sin(time * 16)) * 0.22;
          } else {
            const moveDx = -Math.sin(enemy.patrolAngle);
            spriteMesh.scale.x = moveDx < 0 ? -1 : 1;
            spriteMesh.position.y = 0.8 + Math.abs(Math.sin(enemy.patrolAngle * 3)) * 0.12;
          }
          spriteMesh.quaternion.copy(camera.quaternion);
        }

        // Alert indicator `!`
        if (alertMesh) {
          alertMesh.visible = enemy.aiState === 'chase';
          alertMesh.quaternion.copy(camera.quaternion);
        }
        tagMesh.quaternion.copy(camera.quaternion);
      });

      // Handle Player Movement Input
      if (!isEncounterTransitioning.current) {
        let moveX = 0;
        let moveZ = 0;

        if (keysPressed.current['w'] || keysPressed.current['arrowup']) moveZ -= 1;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) moveZ += 1;
        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) moveX -= 1;
        if (keysPressed.current['d'] || keysPressed.current['arrowright']) moveX += 1;

        if (virtualMovement.current.x !== 0 || virtualMovement.current.z !== 0) {
          moveX += virtualMovement.current.x;
          moveZ += virtualMovement.current.z;
        }

        if (clickTarget.current.active) {
          const dx = clickTarget.current.x - playerPos.current.x;
          const dz = clickTarget.current.z - playerPos.current.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.3) {
            moveX = dx / dist;
            moveZ = dz / dist;
          } else {
            clickTarget.current.active = false;
            clickRingMesh.visible = false;
          }
        }

        const isMoving = moveX !== 0 || moveZ !== 0;

        if (isMoving) {
          if (
            keysPressed.current['w'] ||
            keysPressed.current['s'] ||
            keysPressed.current['a'] ||
            keysPressed.current['d']
          ) {
            clickTarget.current.active = false;
            clickRingMesh.visible = false;
          }

          const length = Math.hypot(moveX, moveZ);
          const normX = moveX / length;
          const normZ = moveZ / length;
          const speed = 7.5;

          playerPos.current.vx = normX * speed;
          playerPos.current.vz = normZ * speed;

          const nextX = playerPos.current.x + playerPos.current.vx * delta;
          const nextZ = playerPos.current.z + playerPos.current.vz * delta;

          playerPos.current.x = Math.max(-14.2, Math.min(14.2, nextX));
          playerPos.current.z = Math.max(-18.5, Math.min(18.5, nextZ));

          walkTimer += delta;

          if (playerSpriteMesh) {
            if (normX < -0.15) {
              playerSpriteMesh.scale.x = -Math.abs(playerSpriteMesh.scale.x);
            } else if (normX > 0.15) {
              playerSpriteMesh.scale.x = Math.abs(playerSpriteMesh.scale.x);
            }
            playerSpriteMesh.position.y = 0.9 + Math.abs(Math.sin(walkTimer * 12)) * 0.18;
          }
        } else {
          if (playerSpriteMesh) {
            playerSpriteMesh.position.y = 0.9 + Math.sin(time * 3) * 0.04;
          }
        }
      }

      playerGroup.position.set(playerPos.current.x, 0, playerPos.current.z);

      // Smooth Camera Follow
      const targetCamX = playerPos.current.x;
      const targetCamY = 13.0;
      const targetCamZ = playerPos.current.z + 13.0;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 4.5, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 4.5, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 4.5, delta);
      camera.lookAt(playerPos.current.x, 1.0, playerPos.current.z);

      if (playerSpriteMesh) playerSpriteMesh.quaternion.copy(camera.quaternion);
      if (bossSpriteMesh) bossSpriteMesh.quaternion.copy(camera.quaternion);

      // Radar Minimap Update
      radarUpdateCounter++;
      if (radarUpdateCounter % 4 === 0) {
        setRadarState({
          player: { x: playerPos.current.x, z: playerPos.current.z },
          enemies: roamingEnemiesRef.current
            .filter((e) => !e.defeated)
            .map((e) => ({
              id: e.id,
              x: e.x,
              z: e.z,
              name: e.pkm.nameZh,
              isChasing: e.aiState === 'chase',
            })),
          props: spawnedPropsRef.current,
        });
      }

      // CONTACT & PROXIMITY DETECTION
      let touchedEnemy: RoamingEnemy | null = null;
      let nearbyEnemy: RoamingEnemy | null = null;

      for (const enemy of roamingEnemiesRef.current) {
        if (enemy.defeated) continue;
        const dist = Math.hypot(playerPos.current.x - enemy.x, playerPos.current.z - enemy.z);
        if (dist <= 1.25) {
          touchedEnemy = enemy;
          break;
        } else if (dist <= 2.8) {
          nearbyEnemy = enemy;
        }
      }

      if (touchedEnemy) {
        triggerContactBattle(touchedEnemy);
        return;
      }

      // Check boss proximity & contact
      const distToBoss = Math.hypot(playerPos.current.x - bossPosition.x, playerPos.current.z - bossPosition.z);
      if (bossNode && distToBoss <= 1.5) {
        triggerBossBattle();
        return;
      }

      // Check active randomized props proximity
      const nearbyProp = spawnedPropsRef.current.find((p) => {
        const d = Math.hypot(playerPos.current.x - p.x, playerPos.current.z - p.z);
        return d <= 2.5;
      });

      // Contextual Action Prompts
      if (nearbyEnemy) {
        setActivePrompt({
          text: `【接觸交戰】${nearbyEnemy.type === 'trainer' ? nearbyEnemy.trainer?.name : '野生 ' + nearbyEnemy.pkm.nameZh} Lv.${nearbyEnemy.pkm.level}`,
          subText: nearbyEnemy.aiState === 'chase' ? '敵人正在全力追擊！操控走位或即刻開戰！' : '靠近接觸或按 E 立即交戰！',
          type: 'enemy',
          action: () => triggerContactBattle(nearbyEnemy!),
        });
      } else if (bossNode && distToBoss <= 3.6) {
        setActivePrompt({
          text: `【挑戰首領】${bossNode.trainer?.name || '深層守護者'}`,
          subText: '直面聖域的強大試煉，按 E 或走近決戰！',
          type: 'boss',
          action: triggerBossBattle,
        });
      } else if (nearbyProp?.type === 'camp') {
        setActivePrompt({
          text: '【營火修憩】甘甜泉水與溫暖營火',
          subText: '回復全體隊伍 HP 與招式 PP，按 E 進入休整',
          type: 'camp',
          action: () => {
            sound.playSelect();
            onOpenCamp();
          },
        });
      } else if (nearbyProp?.type === 'shop') {
        setActivePrompt({
          text: '【流浪商人】友誼補給商店',
          subText: '使用金幣購買精靈球與藥水道具，按 E 瀏覽',
          type: 'shop',
          action: () => {
            sound.playSelect();
            onOpenShop();
          },
        });
      } else if (nearbyProp?.type === 'stele') {
        setActivePrompt({
          text: '【遠古石碑】調查古老遺跡之秘',
          subText: '解讀刻劃在石碑上的地牢奇遇，按 E 調查',
          type: 'event',
          action: () => {
            sound.playSelect();
            const evId = nodes.find((n) => n.type === 'event')?.mysteryEventId || 'fossil_altar';
            onTriggerEvent(evId);
          },
        });
      } else if (nearbyProp?.type === 'chest' && !hasLootedChest) {
        setActivePrompt({
          text: '【古代寶箱】神秘的地牢密寶',
          subText: '按 E 開啟拾取金幣與道具！',
          type: 'chest',
          action: () => {
            sound.playSelect();
            setHasLootedChest(true);
            if (chestLidMesh) chestLidMesh.rotation.x = -Math.PI / 3;
            const earnedCoins = Math.floor(Math.random() * 50) + 50;
            const itemReward = Math.random() > 0.5 ? ITEMS.potion : ITEMS.oran_berry;
            onLootChest(earnedCoins, itemReward);
          },
        });
      } else if (Math.hypot(playerPos.current.x - portalPosition.x, playerPos.current.z - portalPosition.z) <= 2.8) {
        setActivePrompt({
          text: `【聖域傳送門】前往第 ${currentFloor + 1} 層階梯`,
          subText: isBossFloor ? '首領強大的威壓籠罩著傳送門！' : '按 E 前往下一層地牢探索',
          type: 'portal',
          action: () => {
            sound.playSelect();
            onAdvanceFloor();
          },
        });
      } else {
        setActivePrompt(null);
      }

      if (keysPressed.current['e'] || keysPressed.current['enter'] || keysPressed.current[' ']) {
        keysPressed.current['e'] = false;
        keysPressed.current['enter'] = false;
        keysPressed.current[' '] = false;
        if (activePrompt) {
          activePrompt.action();
        }
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.domElement.removeEventListener('click', handleCanvasPointerDown);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [
    currentFloor,
    totalFloors,
    nodes,
    leadPokemon,
    playerPartyLevel,
    hasLootedChest,
    bossNode,
    isBossFloor,
    triggerContactBattle,
    triggerBossBattle,
    onAdvanceFloor,
    onLootChest,
    onOpenCamp,
    onOpenShop,
    onTriggerEvent,
    setHasLootedChest,
  ]);

  return (
    <div className="relative w-full h-[640px] md:h-[740px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 select-none touch-none">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-crosshair" />

      {/* Encounter Flash Overlay */}
      {encounterAlert.active && (
        <div className="absolute inset-0 z-50 bg-white/95 animate-pulse flex items-center justify-center pointer-events-none p-4">
          <div className="px-6 py-4 rounded-3xl bg-slate-950/90 border-2 border-rose-500 shadow-2xl text-center">
            <div className="text-3xl md:text-5xl font-black text-rose-500 tracking-wider">
              {encounterAlert.title}
            </div>
            <div className="text-sm text-slate-300 mt-2">進入回合制戰鬥領域...</div>
          </div>
        </div>
      )}

      {/* Top Left: Floor & Live Radar Minimap */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-xs">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs shadow-lg">
          <Compass className="w-4 h-4 text-rose-400" />
          <span className="font-bold text-white">第 {currentFloor} 層 · 地底迷宮</span>
          <span className="text-[10px] text-amber-400 font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            敵人主動追逐
          </span>
        </div>

        {/* Live Minimap Radar */}
        <div className="p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-xl flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>實時探測雷達</span>
            </span>
            <span className="text-[9px] text-slate-400">
              殘存敵人: {radarState.enemies.length}
            </span>
          </div>

          {/* Radar Screen Map View */}
          <div className="relative w-44 h-32 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            {/* Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-40" />

            {/* Boss Altar Icon at Top */}
            {bossNode && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-rose-500/40 border border-rose-400 flex items-center justify-center animate-ping"
                style={{ left: '50%', top: '12%' }}
              />
            )}
            {bossNode && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px]"
                style={{ left: '50%', top: '12%' }}
              >
                👑
              </div>
            )}

            {/* Dynamic Spawned Props on Radar */}
            {radarState.props.map((p) => {
              const rx = ((p.x + 16) / 32) * 100;
              const rz = ((p.z + 20) / 40) * 100;
              if (p.type === 'chest' && hasLootedChest) return null;

              return (
                <div
                  key={p.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px]"
                  style={{ left: `${rx}%`, top: `${rz}%` }}
                >
                  {p.type === 'camp' && '🔥'}
                  {p.type === 'shop' && '🛒'}
                  {p.type === 'chest' && '🎁'}
                  {p.type === 'stele' && '🪨'}
                </div>
              );
            })}

            {/* Wandering Enemies Dots */}
            {radarState.enemies.map((e) => {
              const rx = ((e.x + 16) / 32) * 100;
              const rz = ((e.z + 20) / 40) * 100;
              return (
                <div
                  key={e.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-md ${
                    e.isChasing
                      ? 'w-3 h-3 bg-red-600 border-white ring-2 ring-red-500 animate-ping'
                      : 'w-2.5 h-2.5 bg-rose-500 border-rose-300'
                  }`}
                  style={{ left: `${rx}%`, top: `${rz}%` }}
                />
              );
            })}

            {/* Player Cyan Blip */}
            {(() => {
              const px = ((radarState.player.x + 16) / 32) * 100;
              const pz = ((radarState.player.z + 20) / 40) * 100;
              return (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-sky-400 border-2 border-white shadow-lg ring-2 ring-sky-400/50"
                  style={{ left: `${px}%`, top: `${pz}%` }}
                />
              );
            })()}
          </div>

          <div className="text-[9px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>玩家</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>敵人 (可走位閃躲)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Top Right: Dungeon Guide Legend */}
      <div className="hidden sm:flex absolute top-4 right-4 z-20 flex-col gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-[11px] text-slate-300 shadow-lg">
        <div className="font-bold text-white text-xs mb-0.5 flex items-center gap-1">
          <Eye className="w-3.5 h-3.5 text-rose-400" />
          <span>動態主動地牢</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span>怪物進入警戒會主動追擊，可走位閃開！</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>營火/寶箱/商人隨機出現在地牢側室</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>擊倒怪物後清除道路</span>
        </div>
      </div>

      {/* Bottom Center: Contextual Interaction Banner */}
      {activePrompt && (
        <div className="absolute bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-md w-full px-4 animate-bounce">
          <button
            onClick={activePrompt.action}
            className={`w-full p-4 rounded-2xl backdrop-blur-md shadow-2xl border text-left flex items-center justify-between transition-transform active:scale-95 cursor-pointer ${
              activePrompt.type === 'boss' || activePrompt.type === 'enemy'
                ? 'bg-rose-950/90 border-rose-500 ring-2 ring-rose-500/50 shadow-rose-950/70'
                : activePrompt.type === 'camp'
                ? 'bg-emerald-950/90 border-emerald-500 ring-2 ring-emerald-500/50 shadow-emerald-950/70'
                : activePrompt.type === 'shop'
                ? 'bg-sky-950/90 border-sky-500 ring-2 ring-sky-500/50 shadow-sky-950/70'
                : activePrompt.type === 'chest'
                ? 'bg-amber-950/90 border-amber-500 ring-2 ring-amber-500/50 shadow-amber-950/70'
                : 'bg-indigo-950/90 border-indigo-500 ring-2 ring-indigo-500/50 shadow-indigo-950/70'
            }`}
          >
            <div>
              <div className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                {activePrompt.type === 'boss' && <Flame className="w-5 h-5 text-rose-400 animate-pulse" />}
                {activePrompt.type === 'enemy' && <Swords className="w-5 h-5 text-rose-400" />}
                {activePrompt.type === 'camp' && <Tent className="w-5 h-5 text-emerald-400" />}
                {activePrompt.type === 'shop' && <ShoppingBag className="w-5 h-5 text-sky-400" />}
                {activePrompt.type === 'chest' && <Sparkles className="w-5 h-5 text-amber-400" />}
                {activePrompt.type === 'event' && <HelpCircle className="w-5 h-5 text-purple-400" />}
                {activePrompt.type === 'portal' && <Compass className="w-5 h-5 text-indigo-400" />}
                <span>{activePrompt.text}</span>
              </div>
              {activePrompt.subText && (
                <div className="text-xs text-slate-300 mt-1">{activePrompt.subText}</div>
              )}
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-white/20 border border-white/30 text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
              <span>立即行動</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Bottom Left: Mobile Dynamic Virtual Joystick */}
      <div
        ref={joystickBaseRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute bottom-5 left-5 z-30 w-28 h-28 rounded-full bg-slate-900/80 backdrop-blur-md border-2 border-slate-700/80 shadow-2xl flex items-center justify-center touch-none select-none active:border-rose-500 transition-colors"
      >
        <div className="absolute w-full h-[1px] bg-slate-800 pointer-events-none" />
        <div className="absolute h-full w-[1px] bg-slate-800 pointer-events-none" />

        <div
          ref={joystickKnobRef}
          className={`w-12 h-12 rounded-full border-2 shadow-lg transition-transform pointer-events-none flex items-center justify-center ${
            isJoystickActive
              ? 'bg-gradient-to-br from-rose-500 to-rose-600 border-white ring-4 ring-rose-500/40'
              : 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-500'
          }`}
          style={{
            transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
          }}
        >
          <div className="w-3 h-3 rounded-full bg-white/80" />
        </div>
      </div>

      {/* Bottom Right: Quick Interaction Action Button */}
      {activePrompt ? (
        <div className="absolute bottom-6 right-6 z-30">
          <button
            onClick={activePrompt.action}
            className={`px-6 py-4 rounded-2xl font-bold text-base shadow-2xl flex items-center gap-2.5 text-white border transition-all active:scale-95 cursor-pointer ${
              activePrompt.type === 'boss' || activePrompt.type === 'enemy'
                ? 'bg-rose-600 hover:bg-rose-500 border-rose-400 ring-4 ring-rose-500/40 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 ring-4 ring-emerald-500/40'
            }`}
          >
            <Swords className="w-5 h-5" />
            <span>
              {activePrompt.type === 'boss'
                ? '挑戰首領！'
                : activePrompt.type === 'enemy'
                ? '接觸開戰！'
                : '立即確認'}
            </span>
          </button>
        </div>
      ) : (
        <div className="absolute bottom-6 right-6 z-20 pointer-events-none hidden sm:block">
          <div className="px-4 py-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-xs text-slate-400">
            操控走位可閃避敵人追擊 · 碰撞或點擊交戰
          </div>
        </div>
      )}

      {/* Bottom Instruction Pill */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[10px] text-slate-400 bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 pointer-events-none hidden md:block">
        WASD/方向鍵或虛擬搖桿操控 · 靠近敵人會發起追擊可走位閃躲 · 營火寶箱商人隨機出現
      </div>
    </div>
  );
};

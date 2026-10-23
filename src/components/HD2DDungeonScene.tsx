import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DungeonNode, PokemonInstance, Item } from '../types/pokemon';
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
  Footprints,
  Compass,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  AlertTriangle,
} from 'lucide-react';

interface HD2DDungeonSceneProps {
  currentFloor: number;
  totalFloors: number;
  nodes: DungeonNode[];
  leadPokemon?: PokemonInstance;
  playerPartyLevel: number;
  onTriggerBattle: (node: DungeonNode) => void;
  onOpenCamp: () => void;
  onOpenShop: () => void;
  onTriggerEvent: (eventId: string) => void;
  onAdvanceFloor: () => void;
  onLootChest: (coins: number, item?: Item) => void;
  dangerLevel: number;
  setDangerLevel: React.Dispatch<React.SetStateAction<number>>;
  hasLootedChest: boolean;
  setHasLootedChest: (looted: boolean) => void;
}

export const HD2DDungeonScene: React.FC<HD2DDungeonSceneProps> = ({
  currentFloor,
  totalFloors,
  nodes,
  leadPokemon,
  playerPartyLevel,
  onTriggerBattle,
  onOpenCamp,
  onOpenShop,
  onTriggerEvent,
  onAdvanceFloor,
  onLootChest,
  dangerLevel,
  setDangerLevel,
  hasLootedChest,
  setHasLootedChest,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Active interaction prompt in UI
  const [activePrompt, setActivePrompt] = useState<{
    text: string;
    subText?: string;
    type: 'boss' | 'camp' | 'shop' | 'event' | 'chest' | 'portal';
    action: () => void;
  } | null>(null);

  // Encounter flash effect
  const [encounterAlert, setEncounterAlert] = useState<boolean>(false);
  const [inGrass, setInGrass] = useState<boolean>(false);

  // Control keys state
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const virtualMovement = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  // Player position in 3D world
  const playerPos = useRef<{ x: number; z: number; vx: number; vz: number }>({
    x: 0,
    z: 14,
    vx: 0,
    vz: 0,
  });

  // Click destination marker
  const clickTarget = useRef<{ x: number; z: number; active: boolean }>({
    x: 0,
    z: 0,
    active: false,
  });

  // Track step accumulation for "踩地雷"
  const stepAccumulator = useRef<number>(0);
  const isEncounterTriggered = useRef<boolean>(false);

  // Boss node resolution
  const bossNode = nodes.find((n) => n.type === 'boss') || (currentFloor % 3 === 0
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
    : null);

  const getSpriteUrl = (pkm?: PokemonInstance) => {
    if (!pkm) return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';
    const dexNo = pkm.pokedexNo || POKEMON_SPECIES[pkm.speciesId]?.pokedexNo || 25;
    return pkm.isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${dexNo}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNo}.png`;
  };

  // Trigger random step encounter ("踩地雷")
  const triggerRandomEncounter = useCallback(() => {
    if (isEncounterTriggered.current) return;
    isEncounterTriggered.current = true;
    sound.playSelect();
    setEncounterAlert(true);

    setTimeout(() => {
      // Find an existing battle/trainer node or generate a wild battle node
      const battleNode =
        nodes.find((n) => n.type === 'battle' || n.type === 'trainer') || {
          id: `step_encounter_${Date.now()}`,
          floor: currentFloor,
          type: 'battle' as const,
          title: '突發野生遭遇！',
          description: '在草叢暗影中躍出的野生寶可夢！',
          completed: false,
          accessible: true,
          wildPokemon: generateWildPokemon(currentFloor, playerPartyLevel),
          connectedNextNodeIds: [],
        };

      // Reset danger level for next exploration
      setDangerLevel(0);
      onTriggerBattle(battleNode);
    }, 600);
  }, [currentFloor, nodes, onTriggerBattle, playerPartyLevel, setDangerLevel]);

  // Main Three.js Scene Setup & Animation Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Atmosphere
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080b12);
    scene.fog = new THREE.FogExp2(0x080b12, 0.038);

    // 2. Camera (HD-2D Isometric / Third-Person tilt)
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 11, 24);
    camera.lookAt(0, 0.5, 14);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 4. PMREM Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 5. Lighting Setup
    const ambientLight = new THREE.HemisphereLight(0x28324a, 0x090d16, 1.3);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffecd0, 1.8);
    sunLight.position.set(12, 22, 16);
    sunLight.castShadow = !isSoftwareGl;
    if (sunLight.castShadow) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 60;
      sunLight.shadow.camera.left = -20;
      sunLight.shadow.camera.right = 20;
      sunLight.shadow.camera.top = 25;
      sunLight.shadow.camera.bottom = -25;
      sunLight.shadow.bias = -0.0006;
    }
    scene.add(sunLight);

    // 6. Ground Geometry (Flagstone Floor)
    const floorTex = createStoneFloorTexture();
    floorTex.repeat.set(10, 14);
    floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const floorGeo = new THREE.PlaneGeometry(36, 44);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.85,
      metalness: 0.12,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    // 7. Perimeter Stone Walls
    const wallTex = createStoneWallTexture();
    wallTex.repeat.set(8, 2);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92 });

    // North Sanctum Wall
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(36, 6, 1.5), wallMat);
    northWall.position.set(0, 3, -21.5);
    northWall.receiveShadow = !isSoftwareGl;
    scene.add(northWall);

    // South Entrance Wall
    const southWall = new THREE.Mesh(new THREE.BoxGeometry(36, 5, 1.5), wallMat);
    southWall.position.set(0, 2.5, 21.5);
    southWall.receiveShadow = !isSoftwareGl;
    scene.add(southWall);

    // West & East Side Walls
    const westWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5, 44), wallMat);
    westWall.position.set(-17.5, 2.5, 0);
    westWall.receiveShadow = !isSoftwareGl;
    scene.add(westWall);

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5, 44), wallMat);
    eastWall.position.set(17.5, 2.5, 0);
    eastWall.receiveShadow = !isSoftwareGl;
    scene.add(eastWall);

    // 8. Ancient Ruin Columns & Wall Sconces with Dynamic PointLights
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

      // Base pedestal
      const baseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1.0, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x242d3d, roughness: 0.8 })
      );
      baseMesh.position.y = 0.3;
      baseMesh.castShadow = !isSoftwareGl;
      baseMesh.receiveShadow = !isSoftwareGl;
      colGroup.add(baseMesh);

      // Main shaft
      const shaftMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 4.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x1f2735, roughness: 0.9 })
      );
      shaftMesh.position.y = 2.4;
      shaftMesh.castShadow = !isSoftwareGl;
      shaftMesh.receiveShadow = !isSoftwareGl;
      colGroup.add(shaftMesh);

      // Capital
      const capMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.5, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x242d3d, roughness: 0.85 })
      );
      capMesh.position.y = 4.6;
      capMesh.castShadow = !isSoftwareGl;
      colGroup.add(capMesh);

      // Torch Bracket & Flame
      const torchSconce = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.4, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 })
      );
      const isWest = pos.x < 0;
      torchSconce.position.set(isWest ? 0.75 : -0.75, 2.7, 0);
      colGroup.add(torchSconce);

      const flameMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.85), flameMat);
      flameMesh.position.set(isWest ? 0.85 : -0.85, 3.15, 0);
      colGroup.add(flameMesh);

      const pLight = new THREE.PointLight(0xff8c38, 2.2, 9, 1.4);
      pLight.position.set(isWest ? 0.95 : -0.95, 3.15, 0);
      colGroup.add(pLight);

      torchLights.push({ light: pLight, flame: flameMesh, baseIntensity: 2.2 });
      scene.add(colGroup);
    });

    // 9. Tall Grass Patches (踩地雷核心區域)
    const grassTex = createGrassTexture();
    const grassMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      transparent: true,
      alphaTest: 0.25,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });

    // 2 Large Tall Grass Zones
    const grassZones = [
      { minX: -13, maxX: -4, minZ: -4, maxZ: 7, count: 42 },
      { minX: 4, maxX: 13, minZ: -7, maxZ: 4, count: 42 },
    ];

    const grassMeshes: THREE.Mesh[] = [];

    grassZones.forEach((gz) => {
      // Grass patch dark moss bed on the ground
      const bedGeo = new THREE.PlaneGeometry(gz.maxX - gz.minX, gz.maxZ - gz.minZ);
      const bedMat = new THREE.MeshBasicMaterial({
        color: 0x0f2416,
        transparent: true,
        opacity: 0.5,
      });
      const bedMesh = new THREE.Mesh(bedGeo, bedMat);
      bedMesh.rotation.x = -Math.PI / 2;
      bedMesh.position.set(
        (gz.minX + gz.maxX) / 2,
        0.02,
        (gz.minZ + gz.maxZ) / 2
      );
      scene.add(bedMesh);

      // Plant 3D Grass Tufts
      for (let i = 0; i < gz.count; i++) {
        const gx = gz.minX + Math.random() * (gz.maxX - gz.minX);
        const gzPos = gz.minZ + Math.random() * (gz.maxZ - gz.minZ);
        const scale = 0.8 + Math.random() * 0.45;

        const tuftGroup = new THREE.Group();
        tuftGroup.position.set(gx, 0, gzPos);

        const gMesh1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * scale, 1.1 * scale), grassMat);
        gMesh1.position.y = (1.1 * scale) / 2;
        gMesh1.rotation.y = Math.random() * Math.PI;

        const gMesh2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * scale, 1.1 * scale), grassMat);
        gMesh2.position.y = (1.1 * scale) / 2;
        gMesh2.rotation.y = gMesh1.rotation.y + Math.PI / 2;

        tuftGroup.add(gMesh1);
        tuftGroup.add(gMesh2);
        scene.add(tuftGroup);
        grassMeshes.push(gMesh1, gMesh2);
      }
    });

    // 10. Boss Sanctum Dais & Boss Physical Entity ("只有頭目是有實體目標的")
    let bossAuraMesh: THREE.Mesh | undefined;
    let bossSpriteMesh: THREE.Mesh | undefined;
    const bossPosition = { x: 0, y: 0.6, z: -15.5 };

    // Stone Dais
    const daisGroup = new THREE.Group();
    daisGroup.position.set(bossPosition.x, 0, bossPosition.z);

    const daisBase = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.6, 0.6, 24),
      new THREE.MeshStandardMaterial({
        map: createStoneFloorTexture(),
        roughness: 0.8,
      })
    );
    daisBase.position.y = 0.3;
    daisBase.receiveShadow = !isSoftwareGl;
    daisGroup.add(daisBase);

    // Magic Rune Disc on dais
    const runeTex = createBattlePedestalTexture('#e11d48');
    const runeDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 7.2),
      new THREE.MeshStandardMaterial({
        map: runeTex,
        transparent: true,
        roughness: 0.6,
      })
    );
    runeDisc.rotation.x = -Math.PI / 2;
    runeDisc.position.y = 0.61;
    daisGroup.add(runeDisc);

    // 2 Braziers flanking the boss dais
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

    // ONLY THE BOSS HAS A PHYSICAL VISIBLE ENTITY!
    if (bossNode) {
      const bossPkm = bossNode.trainer?.team[0] || createPokemon('onix', 10, false);
      const bossSpriteUrl = getSpriteUrl(bossPkm);

      // Swirling Boss Dark/Fire Aura Ring
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

      // Boss 2D Billboard Sprite
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

      // Boss Overhead Nameplate Billboard
      const nameplateCanvas = document.createElement('canvas');
      nameplateCanvas.width = 384;
      nameplateCanvas.height = 96;
      const npCtx = nameplateCanvas.getContext('2d')!;
      npCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
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
      npCtx.fillText(`Lv.${bossPkm.level} · 靠近即刻決戰`, 192, 66);

      const npTex = new THREE.CanvasTexture(nameplateCanvas);
      npTex.colorSpace = THREE.SRGBColorSpace;
      const npMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 0.8),
        new THREE.MeshBasicMaterial({ map: npTex, transparent: true })
      );
      npMesh.position.set(bossPosition.x, bossPosition.y + 3.8, bossPosition.z);
      scene.add(npMesh);
    }

    // 11. Descent Portal / Stairs to Next Floor
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

    // Stone Portal Arch
    const archMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const leftArch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.5, 0.8), archMat);
    leftArch.position.set(-2.2, 2.2, -19.5);
    scene.add(leftArch);
    const rightArch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.5, 0.8), archMat);
    rightArch.position.set(2.2, 2.2, -19.5);
    scene.add(rightArch);
    const topArch = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.8, 1.0), archMat);
    topArch.position.set(0, 4.6, -19.5);
    scene.add(topArch);

    // 12. Interactive Props: Campfire, Merchant Stall, Stele, Treasure Chest
    const campPosition = { x: -11, y: 0, z: 10 };
    const shopPosition = { x: 11, y: 0, z: 10 };
    const stelePosition = { x: -11, y: 0, z: -10 };
    const chestPosition = { x: 11, y: 0, z: -10 };

    // Campfire Model
    const campGroup = new THREE.Group();
    campGroup.position.set(campPosition.x, campPosition.y, campPosition.z);
    // Stone ring
    const cRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.22, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })
    );
    cRing.rotation.x = -Math.PI / 2;
    cRing.position.y = 0.15;
    campGroup.add(cRing);
    // Wood logs
    const logGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95 });
    const log1 = new THREE.Mesh(logGeo, logMat);
    log1.rotation.z = Math.PI / 4;
    log1.position.y = 0.25;
    campGroup.add(log1);
    const log2 = new THREE.Mesh(logGeo, logMat);
    log2.rotation.x = Math.PI / 4;
    log2.position.y = 0.25;
    campGroup.add(log2);
    // Fire flame & Light
    const cFlame = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), flameMat);
    cFlame.position.y = 0.85;
    campGroup.add(cFlame);
    const cLight = new THREE.PointLight(0xf97316, 2.8, 8, 1.5);
    cLight.position.y = 1.0;
    campGroup.add(cLight);
    torchLights.push({ light: cLight, flame: cFlame, baseIntensity: 2.8 });
    scene.add(campGroup);

    // Merchant Stall Model
    const shopGroup = new THREE.Group();
    shopGroup.position.set(shopPosition.x, shopPosition.y, shopPosition.z);
    // Counter
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
    );
    counter.position.y = 0.55;
    shopGroup.add(counter);
    // Awning roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.25, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 })
    );
    roof.position.y = 2.4;
    shopGroup.add(roof);
    // Hanging Lantern
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.5, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.8 })
    );
    lantern.position.set(0.9, 1.9, 0.6);
    shopGroup.add(lantern);
    const sLight = new THREE.PointLight(0x38bdf8, 2.0, 7, 1.4);
    sLight.position.set(0.9, 1.9, 0.6);
    shopGroup.add(sLight);
    scene.add(shopGroup);

    // Ancient Mystery Stele Model
    const steleGroup = new THREE.Group();
    steleGroup.position.set(stelePosition.x, stelePosition.y, stelePosition.z);
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
    const stLight = new THREE.PointLight(0x06b6d4, 1.8, 6, 1.4);
    stLight.position.y = 2.0;
    steleGroup.add(stLight);
    scene.add(steleGroup);

    // Treasure Chest Model
    let chestLidMesh: THREE.Mesh | undefined;
    const chestGroup = new THREE.Group();
    chestGroup.position.set(chestPosition.x, chestPosition.y, chestPosition.z);

    const chestBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.7, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8, metalness: 0.2 })
    );
    chestBase.position.y = 0.35;
    chestBase.castShadow = !isSoftwareGl;
    chestGroup.add(chestBase);

    // Chest Lid
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

    // 13. Floating Atmospheric Dust & Firefly Sparkles
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount; p++) {
      particlePositions[p * 3] = (Math.random() - 0.5) * 32;
      particlePositions[p * 3 + 1] = 0.4 + Math.random() * 4.5;
      particlePositions[p * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffd27d,
      size: 0.22,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 14. Player Billboard Sprite & Contact Shadow
    const playerGroup = new THREE.Group();
    playerGroup.position.set(playerPos.current.x, 0, playerPos.current.z);

    // Contact Shadow
    const shadowTex = createContactShadowTexture();
    const pShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      })
    );
    pShadow.rotation.x = -Math.PI / 2;
    pShadow.position.y = 0.03;
    playerGroup.add(pShadow);

    // Player Sprite
    const playerSpriteUrl = getSpriteUrl(leadPokemon);
    let playerSpriteMesh: THREE.Mesh | undefined;
    const pTexLoader = new THREE.TextureLoader();
    pTexLoader.load(playerSpriteUrl, (tex) => {
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

    // Exclamation Mark `!` over player for encounters
    const alertCanvas = document.createElement('canvas');
    alertCanvas.width = 64;
    alertCanvas.height = 64;
    const aCtx = alertCanvas.getContext('2d')!;
    aCtx.fillStyle = '#ef4444';
    aCtx.beginPath();
    aCtx.arc(32, 32, 28, 0, Math.PI * 2);
    aCtx.fill();
    aCtx.fillStyle = '#ffffff';
    aCtx.font = 'bold 40px sans-serif';
    aCtx.textAlign = 'center';
    aCtx.textBaseline = 'middle';
    aCtx.fillText('!', 32, 34);

    const alertTex = new THREE.CanvasTexture(alertCanvas);
    const alertMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshBasicMaterial({ map: alertTex, transparent: true })
    );
    alertMesh.position.set(0, 2.4, 0);
    alertMesh.visible = false;
    playerGroup.add(alertMesh);

    scene.add(playerGroup);

    // 15. Click Destination Ripple Ring
    const clickRingGeo = new THREE.RingGeometry(0.3, 0.45, 24);
    const clickRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const clickRingMesh = new THREE.Mesh(clickRingGeo, clickRingMat);
    clickRingMesh.rotation.x = -Math.PI / 2;
    clickRingMesh.position.y = 0.05;
    clickRingMesh.visible = false;
    scene.add(clickRingMesh);

    // Click on ground raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

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

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // 16. Keyboard Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 17. Animation & Physics Loop
    let clock = new THREE.Clock();
    let animFrameId: number;
    let walkTimer = 0;

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // Torch flame flickers & light oscillation
      torchLights.forEach((tl, i) => {
        const noise = Math.sin(time * 8 + i * 2.3) * 0.2 + Math.sin(time * 15 + i) * 0.15;
        tl.light.intensity = tl.baseIntensity + noise;
        tl.flame.scale.set(1 + noise * 0.2, 1 + noise * 0.35, 1);
      });

      // Boss aura swirling rotation
      if (bossAuraMesh) {
        bossAuraMesh.rotation.z = time * 0.8;
      }

      // Portal vortex pulsing
      portalMesh.rotation.z = -time * 0.6;
      portalMesh.scale.setScalar(1 + Math.sin(time * 3) * 0.08);

      // Grass tufts gentle wind sway
      grassMeshes.forEach((g, idx) => {
        g.rotation.z = Math.sin(time * 2.5 + idx * 0.4) * 0.08;
      });

      // Floating dust particles drifting upwards
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let p = 0; p < particleCount; p++) {
        positions[p * 3 + 1] += delta * 0.35;
        if (positions[p * 3 + 1] > 5.5) {
          positions[p * 3 + 1] = 0.3;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Handle Player Movement Input
      if (!isEncounterTriggered.current) {
        let moveX = 0;
        let moveZ = 0;

        if (keysPressed.current['w'] || keysPressed.current['arrowup']) moveZ -= 1;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) moveZ += 1;
        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) moveX -= 1;
        if (keysPressed.current['d'] || keysPressed.current['arrowright']) moveX += 1;

        // Merge virtual D-Pad / joystick
        if (virtualMovement.current.x !== 0 || virtualMovement.current.z !== 0) {
          moveX += virtualMovement.current.x;
          moveZ += virtualMovement.current.z;
        }

        // Merge click-to-move target
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
          // Cancel click target if keys pressed
          if (keysPressed.current['w'] || keysPressed.current['s'] || keysPressed.current['a'] || keysPressed.current['d']) {
            clickTarget.current.active = false;
            clickRingMesh.visible = false;
          }

          const length = Math.hypot(moveX, moveZ);
          const normX = moveX / length;
          const normZ = moveZ / length;
          const speed = 7.2;

          playerPos.current.vx = normX * speed;
          playerPos.current.vz = normZ * speed;

          const nextX = playerPos.current.x + playerPos.current.vx * delta;
          const nextZ = playerPos.current.z + playerPos.current.vz * delta;

          // Dungeon Bounds Collision
          playerPos.current.x = Math.max(-14.2, Math.min(14.2, nextX));
          playerPos.current.z = Math.max(-18.5, Math.min(18.5, nextZ));

          walkTimer += delta;

          // Sprite directional facing flip
          if (playerSpriteMesh) {
            if (normX < -0.15) {
              playerSpriteMesh.scale.x = -Math.abs(playerSpriteMesh.scale.x);
            } else if (normX > 0.15) {
              playerSpriteMesh.scale.x = Math.abs(playerSpriteMesh.scale.x);
            }
            // Walking bobbing
            playerSpriteMesh.position.y = 0.9 + Math.abs(Math.sin(walkTimer * 12)) * 0.18;
          }

          // Check if player is currently in tall grass
          const px = playerPos.current.x;
          const pz = playerPos.current.z;
          const insideGrass = grassZones.some(
            (gz) => px >= gz.minX && px <= gz.maxX && pz >= gz.minZ && pz <= gz.maxZ
          );
          setInGrass(insideGrass);

          // Accumulate steps for "踩地雷" encounter check
          const distStep = Math.hypot(playerPos.current.vx * delta, playerPos.current.vz * delta);
          stepAccumulator.current += distStep;

          if (stepAccumulator.current >= 0.8) {
            stepAccumulator.current = 0;
            // Add danger
            const dangerInc = insideGrass ? 6.5 + Math.random() * 3 : 1.8 + Math.random() * 1.5;
            setDangerLevel((prev) => {
              const updated = Math.min(100, prev + dangerInc);
              // Encounter roll
              const encounterChance = (updated / 100) * (insideGrass ? 0.35 : 0.15);
              if (updated >= 100 || (updated > 30 && Math.random() < encounterChance)) {
                triggerRandomEncounter();
              }
              return updated;
            });
          }
        } else {
          // Idle breathing
          if (playerSpriteMesh) {
            playerSpriteMesh.position.y = 0.9 + Math.sin(time * 3) * 0.04;
          }
        }
      }

      // Synchronize player 3D group position
      playerGroup.position.set(playerPos.current.x, 0, playerPos.current.z);

      // Camera smooth follow (HD-2D isometric angle)
      const targetCamX = playerPos.current.x;
      const targetCamY = 10.5;
      const targetCamZ = playerPos.current.z + 12.5;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 4.0, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 4.0, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 4.0, delta);
      camera.lookAt(playerPos.current.x, 1.2, playerPos.current.z);

      // Billboards face camera
      if (playerSpriteMesh) {
        playerSpriteMesh.quaternion.copy(camera.quaternion);
      }
      if (bossSpriteMesh) {
        bossSpriteMesh.quaternion.copy(camera.quaternion);
      }

      // Proximity Interaction Detection
      const px = playerPos.current.x;
      const pz = playerPos.current.z;

      // 1. Boss confrontation
      const distToBoss = Math.hypot(px - bossPosition.x, pz - bossPosition.z);
      if (bossNode && distToBoss <= 3.4) {
        setActivePrompt({
          text: `【挑戰首領】${bossNode.trainer?.name || '深層守護者'}`,
          subText: '直面聖域的強大試煉，按 E 或點擊展開決戰！',
          type: 'boss',
          action: () => {
            sound.playSelect();
            onTriggerBattle(bossNode);
          },
        });
      }
      // 2. Campfire rest
      else if (Math.hypot(px - campPosition.x, pz - campPosition.z) <= 2.6) {
        setActivePrompt({
          text: '【營火修憩】甘甜泉水與溫暖營火',
          subText: '回復全體隊伍 HP 與招式 PP，按 E 進入休整',
          type: 'camp',
          action: () => {
            sound.playSelect();
            onOpenCamp();
          },
        });
      }
      // 3. Wandering Merchant Shop
      else if (Math.hypot(px - shopPosition.x, pz - shopPosition.z) <= 2.6) {
        setActivePrompt({
          text: '【流浪商人】友誼補給商店',
          subText: '使用金幣購買精靈球與藥水道具，按 E 瀏覽',
          type: 'shop',
          action: () => {
            sound.playSelect();
            onOpenShop();
          },
        });
      }
      // 4. Ancient Stele
      else if (Math.hypot(px - stelePosition.x, pz - stelePosition.z) <= 2.6) {
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
      }
      // 5. Treasure Chest
      else if (!hasLootedChest && Math.hypot(px - chestPosition.x, pz - chestPosition.z) <= 2.4) {
        setActivePrompt({
          text: '【古代寶箱】神秘的地牢密寶',
          subText: '按 E 開啟拾取金幣與道具！',
          type: 'chest',
          action: () => {
            sound.playSelect();
            setHasLootedChest(true);
            if (chestLidMesh) {
              chestLidMesh.rotation.x = -Math.PI / 3;
            }
            const earnedCoins = Math.floor(Math.random() * 50) + 50;
            const itemReward = Math.random() > 0.5 ? ITEMS.potion : ITEMS.oran_berry;
            onLootChest(earnedCoins, itemReward);
          },
        });
      }
      // 6. Descent Portal to Next Floor
      else if (Math.hypot(px - portalPosition.x, pz - portalPosition.z) <= 2.8) {
        setActivePrompt({
          text: `【聖域傳送門】前往第 ${currentFloor + 1} 層階梯`,
          subText: bossNode ? '首領強大的威壓籠罩著傳送門！' : '按 E 前往下一層地牢探索',
          type: 'portal',
          action: () => {
            sound.playSelect();
            onAdvanceFloor();
          },
        });
      } else {
        setActivePrompt(null);
      }

      // Handle [E] key for active prompt
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

    // Resize Handler
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
      renderer.domElement.removeEventListener('click', handleCanvasClick);
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
    triggerRandomEncounter,
    onAdvanceFloor,
    onLootChest,
    onOpenCamp,
    onOpenShop,
    onTriggerBattle,
    onTriggerEvent,
    setDangerLevel,
    setHasLootedChest,
  ]);

  return (
    <div className="relative w-full h-[620px] md:h-[720px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-crosshair" />

      {/* White Flash Encounter Overlay */}
      {encounterAlert && (
        <div className="absolute inset-0 z-50 bg-white animate-ping opacity-90 flex items-center justify-center pointer-events-none">
          <div className="text-4xl md:text-6xl font-black text-rose-600 tracking-widest drop-shadow-lg">
            ⚔️ 野生寶可夢遭遇！
          </div>
        </div>
      )}

      {/* Top Left: Floor Status & Danger Meter */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-sm">
        {/* Floor & Grass Alert */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs shadow-lg">
          <Compass className="w-4 h-4 text-rose-400" />
          <span className="font-bold text-white">第 {currentFloor} 層 · 地底迴廊</span>
          {inGrass && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
              🌿 草叢隱蔽中 (+遭遇率)
            </span>
          )}
        </div>

        {/* 踩地雷危險警戒條 (Encounter Danger Gauge) */}
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-lg">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1 font-semibold text-slate-300">
              <Footprints className="w-3.5 h-3.5 text-amber-400" />
              <span>步數遭遇警戒 (踩地雷)</span>
            </span>
            <span
              className={`font-mono font-bold ${
                dangerLevel > 70
                  ? 'text-rose-400 animate-pulse'
                  : dangerLevel > 40
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {Math.round(dangerLevel)}%
            </span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2 p-0.5 border border-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                dangerLevel > 70
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse'
                  : dangerLevel > 40
                  ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${dangerLevel}%` }}
            />
          </div>
          <div className="text-[9px] text-slate-400 mt-1 flex items-center justify-between">
            <span>穿過草叢遭遇機率大增</span>
            <span>只有首領有實體目標</span>
          </div>
        </div>
      </div>

      {/* Top Right: Exploration Legend */}
      <div className="hidden sm:flex absolute top-4 right-4 z-20 flex-col gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-[11px] text-slate-300 shadow-lg">
        <div className="font-bold text-white text-xs mb-0.5 flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          <span>地牢目標導航</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>【深處首領】道館霸主/傳說神獸</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>【地底營火】全隊恢復</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>【友誼商店】道具補給</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>【古代寶箱】拾取金幣道具</span>
        </div>
      </div>

      {/* Bottom Center: Contextual Interaction Banner (near interactable) */}
      {activePrompt && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-md w-full px-4 animate-bounce">
          <button
            onClick={activePrompt.action}
            className={`w-full p-4 rounded-2xl backdrop-blur-md shadow-2xl border text-left flex items-center justify-between transition-transform active:scale-95 cursor-pointer ${
              activePrompt.type === 'boss'
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

            <div className="px-3 py-1.5 rounded-xl bg-white/20 border border-white/30 text-xs font-bold text-white uppercase tracking-wider">
              按 E 互動
            </div>
          </button>
        </div>
      )}

      {/* Bottom Left: Touch Virtual D-Pad (for mobile & mouse) */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-col items-center select-none opacity-85 hover:opacity-100 transition-opacity">
        <button
          onMouseDown={() => (virtualMovement.current.z = -1)}
          onMouseUp={() => (virtualMovement.current.z = 0)}
          onTouchStart={() => (virtualMovement.current.z = -1)}
          onTouchEnd={() => (virtualMovement.current.z = 0)}
          className="w-11 h-11 rounded-t-xl bg-slate-900/90 hover:bg-slate-800 active:bg-rose-600 text-slate-200 border border-slate-700 flex items-center justify-center shadow-lg cursor-pointer"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
        <div className="flex gap-1 my-1">
          <button
            onMouseDown={() => (virtualMovement.current.x = -1)}
            onMouseUp={() => (virtualMovement.current.x = 0)}
            onTouchStart={() => (virtualMovement.current.x = -1)}
            onTouchEnd={() => (virtualMovement.current.x = 0)}
            className="w-11 h-11 rounded-l-xl bg-slate-900/90 hover:bg-slate-800 active:bg-rose-600 text-slate-200 border border-slate-700 flex items-center justify-center shadow-lg cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="w-11 h-11 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
            移動
          </div>
          <button
            onMouseDown={() => (virtualMovement.current.x = 1)}
            onMouseUp={() => (virtualMovement.current.x = 0)}
            onTouchStart={() => (virtualMovement.current.x = 1)}
            onTouchEnd={() => (virtualMovement.current.x = 0)}
            className="w-11 h-11 rounded-r-xl bg-slate-900/90 hover:bg-slate-800 active:bg-rose-600 text-slate-200 border border-slate-700 flex items-center justify-center shadow-lg cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        <button
          onMouseDown={() => (virtualMovement.current.z = 1)}
          onMouseUp={() => (virtualMovement.current.z = 0)}
          onTouchStart={() => (virtualMovement.current.z = 1)}
          onTouchEnd={() => (virtualMovement.current.z = 0)}
          className="w-11 h-11 rounded-b-xl bg-slate-900/90 hover:bg-slate-800 active:bg-rose-600 text-slate-200 border border-slate-700 flex items-center justify-center shadow-lg cursor-pointer"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Right: Quick Interaction / Confront Action Button */}
      {activePrompt && (
        <div className="absolute bottom-4 right-4 z-20">
          <button
            onClick={activePrompt.action}
            className={`px-5 py-3 rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 text-white border transition-all active:scale-95 cursor-pointer ${
              activePrompt.type === 'boss'
                ? 'bg-rose-600 hover:bg-rose-500 border-rose-400 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400'
            }`}
          >
            <Swords className="w-5 h-5" />
            <span>【E】{activePrompt.type === 'boss' ? '挑戰首領！' : '行動確認'}</span>
          </button>
        </div>
      )}

      {/* Bottom Bar: Instructions */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[11px] text-slate-400 bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 pointer-events-none hidden md:block">
        WASD / 方向鍵移動 · 點擊地面可尋路 · 走進草叢累積遭遇值 · 靠近首領決戰
      </div>
    </div>
  );
};

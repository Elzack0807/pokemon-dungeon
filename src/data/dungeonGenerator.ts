import { DungeonNode, DungeonNodeType, Trainer, MysteryEvent, PokemonInstance } from '../types/pokemon';
import { createPokemon } from './pokemonData';
import { ITEMS } from './itemsData';
import { HD2D_DIORAMA_ASSET_PACK, HD2D_TILE_MAP, HD2D_TILE_ID_MAP, HD2DTileDefinition } from './hd2dDioramaAssetPack';

export const MYSTERY_EVENTS: MysteryEvent[] = [
  {
    id: 'fossil_altar',
    titleZh: '古老化石祭壇',
    storyZh: '在地牢岩壁的凹陷處，你發現了一座閃爍著微光的古老化石祭壇。周圍散發出神秘的遠古能量。',
    options: [
      {
        labelZh: '觸碰祭壇祈求力量',
        descriptionZh: '有機會使全體寶可夢攻擊力大幅增強，或遭到遠古詛咒損失 15% HP。',
        outcomeType: 'gamble',
      },
      {
        labelZh: '挖掘祭壇邊緣的碎石',
        descriptionZh: '拾取埋藏在地底的 80 枚古代寶可夢金幣。',
        outcomeType: 'coins',
      },
      {
        labelZh: '在此靜坐冥想',
        descriptionZh: '全體出戰隊伍回復 40% 的生命值與招式 PP。',
        outcomeType: 'heal',
      },
    ],
  },
  {
    id: 'wandering_chansey',
    titleZh: '迷路的野生吉利蛋',
    storyZh: '一隻友善的野生吉利蛋提著蛋袋，怯生生地看著你們。她似乎在地牢裡迷失了方向。',
    options: [
      {
        labelZh: '分享樹果並安撫她',
        descriptionZh: '吉利蛋贈送稀有的「全滿藥」與「文柚果」作為感謝！',
        outcomeType: 'item',
      },
      {
        labelZh: '接受吉利蛋的生蛋祝福',
        descriptionZh: '隊伍中所有的寶可夢 HP 完全回復，並解除全部異常狀態！',
        outcomeType: 'heal',
      },
      {
        labelZh: '護送吉利蛋前往出口',
        descriptionZh: '獲得吉利蛋留下的 120 枚感謝金幣。',
        outcomeType: 'coins',
      },
    ],
  },
  {
    id: 'meowth_gambler',
    titleZh: '喵喵的地下金幣黑市',
    storyZh: '一隻穿著大衣、叼著硬幣的火箭隊喵喵對你使了個眼色：「嘿嘿，冒險者，要來玩一把聚寶功老虎機嗎？」',
    options: [
      {
        labelZh: '下注 40 金幣賭一把',
        descriptionZh: '有 65% 機率贏得 120 金幣，35% 機率打水漂！',
        outcomeType: 'gamble',
      },
      {
        labelZh: '購買神秘盲盒道具 (60 金幣)',
        descriptionZh: '必定獲得一件隨機的高級攜帶道具或高級精靈球。',
        outcomeType: 'item',
      },
      {
        labelZh: '拒絕並禮貌離開',
        descriptionZh: '相安無事，繼續探索地牢。',
        outcomeType: 'heal',
      },
    ],
  },
  {
    id: 'shiny_fountain',
    titleZh: '七彩閃光晶泉',
    storyZh: '地牢幽暗深處有一眼七彩流光的泉水，水波中倒映出星芒般的奇蹟火花。',
    options: [
      {
        labelZh: '讓隊首寶可夢飲用泉水',
        descriptionZh: '獲得極高的閃光奇蹟親和力，永久提升暴擊率與全屬性！',
        outcomeType: 'curse_buff',
      },
      {
        labelZh: '灌滿隨身水壺',
        descriptionZh: '獲得珍稀的「萬靈藥劑」道具。',
        outcomeType: 'item',
      },
      {
        labelZh: '沐浴洗滌疲憊',
        descriptionZh: '全隊 HP 完全回復！',
        outcomeType: 'heal',
      },
    ],
  },
];

export function generateTrainer(floor: number, isBoss: boolean = false, playerPartyLevel: number = 5): Trainer {
  const bossLevel = Math.max(16, playerPartyLevel + 15);
  const regularLevel = Math.max(2, playerPartyLevel);

  if (isBoss) {
    if (floor <= 3) {
      return {
        id: 'boss_brock',
        name: '小剛 (Brock)',
        title: '深灰道館館主',
        titleZh: '道館館主',
        isBoss: true,
        dialogueBefore: '「我的意志如磐石般堅不可摧！展示你的戰術吧！」',
        dialogueWin: '「漂亮的戰術！這枚岩石徽章與獎金是你的證明！」',
        rewardCoins: 220,
        rewardItem: ITEMS.leftovers,
        team: [
          createPokemon('onix', bossLevel, false),
        ],
      };
    } else if (floor <= 6) {
      return {
        id: 'boss_misty',
        name: '小霞 (Misty)',
        title: '華藍道館館主',
        titleZh: '道館館主',
        isBoss: true,
        dialogueBefore: '「我的水屬性寶可夢如怒濤般洶湧，別被沖走了！」',
        dialogueWin: '「居然能破解我的水流戰術...你真的很有一套！」',
        rewardCoins: 320,
        rewardItem: ITEMS.mystic_water,
        team: [
          createPokemon('starmie', bossLevel, false),
        ],
      };
    } else if (floor <= 9) {
      return {
        id: 'boss_giovanni',
        name: '坂木 (Giovanni)',
        title: '火箭隊首領',
        titleZh: '火箭隊老大',
        isBoss: true,
        dialogueBefore: '「敢闖入火箭隊的地牢核心？就讓大地吞噬你的天真！」',
        dialogueWin: '「可惡...居然有如此頑強的意志...撤退！」',
        rewardCoins: 480,
        rewardItem: ITEMS.choice_scarf,
        team: [
          createPokemon('snorlax', bossLevel, false),
        ],
      };
    } else if (floor <= 12) {
      return {
        id: 'boss_cynthia',
        name: '竹蘭 (Cynthia)',
        title: '神奧冠軍',
        titleZh: '神奧聯盟冠軍',
        isBoss: true,
        dialogueBefore: '「戰鬥的本質是靈魂與信念的交織。烈咬陸鯊，出擊！」',
        dialogueWin: '「你與寶可夢之間的羈絆散發著璀璨的光芒，請前往最終聖域吧！」',
        rewardCoins: 650,
        rewardItem: ITEMS.focus_sash,
        team: [
          createPokemon('garchomp', bossLevel, false),
        ],
      };
    } else {
      return {
        id: 'boss_mewtwo',
        name: '超夢 (Mewtwo)',
        title: '地牢終焉之主',
        titleZh: '傳說寶可夢',
        isBoss: true,
        dialogueBefore: '「凡人啊...我因人類的欲望而生，但唯有力量才是一切的答案！」',
        dialogueWin: '「不可思議...你拯救了這座地牢，我認可你的強大！」',
        rewardCoins: 1200,
        rewardItem: ITEMS.master_ball,
        team: [
          createPokemon('mewtwo', bossLevel, true),
        ],
      };
    }
  }

  // Regular dungeon trainers
  const titles = [
    { title: '短褲小子', names: ['阿俊', '小健', '浩浩'], pkm: ['geodude', 'squirtle'] },
    { title: '露營少女', names: ['小葵', '莉莉', '小雪'], pkm: ['bulbasaur', 'eevee'] },
    { title: '精英訓練家', names: ['阿雷', '凱文', '真一'], pkm: ['riolu', 'charmander', 'pikachu'] },
    { title: '火箭隊員', names: ['小卒A', '小卒B', '精英斥候'], pkm: ['gastly', 'geodude'] },
  ];

  const pool = titles[Math.floor(Math.random() * titles.length)];
  const name = pool.names[Math.floor(Math.random() * pool.names.length)];
  const pkmId = pool.pkm[Math.floor(Math.random() * pool.pkm.length)];

  return {
    id: `trainer_${floor}_${Math.random().toString(36).substring(2, 7)}`,
    name: `${pool.title} ${name}`,
    title: pool.title,
    titleZh: pool.title,
    isBoss: false,
    dialogueBefore: '「只要眼神對上就是寶可夢對戰的開始！接招吧！」',
    dialogueWin: '「太強了！這場對戰真痛快，這是給你的獎勵！」',
    rewardCoins: 60 + floor * 15,
    rewardItem: Math.random() > 0.4 ? ITEMS.potion : ITEMS.poke_ball,
    team: [createPokemon(pkmId, regularLevel, Math.random() < 0.05)],
  };
}

export function generateWildPokemon(floor: number, playerPartyLevel: number = 5): PokemonInstance {
  // Synchronize regular wild level with player party level
  const level = Math.max(2, playerPartyLevel);
  const wildSpeciesPool = [
    'geodude', 'gastly', 'eevee', 'riolu', 'gible',
    'pikachu', 'charmander', 'squirtle', 'bulbasaur'
  ];
  if (floor >= 5) wildSpeciesPool.push('onix', 'charmeleon', 'wartortle', 'ivysaur');
  if (floor >= 9) wildSpeciesPool.push('snorlax', 'lucario', 'gengar', 'gabite');
  if (floor >= 12) wildSpeciesPool.push('dragonite', 'garchomp', 'charizard', 'blastoise', 'venusaur');

  const pickedId = wildSpeciesPool[Math.floor(Math.random() * wildSpeciesPool.length)];
  const isShiny = Math.random() < 0.08; // 8% shiny chance in dungeon!
  return createPokemon(pickedId, level, isShiny);
}

export function generateFloorNodes(floor: number, totalFloors: number = 15, playerPartyLevel: number = 5): DungeonNode[] {
  const isBossFloor = floor % 3 === 0;

  if (isBossFloor) {
    // Boss floor: single boss arena node
    return [
      {
        id: `node_${floor}_boss`,
        floor,
        type: 'boss',
        title: floor === totalFloors ? '終極聖域 · 傳說之戰' : `第 ${floor} 層守護者道館`,
        description: '強烈的威壓自前方傳來，迎戰強大的館主或傳說寶可夢！',
        completed: false,
        accessible: true,
        trainer: generateTrainer(floor, true, playerPartyLevel),
        connectedNextNodeIds: [],
      },
    ];
  }

  // Regular floor: 2 ~ 3 branching choices
  const nodeCount = Math.floor(Math.random() * 2) + 2; // 2 or 3 nodes
  const nodes: DungeonNode[] = [];

  const typesDistribution: DungeonNodeType[] = ['battle', 'trainer', 'shop', 'camp', 'event'];

  for (let i = 0; i < nodeCount; i++) {
    let type: DungeonNodeType;
    if (i === 0) {
      type = Math.random() > 0.5 ? 'battle' : 'trainer';
    } else if (i === 1) {
      type = Math.random() > 0.4 ? 'camp' : (Math.random() > 0.5 ? 'shop' : 'event');
    } else {
      type = typesDistribution[Math.floor(Math.random() * typesDistribution.length)];
    }

    let title = '地牢通道';
    let description = '前方的未知區域';
    let wildPokemon: any = undefined;
    let trainer: any = undefined;
    let mysteryEventId: any = undefined;

    switch (type) {
      case 'battle':
        title = '野生寶可夢氣息';
        description = '洞穴草叢中傳來窸窸窣窣的響動，可能有機會收服！';
        wildPokemon = generateWildPokemon(floor, playerPartyLevel);
        break;
      case 'trainer':
        title = '遊蕩的訓練家';
        description = '前方有手握精靈球的訓練家正準備挑戰你。';
        trainer = generateTrainer(floor, false, playerPartyLevel);
        break;
      case 'camp':
        title = '地底休息營地';
        description = '溫暖的火堆與甘甜泉水，可全隊回復、特訓並調整狀態。';
        break;
      case 'shop':
        title = '地牢友誼商店';
        description = '神秘商人在此販售各式精靈球、藥水與稀有道具。';
        break;
      case 'event':
        title = '神秘地牢奇遇';
        description = '閃爍著奇異光芒的未知石碑與古代遺跡。';
        const ev = MYSTERY_EVENTS[Math.floor(Math.random() * MYSTERY_EVENTS.length)];
        mysteryEventId = ev.id;
        break;
    }

    nodes.push({
      id: `node_${floor}_${i}`,
      floor,
      type,
      title,
      description,
      completed: false,
      accessible: true,
      wildPokemon,
      trainer,
      mysteryEventId,
      connectedNextNodeIds: [],
    });
  }

  return nodes;
}

// -------------------------------------------------------------
// HD-2D DIORAMA AUTOMATED MAP LAYOUT GENERATOR
// Automated procedural layout generation using HD2D_DIORAMA_ASSET_PACK
// -------------------------------------------------------------
export interface DioramaFloorProp {
  id: string;
  type: 'camp' | 'shop' | 'chest' | 'stele' | 'house' | 'sign' | 'evolution_altar';
  tileId: number;
  tileX: number;
  tileY: number;
  isUsed?: boolean;
  respawnAt?: number;
}

export interface DioramaMapLayout {
  gridSize: number;
  tileGrid: number[][]; // [r][c] -> Tile ID (0: deep_grass, 1: cobblestone_path)
  boundaryTreeGrid: Set<string>; // Tile ID 2 (forest_canopy_obstacle)
  obstacleGrid: Set<string>;     // Tile ID 3 (stone_pillar_obstacle)
  dirtPathGrid: Set<string>;     // Tile ID 1 (cobblestone_path)
  tallGrassGrid: Set<string>;    // Wild encounter patches
  waterGrid: Set<string>;
  waterShoreGrid: Set<string>;
  bridgeTiles: Set<string>;
  fordTiles: Set<string>;
  cliffGrid: Set<string>;
  floorProps: DioramaFloorProp[];
}

export function generateDioramaMapLayout(floor: number, gridSize: number = 50): DioramaMapLayout {
  // Tile ID 0: deep_grass (ground, walkable)
  const tileGrid: number[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => 0)
  );

  const boundaryTrees = new Set<string>(); // Tile ID 2: forest_canopy_obstacle
  const water = new Set<string>();
  const bridges = new Set<string>();
  const fords = new Set<string>();
  const dirtPaths = new Set<string>();    // Tile ID 1: cobblestone_path
  const tallGrass = new Set<string>();
  const obstacles = new Set<string>();    // Tile ID 3: stone_pillar_obstacle
  const cliffs = new Set<string>();

  // 1. Forest Canopy Boundary Walls (Tile ID 2: forest_canopy_obstacle)
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (r <= 1 || r >= gridSize - 2 || c <= 1 || c >= gridSize - 2) {
        boundaryTrees.add(`${c},${r}`);
      }
    }
  }

  // Interior natural forest canopy groves
  const forestGroves = [
    { x1: 2, y1: 2, x2: 10, y2: 10 },
    { x1: 38, y1: 2, x2: 47, y2: 10 },
    { x1: 39, y1: 37, x2: 47, y2: 47 },
    { x1: 2, y1: 38, x2: 8, y2: 47 },
    { x1: 2, y1: 11, x2: 5, y2: 16 },
  ];
  forestGroves.forEach(({ x1, y1, x2, y2 }) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        boundaryTrees.add(`${x},${y}`);
      }
    }
  });

  // 2. Natural Organic Western Lake & Bay
  const lakeCx = 9;
  const lakeCy = 26;
  for (let r = 16; r <= 36; r++) {
    for (let c = 3; c <= 15; c++) {
      const dx = (c - lakeCx) / 5.2;
      const dy = (r - lakeCy) / 8.2;
      const disturb = Math.sin(c * 0.7 + r * 0.5) * 0.18 + Math.cos(r * 0.4) * 0.12;
      if (dx * dx + dy * dy + disturb <= 1.0) {
        const key = `${c},${r}`;
        if (!boundaryTrees.has(key)) {
          water.add(key);
        }
      }
    }
  }

  // Secondary pond
  const pondCx = 38;
  const pondCy = 21;
  for (let r = 17; r <= 25; r++) {
    for (let c = 34; c <= 42; c++) {
      const dx = (c - pondCx) / 3.8;
      const dy = (r - pondCy) / 3.6;
      const disturb = Math.sin(c * 0.8 + r * 0.9) * 0.15;
      if (dx * dx + dy * dy + disturb <= 1.0) {
        const key = `${c},${r}`;
        if (!boundaryTrees.has(key)) {
          water.add(key);
        }
      }
    }
  }

  // 3. Wooden Bridges & Stepping Stone Crossings
  const bridgeY = 26;
  for (let c = 3; c <= 15; c++) {
    const key = `${c},${bridgeY}`;
    const keyAbove = `${c},${bridgeY - 1}`;
    if (water.has(key)) {
      bridges.add(key);
      bridges.add(keyAbove);
    }
  }

  const fordY = 33;
  for (let c = 7; c <= 11; c++) {
    const key = `${c},${fordY}`;
    if (water.has(key)) {
      fords.add(key);
    }
  }

  bridges.forEach((b) => water.delete(b));
  fords.forEach((f) => water.delete(f));

  // 4. Shorelines
  const waterShore = new Set<string>();
  water.forEach((wKey) => {
    const [wx, wy] = wKey.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = wx + dx;
        const ny = wy + dy;
        const nKey = `${nx},${ny}`;
        if (!water.has(nKey) && !bridges.has(nKey) && !boundaryTrees.has(nKey)) {
          waterShore.add(nKey);
        }
      }
    }
  });

  // 5. Cobblestone Path Network (Tile ID 1: cobblestone_path)
  const addPathLine = (x1: number, y1: number, x2: number, y2: number, width = 2) => {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps);
      const px = Math.round(x1 + (x2 - x1) * t);
      const py = Math.round(y1 + (y2 - y1) * t);
      for (let ox = -Math.floor(width / 2); ox <= Math.floor(width / 2); ox++) {
        for (let oy = -Math.floor(width / 2); oy <= Math.floor(width / 2); oy++) {
          const tx = px + ox;
          const ty = py + oy;
          if (tx >= 0 && tx < gridSize && ty >= 0 && ty < gridSize) {
            const key = `${tx},${ty}`;
            if (!water.has(key) && !boundaryTrees.has(key)) {
              dirtPaths.add(key);
              tileGrid[ty][tx] = 1; // Mark as cobblestone_path
            }
          }
        }
      }
    }
  };

  addPathLine(25, 42, 25, 34, 2); // Entry south to town center
  addPathLine(25, 34, 18, 34, 2); // Center west to Camp
  addPathLine(18, 34, 15, 26, 2); // Camp to lake bridge entrance
  addPathLine(15, 26, 4, 26, 1);  // Lake bridge crossing
  addPathLine(4, 26, 8, 16, 2);   // West lake island trail to ancient chest
  addPathLine(25, 34, 32, 34, 2); // Center east to PokeMart
  addPathLine(32, 34, 36, 24, 2); // East route towards stele
  addPathLine(36, 24, 36, 14, 2); // To ancient mystery stele
  addPathLine(25, 34, 25, 24, 2); // Central trail north
  addPathLine(25, 24, 25, 12, 2); // North avenue
  addPathLine(25, 12, 25, 6, 2);  // North avenue to Boss Sanctum Altar

  // 6. Tall Grass Patches
  const grassPatches = [
    { x1: 18, y1: 37, x2: 23, y2: 42 },
    { x1: 27, y1: 37, x2: 32, y2: 42 },
    { x1: 15, y1: 22, x2: 21, y2: 28 },
    { x1: 28, y1: 22, x2: 35, y2: 30 },
    { x1: 17, y1: 11, x2: 22, y2: 17 },
    { x1: 28, y1: 11, x2: 33, y2: 17 },
    { x1: 36, y1: 8, x2: 42, y2: 14 },
  ];

  grassPatches.forEach(({ x1, y1, x2, y2 }) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const key = `${x},${y}`;
        if (
          !water.has(key) &&
          !dirtPaths.has(key) &&
          !boundaryTrees.has(key) &&
          !bridges.has(key) &&
          !fords.has(key)
        ) {
          tallGrass.add(key);
        }
      }
    }
  });

  // 7. Elevation Cliffs
  for (let r = 5; r <= 13; r++) {
    for (let c = 27; c <= 35; c++) {
      if ((c - 31) * (c - 31) + (r - 9) * (r - 9) <= 14) {
        const key = `${c},${r}`;
        if (!dirtPaths.has(key) && !water.has(key) && !boundaryTrees.has(key)) {
          cliffs.add(key);
        }
      }
    }
  }

  // 8. Procedural Boulders & Stone Pillars (Tile ID 3: stone_pillar_obstacle)
  const seed = floor * 43 + 17;
  for (let i = 0; i < 45; i++) {
    const ox = Math.floor((Math.sin(seed + i * 2.3) * 0.5 + 0.5) * 42) + 4;
    const oy = Math.floor((Math.cos(seed + i * 2.9) * 0.5 + 0.5) * 42) + 4;
    const key = `${ox},${oy}`;

    if (
      !water.has(key) &&
      !bridges.has(key) &&
      !fords.has(key) &&
      !dirtPaths.has(key) &&
      !boundaryTrees.has(key) &&
      !tallGrass.has(key) &&
      !cliffs.has(key) &&
      !(Math.abs(ox - 25) <= 2 && Math.abs(oy - 42) <= 2) && // spawn
      !(Math.abs(ox - 25) <= 2 && Math.abs(oy - 8) <= 2) &&  // boss
      !(Math.abs(ox - 18) <= 1 && Math.abs(oy - 34) <= 1) && // camp
      !(Math.abs(ox - 32) <= 1 && Math.abs(oy - 34) <= 1) && // shop
      !(Math.abs(ox - 8) <= 1 && Math.abs(oy - 16) <= 1) &&  // chest
      !(Math.abs(ox - 36) <= 1 && Math.abs(oy - 14) <= 1) && // stele
      !(Math.abs(ox - 25) <= 2 && Math.abs(oy - 6) <= 2)     // sanctum
    ) {
      obstacles.add(key);
    }
  }

  // 9. Interactive & Decoration Props from HD2D Asset Pack
  const floorProps: DioramaFloorProp[] = [
    {
      id: `camp_${floor}`,
      type: 'camp',
      tileId: 5, // ID 5: camp_fire (interactive)
      tileX: 18,
      tileY: 34,
    },
    {
      id: `shop_${floor}`,
      type: 'shop',
      tileId: 1, // shop mart
      tileX: 32,
      tileY: 34,
    },
    {
      id: `chest_${floor}`,
      type: 'chest',
      tileId: 0, // ancient chest
      tileX: 8,
      tileY: 16,
    },
    {
      id: `stele_${floor}`,
      type: 'stele',
      tileId: 3, // ID 3: stone_pillar_obstacle (interactive ancient stele)
      tileX: 36,
      tileY: 14,
    },
    {
      id: `evo_altar_${floor}`,
      type: 'evolution_altar',
      tileId: 4, // ID 4: sacred_altar (interactive)
      tileX: 14,
      tileY: 38,
    },
    {
      id: `house_1_${floor}`,
      type: 'house',
      tileId: 6, // ID 6: wooden_house_front (decoration)
      tileX: 21,
      tileY: 42,
    },
    {
      id: `house_2_${floor}`,
      type: 'house',
      tileId: 6, // ID 6: wooden_house_front (decoration)
      tileX: 29,
      tileY: 42,
    },
    {
      id: `sign_1_${floor}`,
      type: 'sign',
      tileId: 7, // ID 7: stone_signpost (decoration)
      tileX: 24,
      tileY: 36,
    },
    {
      id: `sign_2_${floor}`,
      type: 'sign',
      tileId: 7, // ID 7: stone_signpost (decoration)
      tileX: 26,
      tileY: 18,
    },
  ];

  return {
    gridSize,
    tileGrid,
    boundaryTreeGrid: boundaryTrees,
    obstacleGrid: obstacles,
    dirtPathGrid: dirtPaths,
    tallGrassGrid: tallGrass,
    waterGrid: water,
    waterShoreGrid: waterShore,
    bridgeTiles: bridges,
    fordTiles: fords,
    cliffGrid: cliffs,
    floorProps,
  };
}

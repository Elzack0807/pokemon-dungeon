import { DungeonNode, DungeonNodeType, Trainer, MysteryEvent, PokemonInstance } from '../types/pokemon';
import { createPokemon } from './pokemonData';
import { ITEMS } from './itemsData';

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
  // Fair, dynamic level scaling:
  // Cap regular trainers to player level (so player is not overwhelmed),
  // and bosses to at most player level + 1 (or +2 for Mewtwo), ensuring tight, tactical battles!
  const floorBaseline = Math.floor(floor * 1.2) + 2;
  const level = isBoss
    ? Math.max(3, Math.min(playerPartyLevel + (floor === 15 ? 2 : 1), floorBaseline + 1))
    : Math.max(2, Math.min(playerPartyLevel, floorBaseline));

  if (isBoss) {
    if (floor <= 3) {
      return {
        id: 'boss_brock',
        name: '小剛 (Brock)',
        title: '深灰道館館主',
        titleZh: '道館館主',
        isBoss: true,
        dialogueBefore: '「我的意志如磐石般堅不可摧！展示你的戰鬥策略吧！」',
        dialogueWin: '「漂亮的戰術！這枚岩石徽章與獎金是你的證明！」',
        rewardCoins: 220,
        rewardItem: ITEMS.leftovers,
        team: [
          createPokemon('geodude', Math.max(3, level - 1), false),
          createPokemon('onix', level, false),
        ],
      };
    } else if (floor <= 6) {
      return {
        id: 'boss_misty',
        name: '小霞 (Misty)',
        title: '華藍道館館主',
        titleZh: '道館館主',
        isBoss: true,
        dialogueBefore: '「我的水屬性寶可夢可是如怒濤般洶湧的，別被沖走了！」',
        dialogueWin: '「居然能破解我的水流戰術...你真的很有一套！」',
        rewardCoins: 320,
        rewardItem: ITEMS.mystic_water,
        team: [
          createPokemon('squirtle', Math.max(4, level - 1), false),
          createPokemon('starmie', level, false),
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
          createPokemon('geodude', Math.max(5, level - 2), false),
          createPokemon('onix', Math.max(6, level - 1), false),
          createPokemon('snorlax', level, false),
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
          createPokemon('lucario', Math.max(7, level - 1), false),
          createPokemon('garchomp', level, false),
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
          createPokemon('mewtwo', level + 1, true), // Boss Mewtwo!
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
    team: [createPokemon(pkmId, level, Math.random() < 0.05)],
  };
}

export function generateWildPokemon(floor: number, playerPartyLevel: number = 5): PokemonInstance {
  const floorBase = Math.floor(floor * 1.1) + 2;
  const level = Math.max(2, Math.min(playerPartyLevel, floorBase));
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

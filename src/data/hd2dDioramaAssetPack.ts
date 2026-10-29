export interface HD2DTileDefinition {
  id: number;
  name: string;
  category: 'ground' | 'obstacle' | 'interactive' | 'decoration';
  isWalkable: boolean;
  hd2dStyle: {
    backgroundColor: string;
    texturePattern?: string;
    bevelHighlight?: string;
    groutColor?: string;
    opacityWhenCovered?: number;
    silhouetteRingColor?: string;
    glowColor?: string;
    bloomRadius?: string;
    animation?: string;
    contactShadow?: boolean;
    tiltShiftDepth?: string;
  };
  description: string;
}

export const HD2D_DIORAMA_ASSET_PACK: {
  tilesetName: string;
  tileSize: number;
  tiles: HD2DTileDefinition[];
} = {
  tilesetName: "hd2d_diorama_master_tileset",
  tileSize: 32,
  tiles: [
    {
      id: 0,
      name: "deep_grass",
      category: "ground",
      isWalkable: true,
      hd2dStyle: {
        backgroundColor: "#1e3d2f",
        texturePattern: "noise_grass",
        bevelHighlight: "rgba(255, 255, 255, 0.18)"
      },
      description: "深草叢底磚，帶有高光微型模型邊緣與立體草地顆粒"
    },
    {
      id: 1,
      name: "cobblestone_path",
      category: "ground",
      isWalkable: true,
      hd2dStyle: {
        backgroundColor: "#3a3b45",
        texturePattern: "stone_pavers",
        groutColor: "#1a1b22"
      },
      description: "歧路旅人風格古老石磚步道，具備深色凹槽磚縫與碎石微粒"
    },
    {
      id: 2,
      name: "forest_canopy_obstacle",
      category: "obstacle",
      isWalkable: false,
      hd2dStyle: {
        backgroundColor: "#14281d",
        opacityWhenCovered: 0.38,
        silhouetteRingColor: "rgba(120, 220, 255, 0.6)"
      },
      description: "大型橡樹冠層障礙物，角色進入下方時自動半透明並顯示藍色透視光環"
    },
    {
      id: 3,
      name: "stone_pillar_obstacle",
      category: "obstacle",
      isWalkable: false,
      hd2dStyle: {
        backgroundColor: "#2c2d38",
        opacityWhenCovered: 0.40,
        silhouetteRingColor: "rgba(255, 200, 100, 0.6)"
      },
      description: "古代遺跡石柱，具備強烈垂直立體陰影與角色遮擋半透明效果"
    },
    {
      id: 4,
      name: "sacred_altar",
      category: "interactive",
      isWalkable: false,
      hd2dStyle: {
        backgroundColor: "#322245",
        glowColor: "rgba(180, 100, 255, 0.75)",
        bloomRadius: "64px"
      },
      description: "神聖進化祭壇，帶有紫色以太泛光與漂浮水晶呼吸光暈"
    },
    {
      id: 5,
      name: "camp_fire",
      category: "interactive",
      isWalkable: false,
      hd2dStyle: {
        backgroundColor: "#4a2511",
        glowColor: "rgba(255, 140, 40, 0.85)",
        bloomRadius: "88px",
        animation: "torchFlicker"
      },
      description: "營火庇護所，具備動態跳動暖橘色呼吸泛光與上升微小火星"
    },
    {
      id: 6,
      name: "wooden_house_front",
      category: "decoration",
      isWalkable: false,
      hd2dStyle: {
        backgroundColor: "#422814",
        opacityWhenCovered: 0.35,
        silhouetteRingColor: "rgba(255, 255, 255, 0.7)"
      },
      description: "木造房屋外牆與屋頂裝飾，永久固定不重置，具備完美前遮擋半透明"
    },
    {
      id: 7,
      name: "stone_signpost",
      category: "decoration",
      isWalkable: false,
      hd2dStyle: {
        backgroundColor: "#333538"
      },
      description: "裝飾性路標，不具備互動冷卻或隨機刷新，位置永久固定"
    }
  ]
};

// Quick lookup maps
export const HD2D_TILE_MAP: Record<string, HD2DTileDefinition> = HD2D_DIORAMA_ASSET_PACK.tiles.reduce(
  (acc, tile) => {
    acc[tile.name] = tile;
    return acc;
  },
  {} as Record<string, HD2DTileDefinition>
);

export const HD2D_TILE_ID_MAP: Record<number, HD2DTileDefinition> = HD2D_DIORAMA_ASSET_PACK.tiles.reduce(
  (acc, tile) => {
    acc[tile.id] = tile;
    return acc;
  },
  {} as Record<number, HD2DTileDefinition>
);

// Backward compatibility alias
export const HD2D_DIORAMA_TILESET = HD2D_DIORAMA_ASSET_PACK;

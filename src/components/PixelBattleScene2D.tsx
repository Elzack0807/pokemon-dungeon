import React, { useMemo, useState } from 'react';
import { FieldTerrainData, FieldTerrainType } from '../utils/fieldTerrain';

import grassyBg from '../assets/images/pixel_battle_grassy_meadow_1792859746328.jpg';
import fireBg from '../assets/images/pixel_battle_fire_cave_1792859746341.jpg';
import iceBg from '../assets/images/pixel_battle_ice_tundra_1792859745380.jpg';

interface PixelBattleScene2DProps {
  fieldTerrain?: FieldTerrainData;
}

export const PixelBattleScene2D: React.FC<PixelBattleScene2DProps> = ({ fieldTerrain }) => {
  const terrainId: FieldTerrainType = fieldTerrain?.id || 'none';
  const [imgError, setImgError] = useState<boolean>(false);

  // Use Vite ESM imported images for 100% reliable bundling across all environments
  const bgImageUrl = useMemo(() => {
    switch (terrainId) {
      case 'fire_cave':
        return fireBg;
      case 'ice_tundra':
        return iceBg;
      case 'grassy_meadow':
      case 'water_lake':
      case 'electric_storm':
      case 'sandstorm_ruin':
      case 'psychic_abyss':
      case 'none':
      default:
        return grassyBg;
    }
  }, [terrainId]);

  // Biome CSS Fallback Gradients & Colors
  const biomeStyle = useMemo(() => {
    switch (terrainId) {
      case 'fire_cave':
        return {
          sky: 'from-amber-950 via-rose-950 to-stone-900',
          ground: 'from-orange-900 via-stone-900 to-black',
          platform: 'bg-rose-950/80 border-orange-600/50 shadow-orange-950/80',
        };
      case 'ice_tundra':
        return {
          sky: 'from-sky-950 via-slate-900 to-indigo-950',
          ground: 'from-slate-800 via-sky-900 to-slate-950',
          platform: 'bg-sky-950/80 border-sky-400/50 shadow-sky-950/80',
        };
      default:
        return {
          sky: 'from-emerald-950 via-slate-900 to-stone-900',
          ground: 'from-emerald-900 via-stone-900 to-black',
          platform: 'bg-emerald-950/80 border-emerald-500/50 shadow-emerald-950/80',
        };
    }
  }, [terrainId]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden select-none pointer-events-none bg-slate-950">
      {/* Procedural Biome Sky & Ground Fallback (Always rendered under image or as fallback if image fails) */}
      <div className={`absolute inset-0 bg-gradient-to-b ${biomeStyle.sky} flex flex-col justify-between`}>
        <div className="h-[45%] w-full bg-gradient-to-b from-transparent to-black/50" />
        <div className={`h-[55%] w-full bg-gradient-to-b ${biomeStyle.ground} border-t-2 border-white/10`} />
      </div>

      {/* High Quality 2D Pixel Art Background Image */}
      {!imgError && (
        <img
          src={bgImageUrl}
          alt="Pixel Battle Field"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover filter brightness-95"
          referrerPolicy="no-referrer"
        />
      )}

      {/* Dark Ambient Overlay */}
      <div className="absolute inset-0 bg-slate-950/15" />

    </div>
  );
};

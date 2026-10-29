import React, { useState } from 'react';
import { TYPE_COLORS } from '../utils/typeChart';
import { PokemonType, StatusCondition } from '../types/pokemon';
import { Sparkles } from 'lucide-react';
import { POKEMON_SPECIES } from '../data/pokemonData';

export interface PokemonSpriteProps {
  speciesId: string;
  pokedexNo?: number;
  nameZh: string;
  types: PokemonType[];
  isShiny?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isBack?: boolean; // For player back sprite in battle
  isFainted?: boolean;
  useArtwork?: boolean; // Use official high-res Sugimori artwork
  condition?: StatusCondition; // Add this prop
}

export const PokemonSprite: React.FC<PokemonSpriteProps> = ({
  speciesId,
  pokedexNo: explicitDexNo,
  nameZh,
  types,
  isShiny = false,
  size = 'md',
  isBack = false,
  isFainted = false,
  useArtwork = false,
  condition = 'None', // Default
}) => {
  const [imgError, setImgError] = useState<boolean>(false);

  const pokedexNo = POKEMON_SPECIES[speciesId]?.pokedexNo || explicitDexNo || 25;
  const primaryType = types[0] || 'Normal';
  const typeStyle = TYPE_COLORS[primaryType] || TYPE_COLORS.Normal;

  // Authentic Animated Showdown GIFs & Official Artwork
  const getSpriteUrl = () => {
    if (useArtwork) {
      return isShiny
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${pokedexNo}.png`
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokedexNo}.png`;
    }

    if (isBack) {
      return isShiny
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/shiny/${pokedexNo}.gif`
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${pokedexNo}.gif`;
    }

    return isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${pokedexNo}.gif`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${pokedexNo}.gif`;
  };

  const fallbackUrl = isBack
    ? isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${pokedexNo}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${pokedexNo}.png`
    : isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokedexNo}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokedexNo}.png`;

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
    xl: 'w-36 h-36 md:w-44 md:h-44',
  }[size];

  // Map status to icon
  const getConditionIcon = () => {
    switch (condition) {
      case 'Burn': return '🔥';
      case 'Poison': return '☣️';
      case 'Paralysis': return '⚡';
      case 'Sleep': return '💤';
      case 'Freeze': return '❄️';
      default: return null;
    }
  };
  const conditionIcon = getConditionIcon();

  return (
    <div className={`relative flex items-center justify-center select-none ${isFainted ? 'opacity-35 grayscale' : ''}`}>
      {/* Ground Battle Platform Shadow */}
      <div
        className={`absolute rounded-full blur-md opacity-30 transition-all duration-300 ${
          isShiny ? 'bg-amber-300/60 blur-lg' : ''
        }`}
        style={{
          backgroundColor: isShiny ? '#FBBF24' : typeStyle.bg,
          width: size === 'xl' ? '80%' : '70%',
          height: size === 'xl' ? '25%' : '20%',
          bottom: size === 'xl' ? '2px' : '0px',
        }}
      />

      {/* Shiny Particle Badge */}
      {isShiny && (
        <div className="absolute -top-1 -right-1 z-10 bg-amber-400 text-amber-950 p-1 rounded-full shadow-lg animate-pulse ring-2 ring-amber-300">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Status Condition Icon */}
      {conditionIcon && (
        <div className="absolute -top-1 -left-1 z-10 bg-white/90 p-0.5 rounded-full shadow-md text-[14px] animate-bounce">
          {conditionIcon}
        </div>
      )}

      {/* Authentic Animated Pokemon Sprite or High-res Static fallback */}
      <img
        src={!imgError ? getSpriteUrl() : fallbackUrl}
        alt={nameZh}
        onError={() => {
          if (!imgError) {
            setImgError(true);
          }
        }}
        className={`${sizeClasses} object-contain transition-transform duration-200 drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)] ${
          isShiny ? 'filter brightness-105' : ''
        }`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

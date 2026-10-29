import React, { useMemo } from 'react';

export type WeatherType = 'auto' | 'rain' | 'fog' | 'torch' | 'spores';

interface DungeonWeatherEffectProps {
  weatherType?: WeatherType;
  currentFloor: number;
  fieldTerrainId?: string;
  isBossFloor?: boolean;
}

export const DungeonWeatherEffect: React.FC<DungeonWeatherEffectProps> = ({
  weatherType = 'auto',
  currentFloor,
  fieldTerrainId,
  isBossFloor = false,
}) => {
  // Determine effective weather type
  const effectiveWeather = useMemo<WeatherType>(() => {
    if (weatherType !== 'auto') return weatherType;

    if (fieldTerrainId === 'fire_cave') return 'torch';
    if (fieldTerrainId === 'ice_tundra') return 'fog';

    // Sector & Floor heuristics
    if (currentFloor <= 3) {
      // Subterranean corridor: flickering torchlight with ambient cave dust
      return 'torch';
    } else if (currentFloor <= 6) {
      // Tidal water caves: fine rain / cave drizzle
      return 'rain';
    } else if (currentFloor <= 9) {
      // Rocket secret excavation: rolling mist & warning fog
      return 'fog';
    } else if (currentFloor <= 12) {
      // Ancient dragon peak: luminescent spores / fireflies
      return 'spores';
    } else {
      // Boss/Sanctuary: Ominous mist & flickering arcane glow
      return isBossFloor ? 'fog' : 'spores';
    }
  }, [weatherType, fieldTerrainId, currentFloor, isBossFloor]);

  // Rain Drops Configuration (36 raindrops with staggered positions and timings)
  const raindrops = useMemo(() => {
    return Array.from({ length: 36 }).map((_, i) => {
      const left = (i * 2.8 + (i % 5) * 1.5) % 98 + 1; // spread evenly across 1% to 99%
      const duration = 0.55 + ((i * 7) % 10) * 0.04; // 0.55s - 0.95s
      const delay = ((i * 13) % 20) * 0.08; // 0s - 1.6s
      const height = 28 + ((i * 9) % 20); // 28px - 48px
      const opacity = 0.35 + ((i * 11) % 10) * 0.04; // 0.35 - 0.75
      return { id: i, left, duration, delay, height, opacity };
    });
  }, []);

  // Rain Splashes (8 soft ground ripples)
  const splashes = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => {
      const left = 10 + i * 11 + ((i * 7) % 8);
      const top = 55 + ((i * 17) % 38);
      const delay = ((i * 19) % 15) * 0.12;
      return { id: i, left, top, delay };
    });
  }, []);

  // Embers for Torchlight (20 floating sparks)
  const embers = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => {
      const left = (i * 5 + ((i * 11) % 12)) % 94 + 3;
      const size = 3 + (i % 4);
      const duration = 3.2 + (i % 6) * 0.6;
      const delay = (i % 8) * 0.45;
      const color = i % 3 === 0 ? '#facc15' : i % 3 === 1 ? '#fb923c' : '#ef4444';
      return { id: i, left, size, duration, delay, color };
    });
  }, []);

  // Glowing Forest / Cave Spores (18 floating bioluminescent motes)
  const spores = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => {
      const left = (i * 5.5 + ((i * 7) % 13)) % 92 + 4;
      const size = 4 + (i % 4);
      const duration = 4.2 + (i % 5) * 0.7;
      const delay = (i % 7) * 0.5;
      const color = i % 3 === 0 ? '#4ade80' : i % 3 === 1 ? '#38bdf8' : '#a855f7';
      return { id: i, left, size, duration, delay, color };
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden">
      {/* ======================================================== */}
      {/* 1. RAIN EFFECT (細雨與水滴漣漪) */}
      {/* ======================================================== */}
      {effectiveWeather === 'rain' && (
        <div className="absolute inset-0">
          {/* Subtle cool rainy atmospheric wash */}
          <div className="absolute inset-0 bg-sky-950/15 mix-blend-multiply" />

          {/* Falling Rain Streaks */}
          {raindrops.map((drop) => (
            <div
              key={drop.id}
              className="absolute -top-16 w-[1.5px] rounded-full"
              style={{
                left: `${drop.left}%`,
                height: `${drop.height}px`,
                background: 'linear-gradient(180deg, rgba(186, 230, 253, 0.7) 0%, rgba(56, 189, 248, 0.25) 75%, transparent 100%)',
                animation: `rainFall ${drop.duration}s linear infinite`,
                animationDelay: `${drop.delay}s`,
                opacity: drop.opacity,
                transform: 'rotate(12deg)',
              }}
            />
          ))}

          {/* Ground Splash Ripples */}
          {splashes.map((splash) => (
            <div
              key={splash.id}
              className="absolute w-4 h-2 rounded-full border border-sky-300/40"
              style={{
                left: `${splash.left}%`,
                top: `${splash.top}%`,
                animation: 'rainSplash 1.2s ease-out infinite',
                animationDelay: `${splash.delay}s`,
              }}
            />
          ))}

          {/* Rainy Mist Bottom Gradient */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-sky-950/25 to-transparent" />
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MIST & FOG EFFECT (迷濛霧氣與地牢煙嵐) */}
      {/* ======================================================== */}
      {effectiveWeather === 'fog' && (
        <div className="absolute inset-0">
          {/* Ethereal Cavern Mist Layer 1 (Drifts horizontally with gentle sway) */}
          <div
            className="absolute -inset-x-20 inset-y-0 opacity-40 blur-2xl"
            style={{
              background:
                'radial-gradient(ellipse 90% 45% at 30% 40%, rgba(203, 213, 225, 0.25), transparent 70%), radial-gradient(ellipse 70% 35% at 75% 65%, rgba(148, 163, 184, 0.22), transparent 70%)',
              animation: 'fogDrift1 22s ease-in-out infinite',
            }}
          />

          {/* Cavern Mist Layer 2 (Opposite direction drift for depth) */}
          <div
            className="absolute -inset-x-24 inset-y-0 opacity-35 blur-3xl"
            style={{
              background:
                'radial-gradient(ellipse 80% 40% at 65% 30%, rgba(226, 232, 240, 0.2), transparent 65%), radial-gradient(ellipse 90% 50% at 25% 75%, rgba(186, 230, 253, 0.18), transparent 70%)',
              animation: 'fogDrift2 28s ease-in-out infinite',
            }}
          />

          {/* Ground Fog Blanket */}
          <div
            className="absolute bottom-0 inset-x-0 h-44 opacity-45 blur-xl bg-gradient-to-t from-slate-200/20 via-slate-300/10 to-transparent"
            style={{
              animation: 'fogDrift1 16s ease-in-out infinite reverse',
            }}
          />

          {/* Ominous Vignette Shadow Border */}
          <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(15,23,42,0.65)]" />
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. FLICKERING TORCHLIGHT & EMBERS (閃爍火光與地牢燈火) */}
      {/* ======================================================== */}
      {effectiveWeather === 'torch' && (
        <div className="absolute inset-0">
          {/* Top-Left Torch Ambient Flicker */}
          <div
            className="absolute -top-16 -left-16 w-80 h-80 rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(234, 88, 12, 0.18) 45%, transparent 70%)',
              animation: 'torchFlicker 3.2s ease-in-out infinite',
            }}
          />

          {/* Top-Right Torch Ambient Flicker */}
          <div
            className="absolute -top-16 -right-16 w-80 h-80 rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(234, 88, 12, 0.18) 45%, transparent 70%)',
              animation: 'torchFlicker 3.8s ease-in-out infinite',
              animationDelay: '0.6s',
            }}
          />

          {/* Bottom-Center Camp/Lava Warm Hearth Glow */}
          <div
            className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.28) 0%, rgba(245, 158, 11, 0.15) 50%, transparent 75%)',
              animation: 'torchFlicker 4.2s ease-in-out infinite',
              animationDelay: '1.2s',
            }}
          />

          {/* Rising Torch Embers / Sparks */}
          {embers.map((ember) => (
            <div
              key={ember.id}
              className="absolute rounded-full"
              style={{
                left: `${ember.left}%`,
                bottom: '2%',
                width: `${ember.size}px`,
                height: `${ember.size}px`,
                backgroundColor: ember.color,
                boxShadow: `0 0 8px ${ember.color}, 0 0 14px ${ember.color}`,
                animation: `emberFloat ${ember.duration}s ease-out infinite`,
                animationDelay: `${ember.delay}s`,
              }}
            />
          ))}

          {/* Dungeon Atmospheric Warmth Hue */}
          <div className="absolute inset-0 bg-amber-950/10 mix-blend-color-dodge" />
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. BIOLUMINESCENT SPORES & FIREFLIES (螢光微塵與幽暗生機) */}
      {/* ======================================================== */}
      {effectiveWeather === 'spores' && (
        <div className="absolute inset-0">
          {/* Floating Luminescent Motes */}
          {spores.map((spore) => (
            <div
              key={spore.id}
              className="absolute rounded-full"
              style={{
                left: `${spore.left}%`,
                bottom: '4%',
                width: `${spore.size}px`,
                height: `${spore.size}px`,
                backgroundColor: spore.color,
                boxShadow: `0 0 10px ${spore.color}, 0 0 18px ${spore.color}`,
                animation: `sporeFloat ${spore.duration}s ease-in-out infinite`,
                animationDelay: `${spore.delay}s`,
              }}
            />
          ))}

          {/* Mystical Cave Flora Glow */}
          <div
            className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full blur-3xl opacity-30"
            style={{
              background: 'radial-gradient(circle, rgba(74, 222, 128, 0.25) 0%, rgba(56, 189, 248, 0.15) 50%, transparent 70%)',
              animation: 'torchFlicker 5s ease-in-out infinite',
            }}
          />
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { PokemonInstance, DungeonNode, Item } from './types/pokemon';
import { generateFloorNodes } from './data/dungeonGenerator';
import { ITEMS } from './data/itemsData';
import { sound } from './utils/audio';
import { FieldTerrainData, getRandomFieldTerrain } from './utils/fieldTerrain';
import { loadMetaProgression, unlockSpecies } from './utils/metaProgression';

// Components
import { TitleScreen } from './components/TitleScreen';
import { DungeonMap } from './components/DungeonMap';
import { BattleArena } from './components/BattleArena';
import { RestCamp } from './components/RestCamp';
import { PokeMart } from './components/PokeMart';
import { MysteryEventModal } from './components/MysteryEventModal';
import { RewardModal } from './components/RewardModal';
import { PartyModal } from './components/PartyModal';
import { BagModal } from './components/BagModal';
import { GameOverModal } from './components/GameOverModal';
import { VictoryModal } from './components/VictoryModal';
import { resetDungeonSceneCaches2D } from './components/PixelDungeonScene2D';

type AppView =
  | 'title'
  | 'dungeon_map'
  | 'battle'
  | 'camp'
  | 'shop'
  | 'event'
  | 'reward'
  | 'game_over'
  | 'victory';

export default function App() {
  const TOTAL_FLOORS = 15;

  // View state
  const [view, setView] = useState<AppView>('title');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.7);

  // Field terrain state
  const [fieldTerrain, setFieldTerrain] = useState<FieldTerrainData>(() => getRandomFieldTerrain(1));

  // Run progress state
  const [currentFloor, setCurrentFloor] = useState<number>(1);
  const [floorNodes, setFloorNodes] = useState<DungeonNode[]>([]);
  const [currentNode, setCurrentNode] = useState<DungeonNode | null>(null);

  // Party and Bag
  const [party, setParty] = useState<PokemonInstance[]>([]);
  const [coins, setCoins] = useState<number>(100);
  const [inventory, setInventory] = useState<{ item: Item; count: number }[]>([
    { item: ITEMS.poke_ball, count: 3 },
    { item: ITEMS.potion, count: 2 },
    { item: ITEMS.oran_berry, count: 2 },
  ]);

  // Statistics
  const [battlesWon, setBattlesWon] = useState<number>(0);
  const [caughtCount, setCaughtCount] = useState<number>(0);

  // Overlays
  const [showPartyModal, setShowPartyModal] = useState<boolean>(false);
  const [showBagModal, setShowBagModal] = useState<boolean>(false);

  // Battle reward state
  const [pendingReward, setPendingReward] = useState<{
    expGained: number;
    coinsEarned: number;
    rewardItem?: Item;
    caughtPokemon?: PokemonInstance;
  } | null>(null);

  // BGM Synchronization
  useEffect(() => {
    if (!soundEnabled) {
      sound.stopBgm();
      return;
    }

    if (view === 'dungeon_map' || view === 'camp' || view === 'shop' || view === 'event') {
      sound.startDungeonBgm();
    } else if (view === 'battle') {
      const isBoss = currentNode?.type === 'boss';
      sound.startBattleBgm(isBoss);
    } else {
      sound.stopBgm();
    }
  }, [view, soundEnabled, currentNode]);

  // Toggle sound
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
    if (next) sound.playSelect();
  };

  // Adjust volume
  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    sound.setVolume(vol);
  };

  // Start new game run
  const handleStartGame = (starter: PokemonInstance) => {
    resetDungeonSceneCaches2D();
    const meta = loadMetaProgression();
    const startingCoins = 100 + (meta.talents?.starterFunds || 0) * 60;

    setParty([starter]);
    setCurrentFloor(1);
    setFieldTerrain(getRandomFieldTerrain(1));
    setCoins(startingCoins);
    setInventory([
      { item: ITEMS.poke_ball, count: 3 },
      { item: ITEMS.potion, count: 2 },
      { item: ITEMS.oran_berry, count: 2 },
      { item: ITEMS.escape_rope, count: 1 },
    ]);
    setBattlesWon(0);
    setCaughtCount(0);

    const initialNodes = generateFloorNodes(1, TOTAL_FLOORS, starter.level);
    setFloorNodes(initialNodes);
    setView('dungeon_map');
  };

  // Player clicks a route node on the floor map
  const handleSelectNode = (node: DungeonNode) => {
    setCurrentNode(node);
    if (node.type === 'battle' || node.type === 'trainer' || node.type === 'boss') {
      setView('battle');
    } else if (node.type === 'camp') {
      setView('camp');
    } else if (node.type === 'shop') {
      setView('shop');
    } else if (node.type === 'event') {
      setView('event');
    }
  };

  // Advance to the next dungeon floor
  const advanceFloor = () => {
    const nextFloor = currentFloor + 1;
    if (nextFloor > TOTAL_FLOORS) {
      setView('victory');
      return;
    }
    setCurrentFloor(nextFloor);
    setFieldTerrain(getRandomFieldTerrain(nextFloor));
    const playerMaxLevel = party.length > 0 ? Math.max(...party.map((p) => p.level), 5) : 5;
    const nextNodes = generateFloorNodes(nextFloor, TOTAL_FLOORS, playerMaxLevel);
    setFloorNodes(nextNodes);
    setCurrentNode(null);
    setView('dungeon_map');
  };

  // Battle completion handler
  const handleBattleEnd = (result: {
    victory: boolean;
    fled?: boolean;
    caughtPokemon?: PokemonInstance;
    expGained: number;
    coinsEarned: number;
    rewardItem?: Item;
    updatedParty: PokemonInstance[];
    updatedInventory: { item: Item; count: number }[];
  }) => {
    setParty(result.updatedParty);
    setInventory(result.updatedInventory);

    if (result.caughtPokemon) {
      unlockSpecies(result.caughtPokemon.speciesId);
    }

    if (result.fled) {
      setView('dungeon_map');
      return;
    }

    if (!result.victory) {
      // Entire party defeated
      setView('game_over');
      return;
    }

    // Victory!
    setBattlesWon((w) => w + 1);
    if (result.caughtPokemon) {
      setCaughtCount((c) => c + 1);
    }
    setCoins((c) => c + result.coinsEarned);

    // If final boss defeated
    if (currentFloor === TOTAL_FLOORS && currentNode?.type === 'boss') {
      setView('victory');
      return;
    }

    // Go to reward drafting & level up
    setPendingReward({
      expGained: result.expGained,
      coinsEarned: result.coinsEarned,
      rewardItem: result.rewardItem,
      caughtPokemon: result.caughtPokemon,
    });
    setView('reward');
  };

  // Reward screen completion handler
  const handleContinueFromReward = (updatedParty: PokemonInstance[], rewardItems: Item[]) => {
    setParty(updatedParty);
    if (rewardItems.length > 0) {
      setInventory((prev) => {
        const copy = [...prev];
        rewardItems.forEach((r) => {
          const idx = copy.findIndex((i) => i.item.id === r.id);
          if (idx !== -1) {
            copy[idx].count += 1;
          } else {
            copy.push({ item: r, count: 1 });
          }
        });
        return copy;
      });
    }
    const wasBoss = currentNode?.type === 'boss';
    setPendingReward(null);
    if (wasBoss) {
      advanceFloor();
    } else {
      setView('dungeon_map');
    }
  };

  // Camp completion handler
  const handleCompleteCamp = (updatedParty: PokemonInstance[]) => {
    setParty(updatedParty);
    setView('dungeon_map');
  };

  // Shop completion handler
  const handleCompleteShop = (
    newCoins: number,
    newInventory: { item: Item; count: number }[]
  ) => {
    setCoins(newCoins);
    setInventory(newInventory);
    setView('dungeon_map');
  };

  // Event completion handler
  const handleCompleteEvent = (result: {
    updatedParty: PokemonInstance[];
    updatedCoins: number;
    updatedInventory: { item: Item; count: number }[];
  }) => {
    setParty(result.updatedParty);
    setCoins(result.updatedCoins);
    setInventory(result.updatedInventory);
    setView('dungeon_map');
  };

  // Treasure chest loot handler
  const handleLootChest = (earnedCoins: number, rewardItem?: Item) => {
    setCoins((c) => c + earnedCoins);
    if (rewardItem) {
      setInventory((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex((i) => i.item.id === rewardItem.id);
        if (idx !== -1) {
          copy[idx].count += 1;
        } else {
          copy.push({ item: rewardItem, count: 1 });
        }
        return copy;
      });
    }
  };

  // Restart game back to title
  const handleRestart = () => {
    resetDungeonSceneCaches2D();
    setCurrentFloor(1);
    setParty([]);
    setCurrentNode(null);
    setFloorNodes([]);
    setView('title');
  };

  // Retain party level and restart at Floor 1
  const handleRetainLevelRestart = () => {
    resetDungeonSceneCaches2D();
    setCurrentFloor(1);
    setFieldTerrain(getRandomFieldTerrain(1));
    // Revive party to full HP & clear status
    setParty((prev) =>
      prev.map((p) => ({
        ...p,
        currentHp: p.maxHp,
        status: 'None',
      }))
    );
    const initialNodes = generateFloorNodes(1, TOTAL_FLOORS, 5);
    setFloorNodes(initialNodes);
    setCurrentNode(null);
    setView('dungeon_map');
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500 selection:text-white">
      {/* 1. Title Screen */}
      {view === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
        />
      )}

      {/* 2. Dungeon Map Screen */}
      {view === 'dungeon_map' && (
        <DungeonMap
          currentFloor={currentFloor}
          totalFloors={TOTAL_FLOORS}
          nodes={floorNodes}
          party={party}
          coins={coins}
          inventory={inventory}
          fieldTerrain={fieldTerrain}
          soundEnabled={soundEnabled}
          volume={volume}
          onToggleSound={handleToggleSound}
          onVolumeChange={handleVolumeChange}
          onSelectNode={handleSelectNode}
          onAdvanceFloor={advanceFloor}
          onLootChest={handleLootChest}
          onReturnToTitle={handleRestart}
          onOpenParty={() => setShowPartyModal(true)}
          onOpenBag={() => setShowBagModal(true)}
          onUpdatePartyAndInventory={(upParty, upInv) => {
            setParty(upParty);
            setInventory(upInv);
          }}
        />
      )}

      {/* 3. Turn-Based Battle Arena */}
      {view === 'battle' && currentNode && (
        <BattleArena
          playerPokemon={party[0]}
          playerParty={party}
          wildPokemon={currentNode.wildPokemon}
          trainer={currentNode.trainer}
          inventory={inventory}
          fieldTerrain={fieldTerrain}
          onBattleEnd={handleBattleEnd}
        />
      )}

      {/* 4. Rest Camp Sanctuary */}
      {view === 'camp' && (
        <RestCamp party={party} onCompleteCamp={handleCompleteCamp} />
      )}

      {/* 5. Poké Mart Shop */}
      {view === 'shop' && (
        <PokeMart
          coins={coins}
          inventory={inventory}
          party={party}
          onCompleteShop={handleCompleteShop}
        />
      )}

      {/* 6. Mystery Event Modal */}
      {view === 'event' && currentNode?.mysteryEventId && (
        <MysteryEventModal
          eventId={currentNode.mysteryEventId}
          party={party}
          coins={coins}
          inventory={inventory}
          onCompleteEvent={handleCompleteEvent}
        />
      )}

      {/* 7. Post-Battle Reward / Level Up / Roguelike Draft */}
      {view === 'reward' && pendingReward && (
        <RewardModal
          party={party}
          expGained={pendingReward.expGained}
          coinsEarned={pendingReward.coinsEarned}
          rewardItem={pendingReward.rewardItem}
          caughtPokemon={pendingReward.caughtPokemon}
          onContinue={handleContinueFromReward}
        />
      )}

      {/* 8. Game Over Screen */}
      {view === 'game_over' && (
        <GameOverModal
          floorReached={currentFloor}
          totalFloors={TOTAL_FLOORS}
          battlesWon={battlesWon}
          caughtCount={caughtCount}
          coins={coins}
          party={party}
          onRestart={handleRestart}
          onRetainLevelRestart={handleRetainLevelRestart}
        />
      )}

      {/* 9. Victory Hall of Fame Screen */}
      {view === 'victory' && (
        <VictoryModal
          party={party}
          battlesWon={battlesWon}
          caughtCount={caughtCount}
          coins={coins}
          onRestart={handleRestart}
        />
      )}

      {/* Party Details Modal Overlay */}
      {showPartyModal && (
        <PartyModal
          party={party}
          inventory={inventory}
          onClose={() => setShowPartyModal(false)}
          onUpdateParty={(updated) => setParty(updated)}
        />
      )}

      {/* Bag Inventory Modal Overlay */}
      {showBagModal && (
        <BagModal
          inventory={inventory}
          party={party}
          onClose={() => setShowBagModal(false)}
        />
      )}
    </div>
  );
}

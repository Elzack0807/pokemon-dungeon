import React, { useState, useEffect } from 'react';
import { MysteryEvent, PokemonInstance, Item } from '../types/pokemon';
import { MYSTERY_EVENTS } from '../data/dungeonGenerator';
import { ITEMS } from '../data/itemsData';
import { sound } from '../utils/audio';
import { HelpCircle, Sparkles, ArrowRight, X } from 'lucide-react';

interface MysteryEventModalProps {
  eventId: string;
  party: PokemonInstance[];
  coins: number;
  inventory: { item: Item; count: number }[];
  onCompleteEvent: (result: {
    updatedParty: PokemonInstance[];
    updatedCoins: number;
    updatedInventory: { item: Item; count: number }[];
  }) => void;
}

export const MysteryEventModal: React.FC<MysteryEventModalProps> = ({
  eventId,
  party: initialParty,
  coins: initialCoins,
  inventory: initialInventory,
  onCompleteEvent,
}) => {
  const event = MYSTERY_EVENTS.find((e) => e.id === eventId) || MYSTERY_EVENTS[0];
  const [outcomeMessage, setOutcomeMessage] = useState<string | null>(null);
  const [party, setParty] = useState<PokemonInstance[]>(initialParty);
  const [coins, setCoins] = useState<number>(initialCoins);
  const [inventory, setInventory] = useState<{ item: Item; count: number }[]>(initialInventory);
  const [displayedOptions, setDisplayedOptions] = useState<any[]>([]);

  const [isExiting, setIsExiting] = useState<boolean>(false);

  // Initialize randomized options
  useEffect(() => {
    // Pool of random recovery options
    const RECOVERY_OPTIONS: { labelZh: string; descriptionZh: string; outcomeType: "heal" | "item" | "coins" | "gamble" | "curse_buff" | "shiny" | "heal_pp" }[] = [
      {
        labelZh: '在此休息片刻',
        descriptionZh: '全體寶可夢回復 50% HP 與全部招式 PP。',
        outcomeType: 'heal_pp'
      },
      {
        labelZh: '尋找林間樹果',
        descriptionZh: '隨機獲得一些回復類道具。',
        outcomeType: 'item'
      },
      {
        labelZh: '向路過的精靈中心求助',
        descriptionZh: '全體寶可夢 HP 完全回復！',
        outcomeType: 'heal'
      }
    ];

    // Take the 3 fixed options from the event
    let options = [...event.options];

    // 40% chance to replace one random option with a recovery option if it's not already a recovery-heavy event
    if (Math.random() < 0.4) {
      const randomIdx = Math.floor(Math.random() * options.length);
      const randomRecovery = RECOVERY_OPTIONS[Math.floor(Math.random() * RECOVERY_OPTIONS.length)];
      // Avoid duplicates if possible
      if (!options.some(o => o.outcomeType === randomRecovery.outcomeType)) {
        options[randomIdx] = randomRecovery;
      }
    }

    setDisplayedOptions(options);
  }, [eventId]);

  const handleLeave = () => {
    if (isExiting) return;
    setIsExiting(true);
    sound.playSelect();
    onCompleteEvent({
      updatedParty: party,
      updatedCoins: coins,
      updatedInventory: inventory,
    });
  };

  // ESC key listener to leave mystery event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleLeave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [party, coins, inventory]);

  const handleChoose = (outcomeType: string) => {
    sound.playSelect();

    if (outcomeType === 'heal') {
      sound.playRest();
      party.forEach((p) => {
        p.currentHp = p.maxHp;
        p.status = 'None';
      });
      setParty([...party]);
      setOutcomeMessage('一陣神聖溫暖的微光包覆著你們，隊伍全員 HP 與異常狀態完全痊癒！');
    } else if (outcomeType === 'heal_pp') {
      sound.playRest();
      party.forEach((p) => {
        p.currentHp = Math.min(p.maxHp, p.currentHp + Math.floor(p.maxHp * 0.5));
        p.moves.forEach(m => {
          m.currentPp = m.maxPp;
        });
      });
      setParty([...party]);
      setOutcomeMessage('你們在安靜的角落稍作休息，全隊回復了大量 HP 並補滿了所有招式的 PP！');
    } else if (outcomeType === 'coins') {
      const added = 100;
      setCoins((c) => c + added);
      setOutcomeMessage(`你獲得了拾取到的 ${added} 枚金幣！`);
    } else if (outcomeType === 'item') {
      const candidateItems = [ITEMS.sitrus_berry, ITEMS.max_potion, ITEMS.ultra_ball, ITEMS.leftovers];
      const rewarded = candidateItems[Math.floor(Math.random() * candidateItems.length)];
      setInventory((prev) => {
        const idx = prev.findIndex((i) => i.item.id === rewarded.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], count: copy[idx].count + 1 };
          return copy;
        } else {
          return [...prev, { item: rewarded, count: 1 }];
        }
      });
      setOutcomeMessage(`你獲得了珍貴的【${rewarded.nameZh}】！`);
    } else if (outcomeType === 'gamble') {
      const won = Math.random() > 0.4;
      if (won) {
        sound.playVictory();
        setCoins((c) => c + 150);
        setOutcomeMessage('賭局大獲全勝！你贏得了 150 枚金幣！');
      } else {
        sound.playHit(false, true);
        party.forEach((p) => {
          p.currentHp = Math.max(1, Math.floor(p.currentHp * 0.8));
        });
        setParty([...party]);
        setOutcomeMessage('突發惡劣意外，隊伍全員受到了 20% 傷害的反噬！');
      }
    } else if (outcomeType === 'curse_buff') {
      sound.playLevelUp();
      party.forEach((p) => {
        p.stats.atk += 10;
        p.stats.spa += 10;
      });
      setParty([...party]);
      setOutcomeMessage('神秘的光輝融入了寶可夢體內，全隊全員攻擊與特攻永久 +10！');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 max-w-xl w-full rounded-2xl p-6 shadow-2xl space-y-5">
        {/* Header with X Close button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            <h3 className="text-xl font-bold text-white">{event.titleZh}</h3>
          </div>

          <button
            onClick={handleLeave}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
            title="不作處理關閉 (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Story Narration */}
        <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          {event.storyZh}
        </p>

        {/* Options or Outcome */}
        {!outcomeMessage ? (
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-400 tracking-wider">
              你要如何應對此事件？
            </span>
            <div className="space-y-2">
              {displayedOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleChoose(opt.outcomeType)}
                  className="w-full p-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-purple-400 text-left transition-all duration-150 group cursor-pointer"
                >
                  <div className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                    {opt.labelZh}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{opt.descriptionZh}</div>
                </button>
              ))}

              {/* Extra explicit leave button */}
              <button
                onClick={handleLeave}
                className="w-full p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all cursor-pointer text-center"
              >
                不作理會，轉身離開 ➔
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 text-sm text-purple-200">
              {outcomeMessage}
            </div>

            <button
              onClick={handleLeave}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-950/40"
            >
              <span>繼續深入地牢探險</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

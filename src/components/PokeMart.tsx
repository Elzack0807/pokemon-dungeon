import React, { useState, useEffect } from 'react';
import { Item, PokemonInstance } from '../types/pokemon';
import { ITEMS } from '../data/itemsData';
import { sound } from '../utils/audio';
import { ShoppingBag, Coins, ArrowRight, Plus, Minus, X } from 'lucide-react';

interface PokeMartProps {
  coins: number;
  inventory: { item: Item; count: number }[];
  party: PokemonInstance[];
  onCompleteShop: (newCoins: number, newInventory: { item: Item; count: number }[]) => void;
  onClose?: () => void;
}

export const PokeMart: React.FC<PokeMartProps> = ({
  coins: initialCoins,
  inventory: initialInventory,
  party,
  onCompleteShop,
  onClose,
}) => {
  const [coins, setCoins] = useState<number>(initialCoins);
  const [inventory, setInventory] = useState<{ item: Item; count: number }[]>(initialInventory);
  const [message, setMessage] = useState<string>('「歡迎光臨地牢友誼商店！你可以自選數量批量採購補給道具。」');

  // ESC key listener to exit shop smoothly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playSelect();
        handleExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [coins, inventory]);

  const [isExiting, setIsExiting] = useState<boolean>(false);

  const handleExit = () => {
    if (isExiting) return;
    setIsExiting(true);
    sound.playSelect();
    onCompleteShop(coins, inventory);
  };

  // Available stock in this shop, including Escape Rope & Revive!
  const shopStock: Item[] = [
    ITEMS.poke_ball,
    ITEMS.great_ball,
    ITEMS.ultra_ball,
    ITEMS.potion,
    ITEMS.super_potion,
    ITEMS.max_potion,
    ITEMS.stage1_evo_stone,
    ITEMS.stage2_evo_stone,
    ITEMS.escape_rope,
    ITEMS.revive,
    ITEMS.sitrus_berry,
    ITEMS.ether,
    ITEMS.elixir,
    ITEMS.max_elixir,
    ITEMS.leftovers,
    ITEMS.choice_scarf,
    ITEMS.muscle_band,
    ITEMS.focus_sash,
  ];

  // Per-item purchase quantity state (default to 1)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    shopStock.forEach((i) => {
      init[i.id] = 1;
    });
    return init;
  });

  const getQuantity = (id: string) => quantities[id] || 1;

  const handleAdjustQuantity = (id: string, delta: number, maxAffordable: number) => {
    const cur = getQuantity(id);
    const next = Math.max(1, Math.min(Math.max(1, maxAffordable), cur + delta));
    setQuantities((prev) => ({ ...prev, [id]: next }));
    sound.playSelect();
  };

  const handleSetMax = (id: string, maxAffordable: number) => {
    const target = Math.max(1, maxAffordable);
    setQuantities((prev) => ({ ...prev, [id]: target }));
    sound.playSelect();
  };

  const handleBuy = (item: Item) => {
    const qty = getQuantity(item.id);
    const totalCost = item.price * qty;

    if (coins < totalCost) {
      sound.playSelect();
      setMessage(`金幣不足！購買 ${qty} 個【${item.nameZh}】需要 ${totalCost} 金幣。`);
      return;
    }

    sound.playCaught();
    setCoins((c) => c - totalCost);

    setInventory((prev) => {
      const idx = prev.findIndex((i) => i.item.id === item.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], count: copy[idx].count + qty };
        return copy;
      } else {
        return [...prev, { item, count: qty }];
      }
    });

    setMessage(`成功購買了 ${qty} 個【${item.nameZh}】（花費 ${totalCost} 🪙）！感謝惠顧！`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 text-slate-100 flex flex-col justify-between font-sans overflow-hidden select-none backdrop-blur-lg">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src="/assets/images/dungeon_shop_camp_1792647581229.jpg"
          alt="Poké Mart"
          className="w-full h-full object-cover filter brightness-40"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-slate-950/85" />
      </div>

      {/* Sticky Header with Close Button */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm sm:text-base leading-tight">
              地牢友誼商店 (Poké Mart)
            </h2>
            <p className="text-[10px] text-slate-400 hidden sm:block">按 ESC 鍵或右上方按鈕隨時離開</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs sm:text-sm">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="tabular-nums">{coins} 🪙</span>
          </div>

          {/* Explicit X Close Button */}
          <button
            onClick={handleExit}
            className="p-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 transition-all cursor-pointer flex items-center justify-center shadow-md active:scale-95"
            title="關閉商店 (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Catalog */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 py-3 flex flex-col justify-between overflow-hidden">
        {/* Merchant Message Toast */}
        <div className="mb-2 p-2.5 rounded-xl bg-slate-900/95 border border-slate-800 text-xs text-sky-300 flex items-center gap-2 shadow-md shrink-0">
          <span className="text-amber-400 font-bold shrink-0">店員喵喵：</span>
          <span className="truncate">{message}</span>
        </div>

        {/* Goods Grid (Scrollable) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto max-h-[58vh] pr-1 pb-2">
          {shopStock.map((item) => {
            const currentOwned = inventory.find((i) => i.item.id === item.id)?.count || 0;
            const maxAfford = Math.max(0, Math.floor(coins / item.price));
            const qty = getQuantity(item.id);
            const totalCost = item.price * qty;
            const canAfford = coins >= totalCost && qty > 0;

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-slate-700 flex flex-col justify-between shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="font-bold text-white text-xs sm:text-sm">{item.nameZh}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        背包持有: {currentOwned}
                      </span>
                    </div>

                    <span className="font-bold text-amber-400 font-mono text-xs sm:text-sm">
                      {item.price} 🪙
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-snug mb-2 line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  {/* Quantity Stepper Controls */}
                  <div className="flex items-center justify-between gap-1 text-xs">
                    <span className="text-slate-400 text-[10px]">採購數量:</span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAdjustQuantity(item.id, -1, maxAfford)}
                        disabled={qty <= 1}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-white cursor-pointer"
                        title="減少 1 個"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className="font-mono font-bold text-white px-1.5 py-0.5 rounded bg-slate-950 min-w-[24px] text-center border border-slate-800 text-xs">
                        {qty}
                      </span>

                      <button
                        onClick={() => handleAdjustQuantity(item.id, 1, maxAfford)}
                        disabled={qty >= Math.max(1, maxAfford)}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-white cursor-pointer"
                        title="增加 1 個"
                      >
                        <Plus className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => handleAdjustQuantity(item.id, 5, maxAfford)}
                        disabled={qty >= Math.max(1, maxAfford)}
                        className="px-1 py-0.5 text-[9px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 cursor-pointer"
                      >
                        +5
                      </button>

                      <button
                        onClick={() => handleSetMax(item.id, maxAfford)}
                        disabled={maxAfford <= 0}
                        className="px-1 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer"
                      >
                        最大
                      </button>
                    </div>
                  </div>

                  {/* Buy Button with Total Price */}
                  <button
                    disabled={!canAfford}
                    onClick={() => handleBuy(item)}
                    className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      canAfford
                        ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md active:scale-98'
                        : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      <span>購買 {qty} 個</span>
                    </div>
                    <span className="font-mono text-amber-300 font-bold">{totalCost} 🪙</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Exit Bar */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            採購完畢後隨時點擊按鈕離開商店
          </span>
          <button
            onClick={handleExit}
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl font-bold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-500 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-950/40 active:scale-98 transition-all"
          >
            <span>離開商店關閉視窗</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};


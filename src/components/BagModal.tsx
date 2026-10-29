import React from 'react';
import { Item, PokemonInstance } from '../types/pokemon';
import { Backpack, X } from 'lucide-react';

interface BagModalProps {
  inventory: { item: Item; count: number }[];
  party: PokemonInstance[];
  onClose: () => void;
  onUseItem?: (item: Item, targetPkmUid: string) => void;
}

export const BagModal: React.FC<BagModalProps> = ({
  inventory,
  party,
  onClose,
  onUseItem,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 max-w-xl w-full rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Backpack className="w-5 h-5 text-sky-400" />
            <h3 className="text-xl font-bold text-white">探險家背包</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inventory list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {inventory.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              背包內目前沒有任何道具。
            </div>
          ) : (
            inventory.map((inv) => (
              <div
                key={inv.item.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{inv.item.nameZh}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-800 text-slate-300">
                      {inv.item.type === 'medicine' && '藥品'}
                      {inv.item.type === 'pokeball' && '精靈球'}
                      {inv.item.type === 'held_item' && '攜帶遺物'}
                      {inv.item.type === 'tm' && '招式學習器'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{inv.item.description}</p>
                </div>

                <div className="text-right shrink-0 ml-4">
                  <span className="font-mono font-bold text-amber-400 text-sm">x{inv.count}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            關閉背包
          </button>
        </div>
      </div>
    </div>
  );
};

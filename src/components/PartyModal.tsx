import React, { useState } from 'react';
import { PokemonInstance, Item } from '../types/pokemon';
import { PokemonSprite } from './PokemonSprite';
import { TYPE_COLORS, TYPE_NAMES_ZH } from '../utils/typeChart';
import { sound } from '../utils/audio';
import { Users, X, Heart, Swords, Shield, Zap, Sparkles, ArrowUp } from 'lucide-react';

interface PartyModalProps {
  party: PokemonInstance[];
  inventory: { item: Item; count: number }[];
  onClose: () => void;
  onUpdateParty: (party: PokemonInstance[]) => void;
}

export const PartyModal: React.FC<PartyModalProps> = ({
  party: initialParty,
  inventory,
  onClose,
  onUpdateParty,
}) => {
  const [party, setParty] = useState<PokemonInstance[]>(initialParty);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  const selected = party[selectedIdx] || party[0];

  const handleMakeLead = (idx: number) => {
    if (idx === 0) return;
    sound.playSelect();
    const copy = [...party];
    const [pkm] = copy.splice(idx, 1);
    copy.unshift(pkm);
    setParty(copy);
    setSelectedIdx(0);
    onUpdateParty(copy);
  };

  const handleEquipItem = (item: Item) => {
    sound.playSelect();
    const copy = [...party];
    copy[selectedIdx].heldItem = item;
    setParty(copy);
    onUpdateParty(copy);
  };

  const handleUnequipItem = () => {
    sound.playSelect();
    const copy = [...party];
    copy[selectedIdx].heldItem = undefined;
    setParty(copy);
    onUpdateParty(copy);
  };

  // Filter held items from inventory
  const heldItemsInInventory = inventory.filter((i) => i.item.type === 'held_item');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 max-w-3xl w-full rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xl font-bold text-white">出戰隊伍詳情</h3>
            <span className="text-xs text-slate-400">({party.length}/3 隻)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 py-4 overflow-y-auto">
          {/* Left: Party Slots (5 Cols) */}
          <div className="md:col-span-5 space-y-2">
            <span className="text-xs font-semibold text-slate-400">隊伍成員 (點選檢視)</span>
            {party.map((pkm, idx) => {
              const isSelected = idx === selectedIdx;
              const isLead = idx === 0;

              return (
                <div
                  key={pkm.uid}
                  onClick={() => {
                    sound.playSelect();
                    setSelectedIdx(idx);
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-slate-800 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-slate-950/50 hover:bg-slate-800/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PokemonSprite
                      speciesId={pkm.speciesId}
                      nameZh={pkm.nameZh}
                      types={pkm.types}
                      isShiny={pkm.isShiny}
                      size="sm"
                    />
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>{pkm.nameZh}</span>
                        {isLead && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-semibold">
                            隊首
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Lv.{pkm.level} · HP {pkm.currentHp}/{pkm.maxHp}
                      </div>
                    </div>
                  </div>

                  {!isLead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMakeLead(idx);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-xs flex items-center gap-1"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>設隊首</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Selected Pokemon In-Depth Stats & Moves (7 Cols) */}
          {selected && (
            <div className="md:col-span-7 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-xl font-bold text-white flex items-center gap-2">
                      {selected.nameZh}
                      <span className="text-xs text-slate-400 font-normal font-mono">Lv.{selected.level}</span>
                    </h4>
                    <div className="flex gap-1 mt-1">
                      {selected.types.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.2 rounded font-semibold"
                          style={{ backgroundColor: TYPE_COLORS[t].bg, color: TYPE_COLORS[t].text }}
                        >
                          {TYPE_NAMES_ZH[t]}
                        </span>
                      ))}
                    </div>
                  </div>

                  <PokemonSprite
                    speciesId={selected.speciesId}
                    nameZh={selected.nameZh}
                    types={selected.types}
                    isShiny={selected.isShiny}
                    size="md"
                  />
                </div>

                {/* Base Stats Table */}
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[10px]">HP 生命</span>
                    <span className="font-bold text-white font-mono">{selected.stats.hp}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[10px]">攻擊 / 特攻</span>
                    <span className="font-bold text-amber-400 font-mono">{selected.stats.atk} / {selected.stats.spa}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[10px]">速度</span>
                    <span className="font-bold text-sky-400 font-mono">{selected.stats.spe}</span>
                  </div>
                </div>

                {/* Ability */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs mb-3">
                  <div className="font-semibold text-amber-300">特性 · {selected.ability.nameZh}</div>
                  <div className="text-slate-300 text-[11px] mt-0.5">{selected.ability.description}</div>
                </div>

                {/* Moves List */}
                <div className="space-y-1.5 mb-3">
                  <span className="text-[11px] font-semibold text-slate-400">目前學會的招式:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {selected.moves.map((m) => (
                      <div
                        key={m.id}
                        className="p-2 rounded bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="font-bold text-white flex items-center justify-between">
                          <span>{m.nameZh}</span>
                          <span className="text-[10px] text-slate-400 font-mono">PP {m.currentPp}/{m.maxPp}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex justify-between mt-1">
                          <span>{m.category === 'Status' ? '變化' : `威力 ${m.power}`}</span>
                          <span style={{ color: TYPE_COLORS[m.type].bg }}>{TYPE_NAMES_ZH[m.type]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Held Item */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">攜帶道具:</span>
                    {selected.heldItem ? (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-300 font-semibold">{selected.heldItem.nameZh}</span>
                        <button
                          onClick={handleUnequipItem}
                          className="text-rose-400 hover:text-rose-300 text-[10px] underline"
                        >
                          卸下
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500">未攜帶道具</span>
                    )}
                  </div>
                  {selected.heldItem && (
                    <div className="text-slate-400 text-[10px] mt-1">{selected.heldItem.description}</div>
                  )}

                  {/* Equip options if unequipped */}
                  {!selected.heldItem && heldItemsInInventory.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
                      <span className="text-[10px] text-slate-500 shrink-0">裝備:</span>
                      {heldItemsInInventory.map((inv) => (
                        <button
                          key={inv.item.id}
                          onClick={() => handleEquipItem(inv.item)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] shrink-0 border border-slate-700"
                        >
                          {inv.item.nameZh}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={onClose}
                  className="py-1.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                >
                  確定儲存
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

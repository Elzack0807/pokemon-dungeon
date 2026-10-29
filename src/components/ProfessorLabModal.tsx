import React, { useState } from 'react';
import {
  MetaProgressionState,
  TALENT_CONFIGS,
  getTalentCost,
  TALENT_MAX_LEVEL,
  saveMetaProgression,
  MetaTalents,
} from '../utils/metaProgression';
import { sound } from '../utils/audio';
import {
  Sparkles,
  Heart,
  Coins,
  BookOpen,
  Zap,
  Shield,
  X,
  Award,
  ArrowUpCircle,
  Check,
} from 'lucide-react';

interface ProfessorLabModalProps {
  metaState: MetaProgressionState;
  onUpdateMetaState: (newState: MetaProgressionState) => void;
  onClose: () => void;
}

export const ProfessorLabModal: React.FC<ProfessorLabModalProps> = ({
  metaState,
  onUpdateMetaState,
  onClose,
}) => {
  const [state, setState] = useState<MetaProgressionState>(metaState);
  const [notification, setNotification] = useState<string | null>(null);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Heart':
        return <Heart className="w-5 h-5 text-rose-400" />;
      case 'Coins':
        return <Coins className="w-5 h-5 text-amber-400" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'BookOpen':
        return <BookOpen className="w-5 h-5 text-emerald-400" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-sky-400" />;
      case 'Shield':
        return <Shield className="w-5 h-5 text-blue-400" />;
      default:
        return <Award className="w-5 h-5 text-amber-400" />;
    }
  };

  const handleUpgrade = (key: keyof MetaTalents) => {
    const currentLevel = state.talents[key];
    if (currentLevel >= TALENT_MAX_LEVEL) return;

    const cost = getTalentCost(key, currentLevel);
    if (state.badges < cost) {
      sound.playSelect();
      setNotification(`冒險勛章不足！需要 ${cost} 枚勛章。`);
      setTimeout(() => setNotification(null), 2500);
      return;
    }

    sound.playCaught();
    const updated: MetaProgressionState = {
      ...state,
      badges: state.badges - cost,
      talents: {
        ...state.talents,
        [key]: currentLevel + 1,
      },
    };

    setState(updated);
    saveMetaProgression(updated);
    onUpdateMetaState(updated);
    setNotification(`升級成功！當前等級 Lv.${currentLevel + 1}`);
    setTimeout(() => setNotification(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
              <Award className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                大木博士的研究所 · 永久天賦強化
              </h3>
              <p className="text-xs text-slate-400">
                每次地牢探險結算的冒險勛章可用於永久強化，全體夥伴冒險受惠！
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playSelect();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currency Status Ribbon */}
        <div className="my-3 py-2.5 px-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Award className="w-4 h-4 text-amber-400" />
            <span>可用探險勛章：</span>
            <span className="text-base font-extrabold text-amber-400 font-mono">
              {state.badges} 枚
            </span>
          </div>

          {notification && (
            <div className="text-xs font-semibold text-emerald-400 animate-pulse">
              {notification}
            </div>
          )}
        </div>

        {/* Talents List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
          {TALENT_CONFIGS.map((talent) => {
            const currentLevel = state.talents[talent.key];
            const isMax = currentLevel >= TALENT_MAX_LEVEL;
            const cost = getTalentCost(talent.key, currentLevel);
            const canAfford = !isMax && state.badges >= cost;

            return (
              <div
                key={talent.key}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                    {getIcon(talent.icon)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm">{talent.nameZh}</h4>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-850 text-sky-300 border border-slate-700">
                        Lv.{currentLevel} / {TALENT_MAX_LEVEL}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{talent.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs">
                      <span className="text-emerald-400 font-medium">
                        當前效果: {talent.getLevelEffectText(currentLevel)}
                      </span>
                      {!isMax && (
                        <span className="text-slate-500">
                          → 下級: {talent.getLevelEffectText(currentLevel + 1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="sm:text-right shrink-0">
                  {isMax ? (
                    <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                      <Check className="w-3.5 h-3.5" />
                      <span>已達最大級</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(talent.key)}
                      disabled={!canAfford}
                      className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-950/40'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      }`}
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>升級 ({cost} 勛章)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            天賦效果將永久保存並自動套用至每一次開局！
          </span>
          <button
            onClick={() => {
              sound.playSelect();
              onClose();
            }}
            className="py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
          >
            完成強化
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { RecipientProfile, RecipientRelation, MAX_RECIPIENTS } from '../types';
import { newRecipientId } from '../utils/storage';
import { AlertCircle, X, ArrowRight, Plus, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  /** 'first': 4コマ → 宛先登録 / 'edit': 宛先の編集（設定から） */
  mode: 'first' | 'edit';
  initialRecipients?: RecipientProfile[];
  onSave: (recipients: RecipientProfile[]) => void;
  onClose?: () => void;
}

const RELATIONS: { id: RecipientRelation; label: string }[] = [
  { id: 'child', label: '子ども' },
  { id: 'partner', label: 'パートナー' },
  { id: 'parent', label: '親' },
  { id: 'friend', label: '友人' },
  { id: 'future_me', label: '未来の自分' },
  { id: 'other', label: 'その他' },
];

const AGE_GROUPS = ['未設定', '乳幼児', '小学生', '中高生', '20代', '30〜40代', '50〜60代', 'シニア'];

// ---- 4コマ（線画。墨の線と朱の一点だけ）
const S = { stroke: '#2B2B2B', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Panel1 = () => (
  <svg viewBox="0 0 200 140" className="w-full h-36">
    {/* 朝の光 */}
    <g {...S} strokeWidth={1.1} opacity={0.6}>
      <line x1="100" y1="12" x2="100" y2="24" />
      <line x1="62" y1="24" x2="70" y2="33" />
      <line x1="138" y1="24" x2="130" y2="33" />
    </g>
    {/* 封筒 */}
    <rect x="40" y="48" width="120" height="76" rx="6" {...S} />
    <path d="M40 56 L100 96 L160 56" {...S} />
    <circle cx="100" cy="96" r="3.2" fill="#B5443A" />
  </svg>
);
const Panel2 = () => (
  <svg viewBox="0 0 200 140" className="w-full h-36">
    {/* 便箋 */}
    <rect x="48" y="22" width="104" height="104" rx="4" {...S} />
    <g {...S} strokeWidth={1.1} opacity={0.5}>
      <line x1="62" y1="48" x2="138" y2="48" />
      <line x1="62" y1="66" x2="138" y2="66" />
      <line x1="62" y1="84" x2="138" y2="84" />
      <line x1="62" y1="102" x2="110" y2="102" />
    </g>
    {/* 手書きの線 */}
    <path d="M64 44 q8 -6 14 2 t14 -2 t12 2" {...S} />
    <path d="M64 62 q10 -5 16 2 t16 -2" {...S} />
    {/* ペン */}
    <path d="M128 112 L158 82 L166 90 L136 120 Z" {...S} />
    <line x1="152" y1="88" x2="160" y2="96" {...S} strokeWidth={1.1} />
  </svg>
);
const Panel3 = () => (
  <svg viewBox="0 0 200 140" className="w-full h-36">
    {/* 束: 少しずつずれた封筒 */}
    <rect x="58" y="78" width="96" height="40" rx="4" {...S} opacity={0.35} />
    <rect x="54" y="66" width="96" height="40" rx="4" {...S} opacity={0.55} />
    <rect x="50" y="54" width="96" height="40" rx="4" {...S} opacity={0.75} />
    <rect x="46" y="42" width="96" height="40" rx="4" {...S} />
    <path d="M46 46 L94 72 L142 46" {...S} />
    <circle cx="94" cy="72" r="3" fill="#B5443A" />
    {/* 紐 */}
    <path d="M40 100 q54 18 118 0" {...S} strokeWidth={1.2} />
  </svg>
);
const Panel4 = () => (
  <svg viewBox="0 0 200 140" className="w-full h-36">
    {/* 受け取る手 */}
    <path d="M30 120 q10 -30 40 -26 l8 2" {...S} />
    <path d="M170 120 q-10 -30 -40 -26 l-8 2" {...S} />
    <path d="M70 96 q30 14 60 0" {...S} />
    {/* 束 */}
    <rect x="66" y="40" width="68" height="34" rx="3" {...S} />
    <rect x="70" y="32" width="68" height="34" rx="3" {...S} opacity={0.6} />
    <path d="M66 44 L100 62 L134 44" {...S} />
    <circle cx="100" cy="62" r="2.8" fill="#B5443A" />
  </svg>
);

const PANELS = [
  { art: <Panel1 />, text: '毎朝ひとつ、問いが届きます。' },
  { art: <Panel2 />, text: '答えるのは、あなたの言葉だけ。' },
  { art: <Panel3 />, text: '答えは束になって、のこります。' },
  { art: <Panel4 />, text: 'いつか、大切な人へ。' },
];

type Draft = { id: string; relation: RecipientRelation; name: string; ageGroup: string };

const blankDraft = (): Draft => ({ id: newRecipientId(), relation: 'child', name: '', ageGroup: '未設定' });

export const OnboardingModal: React.FC<Props> = ({ isOpen, mode, initialRecipients, onSave, onClose }) => {
  const [panel, setPanel] = useState(0); // 0..3 = 4コマ, 4 = 宛先
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    initialRecipients && initialRecipients.length
      ? initialRecipients.map((r) => ({ id: r.id, relation: r.relation, name: r.name, ageGroup: r.ageGroup || '未設定' }))
      : [blankDraft()]
  );
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const atForm = mode === 'edit' || panel >= PANELS.length;

  const updateDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filled = drafts.filter((d) => d.name.trim());
    if (filled.length === 0) {
      setError('呼び名をひとり分は入力してください。（例: ひなた、お母さん、未来の僕）');
      return;
    }
    const now = new Date().toISOString();
    onSave(
      filled.map((d) => ({
        id: d.id,
        relation: d.relation,
        name: d.name.trim(),
        ageGroup: d.ageGroup === '未設定' ? undefined : d.ageGroup,
        updatedAt: now,
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#FAF7F0] border border-[#E0D8CB] rounded-2xl overflow-hidden my-6">
        {mode === 'edit' && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-[#6E685E] hover:text-[#2B2B2B] p-1.5 rounded-full hover:bg-[#EFE9DC] transition-colors cursor-pointer"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {!atForm ? (
          /* 4コマ */
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs tracking-widest text-[#8E877D]">NOCOSU</span>
              <button
                type="button"
                onClick={() => setPanel(PANELS.length)}
                className="text-xs text-[#8E877D] hover:text-[#2B2B2B] transition-colors py-1 px-2.5 rounded-lg hover:bg-[#EFE9DC] cursor-pointer"
              >
                とばす
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPanel((p) => Math.min(p + 1, PANELS.length))}
              className="w-full text-left cursor-pointer"
              aria-label="次へ"
            >
              <div className="bg-[#FCFAF6] border border-[#E0D8CB] rounded-2xl px-4 pt-6 pb-4">
                {PANELS[panel].art}
              </div>
              <p className="mt-5 text-center text-lg font-mincho text-[#2B2B2B] leading-relaxed">
                {PANELS[panel].text}
              </p>
            </button>

            {/* 進捗の点 */}
            <div className="flex items-center justify-center gap-2">
              {PANELS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPanel(i)}
                  aria-label={`${i + 1}コマ目`}
                  className={`w-2 h-2 rounded-full cursor-pointer ${i === panel ? 'bg-[#B5443A]' : 'bg-[#D6CFC3]'}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPanel((p) => p + 1)}
              className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span>{panel < PANELS.length - 1 ? 'つぎへ' : '誰に届けるかを決める'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* 宛先（1〜3人） */
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 max-h-[88vh] overflow-y-auto">
            <div className="text-center space-y-1.5">
              <h2 className="text-2xl font-mincho font-medium text-[#2B2B2B] tracking-wide">
                {mode === 'edit' ? '宛先' : '誰に届けますか'}
              </h2>
              <p className="text-xs text-[#6E685E] leading-relaxed">
                1人でも、3人まででも。あとから増やせます。<br />
                届ける相手は、一通ごとに選べます。
              </p>
            </div>

            {drafts.map((d, idx) => (
              <div key={d.id} className="washi-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8E877D] tracking-wider">{idx + 1}人目</span>
                  {drafts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.id !== d.id))}
                      className="text-[#8E877D] hover:text-[#2B2B2B] cursor-pointer"
                      aria-label="この宛先を外す"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {RELATIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => updateDraft(d.id, { relation: r.id })}
                      className={`py-2 px-1 rounded-lg text-xs border transition-all cursor-pointer ${
                        d.relation === r.id
                          ? 'bg-[#EFE9DC] text-[#2B2B2B] border-[#2B2B2B]'
                          : 'bg-transparent text-[#2B2B2B] border-[#E0D8CB] hover:border-[#2B2B2B]/50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={d.name}
                    onChange={(e) => {
                      updateDraft(d.id, { name: e.target.value });
                      if (error) setError('');
                    }}
                    placeholder="呼び名（例: たろう、お母さん）"
                    maxLength={20}
                    className="flex-1 px-3.5 py-2.5 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-sm text-[#2B2B2B] placeholder-[#A49E93] focus:outline-hidden focus:border-[#2B2B2B] transition-all"
                  />
                  <select
                    value={d.ageGroup}
                    onChange={(e) => updateDraft(d.id, { ageGroup: e.target.value })}
                    className="w-28 px-2 py-2.5 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-xs text-[#2B2B2B] focus:outline-hidden focus:border-[#2B2B2B]"
                    aria-label="相手の年代"
                  >
                    {AGE_GROUPS.map((ag) => (
                      <option key={ag} value={ag}>{ag}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {drafts.length < MAX_RECIPIENTS && (
              <button
                type="button"
                onClick={() => setDrafts((prev) => [...prev, blankDraft()])}
                className="w-full py-2.5 border border-dashed border-[#C4BCAB] text-[#6E685E] hover:text-[#2B2B2B] hover:border-[#2B2B2B] text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>もうひとり</span>
              </button>
            )}

            {error && (
              <p className="text-xs text-[#A94420] flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span>{mode === 'edit' ? '保存する' : 'はじめる'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

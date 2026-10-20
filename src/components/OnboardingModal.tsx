import React, { useState } from 'react';
import { RecipientProfile, RecipientRelation } from '../types';
import { Heart, User, Sparkles, AlertCircle, X, ArrowRight } from 'lucide-react';

interface Props {
  initialProfile?: RecipientProfile | null;
  isOpen: boolean;
  onSave: (profile: RecipientProfile) => void;
  onClose?: () => void;
  isEditMode?: boolean;
}

const RELATIONS: { id: RecipientRelation; label: string; description: string }[] = [
  { id: 'child', label: '子ども', description: '我が子や孫へ' },
  { id: 'partner', label: 'パートナー', description: '夫・妻・恋人へ' },
  { id: 'parent', label: '親', description: '父親・母親へ' },
  { id: 'friend', label: '友人', description: 'かけがえのない友へ' },
  { id: 'future_me', label: '未来の自分', description: 'いつかの自分へ' },
  { id: 'other', label: 'その他', description: '大切なあの人へ' },
];

const AGE_GROUPS = [
  '未設定',
  '乳幼児',
  '小学生',
  '中高生',
  '20代',
  '30〜40代',
  '50〜60代',
  'シニア',
];

export const OnboardingModal: React.FC<Props> = ({
  initialProfile,
  isOpen,
  onSave,
  onClose,
  isEditMode = false,
}) => {
  const [step, setStep] = useState<'intro' | 'form'>(isEditMode ? 'form' : 'intro');
  const [relation, setRelation] = useState<RecipientRelation>(
    initialProfile?.relation || 'child'
  );
  const [name, setName] = useState(initialProfile?.name || '');
  const [ageGroup, setAgeGroup] = useState(initialProfile?.ageGroup || '未設定');
  const [allowDeep, setAllowDeep] = useState(initialProfile?.allowDeep || false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('呼び名を入力してください。（例: ひなた、お母さん、未来の僕）');
      return;
    }

    const profile: RecipientProfile = {
      relation,
      name: name.trim(),
      ageGroup: ageGroup === '未設定' ? undefined : ageGroup,
      allowDeep,
      updatedAt: new Date().toISOString(),
    };

    onSave(profile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#FAF7F0] border border-[#E6E0D2] rounded-2xl shadow-xl overflow-hidden my-6">
        {/* Subtle decorative header bar */}
        <div className="h-1.5 bg-[#2F4F6F]" />

        {isEditMode && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-[#6E685E] hover:text-[#2B2B2B] p-1.5 rounded-full hover:bg-[#EFE9DC] transition-colors cursor-pointer"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {step === 'intro' && !isEditMode ? (
          /* Step 1: Prologue / Introduction Screen */
          <div className="p-6 md:p-8 space-y-6 text-center">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="text-xs text-[#8E877D] hover:text-[#2B2B2B] transition-colors py-1 px-2.5 rounded-lg hover:bg-[#EFE9DC] cursor-pointer"
              >
                スキップ
              </button>
            </div>

            <div className="space-y-4 py-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#EAE0D0] text-[#2F4F6F] shadow-2xs">
                <Sparkles className="w-6 h-6 stroke-[1.8]" />
              </div>

              <h2 className="text-2xl font-mincho font-bold text-[#2B2B2B] tracking-wider">
                NOCOSU
              </h2>

              <div className="space-y-3 pt-2 text-[#2B2B2B]">
                <p className="text-base font-mincho font-medium leading-relaxed">
                  毎朝ひとつ、<br />
                  <span className="text-[#2F4F6F] font-bold">大切な人の声</span>で質問が届きます。
                </p>
                <p className="text-sm font-mincho text-[#524E48] leading-relaxed">
                  答えるのはあなたの言葉。<br />
                  AIは一文字も書きません。
                </p>
              </div>
            </div>

            <div className="pt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-full py-3.5 px-6 bg-[#2F4F6F] hover:bg-[#233B53] text-white font-medium rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <span>宛先を決める</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Recipient Selection Form */
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#EAE0D0] text-[#2F4F6F] mb-1">
                <Heart className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h2 className="text-2xl font-mincho font-bold text-[#2B2B2B] tracking-wide">
                {isEditMode ? '宛先の設定' : '誰に、のこしますか'}
              </h2>
              <p className="text-sm text-[#6E685E] leading-relaxed">
                あなたの言葉を受け取る相手を1人決めます。<br />
                毎朝、その人からの問いかけとして届きます。
              </p>
            </div>

          {/* Relation Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#6E685E] tracking-wider uppercase">
              間柄を選ぶ
            </label>
            <div className="grid grid-cols-3 gap-2">
              {RELATIONS.map((item) => {
                const isSelected = relation === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRelation(item.id)}
                    className={`py-2.5 px-2 rounded-xl text-center border transition-all text-sm flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-[#2F4F6F] text-white border-[#2F4F6F] shadow-xs'
                        : 'bg-[#FCFAF6] text-[#2B2B2B] border-[#E5DFD3] hover:border-[#C4BCAB]'
                    }`}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        isSelected ? 'text-white/80' : 'text-[#8E877D]'
                      }`}
                    >
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#6E685E] tracking-wider uppercase">
              普段の呼び名 <span className="text-[#C05621]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="例: たろう、お母さん、未来の僕"
                maxLength={20}
                className="w-full px-3.5 py-2.5 bg-[#FCFAF6] border border-[#E5DFD3] rounded-xl text-[#2B2B2B] placeholder-[#A49E93] focus:outline-hidden focus:ring-2 focus:ring-[#2F4F6F]/30 focus:border-[#2F4F6F] transition-all"
              />
              <User className="absolute right-3.5 top-3 w-4 h-4 text-[#A49E93] pointer-events-none" />
            </div>
            {error && (
              <p className="text-xs text-[#C05621] flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          {/* Age group selection (optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#6E685E] tracking-wider uppercase">
              相手の年代（任意）
            </label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FCFAF6] border border-[#E5DFD3] rounded-xl text-[#2B2B2B] focus:outline-hidden focus:ring-2 focus:ring-[#2F4F6F]/30 focus:border-[#2F4F6F] transition-all"
            >
              {AGE_GROUPS.map((ag) => (
                <option key={ag} value={ag}>
                  {ag}
                </option>
              ))}
            </select>
          </div>

          {/* Deep questions toggle */}
          <div className="p-4 rounded-xl bg-[#F4EFE6] border border-[#E5DFD3] space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-[#2B2B2B] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#2F4F6F]" />
                  深い質問も含める
                </span>
                <p className="text-xs text-[#6E685E] leading-relaxed">
                  後悔や人生の歩み、大切な別れに関する問いも含めます。（全体の15%以下。いつでも設定から変更できます）
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={allowDeep}
                onClick={() => setAllowDeep(!allowDeep)}
                className={`shrink-0 w-12 h-6.5 rounded-full transition-colors relative focus:outline-hidden ${
                  allowDeep ? 'bg-[#2F4F6F]' : 'bg-[#D6CFC3]'
                }`}
              >
                <span
                  className={`inline-block w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform absolute top-0.5 ${
                    allowDeep ? 'translate-x-6 left-0.5' : 'translate-x-0.5 left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 px-6 bg-[#2F4F6F] hover:bg-[#233B53] text-white font-medium rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span>{isEditMode ? '設定を保存する' : 'この宛先ではじめる'}</span>
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

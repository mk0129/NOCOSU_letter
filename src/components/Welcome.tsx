import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PANELS } from './OnboardingModal';

interface Props {
  /** 招待で来た人には輪の名前を見せる */
  inviteCircleName?: string | null;
  onDone: (displayName: string) => void;
  busy?: boolean;
  error?: string;
}

/** 初回: 4コマ → あなたの呼び名。それだけ */
export const Welcome: React.FC<Props> = ({ inviteCircleName, onDone, busy, error }) => {
  const [panel, setPanel] = useState(0);
  const [name, setName] = useState('');
  const atForm = panel >= PANELS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#FAF7F0] border border-[#E0D8CB] rounded-2xl overflow-hidden my-6">
        {!atForm ? (
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs tracking-widest text-[#8E877D]">NOCOSU</span>
              <button type="button" onClick={() => setPanel(PANELS.length)} className="text-xs text-[#8E877D] hover:text-[#2B2B2B] py-1 px-2.5 rounded-lg cursor-pointer">
                とばす
              </button>
            </div>
            <button type="button" onClick={() => setPanel((p) => Math.min(p + 1, PANELS.length))} className="w-full text-left cursor-pointer" aria-label="次へ">
              <div className="bg-[#FCFAF6] border border-[#E0D8CB] rounded-2xl px-4 pt-6 pb-4">{PANELS[panel].art}</div>
              <p className="mt-5 text-center text-lg font-mincho text-[#2B2B2B] leading-relaxed">{PANELS[panel].text}</p>
            </button>
            <div className="flex items-center justify-center gap-2">
              {PANELS.map((_, i) => (
                <button key={i} type="button" onClick={() => setPanel(i)} aria-label={`${i + 1}コマ目`} className={`w-2 h-2 rounded-full cursor-pointer ${i === panel ? 'bg-[#B5443A]' : 'bg-[#D6CFC3]'}`} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPanel((p) => p + 1)}
              className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{panel < PANELS.length - 1 ? 'つぎへ' : 'はじめる'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onDone(name.trim());
            }}
            className="p-6 md:p-8 space-y-5"
          >
            <div className="text-center space-y-1.5">
              <h2 className="text-2xl font-mincho font-medium text-[#2B2B2B]">
                {inviteCircleName ? `「${inviteCircleName}」に招待されています` : 'あなたの呼び名'}
              </h2>
              <p className="text-xs text-[#6E685E] leading-relaxed">
                {inviteCircleName ? '家族に見える呼び名を入れてください。それだけで入れます。' : '手紙に添える名前です。家族に見えます。'}
              </p>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: お父さん、まさひろ"
              maxLength={20}
              autoFocus
              className="w-full px-3.5 py-3 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-base text-[#2B2B2B] placeholder-[#A49E93] focus:outline-hidden focus:border-[#2B2B2B]"
            />
            {error && <p className="text-xs text-[#A94420] leading-relaxed">{error}</p>}
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <span>{busy ? '入っています…' : inviteCircleName ? '輪に入る' : 'はじめる'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

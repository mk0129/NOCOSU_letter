import React, { useState } from 'react';
import { AnswerItem, RecipientProfile } from '../types';
import { formatJapaneseDate, formatPostmarkDate, getSolarTerm } from '../utils/storage';
import { shareOrDownloadAnswerCard } from '../utils/answerCard';
import { Share2, ArrowRight } from 'lucide-react';

interface Props {
  answer: AnswerItem;
  recipients: RecipientProfile[];
  onDone: () => void;
}

// 宛先の年代から「いつ読むか」をひとこと添える
function whenToRead(recipient: RecipientProfile): string {
  const age = recipient.ageGroup || '';
  if (recipient.relation === 'child') {
    if (age === '乳幼児') return `${recipient.name}が10歳のころ、読むかもしれない一通。`;
    if (age === '小学生') return `${recipient.name}が大人になったころ、読むかもしれない一通。`;
    return `いつか${recipient.name}が、読むかもしれない一通。`;
  }
  if (recipient.relation === 'future_me') return '10年後のあなたが、読むかもしれない一通。';
  return `いつか${recipient.name}が、読むかもしれない一通。`;
}

/** 一通目を封じた直後に、手紙の体裁で見せる */
export const FirstLetterPreview: React.FC<Props> = ({ answer, recipients, onDone }) => {
  const chosen = recipients.filter((r) => (answer.recipientIds || []).includes(r.id));
  const recipient: RecipientProfile = chosen[0] || recipients[0];
  const toLabel = chosen.map((r) => r.name).join('・') || recipient.name;
  const voiceName = recipients.length === 1 ? recipients[0].name : '聞き手';
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await shareOrDownloadAnswerCard({ ...answer, recipientName: toLabel });
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#FAF7F0] border border-[#E0D8CB] rounded-2xl overflow-hidden my-6 p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
        <p className="text-center text-sm font-mincho text-[#524E48]">{whenToRead(recipient)}</p>

        {/* 手紙 */}
        <div className="relative bg-[#FCFAF6] border border-[#E0D8CB] rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <span className="text-[11px] text-[#8E877D] tracking-widest pt-2">{toLabel} へ</span>
            <div className="w-14 h-14 rounded-full border border-[#2B2B2B] flex flex-col items-center justify-center text-[#2B2B2B]">
              <span className="text-[9px] font-medium">{formatPostmarkDate(answer.date)}</span>
              <span className="w-6 border-t border-[#2B2B2B] my-0.5" />
              <span className="text-[10px] font-mincho">{getSolarTerm(answer.date)}</span>
            </div>
          </div>
          <h3 className="font-hand text-xl text-[#2B2B2B] leading-relaxed">{answer.questionText}</h3>
          <p className="text-sm font-mincho text-[#2B2B2B] leading-[1.9] whitespace-pre-wrap">{answer.text}</p>
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-[#8E877D]">{formatJapaneseDate(answer.date)}</span>
            <span className="inline-flex items-center gap-1 text-[#B5443A]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B5443A]" />
              <span className="text-[11px]">封</span>
            </span>
          </div>
        </div>

        <p className="text-xs text-[#6E685E] text-center leading-relaxed">
          一通目がのこりました。明日の朝、{voiceName === '聞き手' ? '次の問い' : `${voiceName}から次の問い`}が届きます。
        </p>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-3 px-6 border border-[#E0D8CB] hover:border-[#2B2B2B] bg-transparent text-[#2B2B2B] text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            <span>{isExporting ? '作っています…' : 'この一通を画像にして持ち出す'}</span>
          </button>
          <button
            type="button"
            onClick={onDone}
            className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <span>ホームへ</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

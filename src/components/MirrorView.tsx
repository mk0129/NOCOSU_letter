import React, { useState } from 'react';
import { AnswerItem, MirrorGeneration, MirrorItem } from '../types';
import { apiGenerateMirror } from '../utils/api';
import { getMirrorCache, saveMirrorCache, formatJapaneseDate } from '../utils/storage';
import { Sparkles, RefreshCw, Quote, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';

interface Props {
  answers: AnswerItem[];
  onNavigateToAnswer?: (answerId: string) => void;
}

export const MirrorView: React.FC<Props> = ({ answers }) => {
  const [mirrorData, setMirrorData] = useState<MirrorGeneration | null>(() => getMirrorCache());
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const answerMap = new Map(answers.map((a) => [a.id, a]));

  const handleGenerateMirror = async () => {
    if (answers.length === 0) {
      setErrorMsg('まだ言葉がのこされていません。ホームから質問に答えてみましょう。');
      return;
    }

    setIsGenerating(true);
    setErrorMsg('');

    try {
      const items = await apiGenerateMirror(answers);

      if (items.length === 0) {
        setErrorMsg('言葉を映し出すことができませんでした。もう少し回答が溜まってから再度お試しください。');
      } else {
        const newCache: MirrorGeneration = {
          generatedAt: new Date().toISOString(),
          items,
        };
        saveMirrorCache(newCache);
        setMirrorData(newCache);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('鏡を映し出す際にエラーが発生しました。時間をおいてもう一度お試しください。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-2 pt-1 border-b border-[#E6E0D2] pb-4">
        <span className="text-[11px] tracking-widest text-[#2F4F6F] font-semibold uppercase font-sans">
          あなたの言葉から
        </span>
        <h2 className="text-2xl font-mincho font-bold text-[#2B2B2B]">
          鏡（かがみ）
        </h2>
        {/* Mandatory Note */}
        <p className="text-xs text-[#6E685E] leading-relaxed">
          あなたがこれまでに残した言葉から、心に残る一節を静かに映し出します。
        </p>
        <div className="inline-block px-3 py-1.5 rounded-lg bg-[#FAF5EB] border border-[#E8DFC9] text-xs font-medium text-[#7A4B1F]">
          要約ではなく、あなたが書いたままの言葉です
        </div>
      </div>

      {/* Action / Trigger Area */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-[#FAF7F0] border border-[#E6E0D2]">
        <div className="text-xs text-[#6E685E]">
          {mirrorData ? (
            <span>
              最終更新: {formatJapaneseDate(mirrorData.generatedAt.split('T')[0])}
            </span>
          ) : (
            <span>これまでの記録から、言葉の鏡を映します</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleGenerateMirror}
          disabled={isGenerating || answers.length === 0}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#2F4F6F] hover:bg-[#233B53] disabled:bg-[#A3B2C3] text-white text-xs font-medium rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>言葉を映しています...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{mirrorData ? 'もう一度言葉を映す' : '言葉を映す'}</span>
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#FAF0EA] border border-[#EACEC0] text-xs text-[#A94420] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Mirror Quotes List */}
      {mirrorData && mirrorData.items.length > 0 ? (
        <div className="space-y-4">
          {mirrorData.items.map((item, idx) => {
            const originalAnswer = answerMap.get(item.answerId);

            return (
              <div
                key={idx}
                className="washi-card rounded-2xl p-6 space-y-4 border-t-2 border-t-[#2F4F6F] relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-[#EAE0D0] text-[#2F4F6F] text-xs font-semibold tracking-wide">
                    {item.label}
                  </span>
                  {originalAnswer && (
                    <span className="text-[11px] text-[#8E877D]">
                      {formatJapaneseDate(originalAnswer.date)} の記録
                    </span>
                  )}
                </div>

                {/* Quote Display */}
                <div className="relative pl-6 pr-2 py-1">
                  <Quote className="absolute left-0 top-0 w-4 h-4 text-[#C4BCAB] rotate-180" />
                  <p className="text-base md:text-lg font-mincho font-bold text-[#2B2B2B] leading-relaxed">
                    「{item.quote}」
                  </p>
                </div>

                {/* Question context */}
                {originalAnswer && (
                  <div className="pt-2 border-t border-[#EAE3D5] text-[11px] text-[#8E877D] flex items-center justify-between">
                    <span className="line-clamp-1">
                      問い: {originalAnswer.textForRecipient || originalAnswer.questionText}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !isGenerating && (
          <div className="text-center py-16 washi-card rounded-2xl p-6 space-y-3">
            <Sparkles className="w-8 h-8 mx-auto text-[#2F4F6F]/60" />
            <h3 className="text-base font-mincho font-bold text-[#2B2B2B]">
              まだ言葉が映されていません
            </h3>
            <p className="text-xs text-[#6E685E] max-w-xs mx-auto leading-relaxed">
              「言葉を映す」ボタンを押すと、あなたが書いた文章の中から、心に残る一節をそのまま抜き出して映し出します。
            </p>
          </div>
        )
      )}
    </div>
  );
};

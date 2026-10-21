import React, { useState, useMemo } from 'react';
import { AnswerItem } from '../types';
import { formatJapaneseDate } from '../utils/storage';
import { shareOrDownloadAnswerCard } from '../utils/answerCard';
import questionsData from '../data/questions.json';
import { QuestionItem, RecipientProfile } from '../types';
import sampleLetter from '../data/sample_letter.json';

const QUESTION_BANK: QuestionItem[] = questionsData as QuestionItem[];
import {
  Search,
  Filter,
  Calendar,
  MessageCircle,
  X,
  ChevronRight,
  Trash2,
  Share2,
} from 'lucide-react';

interface Props {
  answers: AnswerItem[];
  recipients: RecipientProfile[];
  onSelectAnswer?: (answer: AnswerItem) => void;
  onDeleteAnswer: (id: string) => void;
}

export const HistoryView: React.FC<Props> = ({ answers: allAnswers, recipients, onDeleteAnswer }) => {
  const [recipientFilter, setRecipientFilter] = useState<string>('all');
  const answers = recipientFilter === 'all' ? allAnswers : allAnswers.filter((a) => (a.recipientIds || []).includes(recipientFilter));
  const [selectedTheme, setSelectedTheme] = useState<string>('すべて');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDetailAnswer, setActiveDetailAnswer] = useState<AnswerItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isExportingCard, setIsExportingCard] = useState(false);

  const handleExportCard = async (answer: AnswerItem) => {
    setIsExportingCard(true);
    try {
      await shareOrDownloadAnswerCard(answer);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExportingCard(false);
    }
  };

  // Extract all distinct themes
  const themes = useMemo(() => {
    const list = ['すべて'];
    answers.forEach((a) => {
      if (a.theme && !list.includes(a.theme)) {
        list.push(a.theme);
      }
    });
    return list;
  }, [answers]);

  // Filter and search
  const filteredAnswers = useMemo(() => {
    return answers.filter((a) => {
      const matchTheme = selectedTheme === 'すべて' || a.theme === selectedTheme;
      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        a.text.toLowerCase().includes(query) ||
        a.questionText.toLowerCase().includes(query) ||
        (a.textForRecipient && a.textForRecipient.toLowerCase().includes(query)) ||
        (a.followUpAnswer && a.followUpAnswer.toLowerCase().includes(query));
      return matchTheme && matchQuery;
    });
  }, [answers, selectedTheme, searchQuery]);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-1 pt-1 border-b border-[#E0D8CB] pb-3">
        <h2 className="text-xl font-mincho font-medium text-[#2B2B2B]">
          束
        </h2>
        <p className="text-xs text-[#6E685E]">
          日々の問いにあなたが答えてきた記録です（{answers.length}通）
        </p>
      </div>

      {/* 宛先で絞る */}
      {recipients.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[{ id: 'all', name: '全員' }, ...recipients].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRecipientFilter(r.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border cursor-pointer ${
                recipientFilter === r.id ? 'border-[#2B2B2B] text-[#2B2B2B] font-medium' : 'border-[#E0D8CB] text-[#6E685E]'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {/* 束が空のとき: つくった人から */}
      {allAnswers.length === 0 && (
        <div className="washi-card rounded-2xl p-5 space-y-3">
          <span className="text-[11px] text-[#8E877D] tracking-widest">つくった人から</span>
          <h3 className="font-hand text-lg text-[#2B2B2B]">{sampleLetter.question}</h3>
          <p className="text-sm font-mincho text-[#2B2B2B] leading-[1.9] whitespace-pre-wrap">{sampleLetter.body}</p>
          <p className="text-right font-hand text-sm text-[#524E48]">{sampleLetter.from}</p>
        </div>
      )}

      {/* 百通の地図: 問いごとに、答えた分だけ灯りがつく */}
      <div className="washi-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#6E685E]">百通の地図</span>
          <span className="text-[11px] text-[#8E877D]">
            {QUESTION_BANK.filter((q) => answers.some((a) => a.questionId === q.id)).length} / {QUESTION_BANK.length} の問いに答えました
          </span>
        </div>
        <div className="space-y-1.5">
          {Array.from(new Set(QUESTION_BANK.map((q) => q.theme))).map((theme) => {
            const qs = QUESTION_BANK.filter((q) => q.theme === theme);
            return (
              <div key={theme} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[10px] text-[#8E877D] truncate">{theme}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {qs.map((q) => {
                    const ans = answers.find((a) => a.questionId === q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        title={q.text}
                        onClick={() => ans && setActiveDetailAnswer(ans)}
                        className={`w-5 h-5 rounded-sm border transition-colors ${
                          ans
                            ? 'bg-[#B5443A] border-[#B5443A] cursor-pointer'
                            : 'bg-transparent border-[#E0D8CB] cursor-default'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="言葉や質問を検索..."
          className="w-full pl-9 pr-4 py-2.5 bg-[#FAF7F0] border border-[#E0D8CB] rounded-xl text-xs text-[#2B2B2B] placeholder-[#A49E93] focus:outline-hidden focus:border-[#2B2B2B] transition-all"
        />
        <Search className="absolute left-3 top-3 w-4 h-4 text-[#A49E93]" />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-[#A49E93] hover:text-[#524E48] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Theme Filters (horizontal scroll) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {themes.map((t) => {
          const isSelected = selectedTheme === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTheme(t)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                isSelected
                  ? 'bg-transparent text-[#2B2B2B] border border-[#2B2B2B] font-medium'
                  : 'bg-transparent text-[#6E685E] border border-[#E0D8CB] hover:border-[#2B2B2B]/50'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Answers List */}
      {filteredAnswers.length === 0 ? (
        <div className="text-center py-16 washi-card rounded-2xl p-6 space-y-2">
          <p className="text-sm text-[#6E685E] font-mincho">
            {answers.length === 0
              ? 'まだ一通も。今日の封筒から'
              : '該当する言葉が見つかりませんでした。'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnswers.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveDetailAnswer(item)}
              className="washi-card rounded-2xl p-4.5 space-y-2.5 hover:border-[#2B2B2B]/50 cursor-pointer transition-all active:scale-[0.995]"
            >
              <div className="flex items-center justify-between text-[11px] text-[#8E877D]">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-[#EFE9DC] text-[#524E48] font-medium">
                    {item.theme}
                  </span>
                  <span>宛先: {item.recipientName}</span>
                </div>
                <span>{formatJapaneseDate(item.date)}</span>
              </div>

              <h3 className="text-sm font-mincho font-medium text-[#2B2B2B] line-clamp-2 leading-relaxed">
                {item.textForRecipient || item.questionText}
              </h3>

              <p className="text-xs text-[#524E48] font-mincho line-clamp-2 leading-relaxed">
                {item.text}
              </p>

              <div className="flex items-center justify-between pt-1 text-[11px] text-[#8E877D]">
                {item.followUpAnswer ? (
                  <span className="inline-flex items-center gap-1 text-[#524E48]">
                    <MessageCircle className="w-3.5 h-3.5" />
                    追い質問の回答あり
                  </span>
                ) : (
                  <span />
                )}
                <span className="flex items-center gap-0.5 text-[#2B2B2B] font-medium">
                  全文を読む
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {activeDetailAnswer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-[#FAF7F0] border border-[#E0D8CB] rounded-2xl overflow-hidden my-6">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between text-xs text-[#8E877D]">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EFE9DC] text-[#524E48] font-medium">
                    {activeDetailAnswer.theme}
                  </span>
                  <span>宛先: {activeDetailAnswer.recipientName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDetailAnswer(null)}
                  className="p-1 rounded-full text-[#6E685E] hover:bg-[#EFE9DC] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-[#8E877D]">
                  {formatJapaneseDate(activeDetailAnswer.date)} にのこした言葉
                </span>
                <h3 className="text-lg font-mincho font-medium text-[#2B2B2B] leading-relaxed">
                  {activeDetailAnswer.textForRecipient || activeDetailAnswer.questionText}
                </h3>
                {activeDetailAnswer.textForRecipient &&
                  activeDetailAnswer.textForRecipient !== activeDetailAnswer.questionText && (
                    <p className="text-xs text-[#8E877D]">
                      原題: {activeDetailAnswer.questionText}
                    </p>
                  )}
              </div>

              {/* Main text */}
              <div className="p-4 rounded-xl bg-[#FCFAF6] border border-[#E0D8CB]">
                <p className="text-sm font-mincho text-[#2B2B2B] leading-relaxed whitespace-pre-wrap">
                  {activeDetailAnswer.text}
                </p>
              </div>

              {/* いつ読んでほしいか */}
              {activeDetailAnswer.readWhen && (
                <p className="text-[11px] text-[#8E877D]">
                  いつ読んでほしいか: <span className="text-[#2B2B2B]">{activeDetailAnswer.readWhen}</span>
                </p>
              )}

              {/* 聞き手との往復（2往復目以降） */}
              {activeDetailAnswer.dialogue && activeDetailAnswer.dialogue.length > 1 && (
                <div className="p-4 rounded-xl bg-[#F5EFE4] border border-[#E0D8CB] space-y-3">
                  <span className="text-xs text-[#524E48] font-medium">{activeDetailAnswer.recipientName}との往復</span>
                  {activeDetailAnswer.dialogue.map((d, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-xs font-hand text-[#524E48]">{d.q}</p>
                      <p className="text-sm font-mincho text-[#2B2B2B] leading-relaxed whitespace-pre-wrap pl-3 border-l border-[#E0D8CB]">{d.a}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Follow-up section（1往復のみのとき） */}
              {activeDetailAnswer.followUpQuestion && !(activeDetailAnswer.dialogue && activeDetailAnswer.dialogue.length > 1) && (
                <div className="p-4 rounded-xl bg-[#F5EFE4] border border-[#E0D8CB] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#524E48] font-medium">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>追い質問: {activeDetailAnswer.followUpQuestion}</span>
                  </div>
                  {activeDetailAnswer.followUpAnswer ? (
                    <p className="text-sm font-mincho text-[#2B2B2B] leading-relaxed whitespace-pre-wrap">
                      {activeDetailAnswer.followUpAnswer}
                    </p>
                  ) : (
                    <p className="text-xs text-[#8E877D] italic">
                      （追い質問への回答はありません）
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-[#E0D8CB]">
                {confirmDeleteId === activeDetailAnswer.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#2B2B2B]">本当に削除しますか？</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteAnswer(activeDetailAnswer.id);
                        setActiveDetailAnswer(null);
                        setConfirmDeleteId(null);
                      }}
                      className="px-2.5 py-1 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs rounded-lg font-medium cursor-pointer"
                    >
                      削除
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-xs text-[#6E685E] cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(activeDetailAnswer.id)}
                    className="inline-flex items-center gap-1 text-xs text-[#6E685E] hover:text-[#2B2B2B] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>この記録を削除</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isExportingCard}
                  onClick={() => handleExportCard(activeDetailAnswer)}
                  title="この一通を画像にして保存・共有"
                  className="inline-flex items-center gap-1 px-3 py-2 border border-[#E0D8CB] bg-transparent hover:border-[#2B2B2B] text-[#2B2B2B] text-xs rounded-xl font-medium cursor-pointer disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isExportingCard ? '作っています…' : '画像にする'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailAnswer(null)}
                  className="px-4 py-2 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs rounded-xl font-medium cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

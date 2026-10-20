import React, { useState } from 'react';
import {
  AnswerItem,
  RecipientProfile,
  CompiledLetter,
  LetterSection,
} from '../types';
import { apiCompileLetter } from '../utils/api';
import {
  getCompiledLetters,
  saveCompiledLetter,
  formatJapaneseDate,
  getBookletOrderUrl,
} from '../utils/storage';
import {
  Mail,
  CheckSquare,
  Square,
  Sparkles,
  Download,
  Printer,
  ChevronLeft,
  ArrowRight,
  Loader2,
  FileText,
  AlertCircle,
  Copy,
  Check,
  BookOpen,
  ExternalLink,
  X,
  QrCode,
} from 'lucide-react';

interface Props {
  answers: AnswerItem[];
  recipient: RecipientProfile;
}

export const LetterView: React.FC<Props> = ({ answers, recipient }) => {
  // Step 1: Selection, Step 2: Compiled Letter Preview
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    answers.slice(0, 5).map((a) => a.id)
  );
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledLetter, setCompiledLetter] = useState<CompiledLetter | null>(null);
  const [includeFollowUps, setIncludeFollowUps] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [showBookletModal, setShowBookletModal] = useState(false);

  const answerMap = new Map(answers.map((a) => [a.id, a]));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === answers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(answers.map((a) => a.id));
    }
  };

  // Compile with Gemini
  const handleCompile = async () => {
    if (selectedIds.length === 0) {
      setErrorMessage('手紙に含める言葉を1つ以上選んでください。');
      return;
    }

    setIsCompiling(true);
    setErrorMessage('');

    try {
      const selectedAnswers = selectedIds
        .map((id) => answerMap.get(id))
        .filter((a): a is AnswerItem => !!a);

      const result = await apiCompileLetter(selectedAnswers, recipient);

      const letter: CompiledLetter = {
        id: `letter-${Date.now()}`,
        createdAt: new Date().toISOString(),
        title: result.title,
        recipientName: recipient.name,
        sections: result.sections,
        answerIds: selectedIds,
      };

      saveCompiledLetter(letter);
      setCompiledLetter(letter);
      setStep('preview');
    } catch (e) {
      console.error(e);
      setErrorMessage('手紙の編纂に失敗しました。時間をおいて再試行してください。');
    } finally {
      setIsCompiling(false);
    }
  };

  // Export to Markdown
  const handleExportMarkdown = () => {
    if (!compiledLetter) return;

    let md = `# ${compiledLetter.title}\n\n`;
    md += `宛先: ${compiledLetter.recipientName}\n`;
    md += `編纂日: ${formatJapaneseDate(compiledLetter.createdAt.split('T')[0])}\n\n`;
    md += `---\n\n`;

    compiledLetter.sections.forEach((sec, idx) => {
      const ans = answerMap.get(sec.answerId);
      if (!ans) return;

      md += `## 第${idx + 1}章: ${sec.heading}\n\n`;
      md += `> 問い: ${ans.textForRecipient || ans.questionText}\n\n`;
      md += `${ans.text}\n\n`;

      if (includeFollowUps && ans.followUpQuestion && ans.followUpAnswer) {
        md += `*追い質問: ${ans.followUpQuestion}*\n`;
        md += `> ${ans.followUpAnswer}\n\n`;
      }

      md += `\n`;
    });

    md += `---\n\n`;
    md += `*この手紙は、あなた自身がのこした言葉をもとに「NOCOSU」で編纂されました。*\n`;

    // Download as .md file
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${compiledLetter.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy Markdown to Clipboard
  const handleCopyMarkdown = () => {
    if (!compiledLetter) return;
    let md = `# ${compiledLetter.title}\n\n`;
    md += `宛先: ${compiledLetter.recipientName}\n\n`;
    compiledLetter.sections.forEach((sec, idx) => {
      const ans = answerMap.get(sec.answerId);
      if (!ans) return;
      md += `## ${sec.heading}\n\n${ans.text}\n\n`;
      if (includeFollowUps && ans.followUpAnswer) {
        md += `${ans.followUpAnswer}\n\n`;
      }
    });

    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-1.5 pt-1 border-b border-[#E6E0D2] pb-4 no-print">
        <span className="text-[11px] tracking-widest text-[#2F4F6F] font-semibold uppercase font-sans">
          言葉を編む
        </span>
        <h2 className="text-2xl font-mincho font-bold text-[#2B2B2B]">
          手紙を編む
        </h2>
        <p className="text-xs text-[#6E685E] leading-relaxed">
          のこした言葉を選び、一通の手紙として編纂します。<br />
          AIは本文を一文字も書きません。順序と見出しだけを静かに整えます。
        </p>
      </div>

      {step === 'select' ? (
        /* STEP 1: SELECT ANSWERS */
        <div className="space-y-5 no-print">
          {answers.length === 0 ? (
            <div className="text-center py-16 washi-card rounded-2xl p-6 space-y-2">
              <p className="text-sm text-[#6E685E] font-mincho">
                まだのこした言葉がありません。
              </p>
              <p className="text-xs text-[#8E877D]">
                ホームから質問に答えてから、手紙を編んでみましょう。
              </p>
            </div>
          ) : (
            <>
              {/* Selection Bar */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E6E0D2] text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-[#2F4F6F] font-semibold hover:text-[#233B53] cursor-pointer"
                >
                  {selectedIds.length === answers.length ? (
                    <CheckSquare className="w-4 h-4 text-[#2F4F6F]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#8E877D]" />
                  )}
                  <span>すべて選択（{selectedIds.length} / {answers.length}件）</span>
                </button>

                <span className="text-[#8E877D]">3つ以上の選択をおすすめします</span>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-[#FAF0EA] border border-[#EACEC0] text-xs text-[#A94420] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Answers Check List */}
              <div className="space-y-2.5">
                {answers.map((ans) => {
                  const isChecked = selectedIds.includes(ans.id);
                  return (
                    <div
                      key={ans.id}
                      onClick={() => toggleSelect(ans.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isChecked
                          ? 'bg-[#FAF7F0] border-[#2F4F6F] shadow-xs'
                          : 'bg-[#FCFAF6] border-[#E5DDD0] opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="pt-0.5 shrink-0 text-[#2F4F6F]">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#2F4F6F]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#C4BCAB]" />
                        )}
                      </div>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] text-[#8E877D]">
                          <span className="px-2 py-0.2 rounded-full bg-[#EFE9DC] text-[#524E48]">
                            {ans.theme}
                          </span>
                          <span>{formatJapaneseDate(ans.date)}</span>
                        </div>
                        <h4 className="text-xs font-mincho font-bold text-[#2B2B2B] line-clamp-1">
                          {ans.textForRecipient || ans.questionText}
                        </h4>
                        <p className="text-xs text-[#6E685E] font-mincho line-clamp-2">
                          {ans.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCompile}
                  disabled={isCompiling || selectedIds.length === 0}
                  className="w-full py-3.5 px-6 bg-[#2F4F6F] hover:bg-[#233B53] disabled:bg-[#A3B2C3] text-white font-medium rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isCompiling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>章立てを編纂しています...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>選択した言葉で手紙を編む（{selectedIds.length}編）</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        /* STEP 2: COMPILED LETTER PREVIEW */
        compiledLetter && (
          <div className="space-y-6">
            {/* Top Toolbar (No print) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E6E0D2] no-print">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="inline-flex items-center gap-1 text-xs text-[#6E685E] hover:text-[#2B2B2B] py-1 px-2 rounded-lg hover:bg-[#EFE9DC]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>選択に戻る</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Toggle follow-ups */}
                <label className="flex items-center gap-1.5 text-xs text-[#524E48] cursor-pointer mr-1">
                  <input
                    type="checkbox"
                    checked={includeFollowUps}
                    onChange={(e) => setIncludeFollowUps(e.target.checked)}
                    className="rounded text-[#2F4F6F] focus:ring-0"
                  />
                  <span>追い質問も含める</span>
                </label>

                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  title="Markdownをコピー"
                  className="p-2 rounded-lg border border-[#E5DDD0] bg-[#FCFAF6] hover:bg-[#EFE9DC] text-[#524E48] transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  title="Markdownファイルで書き出し"
                  className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg border border-[#E5DDD0] bg-[#FCFAF6] hover:bg-[#EFE9DC] text-xs font-medium text-[#524E48] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.md 書き出し</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  title="手紙を印刷"
                  className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg bg-[#2F4F6F] hover:bg-[#233B53] text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>印刷する</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBookletModal(true)}
                  title="冊子にする"
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#FAF0E6] hover:bg-[#F3E5D4] text-xs font-medium text-[#7A4B1F] border border-[#E0CFBD] transition-colors cursor-pointer shadow-2xs"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#C05621]" />
                  <span>冊子にする</span>
                </button>
              </div>
            </div>

            {/* The Actual Letter Paper View (Print Friendly) */}
            <div className="washi-card rounded-2xl p-6 md:p-10 space-y-8 bg-[#FCFAF6] border border-[#E5DDD0] print-page">
              {/* Letter Title & Header */}
              <div className="text-center space-y-3 pb-6 border-b border-[#E6E0D2]">
                <span className="text-xs text-[#8E877D] tracking-widest block font-sans">
                  {recipient.name} へ
                </span>
                <h1 className="text-2xl md:text-3xl font-mincho font-bold text-[#2B2B2B] leading-tight">
                  {compiledLetter.title}
                </h1>
                <span className="text-xs text-[#8E877D] block">
                  {formatJapaneseDate(compiledLetter.createdAt.split('T')[0])}
                </span>
              </div>

              {/* Letter Sections */}
              <div className="space-y-10">
                {compiledLetter.sections.map((section, idx) => {
                  const ans = answerMap.get(section.answerId);
                  if (!ans) return null;

                  return (
                    <article key={idx} className="space-y-4">
                      {/* Section heading */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-[#2F4F6F] px-2.5 py-0.5 rounded-full bg-[#EAF0F6] font-sans">
                          第{idx + 1}章
                        </span>
                        <h3 className="text-lg font-mincho font-bold text-[#2B2B2B]">
                          {section.heading}
                        </h3>
                      </div>

                      {/* The prompt that sparked the text (smaller) */}
                      <p className="text-xs text-[#8E877D] font-sans pl-1">
                        問い: {ans.textForRecipient || ans.questionText}
                      </p>

                      {/* Main text - untouched, exact user's words */}
                      <div className="p-5 rounded-xl bg-[#FAF7F0] border border-[#EAE3D5]">
                        <p className="text-sm md:text-base font-mincho text-[#2B2B2B] leading-relaxed whitespace-pre-wrap">
                          {ans.text}
                        </p>
                      </div>

                      {/* Follow-up answer if included */}
                      {includeFollowUps &&
                        ans.followUpQuestion &&
                        ans.followUpAnswer && (
                          <div className="ml-4 pl-4 border-l-2 border-[#2F4F6F]/40 space-y-1 text-xs text-[#524E48]">
                            <span className="font-semibold text-[#2F4F6F] block">
                              追い質問: {ans.followUpQuestion}
                            </span>
                            <p className="font-mincho whitespace-pre-wrap leading-relaxed">
                              {ans.followUpAnswer}
                            </p>
                          </div>
                        )}
                    </article>
                  );
                })}
              </div>

              {/* Letter Footer note */}
              <div className="pt-8 border-t border-[#E6E0D2] text-center space-y-1">
                <p className="text-xs text-[#8E877D] font-mincho">
                  この手紙は、あなた自身がのこした言葉の集まりです。
                </p>
                <p className="text-[11px] text-[#A49E93]">
                  NOCOSU
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Booklet Info & Order Modal */}
      {showBookletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs overflow-y-auto no-print">
          <div className="relative w-full max-w-md bg-[#FAF7F0] border border-[#E6E0D2] rounded-2xl shadow-xl overflow-hidden my-6">
            <div className="h-1.5 bg-[#C05621]" />

            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#7A4B1F]">
                  <BookOpen className="w-4 h-4 text-[#C05621]" />
                  <span>製本・冊子化のご案内</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBookletModal(false)}
                  className="p-1 rounded-full text-[#6E685E] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-mincho font-bold text-[#2B2B2B]">
                  言葉を一冊の冊子に
                </h3>
                <p className="text-xs text-[#6E685E] leading-relaxed">
                  のこした言葉を手にとれる形にし、大切な人に届けるための製本仕様です。
                </p>
              </div>

              {/* Feature Cards */}
              <div className="space-y-2.5 text-xs text-[#524E48]">
                <div className="p-3.5 rounded-xl bg-[#FCFAF6] border border-[#E5DDD0] space-y-1">
                  <span className="font-bold text-[#2B2B2B] block">・ 判型: A5判</span>
                  <p className="text-[11px] text-[#6E685E] leading-relaxed">
                    手になじみ、本棚や引き出しにいつまでも大切に保管できるコンパクトな単行本サイズです。
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FCFAF6] border border-[#E5DDD0] space-y-1">
                  <span className="font-bold text-[#2B2B2B] block">・ 本人の言葉のまま（本文は一切整えません）</span>
                  <p className="text-[11px] text-[#6E685E] leading-relaxed">
                    AIや編集者が要約・修正を加えることは一切ありません。あなたの言い淀み、方言、息づかいをそのまま活かして印刷します。
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FCFAF6] border border-[#E5DDD0] space-y-1">
                  <span className="font-bold text-[#2B2B2B] flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-[#2F4F6F]" />
                    原音声へのQRコードを添える
                  </span>
                  <p className="text-[11px] text-[#6E685E] leading-relaxed">
                    音声で吹き込んだ言葉がある場合、紙面の該当章に生音声をそのまま再生できるQRコードを添えて製本します。
                  </p>
                </div>
              </div>

              {/* Action Button: Order Form Link */}
              <div className="pt-2 space-y-2">
                {(() => {
                  const orderUrl = getBookletOrderUrl();
                  if (orderUrl) {
                    return (
                      <a
                        href={orderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-4 bg-[#2F4F6F] hover:bg-[#233B53] text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                      >
                        <span>注文フォームへ</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    );
                  } else {
                    return (
                      <div className="space-y-1.5">
                        <div className="w-full py-3 px-4 bg-[#EFE9DC] text-[#8E877D] text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed">
                          <span>準備中（注文フォーム未設定）</span>
                        </div>
                        <p className="text-[11px] text-[#A49E93] text-center">
                          ※ 注文フォームのURLは「設定」画面からいつでも登録・変更できます。
                        </p>
                      </div>
                    );
                  }
                })()}

                <button
                  type="button"
                  onClick={() => setShowBookletModal(false)}
                  className="w-full py-2.5 px-4 bg-[#FCFAF6] hover:bg-[#EFE9DC] text-[#524E48] text-xs font-medium rounded-xl border border-[#E5DFD3] transition-colors cursor-pointer"
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

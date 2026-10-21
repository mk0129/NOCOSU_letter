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
  recipients: RecipientProfile[];
}

export const LetterView: React.FC<Props> = ({ answers, recipients }) => {
  // 宛先で絞る（全員 / 各宛先）
  const [filterId, setFilterId] = useState<string>(recipients.length === 1 ? recipients[0].id : 'all');
  const recipient: RecipientProfile | null =
    filterId === 'all' ? (recipients.length === 1 ? recipients[0] : null) : recipients.find((r) => r.id === filterId) || null;
  const visibleAnswers =
    filterId === 'all' ? answers : answers.filter((a) => (a.recipientIds || []).includes(filterId));
  const letterTo = recipient ? recipient.name : recipients.map((r) => r.name).join('・') || '大切な人';
  // Step 1: Selection, Step 2: Compiled Letter Preview
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    visibleAnswers.slice(0, 5).map((a) => a.id)
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
    if (selectedIds.length === visibleAnswers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleAnswers.map((a) => a.id));
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
        recipientName: letterTo,
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

      if (includeFollowUps && ans.dialogue && ans.dialogue.length > 0) {
        for (const d of ans.dialogue) {
          md += `*${d.q}*\n`;
          md += `> ${d.a}\n\n`;
        }
      } else if (includeFollowUps && ans.followUpQuestion && ans.followUpAnswer) {
        md += `*追い質問: ${ans.followUpQuestion}*\n`;
        md += `> ${ans.followUpAnswer}\n\n`;
      }
      if (ans.readWhen) md += `（いつ読んでほしいか: ${ans.readWhen}）\n\n`;

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
    compiledLetter.sections.forEach((sec) => {
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
      <div className="space-y-1.5 pt-1 border-b border-[#E0D8CB] pb-4 no-print">
        <span className="text-[11px] tracking-widest text-[#6E685E] font-medium uppercase font-sans">
          言葉を編む
        </span>
        <h2 className="text-2xl font-mincho font-medium text-[#2B2B2B]">
          束ねる
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
                まだ一通も。今日の封筒から
              </p>
            </div>
          ) : (
            <>
              {/* 宛先で絞る */}
              {recipients.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {[{ id: 'all', name: '全員' }, ...recipients].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setFilterId(r.id);
                        setSelectedIds([]);
                      }}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs border cursor-pointer ${
                        filterId === r.id ? 'border-[#2B2B2B] text-[#2B2B2B] font-medium' : 'border-[#E0D8CB] text-[#6E685E]'
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Selection Bar */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E0D8CB] text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-[#2B2B2B] font-medium hover:text-[#524E48] cursor-pointer"
                >
                  {selectedIds.length === visibleAnswers.length ? (
                    <CheckSquare className="w-4 h-4 text-[#2B2B2B]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#8E877D]" />
                  )}
                  <span>すべて選択（{selectedIds.length} / {visibleAnswers.length}件）</span>
                </button>

                <span className="text-[#8E877D]">3つ以上の選択をおすすめします</span>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-[#FAF0EA] border border-[#E0D8CB] text-xs text-[#A94420] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Answers Check List */}
              <div className="space-y-2.5">
                {visibleAnswers.map((ans) => {
                  const isChecked = selectedIds.includes(ans.id);
                  return (
                    <div
                      key={ans.id}
                      onClick={() => toggleSelect(ans.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isChecked
                          ? 'bg-[#FAF7F0] border-[#2B2B2B]'
                          : 'bg-[#FAF7F0]/60 border-[#E0D8CB] opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="pt-0.5 shrink-0 text-[#2B2B2B]">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#2B2B2B]" />
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
                        <h4 className="text-xs font-mincho font-medium text-[#2B2B2B] line-clamp-1">
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
                  className="w-full py-3.5 px-6 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 disabled:opacity-50 text-[#2B2B2B] font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isCompiling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>章立てを編纂しています...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
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
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-xl bg-[#FAF7F0] border border-[#E0D8CB] no-print">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="inline-flex items-center gap-1 text-xs text-[#6E685E] hover:text-[#2B2B2B] py-1 px-2 rounded-lg hover:bg-[#EFE9DC] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>選択に戻る</span>
              </button>

              <div className="flex items-center flex-wrap gap-2">
                {/* Toggle follow-ups */}
                <label className="flex items-center gap-1.5 text-xs text-[#524E48] cursor-pointer mr-1">
                  <input
                    type="checkbox"
                    checked={includeFollowUps}
                    onChange={(e) => setIncludeFollowUps(e.target.checked)}
                    className="rounded accent-[#2B2B2B] focus:ring-0"
                  />
                  <span>追い質問も含める</span>
                </label>

                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  title="Markdownをコピー"
                  className="p-2 rounded-lg border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-[#2B2B2B]" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  title="Markdownファイルで書き出し"
                  className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-xs font-medium text-[#2B2B2B] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.md 書き出し</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  title="手紙を印刷"
                  className="inline-flex items-center gap-1 py-1.5 px-3 rounded-lg border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-xs font-medium text-[#2B2B2B] transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>印刷する</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBookletModal(true)}
                  title="冊子にする"
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-xs font-medium text-[#2B2B2B] transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#2B2B2B]" />
                  <span>冊子にする</span>
                </button>
              </div>
            </div>

            {/* The Actual Letter Paper View (Print Friendly) */}
            <div className="washi-card rounded-2xl p-6 md:p-10 space-y-8 bg-[#FAF7F0] border border-[#E0D8CB] print-page">
              {/* Letter Title & Header */}
              <div className="text-center space-y-3 pb-6 border-b border-[#E0D8CB]">
                <span className="text-xs text-[#8E877D] tracking-widest block font-sans">
                  {letterTo} へ
                </span>
                <h1 className="text-2xl md:text-3xl font-mincho font-medium text-[#2B2B2B] leading-tight">
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
                        <span className="text-xs font-medium text-[#524E48] px-2.5 py-0.5 rounded-full bg-[#EFE9DC] font-sans">
                          第{idx + 1}章
                        </span>
                        <h3 className="text-lg font-mincho font-medium text-[#2B2B2B]">
                          {section.heading}
                        </h3>
                      </div>

                      {/* The prompt that sparked the text (smaller) */}
                      <p className="text-xs text-[#8E877D] font-sans pl-1">
                        問い: {ans.textForRecipient || ans.questionText}
                      </p>

                      {/* Main text - untouched, exact user's words */}
                      <div className="p-5 rounded-xl bg-[#FCFAF6] border border-[#E0D8CB]">
                        <p className="text-sm md:text-base font-mincho text-[#2B2B2B] leading-relaxed whitespace-pre-wrap">
                          {ans.text}
                        </p>
                      </div>

                      {/* 往復（2往復以上） */}
                      {includeFollowUps && ans.dialogue && ans.dialogue.length > 1 && (
                        <div className="ml-4 pl-4 border-l border-[#2B2B2B]/40 space-y-2 text-xs text-[#524E48]">
                          {ans.dialogue.map((d, i) => (
                            <div key={i} className="space-y-0.5">
                              <span className="font-hand text-[#2B2B2B] block">{d.q}</span>
                              <p className="font-mincho whitespace-pre-wrap leading-relaxed">{d.a}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Follow-up answer if included（1往復のみ） */}
                      {includeFollowUps &&
                        !(ans.dialogue && ans.dialogue.length > 1) &&
                        ans.followUpQuestion &&
                        ans.followUpAnswer && (
                          <div className="ml-4 pl-4 border-l border-[#2B2B2B]/40 space-y-1 text-xs text-[#524E48]">
                            <span className="font-medium text-[#2B2B2B] block">
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

              {/* Letter Footer with Vermilion Koyori (朱色の紙縒り) */}
              <div className="pt-8 border-t border-[#E0D8CB] text-center space-y-3">
                <div className="flex justify-center">
                  <svg
                    width="64"
                    height="32"
                    viewBox="0 0 76 44"
                    className="overflow-visible"
                    aria-label="朱色の紙縒り"
                  >
                    <path
                      d="M 38,6 C 37.5,16 38.5,26 38,36"
                      fill="none"
                      stroke="#B5443A"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      opacity="0.85"
                    />
                    <path
                      d="M 14,29 C 22,27 29,14 36,16 C 42,18 41,26 35,25 C 29,24 33,14 40,16 C 46,18 45,26 39,24 C 45,24 53,27 62,30"
                      fill="none"
                      stroke="#B5443A"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[#8E877D] font-mincho">
                    この手紙は、あなた自身がのこした言葉の集まりです。
                  </p>
                  <p className="text-[11px] text-[#A49E93]">
                    NOCOSU
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Booklet Info & Order Modal */}
      {showBookletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs overflow-y-auto no-print">
          <div className="relative w-full max-w-md bg-[#FAF7F0] border border-[#E0D8CB] rounded-2xl overflow-hidden my-6">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-[#524E48]">
                  <BookOpen className="w-4 h-4 text-[#2B2B2B]" />
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
                <h3 className="text-xl font-mincho font-medium text-[#2B2B2B]">
                  言葉を一冊の冊子に
                </h3>
                <p className="text-xs text-[#6E685E] leading-relaxed">
                  のこした言葉を手にとれる形にし、大切な人に届けるための製本仕様です。
                </p>
              </div>

              {/* Feature Cards */}
              <div className="space-y-2.5 text-xs text-[#524E48]">
                <div className="p-3.5 rounded-xl bg-[#FCFAF6] border border-[#E0D8CB] space-y-1">
                  <span className="font-medium text-[#2B2B2B] block">・ 判型: A5判</span>
                  <p className="text-[11px] text-[#6E685E] leading-relaxed">
                    手になじみ、本棚や引き出しにいつまでも大切に保管できるコンパクトな単行本サイズです。
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FCFAF6] border border-[#E0D8CB] space-y-1">
                  <span className="font-medium text-[#2B2B2B] block">・ 本人の言葉のまま（本文は一切整えません）</span>
                  <p className="text-[11px] text-[#6E685E] leading-relaxed">
                    AIや編集者が要約・修正を加えることは一切ありません。あなたの言い淀み、方言、息づかいをそのまま活かして印刷します。
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FCFAF6] border border-[#E0D8CB] space-y-1">
                  <span className="font-medium text-[#2B2B2B] flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-[#2B2B2B]" />
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
                        className="w-full py-3.5 px-4 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                  className="w-full py-2.5 px-4 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs font-medium rounded-xl transition-colors cursor-pointer"
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

import React, { useState, useRef } from 'react';
import { RecipientProfile, AppSettings } from '../types';
import { notificationPermission, requestNotificationPermission, downloadMorningIcs, notificationSupported } from '../utils/reminder';
import sampleLetter from '../data/sample_letter.json';
import {
  exportAllData,
  importAllData,
  clearAllData,
  getBookletOrderUrl,
  saveBookletOrderUrl,
  getTrustee,
  saveTrustee,
} from '../utils/storage';
import {
  Settings,
  Heart,
  Download,
  Upload,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Info,
  Check,
  AlertCircle,
  Phone,
  BookOpen,
} from 'lucide-react';

export interface SupportResource {
  id: string;
  name: string;
  description: string;
  actionLabel: string;
  url: string;
  isExternalLink?: boolean;
}

export const SUPPORT_RESOURCES: SupportResource[] = [
  {
    id: 'cancer-support',
    name: 'がん相談支援センター検索',
    description: '全国の相談支援センターを探せる検索システム（国立がん研究センターがん情報サービス）',
    actionLabel: '窓口を探す',
    url: 'https://hospdb.ganjoho.jp/kyoten/',
    isExternalLink: true,
  },
  {
    id: 'yorisoi-hotline',
    name: 'よりそいホットライン',
    description: '通話料無料・24時間通話対応の相談窓口（一般社団法人 社会的包摂サポートセンター）',
    actionLabel: '0120-279-338',
    url: 'tel:0120-279-338',
    isExternalLink: false,
  },
];

interface Props {
  recipients: RecipientProfile[];
  allowDeep: boolean;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onEditRecipient: () => void;
  onUpdateDeepToggle: (allowDeep: boolean) => void;
  onDataReset: () => void;
  onDataImported: () => void;
}

export const SettingsView: React.FC<Props> = ({
  recipients,
  allowDeep,
  settings,
  onUpdateSettings,
  onEditRecipient,
  onUpdateDeepToggle,
  onDataReset,
  onDataImported,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; msg: string } | null>(
    null
  );
  const [bookletOrderUrl, setBookletOrderUrl] = useState(() => getBookletOrderUrl());
  const [isUrlSaved, setIsUrlSaved] = useState(false);
  const [trusteeName, setTrusteeName] = useState(() => getTrustee()?.name || '');
  const [trusteeNote, setTrusteeNote] = useState(() => getTrustee()?.note || '');
  const [isTrusteeSaved, setIsTrusteeSaved] = useState(false);
  const handleSaveTrustee = () => {
    const name = trusteeName.trim();
    saveTrustee(name ? { name, note: trusteeNote.trim() || undefined, updatedAt: new Date().toISOString() } : null);
    setIsTrusteeSaved(true);
    setTimeout(() => setIsTrusteeSaved(false), 2000);
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSaveBookletUrl = () => {
    saveBookletOrderUrl(bookletOrderUrl);
    setIsUrlSaved(true);
    setTimeout(() => setIsUrlSaved(false), 2500);
  };

  // Handle JSON export
  const handleExportJSON = () => {
    const jsonStr = exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nocosu-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle JSON file import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = importAllData(content);
        if (ok) {
          setImportStatus({ success: true, msg: 'データを正常に復元しました。' });
          onDataImported();
        } else {
          setImportStatus({
            success: false,
            msg: 'ファイルの読み込みに失敗しました。正しいJSONファイルかご確認ください。',
          });
        }
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle complete reset
  const handleConfirmReset = () => {
    if (deleteInputText === 'すべて消去') {
      clearAllData();
      setShowDeleteConfirm(false);
      onDataReset();
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="space-y-1 pt-1 border-b border-[#E0D8CB] pb-3">
        <h2 className="text-xl font-mincho font-medium text-[#2B2B2B]">
          設定
        </h2>
        <p className="text-xs text-[#6E685E]">
          宛先の変更、質問の設定、データの保存・復元
        </p>
      </div>

      {/* Recipient Profile Card */}
      <div className="washi-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#6E685E] tracking-wider uppercase">
            宛先の設定
          </span>
          <button
            type="button"
            onClick={onEditRecipient}
            className="px-3 py-1 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            変更する
          </button>
        </div>

        <div className="space-y-2">
          {recipients.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#EFE9DC] border border-[#E0D8CB] flex items-center justify-center text-[#2B2B2B]">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-mincho font-medium text-[#2B2B2B]">{r.name}</h3>
                <p className="text-xs text-[#8E877D]">
                  間柄: {r.relation}
                  {r.ageGroup ? ` / 年齢帯: ${r.ageGroup}` : ''}
                </p>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-[#8E877D] pt-1">宛先は3人まで。届ける相手は一通ごとに選べます。</p>
        </div>
      </div>

      {/* Deep questions toggle */}
      <div className="washi-card rounded-2xl p-5 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="text-sm font-medium text-[#2B2B2B] flex items-center gap-1.5">
              深い質問（死や後悔）も含める
            </span>
            <p className="text-xs text-[#6E685E] leading-relaxed">
              人生の終盤、後悔、別れについての問い（全体の15%以下）を含めます。オフにすると、日常や思い出、仕事などの穏やかな問いのみが届きます。
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowDeep}
            onClick={() => onUpdateDeepToggle(!allowDeep)}
            className={`shrink-0 w-12 h-6.5 rounded-full transition-colors relative focus:outline-hidden cursor-pointer ${
              allowDeep ? 'bg-[#2B2B2B]' : 'bg-[#D6CFC3]'
            }`}
          >
            <span
              className={`inline-block w-5 h-5 rounded-full bg-white transform transition-transform absolute top-0.5 ${
                allowDeep ? 'translate-x-6 left-0.5' : 'translate-x-0.5 left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 朝の通知 */}
      <div className="washi-card rounded-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="text-sm font-medium text-[#2B2B2B]">朝の通知</span>
            <p className="text-xs text-[#6E685E] leading-relaxed">
              設定した時刻を過ぎて、まだ今日の封をしていなければ一度だけ知らせます。アプリを閉じていると届かないので、カレンダーにも入れておけます。
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.reminderEnabled}
            onClick={async () => {
              if (!settings.reminderEnabled && notificationPermission() !== 'granted') {
                const r = await requestNotificationPermission();
                if (r !== 'granted') {
                  onUpdateSettings({ reminderEnabled: false });
                  return;
                }
              }
              onUpdateSettings({ reminderEnabled: !settings.reminderEnabled });
            }}
            className={`shrink-0 w-12 h-6.5 rounded-full transition-colors relative focus:outline-hidden cursor-pointer ${
              settings.reminderEnabled ? 'bg-[#2B2B2B]' : 'bg-[#D6CFC3]'
            }`}
          >
            <span
              className={`inline-block w-5 h-5 rounded-full bg-white transform transition-transform absolute top-0.5 ${
                settings.reminderEnabled ? 'translate-x-6 left-0.5' : 'translate-x-0.5 left-0.5'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6E685E]">時刻</label>
          <input
            type="time"
            value={settings.reminderTime}
            onChange={(e) => onUpdateSettings({ reminderTime: e.target.value || '07:30' })}
            className="px-3 py-1.5 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-xs text-[#2B2B2B] focus:outline-hidden focus:border-[#2B2B2B]"
          />
          <span className="text-[11px] text-[#8E877D]">
            {!notificationSupported()
              ? 'この端末は通知に対応していません'
              : notificationPermission() === 'granted'
                ? '通知は許可されています'
                : notificationPermission() === 'denied'
                  ? '通知がブロックされています（ブラウザの設定から）'
                  : '通知は未許可'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => downloadMorningIcs(settings.reminderTime, window.location.origin)}
          className="px-3 py-1.5 border border-[#E0D8CB] hover:border-[#2B2B2B] text-[#2B2B2B] text-xs rounded-xl cursor-pointer"
        >
          カレンダーに毎朝の予定を入れる（.ics）
        </button>
      </div>

      {/* 託す人 */}
      <div className="washi-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#6E685E] tracking-wider uppercase">託す人</span>
          {isTrusteeSaved && <span className="text-xs text-[#2B2B2B] font-medium">保存しました</span>}
        </div>
        <p className="text-xs text-[#6E685E] leading-relaxed">
          あなたに何かあったとき、この手紙を{recipients.map((r) => r.name).join('・') || '大切な人'}に渡す人。決めておくと、言葉はあなたより長く残ります。
        </p>
        <input
          type="text"
          value={trusteeName}
          onChange={(e) => setTrusteeName(e.target.value)}
          placeholder="呼び名（例: 妻、兄、親友の田中）"
          maxLength={30}
          className="w-full px-3.5 py-2 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-xs text-[#2B2B2B] placeholder-[#A49E93] focus:outline-hidden focus:border-[#2B2B2B] transition-all"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={trusteeNote}
            onChange={(e) => setTrusteeNote(e.target.value)}
            placeholder="ひとこと・連絡先（任意）"
            maxLength={80}
            className="flex-1 px-3.5 py-2 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-xs text-[#2B2B2B] placeholder-[#A49E93] focus:outline-hidden focus:border-[#2B2B2B] transition-all"
          />
          <button
            type="button"
            onClick={handleSaveTrustee}
            className="px-4 py-2 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs font-medium rounded-xl transition-colors cursor-pointer shrink-0"
          >
            保存
          </button>
        </div>
        <p className="text-[11px] text-[#8E877D]">年に一度、手紙を印刷して封筒に入れておくことも勧めます。</p>
      </div>

      {/* Booklet Order URL Setting */}
      <div className="washi-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#2B2B2B]" />
            <span className="text-xs font-medium text-[#6E685E] tracking-wider uppercase">
              冊子注文フォームの設定
            </span>
          </div>
          {isUrlSaved && (
            <span className="text-xs text-[#2B2B2B] flex items-center gap-1 font-medium">
              <Check className="w-3.5 h-3.5" /> 保存しました
            </span>
          )}
        </div>
        <p className="text-xs text-[#6E685E] leading-relaxed">
          手紙プレビューの「冊子にする」ボタンから案内する注文フォームのURLを設定できます。空の場合は「準備中」と表示されます。
        </p>

        <div className="flex gap-2 pt-1">
          <input
            type="url"
            value={bookletOrderUrl}
            onChange={(e) => {
              setBookletOrderUrl(e.target.value);
              setIsUrlSaved(false);
            }}
            placeholder="https://example.com/order-form"
            className="flex-1 px-3.5 py-2 bg-[#FCFAF6] border border-[#E0D8CB] rounded-xl text-xs text-[#2B2B2B] placeholder-[#A49E93] focus:outline-hidden focus:border-[#2B2B2B] transition-all"
          />
          <button
            type="button"
            onClick={handleSaveBookletUrl}
            className="px-4 py-2 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs font-medium rounded-xl transition-colors cursor-pointer shrink-0"
          >
            保存
          </button>
        </div>
      </div>

      {/* Data Backup & Restore */}
      <div className="washi-card rounded-2xl p-5 space-y-4">
        <span className="text-xs font-medium text-[#6E685E] tracking-wider uppercase block">
          データの管理（保存と復元）
        </span>
        <p className="text-xs text-[#6E685E] leading-relaxed">
          あなたの言葉はすべてこの端末のブラウザ内（localStorage）に安全に保存されています。機種変更やバックアップの際はJSONファイルとして書き出してください。
        </p>

        {importStatus && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 border border-[#E0D8CB] ${
              importStatus.success
                ? 'bg-[#FAF7F0] text-[#2B2B2B]'
                : 'bg-[#FAF0EA] text-[#A94420]'
            }`}
          >
            {importStatus.success ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{importStatus.msg}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportJSON}
            className="py-2.5 px-3 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#2B2B2B]" />
            <span>JSONで書き出し</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 px-3 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#2B2B2B]" />
            <span>JSONから読み込み</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />
        </div>
      </div>

      {/* つくった人から */}
      <details className="washi-card rounded-2xl p-5 space-y-3">
        <summary className="text-xs font-medium text-[#6E685E] tracking-wider uppercase cursor-pointer">
          つくった人から
        </summary>
        <div className="pt-3 space-y-3">
          <h3 className="font-hand text-lg text-[#2B2B2B]">{sampleLetter.question}</h3>
          <p className="text-sm font-mincho text-[#2B2B2B] leading-[1.9] whitespace-pre-wrap">{sampleLetter.body}</p>
          <p className="text-right font-hand text-sm text-[#524E48]">{sampleLetter.from}</p>
        </div>
      </details>

      {/* Support Hotlines Section */}
      <div className="washi-card rounded-2xl p-5 space-y-3.5">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-[#2B2B2B]" />
          <h3 className="text-sm font-medium text-[#2B2B2B]">
            つらい気持ちのときは
          </h3>
        </div>
        <p className="text-xs text-[#6E685E] leading-relaxed">
          自分を振り返る問いかけの中で、悲しみや苦しさを感じたときは、一人で抱え込まず専門の窓口にご相談ください。
        </p>

        {/* Medical disclaimer note */}
        <div className="p-3 rounded-xl bg-[#FCFAF6] border border-[#E0D8CB] text-[11px] text-[#6E685E] leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-[#2B2B2B]">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>医療的な助言について</span>
          </div>
          <p>
            当アプリは個人の言葉の記録や手紙の編纂を目的としており、医学的・医療的な診断や助言を行うものではありません。身体や心の不調・治療に関するご相談は、専門の医療機関や下記の公的な相談窓口へお寄せください。
          </p>
        </div>

        {/* Support resources from constant array */}
        <div className="space-y-2 pt-1 text-xs text-[#524E48]">
          {SUPPORT_RESOURCES.map((resource) => (
            <div
              key={resource.id}
              className="p-3 rounded-xl bg-[#FCFAF6] border border-[#E0D8CB] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <div className="space-y-0.5">
                <span className="font-medium block text-[#2B2B2B]">
                  {resource.name}
                </span>
                <span className="text-[#8E877D] text-[11px] block leading-relaxed">
                  {resource.description}
                </span>
              </div>
              <a
                href={resource.url}
                target={resource.isExternalLink ? '_blank' : undefined}
                rel={resource.isExternalLink ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 text-[#2B2B2B] text-xs font-medium rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <span>{resource.actionLabel}</span>
                {resource.isExternalLink && <ExternalLink className="w-3 h-3" />}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Delete All Data */}
      <div className="washi-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-[#2B2B2B]" />
          <h3 className="text-sm font-medium text-[#2B2B2B]">
            すべての記録の消去
          </h3>
        </div>
        <p className="text-xs text-[#6E685E] leading-relaxed">
          この端末に保存されているすべての回答、宛先設定、編纂した手紙を完全に削除します。この操作は取り消せません。
        </p>

        {showDeleteConfirm ? (
          <div className="p-3.5 rounded-xl bg-[#FCFAF6] border border-[#E0D8CB] space-y-3">
            <p className="text-xs text-[#2B2B2B] font-medium">
              確認のため「すべて消去」と入力してください。
            </p>
            <input
              type="text"
              value={deleteInputText}
              onChange={(e) => setDeleteInputText(e.target.value)}
              placeholder="すべて消去"
              className="w-full px-3 py-2 bg-[#FAF7F0] border border-[#E0D8CB] rounded-lg text-xs text-[#2B2B2B] focus:outline-hidden focus:border-[#2B2B2B]"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={deleteInputText !== 'すべて消去'}
                onClick={handleConfirmReset}
                className="flex-1 py-2 border border-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 disabled:opacity-40 text-[#2B2B2B] text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                完全に消去する
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInputText('');
                }}
                className="px-3 py-2 text-xs text-[#6E685E] cursor-pointer"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="py-2 px-3 text-xs text-[#2B2B2B] bg-transparent hover:bg-[#2B2B2B]/5 border border-[#2B2B2B] rounded-xl font-medium transition-colors cursor-pointer"
          >
            データを全消去する
          </button>
        )}
      </div>

      {/* About App */}
      <div className="text-center text-xs text-[#8E877D] space-y-1 pt-4">
        <p className="font-mincho">NOCOSU（のこす）</p>
        <p>AIは本文を一文字も書かない、あなたのための記録帳</p>
      </div>
    </div>
  );
};

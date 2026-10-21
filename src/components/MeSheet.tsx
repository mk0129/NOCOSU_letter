import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AnswerItem, RecipientProfile, AppSettings } from '../types';
import { Circle, CircleMember, inviteUrl } from '../utils/circle';
import { LetterView } from './LetterView';
import { SettingsView } from './SettingsView';
import { X, Copy, Check } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  myName: string;
  answers: AnswerItem[];
  recipients: RecipientProfile[];
  settings: AppSettings;
  circle: Circle | null;
  members: CircleMember[];
  circleError: string;
  onCreateCircle: () => Promise<void>;
  onShowMine: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onEditRecipients: () => void;
  onDataReset: () => void;
  onDataImported: () => void;
}

type Pane = 'menu' | 'invite' | 'bind' | 'settings';

/** 右上の丸から開く「自分のページ」。タブの代わりに全部ここ */
export const MeSheet: React.FC<Props> = ({
  open,
  onClose,
  myName,
  answers,
  recipients,
  settings,
  circle,
  members,
  circleError,
  onCreateCircle,
  onShowMine,
  onUpdateSettings,
  onEditRecipients,
  onDataReset,
  onDataImported,
}) => {
  const [pane, setPane] = useState<Pane>('menu');
  const [qr, setQr] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setPane('menu');
  }, [open]);

  useEffect(() => {
    if (!circle) {
      setQr('');
      return;
    }
    QRCode.toDataURL(inviteUrl(circle.invite_code), { margin: 1, width: 220, color: { dark: '#2B2B2B', light: '#FAF7F0' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [circle]);

  if (!open) return null;

  const link = circle ? inviteUrl(circle.invite_code) : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#FAF7F0] rounded-t-2xl border-t border-[#E0D8CB] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#FAF7F0] px-5 pt-4 pb-3 border-b border-[#E0D8CB] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-mincho font-medium text-[#2B2B2B]">{myName} のページ</h2>
            <p className="text-[11px] text-[#8E877D]">
              あなたの手紙 {answers.length}通{circle ? ` ・ ${circle.name}（${members.map((m) => m.display_name).join('・')}）` : ''}
            </p>
          </div>
          <button type="button" onClick={pane === 'menu' ? onClose : () => setPane('menu')} className="p-2 text-[#6E685E] cursor-pointer" aria-label="閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {pane === 'menu' && (
            <div className="space-y-2.5">
              <MenuButton onClick={() => { onShowMine(); onClose(); }}>あなたの手紙だけを見る</MenuButton>
              <MenuButton onClick={() => setPane('bind')}>束ねて一冊にする（手紙・冊子・画像）</MenuButton>
              <MenuButton onClick={() => setPane('invite')}>{circle ? '家族を招待する（リンク・QR）' : '家族の輪を作る'}</MenuButton>
              <MenuButton onClick={() => setPane('settings')}>朝の通知 ・ 深い問い ・ 託す人 ・ 宛先</MenuButton>
              <p className="text-[11px] text-[#8E877D] pt-2">タブはありません。ここに全部あります。</p>
            </div>
          )}

          {pane === 'invite' && (
            <div className="space-y-4">
              {!circle ? (
                <div className="washi-card rounded-2xl p-5 space-y-3">
                  <p className="text-sm font-mincho text-[#2B2B2B] leading-relaxed">
                    家族の輪を作ると、招待リンクが出ます。家族はリンクを開いて呼び名を入れるだけ。メールもパスワードもありません。
                  </p>
                  {circleError && <p className="text-xs text-[#A94420] leading-relaxed">{circleError}</p>}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await onCreateCircle();
                      setBusy(false);
                    }}
                    className="w-full py-3 border border-[#2B2B2B] rounded-xl text-sm font-medium text-[#2B2B2B] hover:bg-[#2B2B2B]/5 disabled:opacity-40 cursor-pointer"
                  >
                    {busy ? '作っています…' : `${myName}の家族の輪を作る`}
                  </button>
                </div>
              ) : (
                <div className="washi-card rounded-2xl p-5 space-y-3 text-center">
                  <p className="text-sm font-mincho text-[#2B2B2B]">このリンクを家族に送ってください。</p>
                  {qr && <img src={qr} alt="招待QR" className="mx-auto w-44 h-44 rounded-lg border border-[#E0D8CB]" />}
                  <p className="text-xs text-[#6E685E] break-all">{link}</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(link);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        } catch {
                          /* noop */
                        }
                      }}
                      className="px-3 py-1.5 rounded-full text-xs border border-[#2B2B2B] text-[#2B2B2B] cursor-pointer inline-flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} リンクをコピー
                    </button>
                    {typeof navigator.share === 'function' && (
                      <button
                        type="button"
                        onClick={() => navigator.share({ title: 'NOCOSU', text: `${circle.name}に招待します`, url: link }).catch(() => {})}
                        className="px-3 py-1.5 rounded-full text-xs border border-[#E0D8CB] text-[#2B2B2B] cursor-pointer"
                      >
                        LINEなどで送る
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#8E877D]">招待コード {circle.invite_code}</p>
                </div>
              )}
            </div>
          )}

          {pane === 'bind' && (
            <div className="-mx-1">
              <LetterView answers={answers} recipients={recipients.length ? recipients : [{ id: 'family', relation: 'other', name: circle ? circle.name : '大切な人', updatedAt: '' }]} />
            </div>
          )}

          {pane === 'settings' && (
            <div className="-mx-1">
              <SettingsView
                recipients={recipients}
                allowDeep={settings.allowDeep}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                onEditRecipient={onEditRecipients}
                onUpdateDeepToggle={(allowDeep) => onUpdateSettings({ allowDeep })}
                onDataReset={onDataReset}
                onDataImported={onDataImported}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MenuButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left px-4 py-3.5 border border-[#E0D8CB] hover:border-[#2B2B2B] rounded-xl text-sm text-[#2B2B2B] bg-transparent cursor-pointer"
  >
    {children}
  </button>
);

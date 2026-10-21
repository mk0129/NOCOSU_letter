import { AppSettings } from '../types';
import { getSettings, saveSettings, getTodayDateString } from './storage';

// 朝の通知（v0.1: サーバー無し）
// - アプリやPWAが開いている／バックグラウンドにあるとき、設定時刻を過ぎていて今日まだ封をしていなければ一度だけ通知する
// - 端末が完全に閉じているときは届かない。その穴は .ics（毎朝の予定）で埋める。v0.2 で LINE 配信に置き換える

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('service worker registration failed', e);
  }
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 条件が揃えば通知を出す。戻り値: 出したか */
export async function maybeNotify(todayAnswered: boolean, voiceName?: string | null): Promise<boolean> {
  const s: AppSettings = getSettings();
  if (!s.reminderEnabled) return false;
  if (notificationPermission() !== 'granted') return false;
  const today = getTodayDateString();
  if (s.lastNotifiedDate === today) return false;
  if (todayAnswered) return false;
  if (nowHHMM() < s.reminderTime) return false;

  const title = voiceName ? `${voiceName}から手紙が届いています` : '今日の封筒が届いています';
  const body = '毎朝ひとつの問い。答えなくても大丈夫です。';
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, { body, icon: '/icon.svg', tag: 'nocosu-morning' });
    } else {
      new Notification(title, { body, icon: '/icon.svg', tag: 'nocosu-morning' });
    }
    saveSettings({ ...s, lastNotifiedDate: today });
    return true;
  } catch (e) {
    console.warn('notification failed', e);
    return false;
  }
}

/** 毎朝の予定（.ics）を作って保存する。端末が閉じていても届く保険 */
export function downloadMorningIcs(time: string, url: string): void {
  const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
  const d = new Date();
  d.setDate(d.getDate() + 1); // 明日から
  const pad = (n: number) => String(n).padStart(2, '0');
  const dtstart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NOCOSU//JP',
    'BEGIN:VEVENT',
    `UID:nocosu-morning-${Date.now()}@nocosu`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Tokyo:${dtstart}`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:今日の封筒（NOCOSU）',
    `DESCRIPTION:毎朝ひとつの問い。答えなくても大丈夫です。\\n${url}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:今日の封筒が届いています',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = 'nocosu_morning.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

import { supabase, supabaseConfigured } from '../lib/supabase';
import { AnswerItem, DialogueTurn } from '../types';

// 家族の輪（最小版）: 招待コードで輪を作る／入る、答えを輪に送る、読む、「読んだ」「ありがとう」を返す
// 本文（text）はサーバーにそのまま置く。加工しない。

export interface Circle {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface CircleMember {
  circle_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
}

export interface SharedAnswer {
  id: string;
  circle_id: string;
  user_id: string;
  author_name: string;
  local_answer_id: string;
  question_id: string;
  question_text: string;
  text: string;
  dialogue: DialogueTurn[] | null;
  read_when: string | null;
  answered_on: string;
  created_at: string;
}

export interface AnswerRead {
  shared_answer_id: string;
  user_id: string;
  reaction: 'read' | 'thanks';
  created_at: string;
}

export const circleAvailable = supabaseConfigured;

// ---- 認証（メールに届く6桁の確認コード）
export async function getSessionUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** 端末に紐づく匿名アカウントでログイン（メール不要）。既にログイン済みならそのまま */
export async function ensureSession(): Promise<{ userId: string } | { error: string }> {
  if (!supabase) return { error: 'サーバー未設定' };
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return { userId: data.session.user.id };
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) {
    const msg = error?.message || '';
    if (/anonymous/i.test(msg) && /disabled|not enabled/i.test(msg)) {
      return { error: 'サーバー側で匿名ログインが無効です（Supabase: Authentication → Sign In / Providers → Anonymous を有効に）' };
    }
    return { error: msg || 'ログインできませんでした' };
  }
  return { userId: anon.user.id };
}

/** 招待リンク */
export function inviteUrl(code: string): string {
  return `${window.location.origin}/?join=${encodeURIComponent(code)}`;
}

export function joinCodeFromUrl(): string | null {
  try {
    const c = new URLSearchParams(window.location.search).get('join');
    return c ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}

/** 招待コードから輪の名前だけ取る（入る前の表示用） */
export async function circleNameByCode(code: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('circle_name_by_code', { p_code: code });
  if (error) return null;
  return (data as string | null) || null;
}

export function onAuthChange(cb: () => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(() => cb());
  return () => data.subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// ---- 輪
export async function myCircles(): Promise<Circle[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('circles').select('*').order('created_at');
  if (error) {
    console.warn(error);
    return [];
  }
  return (data as Circle[]) || [];
}

export async function createCircle(name: string, displayName: string): Promise<Circle | string> {
  if (!supabase) return 'サーバー未設定';
  const { data, error } = await supabase.rpc('create_circle', { p_name: name, p_display_name: displayName });
  if (error) return error.message;
  return data as Circle;
}

export async function joinCircle(code: string, displayName: string): Promise<Circle | string> {
  if (!supabase) return 'サーバー未設定';
  const { data, error } = await supabase.rpc('join_circle', { p_code: code, p_display_name: displayName });
  if (error) return error.message.includes('invalid code') ? '招待コードが見つかりません' : error.message;
  return data as Circle;
}

export async function circleMembers(circleId: string): Promise<CircleMember[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('circle_members').select('*').eq('circle_id', circleId).order('joined_at');
  return (data as CircleMember[]) || [];
}

// ---- 答えを輪に送る（同じ答えは上書き）
export async function shareAnswer(circleId: string, authorName: string, a: AnswerItem): Promise<string | null> {
  if (!supabase) return 'サーバー未設定';
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 'ログインしていません';
  const { error } = await supabase.from('shared_answers').upsert(
    {
      circle_id: circleId,
      user_id: u.user.id,
      author_name: authorName,
      local_answer_id: a.id,
      question_id: a.questionId,
      question_text: a.textForRecipient || a.questionText,
      text: a.text,
      dialogue: a.dialogue && a.dialogue.length ? a.dialogue : null,
      read_when: a.readWhen || null,
      answered_on: a.date,
    },
    { onConflict: 'circle_id,user_id,local_answer_id' }
  );
  return error ? error.message : null;
}

export async function sharedAnswersOf(circleId: string): Promise<SharedAnswer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('shared_answers')
    .select('*')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.warn(error);
    return [];
  }
  return (data as SharedAnswer[]) || [];
}

export async function readsFor(ids: string[]): Promise<AnswerRead[]> {
  if (!supabase || ids.length === 0) return [];
  const { data } = await supabase.from('answer_reads').select('*').in('shared_answer_id', ids);
  return (data as AnswerRead[]) || [];
}

export async function markRead(sharedAnswerId: string, reaction: 'read' | 'thanks'): Promise<string | null> {
  if (!supabase) return 'サーバー未設定';
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 'ログインしていません';
  const { error } = await supabase
    .from('answer_reads')
    .upsert({ shared_answer_id: sharedAnswerId, user_id: u.user.id, reaction }, { onConflict: 'shared_answer_id,user_id' });
  return error ? error.message : null;
}

/** 自分が送った答えの local_answer_id 一覧（送信済みの印に使う） */
export async function mySharedLocalIds(circleId: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return new Set();
  const { data } = await supabase
    .from('shared_answers')
    .select('local_answer_id')
    .eq('circle_id', circleId)
    .eq('user_id', u.user.id);
  return new Set(((data as { local_answer_id: string }[]) || []).map((r) => r.local_answer_id));
}

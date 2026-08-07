import { api } from './client';
import type {
  LinkItem,
  LinkStats,
  ListLinksResult,
  LoginResult,
  SystemInfo,
  UserInfo,
  UserRow
} from './types';

export function login(input: { username: string; password: string }): Promise<LoginResult> {
  return api.post<LoginResult>('/auth/login', input);
}

export function logout(): Promise<{ loggedOut: boolean }> {
  return api.post<{ loggedOut: boolean }>('/auth/logout', {});
}

export function verify(): Promise<UserInfo> {
  return api.get<UserInfo>('/auth/verify');
}

export function getSystemInfo(): Promise<SystemInfo> {
  return api.get<SystemInfo>('/system/info');
}

export interface ListLinksParams {
  page: number;
  pageSize: number;
  type?: 'hash' | 'alias';
  status?: 'active' | 'retired';
  q?: string;
}

export interface ListAllLinksParams extends ListLinksParams {
  userId?: number;
}

function listQuery(params: ListLinksParams | ListAllLinksParams): string {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  if (params.type) qs.set('type', params.type);
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  if ('userId' in params && params.userId !== undefined) qs.set('userId', String(params.userId));
  return qs.toString();
}

export function listLinks(params: ListLinksParams): Promise<ListLinksResult> {
  return api.get<ListLinksResult>(`/links?${listQuery(params)}`);
}

export function listAllLinks(params: ListAllLinksParams): Promise<ListLinksResult> {
  return api.get<ListLinksResult>(`/links/all?${listQuery(params)}`);
}

export function getLink(code: string): Promise<LinkItem> {
  return api.get<LinkItem>(`/links/${encodeURIComponent(code)}`);
}

export interface CreateLinkBody {
  type: 'hash' | 'alias';
  code?: string;
  targetUrl: string;
  permanent: boolean;
  expiresAt?: string | null;
}

export function createLink(body: CreateLinkBody): Promise<LinkItem> {
  return api.post<LinkItem>('/links', body);
}

export function updateLink(
  code: string,
  patch: { targetUrl?: string; permanent?: boolean; expiresAt?: string | null }
): Promise<LinkItem> {
  return api.patch<LinkItem>(`/links/${encodeURIComponent(code)}`, patch);
}

export function deleteLink(code: string): Promise<LinkItem> {
  return api.delete<LinkItem>(`/links/${encodeURIComponent(code)}`);
}

export function getLinkStats(code: string): Promise<LinkStats> {
  return api.get<LinkStats>(`/links/${encodeURIComponent(code)}/stats`);
}

export function listUsers(): Promise<UserRow[]> {
  return api.get<UserRow[]>('/users');
}

export function createUser(body: { username: string; password: string }): Promise<UserRow> {
  return api.post<UserRow>('/users', body);
}

export function updateUser(
  id: number,
  patch: { enabled?: boolean; password?: string }
): Promise<UserRow> {
  return api.patch<UserRow>(`/users/${id}`, patch);
}

export function deleteUser(id: number): Promise<{ deleted: boolean }> {
  return api.delete<{ deleted: boolean }>(`/users/${id}`);
}

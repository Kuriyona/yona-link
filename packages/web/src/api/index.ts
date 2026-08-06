import { api } from './client';
import type {
  ApiKeyInfo,
  AuthInfo,
  CreatedKey,
  LinkItem,
  LinkStats,
  ListLinksResult,
  Permission,
  SystemInfo
} from './types';

export function verify(): Promise<AuthInfo> {
  return api.get<AuthInfo>('/auth/verify');
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

export function listLinks(params: ListLinksParams): Promise<ListLinksResult> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  if (params.type) qs.set('type', params.type);
  if (params.status) qs.set('status', params.status);
  if (params.q) qs.set('q', params.q);
  return api.get<ListLinksResult>(`/links?${qs.toString()}`);
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

export function listKeys(): Promise<ApiKeyInfo[]> {
  return api.get<ApiKeyInfo[]>('/keys');
}

export function createKey(body: { name: string; permissions: Permission[] }): Promise<CreatedKey> {
  return api.post<CreatedKey>('/keys', body);
}

export function updateKey(
  id: number,
  patch: { name?: string; permissions?: Permission[]; enabled?: boolean }
): Promise<ApiKeyInfo> {
  return api.patch<ApiKeyInfo>(`/keys/${id}`, patch);
}

export function deleteKey(id: number): Promise<{ deleted: boolean }> {
  return api.delete<{ deleted: boolean }>(`/keys/${id}`);
}

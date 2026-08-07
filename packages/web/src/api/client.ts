import { getApiBaseUrl, getToken } from './credentials';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

class ApiClient {
  private baseUrl(): string {
    return getApiBaseUrl().replace(/\/$/, '');
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set('content-type', 'application/json');
    const token = getToken();
    if (token) headers.set('authorization', `Bearer ${token}`);

    const res = await fetch(`${this.baseUrl()}${path}`, { ...init, headers });
    let payload: ApiResponse<T> | null = null;
    try {
      payload = (await res.json()) as ApiResponse<T>;
    } catch {
      payload = null;
    }

    if (!res.ok) {
      throw new ApiError(
        payload?.error?.message ?? `请求失败 (${res.status})`,
        res.status,
        payload?.error?.code
      );
    }
    return payload?.data as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

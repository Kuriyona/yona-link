import { ApiError } from './errors';

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, '请求体不是合法的 JSON', 'invalid_body');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(400, '请求体必须是 JSON 对象', 'invalid_body');
  }
  return parsed as Record<string, unknown>;
}

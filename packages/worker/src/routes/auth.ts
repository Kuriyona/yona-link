import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import { users } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { readJsonObject } from '../http';
import { SESSION_COOKIE, extractToken, unauthorized } from '../middleware/auth';
import { createSession, destroySession } from '../services/session-service';
import { getUserByUsername, verifyPassword } from '../services/user-service';
import { permissionsForRole } from '../types';

export function createAuthRoutes() {
  const routes = new Hono<AppEnv>();

  routes.post('/login', async (c) => {
    const body = await readJsonObject(c.req.raw);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) {
      throw new ApiError(400, '必须提供用户名和密码', 'invalid_credentials');
    }
    const db = c.get('db');
    const user = await getUserByUsername(db, username);
    if (!user || !user.enabled || !(await verifyPassword(password, user.passwordHash))) {
      throw new ApiError(401, '用户名或密码错误', 'invalid_credentials');
    }
    await db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, user.id));
    const ttlDays = c.get('config').sessionTtlDays;
    const token = await createSession(db, user.id, ttlDays);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Lax',
      path: '/',
      maxAge: ttlDays * 86_400
    });
    return c.json({
      ok: true as const,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: permissionsForRole(user.role)
        }
      }
    });
  });

  routes.post('/logout', async (c) => {
    if (!c.get('auth')) return c.json(unauthorized(), 401);
    const raw = getCookie(c, SESSION_COOKIE) ?? extractToken(c.req.raw.headers);
    if (raw) await destroySession(c.get('db'), raw);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true as const, data: { loggedOut: true } });
  });

  routes.get('/verify', (c) => {
    const auth = c.get('auth');
    if (!auth) return c.json(unauthorized(), 401);
    return c.json({
      ok: true as const,
      data: {
        id: auth.userId,
        username: auth.username,
        role: auth.role,
        permissions: auth.permissions
      }
    });
  });

  return routes;
}

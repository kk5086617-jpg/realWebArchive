import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const deriveKey = promisify(scrypt);
const COOKIE = 'webarchive_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const tokenHash = token => createHash('sha256').update(token).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt-v1:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [version, salt, encoded] = stored.split(':');
  if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(encoded)) return false;
  const actual = await deriveKey(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, Buffer.from(encoded, 'hex'));
}

function sessionToken(req) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

const cookieOptions = req => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || req.secure,
  sameSite: 'lax',
  path: '/',
});

export async function initializeAuth(pool) {
  const sql = await readFile(new URL('./migrations/001-auth.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  await pool.query(await readFile(new URL('./migrations/002-profiles.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./migrations/003-community.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('./migrations/004-chat-images.sql', import.meta.url), 'utf8'));
}

export async function getSessionUser(pool, req) {
  const token = sessionToken(req);
  if (!token) return null;
  const result = await pool.query(`SELECT u.id, u.username FROM archive_users u
    JOIN archive_sessions s ON s.user_id = u.id
    WHERE s.token_hash = $1 AND s.expires_at > now()`, [tokenHash(token)]);
  return result.rows[0] || null;
}

export function createAuthRouter(pool) {
  const router = Router();
  // Used when a login is unknown so password verification still takes the same work.
  const dummyHash = hashPassword(randomBytes(32).toString('hex'));
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    // JSON requests from the frontend always carry Origin. No cross-origin writes.
    if (req.get('Origin') !== `${req.protocol}://${req.get('host')}`) {
      return res.status(403).json({ error: 'ORIGIN_REJECTED', message: 'Запрос отклонён. Обновите страницу.' });
    }
    next();
  });

  const limitAttempts = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'TOO_MANY_ATTEMPTS', message: 'Слишком много попыток. Попробуйте через 15 минут.' },
  });

  const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  async function createSession(req, res, user) {
    const token = randomBytes(32).toString('hex');
    // Rotate any previous session on this browser on successful authentication.
    const previous = sessionToken(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (previous) await client.query('DELETE FROM archive_sessions WHERE token_hash = $1', [tokenHash(previous)]);
      await client.query('DELETE FROM archive_sessions WHERE expires_at <= now()');
      await client.query('INSERT INTO archive_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
        [tokenHash(token), user.id, new Date(Date.now() + SESSION_SECONDS * 1000)]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.cookie(COOKIE, token, { ...cookieOptions(req), maxAge: SESSION_SECONDS * 1000 });
  }

  router.get('/me', handle(async (req, res) => {
    const token = sessionToken(req);
    if (!token) return res.json({ user: null });
    const result = await pool.query(`
      SELECT u.id, u.username FROM archive_users u
      JOIN archive_sessions s ON s.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > now()
    `, [tokenHash(token)]);
    const user = result.rows[0] || null;
    if (!user) res.clearCookie(COOKIE, cookieOptions(req));
    res.json({ user });
  }));

  router.post('/register', limitAttempts, handle(async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = req.body?.password;
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'INVALID_USERNAME', message: 'Логин: 3–32 символа, латинские буквы, цифры, точка, дефис или _.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Пароль должен содержать от 8 до 128 символов.' });
    }
    const encoded = await hashPassword(password);
    let user;
    try {
      const result = await pool.query('INSERT INTO archive_users (username, password_hash) VALUES ($1, $2) RETURNING id, username', [username, encoded]);
      user = result.rows[0];
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'USERNAME_TAKEN', message: 'Этот логин уже занят.' });
      throw err;
    }
    await createSession(req, res, user);
    res.status(201).json({ user });
  }));

  router.post('/login', limitAttempts, handle(async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = req.body?.password;
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username) || typeof password !== 'string' || password.length > 128 || !password.length) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль.' });
    }
    const result = await pool.query('SELECT id, username, password_hash FROM archive_users WHERE lower(username) = lower($1)', [username]);
    const record = result.rows[0];
    const valid = await verifyPassword(password, record?.password_hash || await dummyHash);
    if (!record || !valid) return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Неверный логин или пароль.' });
    const user = { id: record.id, username: record.username };
    await createSession(req, res, user);
    res.json({ user });
  }));

  router.post('/logout', handle(async (req, res) => {
    const token = sessionToken(req);
    if (token) await pool.query('DELETE FROM archive_sessions WHERE token_hash = $1', [tokenHash(token)]);
    res.clearCookie(COOKIE, cookieOptions(req));
    res.json({ user: null });
  }));

  router.use((err, _req, res, _next) => {
    console.error('Authentication error:', err.code || err.name);
    res.status(500).json({ error: 'AUTH_ERROR', message: 'Сервис авторизации недоступен. Попробуйте позже.' });
  });
  return router;
}

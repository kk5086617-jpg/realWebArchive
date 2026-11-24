import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSessionUser } from './auth.js';
import { chatEvents } from './chatSocket.js';
import { prepareImage } from './profiles.js';

const gamesRoot = fileURLToPath(new URL('../storage/games/', import.meta.url));
const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const cursor = value => /^\d{1,10}$/.test(value || '') && Number(value) <= 2147483647 ? Number(value) : null;
const selectAuthor = `p.id,p.body,p.created_at,u.id AS author_id,COALESCE(u.nickname,u.username) AS nickname,
  u.avatar IS NOT NULL AS has_avatar,u.profile_updated_at`;
const asPost = row => ({ id: row.id, body: row.body, createdAt: row.created_at,
  imageURL: row.has_image ? `/api/chat/${row.id}/image` : null,
  author: { id: row.author_id, nickname: row.nickname,
    avatarURL: row.has_avatar ? `/api/profiles/${row.author_id}/avatar?v=${new Date(row.profile_updated_at).getTime()}` : null } });

export function createCommunityRouter(pool) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['GET', 'HEAD'].includes(req.method)) return next();
    if (req.get('Origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ message: 'Запрос отклонён.' });
    getSessionUser(pool, req).then(user => {
      if (!user) return res.status(401).json({ message: 'Войдите, чтобы писать и оценивать игры.' });
      req.user = user;
      next();
    }).catch(next);
  });
  const writes = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { message: 'Слишком много запросов. Подождите немного.' } });
  router.param('gameId', (req, res, next, value) => {
    if (!/^[1-9]\d{0,8}$/.test(value)) return res.status(404).json({ message: 'Игра не найдена.' });
    pool.query('SELECT appid, sfwurl FROM applications WHERE appid=$1', [value]).then(result => {
      if (!result.rows[0]) return res.status(404).json({ message: 'Игра не найдена.' });
      req.game = result.rows[0]; next();
    }).catch(next);
  });

  function discussion(base, table, game = false) {
    router.get(base, handle(async (req, res) => {
      const after = !game ? cursor(req.query.after) : null;
      const before = cursor(req.query.before) || 2147483647;
      const params = game ? [req.params.gameId, before] : [after ?? before];
      const condition = game ? 'p.game_id=$1 AND p.id<$2' : `p.id${after !== null ? '>' : '<'}$1`;
      const result = await pool.query(`SELECT ${selectAuthor}${game ? '' : ',p.image IS NOT NULL AS has_image'} FROM ${table} p JOIN archive_users u ON u.id=p.author_id
        WHERE ${condition} ORDER BY p.id ${after !== null ? 'ASC' : 'DESC'} LIMIT 51`, params);
      const rows = result.rows.slice(0, 50);
      res.json({ posts: rows.map(asPost), nextCursor: after === null && result.rows.length > 50 ? rows.at(-1).id : null });
    }));
    router.post(base, writes, handle(async (req, res) => {
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
      const image = game ? null : await prepareImage(req.body?.image);
      if ((!body && !image) || body.length > 2000) throw fail('Добавьте текст (до 2000 символов) или изображение.');
      const result = await pool.query(game
        ? `INSERT INTO ${table} (game_id,author_id,body) VALUES ($1,$2,$3) RETURNING id`
        : `INSERT INTO ${table} (author_id,body,image) VALUES ($1,$2,$3) RETURNING id`,
      game ? [req.params.gameId, req.user.id, body] : [req.user.id, body, image]);
      const post = await pool.query(`SELECT ${selectAuthor}${game ? '' : ',p.image IS NOT NULL AS has_image'} FROM ${table} p JOIN archive_users u ON u.id=p.author_id WHERE p.id=$1`, [result.rows[0].id]);
      const published = asPost(post.rows[0]);
      if (!game) chatEvents.emit('message', published);
      res.status(201).json({ post: published });
    }));
  }
  discussion('/chat', 'archive_chat_messages');
  router.get('/chat/:messageId/image', handle(async (req, res) => {
    if (!/^[1-9]\d{0,8}$/.test(req.params.messageId)) throw fail('Изображение не найдено.', 404);
    const result = await pool.query('SELECT image FROM archive_chat_messages WHERE id=$1', [req.params.messageId]);
    if (!result.rows[0]?.image) throw fail('Изображение не найдено.', 404);
    res.type('image/webp').set('X-Content-Type-Options', 'nosniff').send(result.rows[0].image);
  }));
  discussion('/games/:gameId/comments', 'archive_game_comments', true);

  async function ratingSummary(gameId, userId) {
    const result = await pool.query(`SELECT round(avg(value),1) AS average, count(*)::int AS count,
      max(value) FILTER (WHERE user_id=$2) AS mine FROM archive_game_ratings WHERE game_id=$1`, [gameId, userId || null]);
    const row = result.rows[0];
    return { average: row.average === null ? null : Number(row.average), count: row.count, mine: row.mine };
  }
  router.get('/games/:gameId/rating', handle(async (req, res) => {
    const user = await getSessionUser(pool, req);
    res.json(await ratingSummary(req.params.gameId, user?.id));
  }));
  router.put('/games/:gameId/rating', writes, handle(async (req, res) => {
    const value = req.body?.value;
    if (!Number.isInteger(value) || value < 1 || value > 5) throw fail('Оценка должна быть целым числом от 1 до 5.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize votes per game so the catalog average stays consistent.
      await client.query('SELECT appid FROM applications WHERE appid=$1 FOR UPDATE', [req.params.gameId]);
      await client.query(`INSERT INTO archive_game_ratings (game_id,user_id,value) VALUES ($1,$2,$3)
        ON CONFLICT (game_id,user_id) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`, [req.params.gameId, req.user.id, value]);
      await client.query(`UPDATE applications SET rate=(SELECT round(avg(value),1) FROM archive_game_ratings WHERE game_id=$1) WHERE appid=$1`, [req.params.gameId]);
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
    res.json(await ratingSummary(req.params.gameId, req.user.id));
  }));
  router.get('/games/:gameId/download', handle(async (req, res) => {
    if (!req.game.sfwurl) throw fail('Файл игры не найден.', 404);
    const file = path.resolve(gamesRoot, req.game.sfwurl);
    if (!file.startsWith(path.resolve(gamesRoot) + path.sep) || path.extname(file).toLowerCase() !== '.swf') throw fail('Файл игры недоступен.', 404);
    res.download(file, path.basename(file), err => {
      if (err) {
        if (!res.headersSent) res.status(404).json({ message: 'Файл игры не найден.' });
        return;
      }
      if (req.method === 'GET') pool.query('UPDATE applications SET uploads=COALESCE(uploads,0)+1 WHERE appid=$1', [req.params.gameId])
        .catch(error => console.error('Download counter:', error.code));
    });
  }));
  router.use((err, _req, res, _next) => {
    if (!err.status) console.error('Community error:', err.code || err.name);
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Не удалось выполнить запрос. Попробуйте позже.' });
  });
  return router;
}

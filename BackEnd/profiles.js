import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import sharp from 'sharp';
import { getSessionUser } from './auth.js';

const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
function invalid(message, status = 400) { return Object.assign(new Error(message), { status }); }
const avatarURL = row => row.has_avatar ? `/api/profiles/${row.id}/avatar?v=${new Date(row.profile_updated_at).getTime()}` : null;

export async function prepareImage(value, avatar = false) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 2800000) throw invalid('Размер изображения — не более 2 МБ.');
  const match = /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw invalid('Поддерживаются PNG, JPEG, WebP и GIF.');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length > 2 * 1024 * 1024) throw invalid('Размер изображения — не более 2 МБ.');
  try {
    const image = sharp(bytes, { limitInputPixels: 16000000, animated: false });
    const meta = await image.metadata();
    if (!['png', 'jpeg', 'webp', 'gif'].includes(meta.format)) throw Error('Invalid format');
    if (!avatar && (meta.pages || 1) > 1) {
      if (meta.pages > 200 || meta.width * meta.height * meta.pages > 32000000) throw Error('Animation too large');
      return await sharp(bytes, { animated: true, limitInputPixels: 32000000 })
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, effort: 3 }).toBuffer();
    }
    return await image.rotate().resize(avatar ? 256 : 1280, avatar ? 256 : 1280,
      { fit: avatar ? 'cover' : 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw invalid('Изображение повреждено или слишком большое. GIF: до 200 кадров, суммарно до 32 мегапикселей.');
  }
}

export function createProfilesRouter(pool) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (req.get('Origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ message: 'Запрос отклонён.' });
    next();
  });
  router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    getSessionUser(pool, req).then(user => {
      if (!user) return res.status(401).json({ message: 'Войдите, чтобы выполнить это действие.' });
      req.user = user;
      next();
    }).catch(next);
  });
  const writes = rateLimit({ windowMs: 60000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { message: 'Слишком много действий. Подождите минуту.' } });

  router.param('id', (req, res, next, id) => {
    if (!/^[1-9]\d{0,8}$/.test(id)) return res.status(404).json({ message: 'Профиль не найден.' });
    next();
  });
  router.get('/:id', handle(async (req, res) => {
    const result = await pool.query(`SELECT id, COALESCE(nickname, username) AS nickname, bio, created_at,
      avatar IS NOT NULL AS has_avatar, profile_updated_at FROM archive_users WHERE id=$1`, [req.params.id]);
    const row = result.rows[0];
    if (!row) throw invalid('Профиль не найден.', 404);
    res.json({ profile: { id: row.id, nickname: row.nickname, bio: row.bio, createdAt: row.created_at, avatarURL: avatarURL(row) } });
  }));
  router.patch('/:id', writes, handle(async (req, res) => {
    if (req.user.id !== Number(req.params.id)) throw invalid('Редактировать можно только свой профиль.', 403);
    const { nickname, bio, avatar } = req.body || {};
    if (typeof nickname !== 'string' || nickname.trim().length < 1 || nickname.trim().length > 40) throw invalid('Ник должен содержать от 1 до 40 символов.');
    if (typeof bio !== 'string' || bio.length > 1000) throw invalid('Био — не более 1000 символов.');
    const hasImageChange = Object.hasOwn(req.body, 'avatar');
    const image = hasImageChange ? await prepareImage(avatar, true) : null;
    const result = await pool.query(`UPDATE archive_users SET nickname=$1, bio=$2,
      avatar=CASE WHEN $3 THEN $4::bytea ELSE avatar END, profile_updated_at=clock_timestamp()
      WHERE id=$5 RETURNING id, nickname, bio, created_at, avatar IS NOT NULL AS has_avatar, profile_updated_at`,
    [nickname.trim(), bio.trim(), hasImageChange, image, req.user.id]);
    const row = result.rows[0];
    res.json({ profile: { id: row.id, nickname: row.nickname, bio: row.bio, createdAt: row.created_at, avatarURL: avatarURL(row) } });
  }));
  router.get('/:id/avatar', handle(async (req, res) => {
    const result = await pool.query('SELECT avatar FROM archive_users WHERE id=$1', [req.params.id]);
    if (!result.rows[0]?.avatar) throw invalid('Аватар не найден.', 404);
    res.type('image/webp').set('X-Content-Type-Options', 'nosniff').send(result.rows[0].avatar);
  }));
  router.get('/:id/wall', handle(async (req, res) => {
    const exists = await pool.query('SELECT id FROM archive_users WHERE id=$1', [req.params.id]);
    if (!exists.rowCount) throw invalid('Профиль не найден.', 404);
    const before = /^\d{1,10}$/.test(req.query.before || '') ? Number(req.query.before) : 2147483647;
    const result = await pool.query(`SELECT p.id, p.author_id, p.body, p.created_at, p.image IS NOT NULL AS has_image,
      COALESCE(u.nickname,u.username) AS nickname, u.avatar IS NOT NULL AS has_avatar, u.profile_updated_at
      FROM archive_wall_posts p JOIN archive_users u ON u.id=p.author_id
      WHERE p.owner_id=$1 AND p.id<$2 ORDER BY p.id DESC LIMIT 21`, [req.params.id, before]);
    const rows = result.rows.slice(0, 20);
    res.json({ posts: rows.map(row => ({ id: row.id, body: row.body, createdAt: row.created_at,
      imageURL: row.has_image ? `/api/profiles/${req.params.id}/wall/${row.id}/image` : null,
      author: { id: row.author_id, nickname: row.nickname, avatarURL: avatarURL({ ...row, id: row.author_id }) } })),
    nextCursor: result.rows.length > 20 ? rows.at(-1).id : null });
  }));
  router.post('/:id/wall', writes, handle(async (req, res) => {
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (body.length > 2000) throw invalid('Сообщение — не более 2000 символов.');
    const image = await prepareImage(req.body?.image);
    if (!body && !image) throw invalid('Напишите сообщение или прикрепите изображение.');
    const exists = await pool.query('SELECT id FROM archive_users WHERE id=$1', [req.params.id]);
    if (!exists.rowCount) throw invalid('Профиль не найден.', 404);
    const result = await pool.query('INSERT INTO archive_wall_posts (owner_id,author_id,body,image) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.params.id, req.user.id, body, image]);
    res.status(201).json({ id: result.rows[0].id });
  }));
  router.get('/:id/wall/:postId/image', handle(async (req, res) => {
    if (!/^\d{1,10}$/.test(req.params.postId)) throw invalid('Изображение не найдено.', 404);
    const result = await pool.query('SELECT image FROM archive_wall_posts WHERE owner_id=$1 AND id=$2', [req.params.id, req.params.postId]);
    if (!result.rows[0]?.image) throw invalid('Изображение не найдено.', 404);
    res.type('image/webp').set('X-Content-Type-Options', 'nosniff').send(result.rows[0].image);
  }));
  router.delete('/:id/wall/:postId', writes, handle(async (req, res) => {
    if (!/^\d{1,10}$/.test(req.params.postId)) throw invalid('Запись не найдена.', 404);
    const result = await pool.query(`DELETE FROM archive_wall_posts WHERE owner_id=$1 AND id=$2
      AND (author_id=$3 OR owner_id=$3) RETURNING id`, [req.params.id, req.params.postId, req.user.id]);
    if (!result.rowCount) throw invalid('Запись не найдена или нет прав на удаление.', 403);
    res.json({ ok: true });
  }));
  router.use((err, _req, res, _next) => {
    if (!err.status) console.error('Profile error:', err.code || err.name);
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Не удалось выполнить действие. Попробуйте позже.' });
  });
  return router;
}

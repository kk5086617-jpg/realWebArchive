import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './db.js';
import { createAuthRouter, initializeAuth } from './auth.js';
import { createProfilesRouter } from './profiles.js';
import { createCommunityRouter } from './community.js';
import { attachChatSocket } from './chatSocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors());
app.use('/api/profiles', express.json({ limit: '4mb' }), createProfilesRouter(getPool()));
app.use('/api/chat', express.json({ limit: '4mb' }));
app.use(express.json());
app.use('/api/auth', createAuthRouter(getPool()));
app.use('/api', createCommunityRouter(getPool()));

app.get('/api/health', async (_req, res) => {
  try {
    await getPool().query('SELECT 1');
    res.json({ status: 'ok', database: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

// Раздача картинок и игр
const coversPath = path.resolve(__dirname, '../storage/covers');
app.use('/covers', express.static(coversPath, { maxAge: '7d', fallthrough: false }));

const gamesPath = path.resolve(__dirname, '../storage/games');
app.use('/games', express.static(gamesPath, { maxAge: '7d', fallthrough: false }));

// ── Список игр ───────────────────────────────────
app.get('/api/games', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const q = req.query.q ? `%${req.query.q}%` : '%';
  const filterQuery = typeof req.query.filters === 'string'
    ? [...new Set(req.query.filters.split(',').map(name => name.trim()).filter(Boolean))]
    : [];

  try {
    const pool = getPool();
    let queryText = `
      SELECT appID AS id, title, description, imageURL, sfwURL, developer, uploads, COALESCE((SELECT round(avg(value),1) FROM archive_game_ratings r WHERE r.game_id=applications.appID),0) AS rate, releaseDate
      FROM applications
      WHERE title ILIKE $1
    `;
    const queryParams = [q];
    let paramIndex = 2;

    if (filterQuery.length > 0) {
      queryText += `
        AND appID IN (
          SELECT fa.appID FROM filter_app fa 
          JOIN filters f ON f.filterID = fa.filterID 
          WHERE f.name = ANY($${paramIndex})
          GROUP BY fa.appID
          HAVING COUNT(DISTINCT f.name) = cardinality($${paramIndex}::text[])
        )
      `;
      queryParams.push(filterQuery);
      paramIndex++;
    }

    queryText += ` ORDER BY releaseDate DESC NULLS LAST OFFSET $${paramIndex} LIMIT $${paramIndex + 1}`;
    queryParams.push(offset, limit);

    const result = await pool.query(queryText, queryParams);

    // Запрос общего количества
    let countText = `SELECT COUNT(*) AS total FROM applications WHERE title ILIKE $1`;
    const countParams = [q];
    if (filterQuery.length > 0) {
      countText += `
        AND appID IN (
          SELECT fa.appID FROM filter_app fa 
          JOIN filters f ON f.filterID = fa.filterID 
          WHERE f.name = ANY($2)
          GROUP BY fa.appID
          HAVING COUNT(DISTINCT f.name) = cardinality($2::text[])
        )
      `;
      countParams.push(filterQuery);
    }
    const countResult = await pool.query(countText, countParams);

    // Подтягиваем теги и формируем объекты для фронта
    const items = await Promise.all(result.rows.map(async (game) => {
      const tagsResult = await pool.query(`
        SELECT f.name FROM filters f
        JOIN filter_app fa ON fa.filterID = f.filterID
        WHERE fa.appID = $1
      `, [game.id]);
      
      return {
        id: game.id,
        title: game.title,
        description: game.description,
        imageURL: game.imageurl ? `/covers/${game.imageurl}` : null,
        sfwURL: game.sfwurl,
        developer: game.developer,
        uploads: game.uploads,
        rate: game.rate,
        releaseDate: game.releasedate,
        filters: tagsResult.rows.map(t => t.name),
      };
    }));

    res.json({
      items,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
    });
  } catch (err) {
    console.error('Ошибка /api/games:', err);
    res.status(500).json({ error: 'DB_ERROR' });
  }
});

// ── Одна игра ────────────────────────────────────
app.get('/api/games/:id', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT appID AS id, title, description, imageURL, sfwURL, developer, uploads, COALESCE((SELECT round(avg(value),1) FROM archive_game_ratings r WHERE r.game_id=applications.appID),0) AS rate, releaseDate
      FROM applications WHERE appID = $1
    `, [req.params.id]);
      
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });

    const g = result.rows[0];
    
    // Подтягиваем теги
    const tags = await pool.query(`
      SELECT f.name FROM filters f
      JOIN filter_app fa ON fa.filterID = f.filterID
      WHERE fa.appID = $1
    `, [g.id]);

    // Формируем ответ с правильными ключами
    const response = {
      id: g.id,
      title: g.title,
      description: g.description,
      imageURL: g.imageurl ? `/covers/${g.imageurl}` : null,
      sfwURL: g.sfwurl,
      developer: g.developer,
      uploads: g.uploads,
      rate: g.rate,
      releaseDate: g.releasedate,
      filters: tags.rows.map(t => t.name),
    };

    res.json(response);
  } catch (err) {
    console.error('Ошибка /api/games/:id:', err);
    res.status(500).json({ error: 'DB_ERROR' });
  }
});

// ── Получить все доступные теги ──────────────────
app.get('/api/filters', async (_req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`SELECT filterID AS id, name FROM filters ORDER BY name ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR' });
  }
});

try {
  await initializeAuth(getPool());
  const server = app.listen(PORT, () => console.log(`Backend: http://localhost:${PORT}`));
  attachChatSocket(server);
} catch (err) {
  console.error('Failed to initialize database:', err.code || err.name);
  process.exit(1);
}

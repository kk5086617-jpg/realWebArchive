CREATE TABLE IF NOT EXISTS archive_chat_messages (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES archive_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS archive_game_comments (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES applications(appid) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES archive_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS archive_comments_game ON archive_game_comments(game_id, id DESC);
CREATE TABLE IF NOT EXISTS archive_game_ratings (
  game_id INTEGER NOT NULL REFERENCES applications(appid) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES archive_users(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, user_id)
);

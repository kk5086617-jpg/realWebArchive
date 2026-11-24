ALTER TABLE archive_users ADD COLUMN IF NOT EXISTS nickname VARCHAR(40);
ALTER TABLE archive_users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE archive_users ADD COLUMN IF NOT EXISTS avatar BYTEA;
ALTER TABLE archive_users ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS archive_wall_posts (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES archive_users(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES archive_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  image BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS archive_wall_owner ON archive_wall_posts(owner_id, id DESC);

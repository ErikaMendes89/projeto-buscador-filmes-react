CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(40) UNIQUE NOT NULL,
  display_name varchar(100) NOT NULL,
  email varchar(320) UNIQUE NOT NULL,
  bio varchar(280),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO users (id, username, display_name, email, bio)
VALUES ('00000000-0000-0000-0000-000000000001', 'erika', 'Erika Mendes', 'demo@moviematch.local', 'Ficção científica, suspense e filmes que explodem a cabeça.')
ON CONFLICT DO NOTHING;

CREATE TYPE interaction_status AS ENUM ('want_to_watch', 'watching', 'watched', 'abandoned', 'favorite');

CREATE TABLE IF NOT EXISTS movie_interactions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id bigint NOT NULL,
  title varchar(250) NOT NULL,
  poster_path text,
  status interaction_status NOT NULL,
  rating numeric(2,1) CHECK (rating BETWEEN 0.5 AND 5),
  review text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS movie_interactions_status_idx ON movie_interactions (user_id, status, updated_at DESC);

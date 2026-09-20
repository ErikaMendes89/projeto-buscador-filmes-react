CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id bigint NOT NULL,
  title varchar(250) NOT NULL,
  poster_path text,
  rating numeric(2,1) NOT NULL CHECK (rating BETWEEN 0.5 AND 5),
  body varchar(2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS reviews_movie_created_idx ON reviews (movie_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_user_created_idx ON reviews (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE INDEX IF NOT EXISTS follows_followed_idx ON follows (followed_id, created_at DESC);

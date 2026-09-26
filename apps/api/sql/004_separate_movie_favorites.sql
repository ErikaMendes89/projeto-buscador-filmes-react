ALTER TABLE movie_interactions
  ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;

UPDATE movie_interactions
SET status = 'want_to_watch', is_favorite = true
WHERE status = 'favorite';

CREATE TYPE interaction_status_new AS ENUM ('want_to_watch', 'watching', 'watched', 'abandoned');

ALTER TABLE movie_interactions
  ALTER COLUMN status TYPE interaction_status_new
  USING status::text::interaction_status_new;

DROP TYPE interaction_status;
ALTER TYPE interaction_status_new RENAME TO interaction_status;

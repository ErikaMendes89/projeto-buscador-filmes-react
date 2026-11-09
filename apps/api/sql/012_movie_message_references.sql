ALTER TABLE messages
  ADD COLUMN movie_id integer,
  ADD COLUMN movie_title text,
  ADD COLUMN movie_poster_path text,
  ADD CONSTRAINT messages_movie_reference_check CHECK (
    (movie_id IS NULL AND movie_title IS NULL AND movie_poster_path IS NULL)
    OR (movie_id > 0 AND movie_title IS NOT NULL AND length(btrim(movie_title)) > 0)
  );

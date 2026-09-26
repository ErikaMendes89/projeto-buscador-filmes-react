ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_half_step_check
  CHECK (rating * 2 = trunc(rating * 2)) NOT VALID;

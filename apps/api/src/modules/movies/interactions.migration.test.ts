import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('favorite migration', () => {
  it('converts legacy favorites into want-to-watch plus is_favorite without marking them watched', async () => {
    const migration = await readFile(new URL('../../../sql/004_separate_movie_favorites.sql', import.meta.url), 'utf8');

    expect(migration).toContain('ADD COLUMN is_favorite boolean NOT NULL DEFAULT false');
    expect(migration).toMatch(/UPDATE movie_interactions\s+SET status = 'want_to_watch', is_favorite = true\s+WHERE status = 'favorite'/);
    expect(migration).toContain("CREATE TYPE interaction_status_new AS ENUM ('want_to_watch', 'watching', 'watched', 'abandoned')");
    expect(migration).toContain('USING status::text::interaction_status_new');
    expect(migration).toContain('DROP TYPE interaction_status');
  });
});

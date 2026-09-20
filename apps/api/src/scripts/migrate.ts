import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const sqlDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../sql');
const client = await pool.connect();

try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const applied = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  const appliedNames = new Set(applied.rows.map(({ filename }) => filename));
  const migrations = (await readdir(sqlDirectory)).filter((file) => file.endsWith('.sql')).sort();

  for (const filename of migrations) {
    if (appliedNames.has(filename)) continue;
    await client.query('BEGIN');
    try {
      await client.query(await readFile(join(sqlDirectory, filename), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      console.log(`Aplicada: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}

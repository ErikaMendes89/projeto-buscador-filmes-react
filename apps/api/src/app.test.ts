import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app.js';

describe('API', () => {
  it('reports its health', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'moviematch-api' });
  });

  it('rejects a one-character movie query', async () => {
    const response = await request(app).get('/api/movies?q=a');
    expect(response.status).toBe(400);
  });

  it('provides a demo catalog without requiring a TMDB token', async () => {
    const response = await request(app).get('/api/movies');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });
});

import type { Pool, PoolClient } from 'pg';

export interface ConversationSummary {
  id: string;
  kind: 'individual';
  participant: { username: string; displayName: string };
  lastMessage: { id: string; body: string; senderUsername: string; createdAt: Date } | null;
  lastMessageId: string | null;
  unreadCount: number;
  updatedAt: Date;
}

export interface ConversationMessage {
  conversationId: string;
  clientMessageId: string;
  id: string;
  body: string;
  movie: { id: number; title: string; posterPath: string | null } | null;
  sender: { username: string; displayName: string };
  createdAt: Date;
}

export interface ConversationsRepository {
  createIndividual(firstUserId: string, secondUserId: string): Promise<{ id: string; created: boolean } | null>;
  listForUser(userId: string): Promise<ConversationSummary[]>;
  sendMessage(conversationId: string, senderId: string, clientMessageId: string, body: string, movie?: ConversationMessage['movie']): Promise<
    | { status: 'sent'; created: boolean; recipientId: string; message: ConversationMessage }
    | { status: 'not_participant' }
    | { status: 'blocked' }
    | { status: 'mutual_follow_required' }
    | { status: 'idempotency_conflict' }
  >;
  listMessages(conversationId: string, userId: string, page: number, pageSize: number): Promise<
    | { status: 'ok'; items: ConversationMessage[]; totalResults: number }
    | { status: 'not_participant' | 'blocked' }
  >;
  listMessagesAfter(conversationId: string, userId: string, afterMessageId: string, pageSize: number): Promise<
    | { status: 'ok'; items: ConversationMessage[]; hasMore: boolean }
    | { status: 'not_participant' | 'blocked' }
  >;
  markMessagesRead(conversationId: string, userId: string): Promise<
    | { status: 'ok'; updatedCount: number }
    | { status: 'not_participant' | 'blocked' }
  >;
}

interface HistoryQueryRow extends ConversationMessage {
  isParticipant: boolean;
  isBlocked: boolean;
  totalResults?: number;
}

const historyAccessCtes = `
  WITH participant AS MATERIALIZED (
    SELECT mine.conversation_id AS "conversationId", other.user_id AS "peerId"
    FROM conversation_participants mine
    JOIN conversation_participants other ON other.conversation_id = mine.conversation_id AND other.user_id <> mine.user_id
    JOIN conversations c ON c.id = mine.conversation_id AND c.kind = 'individual'
    WHERE mine.conversation_id = $1 AND mine.user_id = $2
  ), access AS MATERIALIZED (
    SELECT EXISTS (SELECT 1 FROM participant) AS "isParticipant",
           EXISTS (
             SELECT 1 FROM participant p
             JOIN user_blocks b ON (b.blocker_id = $2 AND b.blocked_id = p."peerId")
                               OR (b.blocker_id = p."peerId" AND b.blocked_id = $2)
           ) AS "isBlocked"
  ), authorized AS MATERIALIZED (
    SELECT p."conversationId"
    FROM participant p CROSS JOIN access a
    WHERE a."isParticipant" AND NOT a."isBlocked"
  )`;

function historyAccessStatus(row: Pick<HistoryQueryRow, 'isParticipant' | 'isBlocked'>): 'ok' | 'not_participant' | 'blocked' {
  if (!row.isParticipant) return 'not_participant';
  return row.isBlocked ? 'blocked' : 'ok';
}

function toConversationMessage(row: HistoryQueryRow): ConversationMessage {
  return {
    conversationId: row.conversationId,
    clientMessageId: row.clientMessageId,
    id: row.id,
    body: row.body,
    movie: row.movie,
    sender: row.sender,
    createdAt: row.createdAt,
  };
}

export class PgConversationsRepository implements ConversationsRepository {
  constructor(private readonly db: Pool) {}

  private async lockPair(client: PoolClient, firstUserId: string, secondUserId: string) {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended(LEAST($1::text, $2::text) || ':' || GREATEST($1::text, $2::text), 0))`,
      [firstUserId, secondUserId],
    );
  }

  async createIndividual(firstUserId: string, secondUserId: string) {
    const [lowId, highId] = [firstUserId, secondUserId].sort();
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await this.lockPair(client, lowId!, highId!);
      const blocked = await client.query(
        'SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
        [lowId, highId],
      );
      if (blocked.rowCount) {
        await client.query('ROLLBACK');
        return null;
      }

      const existing = await client.query<{ id: string }>(
        `SELECT id FROM conversations
         WHERE kind = 'individual' AND direct_user_low_id = $1 AND direct_user_high_id = $2`,
        [lowId, highId],
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return { id: existing.rows[0].id, created: false };
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO conversations (kind, direct_user_low_id, direct_user_high_id)
         VALUES ('individual', $1, $2) RETURNING id`,
        [lowId, highId],
      );
      const conversationId = inserted.rows[0]!.id;
      await client.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
        [conversationId, lowId, highId],
      );
      await client.query('COMMIT');
      return { id: conversationId, created: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listForUser(userId: string): Promise<ConversationSummary[]> {
    const result = await this.db.query<ConversationSummary>(
      `SELECT c.id, c.kind,
              json_build_object('username', peer.username, 'displayName', peer.display_name) AS participant,
              CASE WHEN latest.id IS NULL THEN NULL ELSE json_build_object(
                'id', latest.id, 'body', latest.body, 'senderUsername', sender.username, 'createdAt', latest.created_at
              ) END AS "lastMessage",
              latest.id AS "lastMessageId",
              (SELECT count(*)::int FROM messages unread
               WHERE unread.conversation_id = c.id AND unread.sender_id <> mine.user_id
                 AND NOT EXISTS (SELECT 1 FROM message_reads read_receipt
                                 WHERE read_receipt.conversation_id = unread.conversation_id
                                   AND read_receipt.message_id = unread.id AND read_receipt.user_id = mine.user_id)
              ) AS "unreadCount",
              c.updated_at AS "updatedAt"
       FROM conversation_participants mine
       JOIN conversations c ON c.id = mine.conversation_id AND c.kind = 'individual'
       JOIN conversation_participants other ON other.conversation_id = c.id AND other.user_id <> mine.user_id
       JOIN users peer ON peer.id = other.user_id AND peer.password_hash IS NOT NULL
       LEFT JOIN LATERAL (
         SELECT m.id, m.body, m.sender_id, m.created_at
         FROM messages m WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC, m.id DESC LIMIT 1
       ) latest ON true
       LEFT JOIN users sender ON sender.id = latest.sender_id
       WHERE mine.user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = peer.id) OR (b.blocker_id = peer.id AND b.blocked_id = $1)
         )
       ORDER BY c.updated_at DESC, c.id DESC`,
      [userId],
    );
    return result.rows;
  }

  async sendMessage(conversationId: string, senderId: string, clientMessageId: string, body: string, movie: ConversationMessage['movie'] = null) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const peer = await client.query<{ peerId: string }>(
        `SELECT other.user_id AS "peerId"
         FROM conversation_participants mine
         JOIN conversation_participants other ON other.conversation_id = mine.conversation_id AND other.user_id <> mine.user_id
         JOIN conversations c ON c.id = mine.conversation_id AND c.kind = 'individual'
         WHERE mine.conversation_id = $1 AND mine.user_id = $2 LIMIT 1`,
        [conversationId, senderId],
      );
      const recipientId = peer.rows[0]?.peerId;
      if (!recipientId) {
        await client.query('ROLLBACK');
        return { status: 'not_participant' } as const;
      }

      await this.lockPair(client, senderId, recipientId);
      const blocked = await client.query(
        'SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
        [senderId, recipientId],
      );
      if (blocked.rowCount) {
        await client.query('ROLLBACK');
        return { status: 'blocked' } as const;
      }

      const existing = await client.query<{ id: string; body: string; createdAt: Date; movieId: number | null; movieTitle: string | null; moviePosterPath: string | null }>(
        `SELECT id, body, movie_id AS "movieId", movie_title AS "movieTitle", movie_poster_path AS "moviePosterPath", created_at AS "createdAt"
         FROM messages
         WHERE conversation_id = $1 AND sender_id = $2 AND client_message_id = $3`,
        [conversationId, senderId, clientMessageId],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].body !== body || (existing.rows[0].movieId ?? null) !== (movie?.id ?? null)) {
          await client.query('ROLLBACK');
          return { status: 'idempotency_conflict' } as const;
        }
        const author = await client.query<{ username: string; displayName: string }>(
          'SELECT username, display_name AS "displayName" FROM users WHERE id = $1',
          [senderId],
        );
        await client.query('COMMIT');
        return {
          status: 'sent',
          created: false,
          recipientId,
          message: { ...existing.rows[0], movie: existing.rows[0].movieId ? { id: existing.rows[0].movieId, title: existing.rows[0].movieTitle ?? 'Filme', posterPath: existing.rows[0].moviePosterPath } : null, conversationId, clientMessageId, sender: author.rows[0]! },
        } as const;
      }

      const follows = await client.query<{ mutual: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2)
                AND EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND followed_id = $1) AS mutual`,
        [senderId, recipientId],
      );
      if (!follows.rows[0]?.mutual) {
        await client.query('ROLLBACK');
        return { status: 'mutual_follow_required' } as const;
      }

      const inserted = await client.query<{ id: string; body: string; createdAt: Date; clientMessageId: string; movieId: number | null; movieTitle: string | null; moviePosterPath: string | null }>(
        `INSERT INTO messages (conversation_id, sender_id, client_message_id, body, movie_id, movie_title, movie_poster_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (conversation_id, sender_id, client_message_id) DO NOTHING
         RETURNING id, body, created_at AS "createdAt", client_message_id AS "clientMessageId", movie_id AS "movieId", movie_title AS "movieTitle", movie_poster_path AS "moviePosterPath"`,
        [conversationId, senderId, clientMessageId, body, movie?.id ?? null, movie?.title ?? null, movie?.posterPath ?? null],
      );
      if (!inserted.rows[0]) {
        const conflict = await client.query<{ id: string; body: string; createdAt: Date; movieId: number | null; movieTitle: string | null; moviePosterPath: string | null }>(
          `SELECT id, body, movie_id AS "movieId", movie_title AS "movieTitle", movie_poster_path AS "moviePosterPath", created_at AS "createdAt"
           FROM messages
           WHERE conversation_id = $1 AND sender_id = $2 AND client_message_id = $3`,
          [conversationId, senderId, clientMessageId],
        );
        const prior = conflict.rows[0];
        if (!prior || prior.body !== body || (prior.movieId ?? null) !== (movie?.id ?? null)) {
          await client.query('ROLLBACK');
          return { status: 'idempotency_conflict' } as const;
        }
        const author = await client.query<{ username: string; displayName: string }>(
          'SELECT username, display_name AS "displayName" FROM users WHERE id = $1',
          [senderId],
        );
        await client.query('COMMIT');
        return {
          status: 'sent',
          created: false,
          recipientId,
          message: { ...prior, movie: prior.movieId ? { id: prior.movieId, title: prior.movieTitle ?? 'Filme', posterPath: prior.moviePosterPath } : null, conversationId, clientMessageId, sender: author.rows[0]! },
        } as const;
      }
      await client.query('UPDATE conversations SET updated_at = now() WHERE id = $1', [conversationId]);
      const author = await client.query<{ username: string; displayName: string }>(
        'SELECT username, display_name AS "displayName" FROM users WHERE id = $1',
        [senderId],
      );
      await client.query('COMMIT');
      return {
        status: 'sent',
        created: true,
        recipientId,
        message: { ...inserted.rows[0]!, movie: inserted.rows[0]!.movieId ? { id: inserted.rows[0]!.movieId, title: inserted.rows[0]!.movieTitle ?? 'Filme', posterPath: inserted.rows[0]!.moviePosterPath } : null, conversationId, sender: author.rows[0]! },
      } as const;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listMessages(conversationId: string, userId: string, page: number, pageSize: number) {
    const result = await this.db.query<HistoryQueryRow>(
      `${historyAccessCtes}, total AS MATERIALIZED (
         SELECT count(*)::int AS "totalResults"
         FROM messages m JOIN authorized a ON a."conversationId" = m.conversation_id
       ), page AS MATERIALIZED (
         SELECT m.id, m.conversation_id AS "conversationId", m.client_message_id AS "clientMessageId", m.body,
                m.movie_id AS "movieId", m.movie_title AS "movieTitle", m.movie_poster_path AS "moviePosterPath",
                m.sender_id, m.created_at AS "createdAt"
         FROM messages m JOIN authorized a ON a."conversationId" = m.conversation_id
         ORDER BY m.created_at DESC, m.id DESC LIMIT $3 OFFSET $4
       )
       SELECT a."isParticipant", a."isBlocked", total."totalResults",
              page.id, page."conversationId", page."clientMessageId", page.body,
              CASE WHEN page."movieId" IS NULL THEN NULL ELSE json_build_object('id', page."movieId", 'title', page."movieTitle", 'posterPath', page."moviePosterPath") END AS movie,
              CASE WHEN page.id IS NULL THEN NULL ELSE json_build_object('username', sender.username, 'displayName', sender.display_name) END AS sender,
              page."createdAt"
       FROM access a CROSS JOIN total
       LEFT JOIN page ON true
       LEFT JOIN users sender ON sender.id = page.sender_id
       ORDER BY page."createdAt" DESC NULLS LAST, page.id DESC NULLS LAST`,
      [conversationId, userId, pageSize, (page - 1) * pageSize],
    );
    const firstRow = result.rows[0];
    if (!firstRow) return { status: 'not_participant' } as const;
    const status = historyAccessStatus(firstRow);
    if (status !== 'ok') return { status } as const;
    return {
      status: 'ok',
      items: result.rows.filter((row) => row.id !== null).map(toConversationMessage),
      totalResults: firstRow.totalResults ?? 0,
    } as const;
  }

  async listMessagesAfter(conversationId: string, userId: string, afterMessageId: string, pageSize: number) {
    const result = await this.db.query<HistoryQueryRow>(
      `${historyAccessCtes}, page AS MATERIALIZED (
         SELECT m.id, m.conversation_id AS "conversationId", m.client_message_id AS "clientMessageId", m.body,
                m.movie_id AS "movieId", m.movie_title AS "movieTitle", m.movie_poster_path AS "moviePosterPath",
                m.sender_id, m.created_at AS "createdAt"
         FROM messages m JOIN authorized a ON a."conversationId" = m.conversation_id
         WHERE (m.created_at, m.id) > (SELECT cursor_message.created_at, cursor_message.id
                                       FROM messages cursor_message
                                       WHERE cursor_message.conversation_id = $1 AND cursor_message.id = $3)
         ORDER BY m.created_at, m.id LIMIT $4
       )
       SELECT a."isParticipant", a."isBlocked",
              page.id, page."conversationId", page."clientMessageId", page.body,
              CASE WHEN page."movieId" IS NULL THEN NULL ELSE json_build_object('id', page."movieId", 'title', page."movieTitle", 'posterPath', page."moviePosterPath") END AS movie,
              CASE WHEN page.id IS NULL THEN NULL ELSE json_build_object('username', sender.username, 'displayName', sender.display_name) END AS sender,
              page."createdAt"
       FROM access a LEFT JOIN page ON true
       LEFT JOIN users sender ON sender.id = page.sender_id
       ORDER BY page."createdAt", page.id`,
      [conversationId, userId, afterMessageId, pageSize + 1],
    );
    const firstRow = result.rows[0];
    if (!firstRow) return { status: 'not_participant' } as const;
    const status = historyAccessStatus(firstRow);
    if (status !== 'ok') return { status } as const;
    const items = result.rows.filter((row) => row.id !== null).map(toConversationMessage);
    return { status: 'ok', items: items.slice(0, pageSize), hasMore: items.length > pageSize } as const;
  }

  async markMessagesRead(conversationId: string, userId: string) {
    const result = await this.db.query<{ isParticipant: boolean; isBlocked: boolean; updatedCount: number }>(
      `${historyAccessCtes}, marked AS (
         INSERT INTO message_reads (conversation_id, message_id, user_id)
         SELECT m.conversation_id, m.id, $2
         FROM messages m
         JOIN authorized a ON a."conversationId" = m.conversation_id
         WHERE m.sender_id <> $2
         ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = now()
         RETURNING message_id
       )
       SELECT a."isParticipant", a."isBlocked", (SELECT count(*)::int FROM marked) AS "updatedCount" FROM access a`,
      [conversationId, userId],
    );
    const row = result.rows[0];
    if (!row) return { status: 'not_participant' } as const;
    const status = historyAccessStatus(row);
    if (status !== 'ok') return { status } as const;
    return { status: 'ok', updatedCount: row.updatedCount } as const;
  }
}

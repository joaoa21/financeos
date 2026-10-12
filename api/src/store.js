// Onde os dados ficam guardados: uma linha por conta, com todos os meses num JSON.
//
// Cada linha tem um número de versão. Quem salva diz em qual versão se baseou;
// se outra aba ou outro aparelho salvou antes, a versão não bate e nada é
// sobrescrito (a API responde 409 e o site carrega a versão mais nova).
//
// Versões anteriores (user_state_history): antes de sobrescrever, a versão que estava
// no banco é copiada para o histórico, no máximo uma vez a cada 6 horas (ou sempre,
// quando o site pede um "ponto de restauração" antes de algo grande, como importar
// um arquivo ou limpar um mês). Também antes de "Apagar todos os dados". Cada cópia
// fica 30 dias e some sozinha depois.

const SNAPSHOT_EVERY = '6 hours';
const KEEP = '30 days';
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const SNAPSHOT_EVERY_MS = 6 * 60 * 60 * 1000;
const HISTORY_LIMIT = 60;

/** Cria as tabelas (ou acrescenta as colunas novas) ao ligar a API. */
export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_state (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL UNIQUE,
      data        JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE user_state ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    CREATE TABLE IF NOT EXISTS user_state_history (
      id        SERIAL PRIMARY KEY,
      user_id   TEXT NOT NULL,
      data      JSONB NOT NULL,
      version   INTEGER NOT NULL,
      saved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS user_state_history_user ON user_state_history (user_id, saved_at DESC);
  `);
}

const iso = (value) => new Date(value).toISOString();

/** @param {import('pg').Pool} pool */
export function pgStore(pool) {
  return {
    async get(userId) {
      const { rows } = await pool.query('SELECT data, version, updated_at FROM user_state WHERE user_id = $1', [userId]);
      if (!rows.length) return null;
      return { data: rows[0].data, version: rows[0].version, updatedAt: iso(rows[0].updated_at) };
    },

    /** `checkpoint`: guarda a versão atual no histórico mesmo que a última cópia seja recente. */
    async save(userId, data, baseVersion, checkpoint = false) {
      const json = JSON.stringify(data);
      const { rows } =
        baseVersion === 0
          ? await pool.query(
              `INSERT INTO user_state (user_id, data, version, updated_at) VALUES ($1, $2, 1, NOW())
               ON CONFLICT (user_id) DO NOTHING RETURNING version, updated_at`,
              [userId, json],
            )
          : await pool.query(
              `WITH cur AS (
                 SELECT data, version FROM user_state WHERE user_id = $1 AND version = $3 FOR UPDATE
               ), snap AS (
                 INSERT INTO user_state_history (user_id, data, version)
                 SELECT $1, cur.data, cur.version FROM cur
                 WHERE cur.data <> '{}'::jsonb
                   AND ($4::boolean OR NOT EXISTS (
                     SELECT 1 FROM user_state_history
                     WHERE user_id = $1 AND saved_at > NOW() - INTERVAL '${SNAPSHOT_EVERY}'))
               )
               UPDATE user_state s SET data = $2, version = s.version + 1, updated_at = NOW()
               FROM cur WHERE s.user_id = $1 AND s.version = $3
               RETURNING s.version, s.updated_at`,
              [userId, json, baseVersion, checkpoint],
            );
      if (!rows.length) return { ok: false };
      return { ok: true, version: rows[0].version, updatedAt: iso(rows[0].updated_at) };
    },

    /** "Apagar todos os dados": guarda uma última cópia no histórico (30 dias) e apaga. */
    async remove(userId) {
      const { rowCount } = await pool.query(
        `WITH snap AS (
           INSERT INTO user_state_history (user_id, data, version)
           SELECT user_id, data, version FROM user_state WHERE user_id = $1 AND data <> '{}'::jsonb
         )
         DELETE FROM user_state WHERE user_id = $1`,
        [userId],
      );
      return rowCount > 0;
    },

    /** Conta excluída no Authik (LGPD): apaga tudo, inclusive o histórico. */
    async purge(userId) {
      const state = await pool.query('DELETE FROM user_state WHERE user_id = $1', [userId]);
      const history = await pool.query('DELETE FROM user_state_history WHERE user_id = $1', [userId]);
      return state.rowCount + history.rowCount > 0;
    },

    async history(userId) {
      const { rows } = await pool.query(
        `SELECT id, version, saved_at, (SELECT count(*) FROM jsonb_object_keys(data))::int AS months
         FROM user_state_history
         WHERE user_id = $1 AND saved_at > NOW() - INTERVAL '${KEEP}'
         ORDER BY saved_at DESC LIMIT ${HISTORY_LIMIT}`,
        [userId],
      );
      return rows.map((row) => ({ id: row.id, version: row.version, savedAt: iso(row.saved_at), months: row.months }));
    },

    async historyItem(userId, id) {
      const { rows } = await pool.query(
        `SELECT id, data, version, saved_at FROM user_state_history
         WHERE user_id = $1 AND id = $2 AND saved_at > NOW() - INTERVAL '${KEEP}'`,
        [userId, id],
      );
      if (!rows.length) return null;
      return { id: rows[0].id, data: rows[0].data, version: rows[0].version, savedAt: iso(rows[0].saved_at) };
    },

    /** Apaga as cópias com mais de 30 dias. */
    async prune() {
      const { rowCount } = await pool.query(`DELETE FROM user_state_history WHERE saved_at < NOW() - INTERVAL '${KEEP}'`);
      return rowCount;
    },

    async list() {
      const { rows } = await pool.query(
        `SELECT user_id, version, updated_at, pg_column_size(data) AS bytes,
                (SELECT count(*) FROM jsonb_object_keys(data)) AS months
         FROM user_state ORDER BY updated_at DESC`,
      );
      return rows;
    },

    async move(fromUserId, toUserId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const target = await client.query('SELECT data FROM user_state WHERE user_id = $1 FOR UPDATE', [toUserId]);
        if (target.rows.length && Object.keys(target.rows[0].data ?? {}).length) {
          throw new Error('A conta de destino já tem dados. Nada foi alterado.');
        }
        await client.query('DELETE FROM user_state WHERE user_id = $1', [toUserId]);
        const { rowCount } = await client.query(
          'UPDATE user_state SET user_id = $2, version = version + 1, updated_at = NOW() WHERE user_id = $1',
          [fromUserId, toUserId],
        );
        if (!rowCount) throw new Error('Conta de origem não encontrada. Nada foi alterado.');
        await client.query('UPDATE user_state_history SET user_id = $2 WHERE user_id = $1', [fromUserId, toUserId]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/** Mesmo comportamento, só na memória (testes e prévias locais). `now` permite simular o relógio. */
export function memoryStore({ now = () => Date.now() } = {}) {
  const rows = new Map();
  const snaps = [];
  let nextId = 1;
  const isEmpty = (data) => !Object.keys(data ?? {}).length;
  const snapshot = (userId, row) => {
    if (!isEmpty(row.data)) snaps.push({ id: nextId++, userId, data: structuredClone(row.data), version: row.version, savedAt: now() });
  };
  const recent = (userId) => snaps.filter((s) => s.userId === userId && s.savedAt > now() - KEEP_MS);
  return {
    async get(userId) {
      const row = rows.get(userId);
      return row ? structuredClone(row) : null;
    },
    async save(userId, data, baseVersion, checkpoint = false) {
      const current = rows.get(userId);
      if ((current?.version ?? 0) !== baseVersion) return { ok: false };
      if (current && (checkpoint || !recent(userId).some((s) => s.savedAt > now() - SNAPSHOT_EVERY_MS))) snapshot(userId, current);
      const row = { data: structuredClone(data), version: baseVersion + 1, updatedAt: new Date(now()).toISOString() };
      rows.set(userId, row);
      return { ok: true, version: row.version, updatedAt: row.updatedAt };
    },
    async remove(userId) {
      const current = rows.get(userId);
      if (current) snapshot(userId, current);
      return rows.delete(userId);
    },
    async purge(userId) {
      const before = snaps.length;
      for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].userId === userId) snaps.splice(i, 1);
      return rows.delete(userId) || snaps.length !== before;
    },
    async history(userId) {
      return recent(userId)
        .sort((a, b) => b.savedAt - a.savedAt || b.id - a.id)
        .slice(0, HISTORY_LIMIT)
        .map((s) => ({ id: s.id, version: s.version, savedAt: new Date(s.savedAt).toISOString(), months: Object.keys(s.data).length }));
    },
    async historyItem(userId, id) {
      const s = recent(userId).find((x) => x.id === id);
      return s ? { id: s.id, data: structuredClone(s.data), version: s.version, savedAt: new Date(s.savedAt).toISOString() } : null;
    },
    async prune() {
      const before = snaps.length;
      for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].savedAt < now() - KEEP_MS) snaps.splice(i, 1);
      return before - snaps.length;
    },
  };
}

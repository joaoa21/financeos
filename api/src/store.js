// Onde os dados ficam guardados: uma linha por conta, com todos os meses num JSON.
//
// Cada linha tem um número de versão. Quem salva diz em qual versão se baseou;
// se outra aba ou outro aparelho salvou antes, a versão não bate e nada é
// sobrescrito (a API responde 409 e o site carrega a versão mais nova).

/** Cria a tabela (ou acrescenta as colunas novas) ao ligar a API. */
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
  `);
}

/** @param {import('pg').Pool} pool */
export function pgStore(pool) {
  return {
    async get(userId) {
      const { rows } = await pool.query('SELECT data, version, updated_at FROM user_state WHERE user_id = $1', [userId]);
      if (!rows.length) return null;
      return { data: rows[0].data, version: rows[0].version, updatedAt: new Date(rows[0].updated_at).toISOString() };
    },

    async save(userId, data, baseVersion) {
      const json = JSON.stringify(data);
      const { rows } =
        baseVersion === 0
          ? await pool.query(
              `INSERT INTO user_state (user_id, data, version, updated_at) VALUES ($1, $2, 1, NOW())
               ON CONFLICT (user_id) DO NOTHING RETURNING version, updated_at`,
              [userId, json],
            )
          : await pool.query(
              `UPDATE user_state SET data = $2, version = version + 1, updated_at = NOW()
               WHERE user_id = $1 AND version = $3 RETURNING version, updated_at`,
              [userId, json, baseVersion],
            );
      if (!rows.length) return { ok: false };
      return { ok: true, version: rows[0].version, updatedAt: new Date(rows[0].updated_at).toISOString() };
    },

    async remove(userId) {
      const { rowCount } = await pool.query('DELETE FROM user_state WHERE user_id = $1', [userId]);
      return rowCount > 0;
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

/** Mesmo comportamento, só na memória (testes e prévias locais). */
export function memoryStore() {
  const rows = new Map();
  return {
    async get(userId) {
      const row = rows.get(userId);
      return row ? structuredClone(row) : null;
    },
    async save(userId, data, baseVersion) {
      const current = rows.get(userId);
      if ((current?.version ?? 0) !== baseVersion) return { ok: false };
      const row = { data: structuredClone(data), version: baseVersion + 1, updatedAt: new Date().toISOString() };
      rows.set(userId, row);
      return { ok: true, version: row.version, updatedAt: row.updatedAt };
    },
    async remove(userId) {
      return rows.delete(userId);
    },
  };
}

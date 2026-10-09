import pg from 'pg';
import { pgStore } from '../src/store.js';

// Comandos de manutenção das contas (rodar no servidor ou com a URL pública do banco).
//
//   npm run contas -- listar
//   npm run contas -- mover <ID antigo> <ID novo>
//
// "mover" serve para a troca do Clerk pelo Authik: os dados guardados com o ID antigo
// (Clerk, começa com "user_") passam para o ID da conta nova no Authik. Só funciona se a
// conta nova ainda não tiver dados (entrar no site sem mexer em nada não cria dados).
// Para usar outro banco: --db "<DATABASE_PUBLIC_URL>" antes do comando.

const args = process.argv.slice(2);
let url = process.env.DATABASE_URL;
const dbIndex = args.indexOf('--db');
if (dbIndex >= 0) {
  url = args[dbIndex + 1];
  args.splice(dbIndex, 2);
}
if (!url) {
  console.error('Falta DATABASE_URL (ou --db "<url>").');
  process.exit(1);
}

const local = /localhost|127\.0\.0\.1/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
const store = pgStore(pool);
const [command, from, to] = args;

try {
  if (command === 'listar') {
    const rows = await store.list();
    if (!rows.length) console.log('Nenhuma conta com dados.');
    for (const row of rows) {
      console.log(`${row.user_id}  |  ${row.months} mês(es)  |  ${(row.bytes / 1024).toFixed(1)} KB  |  salvo em ${new Date(row.updated_at).toLocaleString('pt-BR')}`);
    }
  } else if (command === 'mover' && from && to) {
    await store.move(from, to);
    console.log(`Pronto: os dados de ${from} agora são da conta ${to}.`);
  } else {
    console.log('Uso: npm run contas -- listar | mover <ID antigo> <ID novo>');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

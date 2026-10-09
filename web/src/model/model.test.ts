import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { preparar, previsaoPreparo, resumo, situacao, totaisPorForma, valorInvestimento } from './calc.ts';
import { sugerirCategoria, sugerirTipo } from './categorias.ts';
import { businessDaysBetween, shiftKey } from './dates.ts';
import { migrate } from './migrate.ts';
import { merge3 } from './merge.ts';

const legado = {
  '2026-09': {
    saldoInicial: 1000,
    despesas: [
      { id: 'd1', nome: 'Aluguel', planejado: 1500, realizado: 1500, tipo: 'fixo', subtipo: 'boleto', data: 5, autoReplicar: true },
      { id: 'd2', nome: 'Fatura', planejado: 800, realizado: 0, tipo: 'cartao', data: '2026-09-10', agendado: true },
      { id: 'd3', nome: 'Presente', planejado: 100, realizado: 0, tipo: 'esporadico', data: 20 },
    ],
    rendas: [{ id: 'r1', nome: 'Salário', planejado: 5000, realizado: 5000, data: 5 }],
    investimentos: [
      { id: 'i1', nome: 'CDB Banco', tipo: 'CDB', valorInicial: 2000, dataInicio: '2026-09-01' },
      {
        id: 'i2',
        nome: 'Reserva',
        tipo: 'CDB',
        percentualCDI: 110,
        aportes: [
          { id: 'a1', valor: 300, data: '2026-09-06', impacto: 'realizado', previsto: false },
          { id: 'a2', valor: 200, data: '2026-09-25', impacto: 'planejado', previsto: true },
          { id: 'a3', valor: 50, data: '2026-09-02', impacto: 'nenhum', previsto: false },
        ],
      },
    ],
  },
  lixo: { despesas: [] },
};

describe('migração dos dados antigos', () => {
  const estado = migrate(legado);
  const set = estado['2026-09']!;

  it('descarta chaves que não são meses', () => {
    assert.deepEqual(Object.keys(estado), ['2026-09']);
  });

  it('converte pago/recebido, cartão antigo e dia em formato de data', () => {
    const [aluguel, fatura, presente] = set.despesas;
    assert.equal(aluguel!.pago, true);
    assert.equal(fatura!.tipo, 'fixo');
    assert.equal(fatura!.subtipo, 'cartao');
    assert.equal(fatura!.data, 10);
    assert.equal(fatura!.agendado, true);
    assert.equal(presente!.subtipo, null);
    assert.equal(set.rendas[0]!.recebido, true);
  });

  it('converte o impacto antigo dos aportes em origem + situação', () => {
    const cdbAntigo = set.investimentos[0]!;
    assert.equal(cdbAntigo.percentualCDI, 100);
    assert.equal(cdbAntigo.aportes[0]!.valor, 2000);
    const [a1, a2, a3] = set.investimentos[1]!.aportes;
    assert.deepEqual([a1!.origem, a1!.status], ['conta', 'feito']);
    assert.deepEqual([a2!.origem, a2!.status], ['conta', 'previsto']);
    assert.deepEqual([a3!.origem, a3!.status], ['externo', 'feito']);
  });

  it('é estável: migrar duas vezes dá o mesmo resultado', () => {
    assert.deepEqual(migrate(estado), estado);
  });

  it('não aceita lixo', () => {
    assert.deepEqual(migrate(null), {});
    assert.deepEqual(migrate('x'), {});
    const m = migrate({ '2026-01': { despesas: [{ nome: '<img onerror=x>', planejado: 'abc', id: "x');alert(1);//" }] } });
    const d = m['2026-01']!.despesas[0]!;
    assert.equal(d.planejado, 0);
    assert.notEqual(d.id, "x');alert(1);//");
  });
});

describe('resumo do mês', () => {
  const r = resumo(migrate(legado)['2026-09']!, 10);
  it('calcula sobra e "na conta" com agendados e aportes da conta', () => {
    assert.equal(r.rendaPrevista, 5000);
    assert.equal(r.despesaPrevista, 2400);
    assert.equal(r.agendado, 800);
    assert.equal(r.aPagar, 100);
    // aportes da conta: 300 (feito) + 200 (previsto)
    assert.equal(r.sobra, 1000 + 5000 - 2400 - 500);
    assert.equal(r.naConta, 1000 + 5000 - 1500 - 800 - 300);
    assert.equal(r.economia, (5000 - 2400) / 5000);
  });
});

describe('situação', () => {
  const now = new Date(2026, 9, 15);
  const base = { id: 'x', nome: 'x', planejado: 1, realizado: 0, pago: false, tipo: 'fixo' as const, subtipo: null, autoReplicar: false, agendado: false };
  it('atrasado, hoje, pendente, agendado e pago', () => {
    assert.equal(situacao({ ...base, data: 10 }, '2026-10', now), 'atrasado');
    assert.equal(situacao({ ...base, data: 15 }, '2026-10', now), 'hoje');
    assert.equal(situacao({ ...base, data: 20 }, '2026-10', now), 'pendente');
    assert.equal(situacao({ ...base, data: 20 }, '2026-09', now), 'atrasado');
    assert.equal(situacao({ ...base, data: 1 }, '2026-11', now), 'pendente');
    assert.equal(situacao({ ...base, data: 10, agendado: true }, '2026-10', now), 'agendado');
    assert.equal(situacao({ ...base, data: 10, pago: true }, '2026-10', now), 'pago');
  });
});

describe('investimentos', () => {
  it('dias úteis: não conta o dia do aporte e pula fins de semana', () => {
    assert.equal(businessDaysBetween('2026-10-09', '2026-10-09'), 0); // sexta → sexta
    assert.equal(businessDaysBetween('2026-10-09', '2026-10-12'), 1); // sexta → segunda
    assert.equal(businessDaysBetween('2026-10-05', '2026-10-19'), 10);
    assert.equal(businessDaysBetween('2026-10-12', '2026-10-05'), 0);
  });

  it('CDB rende pelo CDI; aporte previsto não entra na carteira', () => {
    const inv = { id: 'i', nome: 'CDB', tipo: 'CDB', percentualCDI: 100, aportes: [
      { id: 'a', valor: 1000, data: '2026-10-05', origem: 'externo' as const, status: 'feito' as const },
      { id: 'b', valor: 500, data: '2026-10-30', origem: 'conta' as const, status: 'previsto' as const },
    ] };
    const v = valorInvestimento(inv, 10, '2026-10-19');
    const esperado = 1000 * Math.pow(Math.pow(1.1, 1 / 252), 10);
    assert.ok(Math.abs(v.atual - esperado) < 1e-9);
    assert.equal(v.investido, 1000);
    assert.equal(v.previsto, 500);
  });
});

describe('preparar o mês seguinte', () => {
  const estado = migrate(legado);
  it('traz saldo, recorrentes e investimentos consolidados, sem repetir', () => {
    const p = previsaoPreparo(estado, '2026-09', '2026-10', 10);
    assert.equal(p.despesasRecorrentes.length, 1);
    assert.equal(p.outrasFixas.length, 1);
    const opcoes = { saldo: true, despesasRecorrentes: true, outrasFixas: false, rendasRecorrentes: true, outrasRendas: true, investimentos: true };
    const next = preparar(estado, '2026-09', '2026-10', opcoes, 10, true);
    const out = next['2026-10']!;
    assert.equal(out.saldoInicial, resumo(estado['2026-09']!, 10).naConta);
    assert.deepEqual(out.despesas.map((d) => [d.nome, d.pago, d.realizado]), [['Aluguel', false, 0]]);
    assert.equal(out.rendas.length, 1);
    assert.equal(out.investimentos.length, 2);
    assert.ok(out.investimentos[0]!.valorBase!.valor >= 2000);
    assert.equal(next['2026-09']!.fechado, true);
    // De novo: nada se repete.
    const again = preparar(next, '2026-09', '2026-10', opcoes, 10, true);
    assert.equal(again['2026-10']!.despesas.length, 1);
    assert.equal(again['2026-10']!.investimentos.length, 2);
  });

  it('virada de ano', () => {
    assert.equal(shiftKey('2026-12', 1), '2027-01');
    assert.equal(shiftKey('2026-01', -1), '2025-12');
  });
});

describe('categorias', () => {
  it('sugere pela palavra inteira', () => {
    assert.equal(sugerirCategoria('Netflix'), 'assinaturas');
    assert.equal(sugerirCategoria('Conta de luz'), 'contas');
    assert.equal(sugerirCategoria('Plano de saúde'), 'saude');
    assert.equal(sugerirCategoria('Claudete'), null);
  });

  it('sugere o tipo do investimento', () => {
    assert.equal(sugerirTipo('Tesouro Selic 2029'), 'Tesouro Direto');
    assert.equal(sugerirTipo('CDB Nubank'), 'CDB');
    assert.equal(sugerirTipo('HGLG11'), 'FII');
    assert.equal(sugerirTipo('PETR4'), 'Ações');
    assert.equal(sugerirTipo('Ações (carteira)'), 'Ações');
    assert.equal(sugerirTipo('LCI Inter'), 'Renda Fixa');
    assert.equal(sugerirTipo('Reserva'), null);
  });
});

describe('mescla com outro aparelho', () => {
  const base = migrate({
    '2026-10': {
      saldoInicial: 100,
      despesas: [
        { id: 'a', nome: 'Aluguel', planejado: 1000, realizado: 0 },
        { id: 'b', nome: 'Luz', planejado: 200, realizado: 0 },
        { id: 'c', nome: 'Água', planejado: 80, realizado: 0 },
      ],
    },
  });
  const clone = () => structuredClone(base);

  it('junta mudanças em lançamentos diferentes sem conflito', () => {
    const local = clone();
    local['2026-10']!.despesas[0]!.pago = true; // pagou o aluguel aqui
    local['2026-10']!.despesas.push({ ...local['2026-10']!.despesas[2]!, id: 'novo-local', nome: 'Gás' });
    const remote = clone();
    remote['2026-10']!.despesas[1]!.planejado = 250; // mudou a luz lá
    remote['2026-10']!.despesas.splice(2, 1); // apagou a água lá
    remote['2026-11'] = migrate({ '2026-11': { saldoInicial: 5 } })['2026-11']!;
    const { estado, conflicts } = merge3(base, local, remote);
    assert.equal(conflicts, 0);
    const d = estado['2026-10']!.despesas;
    assert.deepEqual(d.map((x) => x.id), ['a', 'b', 'novo-local']);
    assert.equal(d[0]!.pago, true);
    assert.equal(d[1]!.planejado, 250);
    assert.equal(estado['2026-11']!.saldoInicial, 5);
  });

  it('mesma coisa mudada dos dois lados: vale o servidor e conta o conflito', () => {
    const local = clone();
    local['2026-10']!.saldoInicial = 1;
    const remote = clone();
    remote['2026-10']!.saldoInicial = 2;
    const { estado, conflicts } = merge3(base, local, remote);
    assert.equal(conflicts, 1);
    assert.equal(estado['2026-10']!.saldoInicial, 2);
  });

  it('apagado aqui e intocado lá: continua apagado', () => {
    const local = clone();
    local['2026-10']!.despesas.splice(0, 1);
    const { estado } = merge3(base, local, clone());
    assert.deepEqual(estado['2026-10']!.despesas.map((x) => x.id), ['b', 'c']);
  });
});

describe('totais por forma de pagamento', () => {
  it('separa cartão, boleto e pix; agendado conta como falta', () => {
    const m = migrate(legado)['2026-09']!;
    const t = Object.fromEntries(totaisPorForma(m).map((x) => [x.forma, x]));
    // Aluguel (boleto, pago 1500); Fatura (cartão antigo, agendada 800); Presente (esporádica sem forma, 100)
    assert.deepEqual([t.boleto!.total, t.boleto!.pago, t.boleto!.falta], [1500, 1500, 0]);
    assert.deepEqual([t.cartao!.total, t.cartao!.falta], [800, 800]);
    assert.equal(t.pix!.total, 0);
    assert.equal(t.sem!.total, 100);
  });
});

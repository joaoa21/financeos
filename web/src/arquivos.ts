import { valorInvestimento } from './model/calc.ts';
import { categoria } from './model/categorias.ts';
import { todayISO } from './model/dates.ts';
import { migrate } from './model/migrate.ts';
import type { Estado, Mes } from './model/types.ts';

// Baixar e importar arquivos (cópia de segurança em JSON e planilha do mês em CSV).

function baixar(conteudo: BlobPart, tipo: string, nome: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportarJson(estado: Estado) {
  baixar(JSON.stringify({ app: 'FinanceOS', versao: 2, exportadoEm: new Date().toISOString(), dados: estado }, null, 2), 'application/json', `financeos-${todayISO()}.json`);
}

/** Lê um arquivo exportado (deste FinanceOS ou da versão antiga). Lança erro se não for válido. */
export async function lerJson(arquivo: File): Promise<Estado> {
  if (arquivo.size > 5 * 1024 * 1024) throw new Error('Arquivo grande demais (máximo 5 MB).');
  let bruto: unknown;
  try {
    bruto = JSON.parse(await arquivo.text());
  } catch {
    throw new Error('Esse arquivo não é um JSON válido.');
  }
  const dados = bruto && typeof bruto === 'object' && 'dados' in bruto ? (bruto as { dados: unknown }).dados : bruto;
  const estado = migrate(dados);
  if (!Object.keys(estado).length) throw new Error('Não encontramos meses do FinanceOS nesse arquivo.');
  return estado;
}

/** Célula de CSV segura: entre aspas e sem virar fórmula ao abrir no Excel. */
function celula(valor: string | number): string {
  let texto = typeof valor === 'number' ? valor.toFixed(2).replace('.', ',') : valor;
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function exportarCsvMes(mes: Mes, key: string, cdiAnual: number) {
  const linhas: (string | number)[][] = [['Tipo', 'Nome', 'Categoria', 'Dia', 'Previsto (R$)', 'Pago/recebido (R$)', 'Situação', 'Detalhe']];
  for (const r of mes.rendas) linhas.push(['Renda', r.nome, '', String(r.data ?? ''), r.planejado, r.recebido ? r.realizado : 0, r.recebido ? 'Recebida' : 'A receber', r.autoReplicar ? 'Repete todo mês' : '']);
  for (const d of mes.despesas) {
    linhas.push([
      'Despesa',
      d.nome,
      d.categoria ? categoria(d.categoria).nome : '',
      String(d.data ?? ''),
      d.planejado,
      d.pago ? d.realizado : 0,
      d.pago ? 'Paga' : d.agendado ? 'Agendada' : 'A pagar',
      [d.tipo === 'fixo' ? 'Fixa' : 'Esporádica', d.subtipo ?? '', d.autoReplicar ? 'repete todo mês' : ''].filter(Boolean).join(' · '),
    ]);
  }
  for (const i of mes.investimentos) {
    const v = valorInvestimento(i, cdiAnual);
    linhas.push(['Investimento', i.nome, i.tipo, '', v.investido, v.atual, 'Valor estimado hoje', i.percentualCDI ? `${i.percentualCDI}% do CDI` : '']);
  }
  linhas.push([], ['Saldo inicial', '', '', '', mes.saldoInicial, '', '', '']);
  const csv = linhas.map((l) => l.map(celula).join(';')).join('\r\n');
  baixar('﻿' + csv, 'text/csv;charset=utf-8', `financeos-${key}.csv`);
}

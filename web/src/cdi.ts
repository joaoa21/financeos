import { useEffect, useState } from 'react';
import { CDI_RESERVA_AA } from './model/calc.ts';
import { storage } from './storage.ts';

// Taxa do CDI do Banco Central (série 12, taxa diária em %). Guardada por 12 horas
// para não consultar a cada abertura; se o BC não responder, usa a última conhecida.

const KEY = 'fos_cdi_v2';
const VALID_MS = 12 * 60 * 60 * 1000;

export interface Cdi {
  /** CDI ao ano, em % (ex.: 14.9). */
  anual: number;
  fonte: 'bc' | 'cache' | 'reserva';
}

function cached(): { anual: number; ts: number } | null {
  try {
    const value = JSON.parse(storage.get(KEY) ?? 'null') as { anual: number; ts: number } | null;
    return value && Number.isFinite(value.anual) && value.anual > 0 && value.anual < 100 ? value : null;
  } catch {
    return null;
  }
}

export function useCdi(): Cdi {
  const [cdi, setCdi] = useState<Cdi>(() => {
    const c = cached();
    return c ? { anual: c.anual, fonte: Date.now() - c.ts < VALID_MS ? 'bc' : 'cache' } : { anual: CDI_RESERVA_AA, fonte: 'reserva' };
  });

  useEffect(() => {
    const c = cached();
    if (c && Date.now() - c.ts < VALID_MS) return;
    const controller = new AbortController();
    fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json', { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ valor: string }[]>) : Promise.reject(new Error(String(r.status)))))
      .then((rows) => {
        const diario = parseFloat(rows[0]?.valor ?? '') / 100;
        if (!Number.isFinite(diario) || diario <= 0 || diario > 0.01) throw new Error('valor inesperado');
        const anual = Math.round((Math.pow(1 + diario, 252) - 1) * 10000) / 100;
        storage.set(KEY, JSON.stringify({ anual, ts: Date.now() }));
        setCdi({ anual, fonte: 'bc' });
      })
      .catch(() => {
        // Sem resposta do BC: segue com a última taxa conhecida (ou a de reserva).
      });
    return () => controller.abort();
  }, []);

  return cdi;
}

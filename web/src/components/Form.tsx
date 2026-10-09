import { type ReactNode, useId } from 'react';
import { moneyInput, parseMoney } from '../format.ts';

// Peças de formulário usadas nas janelas (rótulo, valor em reais, escolhas, interruptor).

export function Field(props: { label: ReactNode; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={`campo-grupo ${props.className ?? ''}`}>
      <label className="campo-rotulo" htmlFor={id}>
        {props.label}
      </label>
      {props.children(id)}
      {props.error ? (
        <span className="campo-erro" role="alert">
          {props.error}
        </span>
      ) : (
        props.hint && <span className="campo-ajuda">{props.hint}</span>
      )}
    </div>
  );
}

/** Campo de valor: a pessoa digita só números e os centavos se ajeitam sozinhos (1234 → 12,34). */
export function MoneyInput(props: { id?: string; value: number; onChange: (value: number) => void; invalid?: boolean; autoFocus?: boolean; ariaLabel?: string }) {
  return (
    <span className="campo-dinheiro">
      <span className="campo-dinheiro__prefixo" aria-hidden="true">
        R$
      </span>
      <input
        id={props.id}
        className="campo"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0,00"
        aria-label={props.ariaLabel}
        aria-invalid={props.invalid || undefined}
        autoFocus={props.autoFocus}
        value={moneyInput(props.value)}
        onChange={(e) => props.onChange(Math.min(parseMoney(e.target.value), 999_999_999))}
        onFocus={(e) => e.target.select()}
      />
    </span>
  );
}

export function Segmented<T extends string>(props: { value: T; onChange: (value: T) => void; options: { value: T; label: ReactNode }[]; ariaLabel: string; size?: 'normal' | 'grande' }) {
  return (
    <div className={`segmentado segmentado--${props.size ?? 'normal'}`} role="radiogroup" aria-label={props.ariaLabel}>
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === props.value}
          className="segmentado__opcao"
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Switch(props: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label className={`interruptor${props.disabled ? ' interruptor--desligado' : ''}`} htmlFor={id}>
      <span className="interruptor__texto">
        <span>{props.label}</span>
        {props.hint && <span className="campo-ajuda">{props.hint}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="interruptor__trilho" aria-hidden="true" />
    </label>
  );
}

/** Escolha em cartões (rádio com título e explicação). */
export function ChoiceCards<T extends string>(props: { value: T; onChange: (value: T) => void; name: string; options: { value: T; title: ReactNode; text: ReactNode }[] }) {
  return (
    <div className="escolhas">
      {props.options.map((option) => (
        <label key={option.value} className={`escolha${option.value === props.value ? ' escolha--marcada' : ''}`}>
          <input type="radio" name={props.name} value={option.value} checked={option.value === props.value} onChange={() => props.onChange(option.value)} />
          <span>
            <strong>{option.title}</strong>
            <span>{option.text}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

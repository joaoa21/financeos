import { type FormEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import { IconX } from './Icons';

// Janela sobre a página: fecha com Esc, no "✕" ou clicando fora. O foco fica preso
// dentro dela enquanto estiver aberta e volta para onde estava ao fechar.

export function Modal(props: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Botões do rodapé. Com `onSubmit`, o conteúdo vira um formulário (Enter envia). */
  footer?: ReactNode;
  onSubmit?: () => void;
  size?: 'normal' | 'grande';
}) {
  const { onClose } = props;
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = panel.current;
    const first = root?.querySelector<HTMLElement>('[data-autofocus]') ?? root?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=radio]), select, textarea') ?? root?.querySelector<HTMLElement>('.modal__rodape .btn');
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === 'Tab' && root) {
        const focusable = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
        if (!focusable.length) return;
        const firstEl = focusable[0]!;
        const lastEl = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmit?.();
  };

  const body = (
    <>
      <div className="modal__corpo">{props.children}</div>
      {props.footer && <footer className="modal__rodape">{props.footer}</footer>}
    </>
  );

  return (
    <div className="modal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal__painel modal__painel--${props.size ?? 'normal'}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <header className="modal__topo">
          <div>
            <h2 id={titleId}>{props.title}</h2>
            {props.subtitle && <p className="modal__subtitulo">{props.subtitle}</p>}
          </div>
          <button type="button" className="botao-icone" onClick={onClose} aria-label="Fechar">
            <IconX size={18} />
          </button>
        </header>
        {props.onSubmit ? (
          <form onSubmit={submit} noValidate className="modal__form">
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>
  );
}

/** Confirmação simples ("tem certeza?"), com o botão perigoso em vermelho. */
export function Confirm(props: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={props.title}
      onClose={props.onClose}
      onSubmit={() => {
        props.onConfirm();
        props.onClose();
      }}
      footer={
        <>
          <button type="button" className="btn btn--secundario" onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" className={`btn${props.danger ? ' btn--perigo' : ''}`} data-autofocus>
            {props.confirmLabel}
          </button>
        </>
      }
    >
      <div className="texto-modal">{props.children}</div>
    </Modal>
  );
}

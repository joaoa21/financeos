import { type ReactNode, useEffect, useRef, useState } from 'react';

// Menu de ações (botão "⋯"): fecha ao clicar fora, com Esc ou ao escolher.
// Setas para cima e para baixo andam entre as opções.

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function Menu(props: { trigger: (open: boolean) => ReactNode; items: (MenuItem | 'separador')[]; align?: 'left' | 'right'; ariaLabel: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const onClick = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        root.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className={`menu ${props.className ?? ''}`} ref={root}>
      <button
        type="button"
        className="menu__gatilho"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={props.ariaLabel}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {props.trigger(open)}
      </button>
      {open && (
        <div className={`menu__lista menu__lista--${props.align ?? 'right'}`} role="menu" aria-label={props.ariaLabel}>
          {props.items.map((item, index) =>
            item === 'separador' ? (
              <div key={index} className="menu__separador" role="separator" />
            ) : (
              <button
                key={index}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`menu__item${item.danger ? ' menu__item--perigo' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

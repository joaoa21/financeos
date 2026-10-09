import { useRef, useState } from 'react';
import { exportarCsvMes, exportarJson, lerJson } from '../arquivos.ts';
import { Segmented, Switch } from '../components/Form.tsx';
import { IconDownload, IconLogout, IconTrash, IconUpload } from '../components/Icons.tsx';
import { Modal } from '../components/Modal.tsx';
import { useToast } from '../components/Toast.tsx';
import { useData } from '../data.tsx';
import { plural } from '../format.ts';
import { monthName } from '../model/dates.ts';
import { emptyMonth } from '../model/migrate.ts';
import type { Estado } from '../model/types.ts';
import { type Tema, usePrefs } from '../prefs.tsx';
import { useUi } from '../ui.tsx';

export function Configuracoes({ user, onLogout }: { user: { name: string; email: string }; onLogout: () => void }) {
  const { estado, replace, wipe } = useData();
  const prefs = usePrefs();
  const ui = useUi();
  const toast = useToast();
  const arquivo = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState<Estado | null>(null);
  const [apagar, setApagar] = useState(false);
  const meses = Object.keys(estado).length;

  async function escolher(file: File | undefined) {
    if (!file) return;
    try {
      setImportando(await lerJson(file));
    } catch (err) {
      toast((err as Error).message, { tipo: 'erro' });
    }
  }

  return (
    <div className="pagina pagina--estreita">
      <section className="cartao ajuste">
        <h2>Conta</h2>
        <div className="ajuste__linha">
          <div>
            <strong>{user.name || 'Sem nome'}</strong>
            <span className="campo-ajuda">{user.email}</span>
          </div>
          <button type="button" className="btn btn--secundario" onClick={onLogout}>
            <IconLogout size={16} /> Sair
          </button>
        </div>
        <p className="campo-ajuda">O login é feito pelo Authik. Para trocar a senha, use "Esqueci minha senha" na tela de entrada.</p>
      </section>

      <section className="cartao ajuste">
        <h2>Aparência</h2>
        <div className="ajuste__linha">
          <span>Tema</span>
          <Segmented<Tema>
            ariaLabel="Tema"
            value={prefs.tema}
            onChange={prefs.setTema}
            options={[
              { value: 'claro', label: 'Claro' },
              { value: 'escuro', label: 'Escuro' },
              { value: 'sistema', label: 'Automático' },
            ]}
          />
        </div>
        <Switch checked={prefs.ocultar} onChange={prefs.setOcultar} label="Ocultar valores" hint="Mostra R$ ••••• no lugar dos valores — útil para abrir o app em público. Atalho: o olho no topo." />
      </section>

      <section className="cartao ajuste">
        <h2>Seus dados</h2>
        <p className="campo-ajuda">
          {meses ? `${plural(meses, 'mês registrado', 'meses registrados')}. ` : ''}Os dados ficam guardados no servidor do FinanceOS, ligados à sua conta, e são salvos sozinhos a cada alteração.
        </p>
        <div className="ajuste__botoes">
          <button type="button" className="btn btn--secundario" onClick={() => exportarJson(estado)} disabled={!meses}>
            <IconDownload size={16} /> Baixar cópia de segurança (JSON)
          </button>
          <button type="button" className="btn btn--secundario" onClick={() => exportarCsvMes(estado[ui.mes] ?? emptyMonth(), ui.mes, ui.cdi.anual)} disabled={!estado[ui.mes]}>
            <IconDownload size={16} /> Planilha de {monthName(ui.mes)} (CSV)
          </button>
          <button type="button" className="btn btn--secundario" onClick={() => arquivo.current?.click()}>
            <IconUpload size={16} /> Importar cópia de segurança
          </button>
          <input
            ref={arquivo}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void escolher(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="cartao ajuste ajuste--perigo">
        <h2>Zona de perigo</h2>
        <div className="ajuste__linha">
          <div>
            <strong>Apagar todos os dados</strong>
            <span className="campo-ajuda">Remove todos os meses do servidor. A conta continua existindo.</span>
          </div>
          <button type="button" className="btn btn--perigo" onClick={() => setApagar(true)} disabled={!meses}>
            <IconTrash size={16} /> Apagar tudo
          </button>
        </div>
      </section>

      {importando && (
        <ImportarModal
          estado={estado}
          novo={importando}
          onClose={() => setImportando(null)}
          onImport={(juntar) => {
            const antes = estado;
            replace(juntar ? { ...estado, ...importando } : importando);
            setImportando(null);
            toast(`${plural(Object.keys(importando).length, "mês importado", "meses importados")}.`, { acao: { label: "Desfazer", onClick: () => replace(antes) } });
          }}
        />
      )}

      {apagar && <ApagarTudo onClose={() => setApagar(false)} onConfirm={async () => {
        try {
          await wipe();
          toast('Todos os dados foram apagados.');
          setApagar(false);
        } catch {
          toast('Não foi possível apagar agora. Tente de novo.', { tipo: 'erro' });
        }
      }} />}
    </div>
  );
}

function ImportarModal({ estado, novo, onClose, onImport }: { estado: Estado; novo: Estado; onClose: () => void; onImport: (juntar: boolean) => void }) {
  const [modo, setModo] = useState<"juntar" | "substituir">("juntar");
  const chaves = Object.keys(novo).sort();
  const repetidos = chaves.filter((k) => k in estado).length;
  return (
    <Modal
      title="Importar cópia de segurança"
      onClose={onClose}
      onSubmit={() => onImport(modo === "juntar")}
      footer={
        <>
          <button type="button" className="btn btn--secundario" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            Importar
          </button>
        </>
      }
    >
      <div className="texto-modal">
        <p>
          O arquivo tem {plural(chaves.length, "mês", "meses")} ({monthName(chaves[0]!)} a {monthName(chaves[chaves.length - 1]!)}).
        </p>
        <Segmented
          ariaLabel="Como importar"
          value={modo}
          onChange={setModo}
          options={[
            { value: "juntar", label: "Juntar com os meus" },
            { value: "substituir", label: "Substituir tudo" },
          ]}
        />
        <p className="campo-ajuda">
          {modo === "juntar"
            ? repetidos
              ? `${plural(repetidos, "mês que já existe será trocado", "meses que já existem serão trocados")} pela versão do arquivo; os outros continuam.`
              : "Os meses do arquivo entram junto com os que você já tem."
            : "Tudo o que está na conta hoje é trocado pelo conteúdo do arquivo."}{" "}
          Dá para desfazer logo depois.
        </p>
      </div>
    </Modal>
  );
}

function ApagarTudo({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => Promise<void> }) {
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ok = texto.trim().toUpperCase() === 'APAGAR';
  return (
    <Modal
      title="Apagar todos os dados?"
      onClose={onClose}
      onSubmit={async () => {
        if (!ok || ocupado) return;
        setOcupado(true);
        await onConfirm();
        setOcupado(false);
      }}
      footer={
        <>
          <button type="button" className="btn btn--secundario" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--perigo" disabled={!ok || ocupado}>
            {ocupado ? 'Apagando…' : 'Apagar para sempre'}
          </button>
        </>
      }
    >
      <div className="texto-modal">
        <p>Isso apaga todos os meses do servidor e não pode ser desfeito. Se quiser, baixe uma cópia de segurança antes.</p>
        <label className="campo-grupo">
          <span className="campo-rotulo">Digite APAGAR para confirmar</span>
          <input className="campo" autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

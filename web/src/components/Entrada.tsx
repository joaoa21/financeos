import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { googleErrorMessage, passwordRequirements, useAuth, validPassword } from '@central-auth/sdk-react';
import { IconCheck, IconCircle, IconEye, IconEyeOff } from './Icons';
import { Logo } from './Logo';

// Telas de entrada do FinanceOS (mesmo modelo do Trackik). O login é feito pelo Authik
// (autenticador próprio do dono): a sessão fica num cookie protegido de auth.<domínio>,
// nada no localStorage. A regra de senha vem do SDK: é a mesma que o servidor aplica.

// "Continuar com Google" só aparece depois de configurar a chave do Google no Authik.
const GOOGLE = import.meta.env.VITE_GOOGLE_LOGIN === '1';

function Marca({ centro }: { centro?: boolean }) {
  return (
    <span className={`marca${centro ? ' marca--centro' : ''}`}>
      <Logo height={centro ? 34 : 28} />
    </span>
  );
}

/** Cartão centralizado com o efeito de fundo (entrar, esqueci a senha, links do e-mail). */
function Centro({ titulo, texto, children }: { titulo: string; texto?: ReactNode; children: ReactNode }) {
  return (
    <main className="entrada">
      <div className="entrada__efeito" aria-hidden="true" />
      <div className="cartao entrada__cartao">
        <div className="entrada__topo">
          <Marca centro />
          <h1 className="entrada__titulo">{titulo}</h1>
          {texto && <p className="entrada__texto">{texto}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

function Erro({ children }: { children: ReactNode }) {
  return (
    <p className="entrada__erro" role="alert">
      {children}
    </p>
  );
}

function CampoSenha(props: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  nova?: boolean;
  autoFocus?: boolean;
  acao?: ReactNode;
  descritoPor?: string;
}) {
  const [visivel, setVisivel] = useState(false);
  const id = useId();
  return (
    <div className="campo-grupo">
      <div className="campo-grupo__topo">
        <label className="campo-rotulo" htmlFor={id}>
          {props.rotulo}
        </label>
        {props.acao}
      </div>
      <span className="campo-senha">
        <input
          id={id}
          aria-describedby={props.descritoPor}
          className="campo"
          type={visivel ? 'text' : 'password'}
          autoComplete={props.nova ? 'new-password' : 'current-password'}
          maxLength={128}
          required
          autoFocus={props.autoFocus}
          value={props.valor}
          onChange={(e) => props.onChange(e.target.value)}
        />
        <button
          type="button"
          className="campo-senha__olho"
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          onClick={() => setVisivel((v) => !v)}
        >
          {visivel ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      </span>
    </div>
  );
}

/**
 * Senha nova com checklist ao vivo e "repita a senha". Devolve se as duas estão válidas.
 * Usada no cadastro e na criação de senha nova (link do e-mail).
 */
function SenhaNova(props: {
  senha: string;
  repetida: string;
  onSenha: (v: string) => void;
  onRepetida: (v: string) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const regras = passwordRequirements(props.senha);
  const confere = props.repetida.length > 0 && props.repetida === props.senha;
  return (
    <>
      <CampoSenha rotulo="Senha" valor={props.senha} onChange={props.onSenha} nova autoFocus={props.autoFocus} descritoPor={id} />
      <ul id={id} className="requisitos" aria-label="Requisitos da senha" aria-live="polite">
        {regras.map((regra) => (
          <li key={regra.key} className={regra.met ? 'requisito--ok' : undefined}>
            {regra.met ? <IconCheck size={15} /> : <IconCircle size={15} />}
            <span>
              {regra.label}
              <span className="so-leitor"> — {regra.met ? 'atendido' : 'pendente'}</span>
            </span>
          </li>
        ))}
      </ul>
      <CampoSenha rotulo="Repita a senha" valor={props.repetida} onChange={props.onRepetida} nova />
      {props.repetida.length > 0 && (
        <p className={`confere${confere ? ' confere--ok' : ''}`} aria-live="polite">
          {confere ? <IconCheck size={15} /> : <IconCircle size={15} />}
          {confere ? 'As senhas coincidem' : 'As senhas ainda não coincidem'}
        </p>
      )}
    </>
  );
}

/** "Continuar com Google": leva à página do Google e volta para o painel já logado. */
function BotaoGoogle({ onErro }: { onErro: (mensagem: string) => void }) {
  const auth = useAuth();
  const [indo, setIndo] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--grande btn--google"
      disabled={indo}
      onClick={async () => {
        setIndo(true);
        const r = await auth.loginWithGoogle({
          callbackURL: `${location.origin}/`,
          errorCallbackURL: `${location.origin}/entrar`,
        });
        // Deu certo: o navegador já está indo para o Google.
        if (!r.ok) {
          setIndo(false);
          onErro('O login com Google não está disponível agora. Use e-mail e senha.');
        }
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
        <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8Z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
      </svg>
      {indo ? 'Abrindo o Google…' : 'Continuar com Google'}
    </button>
  );
}

function Ou() {
  return (
    <div className="entrada__divisor">
      <span>ou</span>
    </div>
  );
}

/** Tira o token do link da barra de endereço logo ao abrir (não fica no histórico). */
function useTokenDoLink() {
  const token = useRef<string | null>(null);
  if (token.current === null) {
    const params = new URLSearchParams(location.search);
    token.current = params.get('token') ?? '';
    if (params.has('token')) history.replaceState(null, '', location.pathname);
  }
  return token.current;
}

type Modo = 'entrar' | 'criar' | 'esqueci';
const ENDERECO: Record<Modo, string> = { entrar: '/entrar', criar: '/criar-conta', esqueci: '/entrar' };

/** `inicial`: a landing page abre direto o cadastro (/criar-conta) ou a entrada (/entrar). */
export function Entrada({ inicial = 'entrar' }: { inicial?: Modo }) {
  const auth = useAuth();
  const [modo, setModo] = useState<Modo>(inicial);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [novidades, setNovidades] = useState(false);
  const [erro, setErro] = useState<string | null>(() => {
    const codigo = new URLSearchParams(location.search).get('error');
    if (codigo) history.replaceState(null, '', location.pathname);
    return googleErrorMessage(codigo);
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [naoConfirmado, setNaoConfirmado] = useState(false);

  function trocar(novo: Modo) {
    setModo(novo);
    setErro(null);
    setAviso(null);
    setNaoConfirmado(false);
    setSenha('');
    setRepetida('');
    // O endereço acompanha a tela (recarregar mantém onde a pessoa estava).
    if (location.pathname !== '/') history.replaceState(null, '', ENDERECO[novo]);
  }

  async function entrar(event: FormEvent) {
    event.preventDefault();
    setOcupado(true);
    setErro(null);
    setNaoConfirmado(false);
    const r = await auth.login(email.trim(), senha);
    setOcupado(false);
    if (!r.ok) {
      setErro(r.message);
      setNaoConfirmado(r.code === 'EMAIL_NOT_VERIFIED');
    }
  }

  async function criar(event: FormEvent) {
    event.preventDefault();
    if (!validPassword(senha) || senha !== repetida) return;
    setOcupado(true);
    setErro(null);
    const r = await auth.register({ name: nome.trim(), email: email.trim(), password: senha, marketingOptIn: novidades });
    setOcupado(false);
    if (!r.ok) return setErro(r.message);
    // Mesma resposta para e-mail novo ou já cadastrado (ninguém descobre quem tem conta).
    trocar('entrar');
    setAviso('Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre aqui.');
  }

  async function esqueci(event: FormEvent) {
    event.preventDefault();
    setOcupado(true);
    setErro(null);
    const r = await auth.requestPasswordReset(email.trim());
    setOcupado(false);
    if (!r.ok) return setErro(r.message);
    trocar('entrar');
    setAviso('Se houver uma conta com esse e-mail, você vai receber um link para criar uma senha nova.');
  }

  async function reenviar() {
    setOcupado(true);
    const r = await auth.resendVerification(email.trim());
    setOcupado(false);
    setNaoConfirmado(false);
    if (r.ok) setAviso('Link de confirmação reenviado. Confira seu e-mail.');
    else setErro(r.message);
  }

  const campoEmail = (
    <label className="campo-grupo">
      <span className="campo-rotulo">E-mail</span>
      <input
        className="campo"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        autoFocus={modo !== 'criar'}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </label>
  );
  const avisoTopo = aviso && (
    <p className="entrada__aviso" role="status">
      {aviso}
    </p>
  );

  if (modo === 'criar') {
    const pronto = validPassword(senha) && senha === repetida && nome.trim() && email.trim();
    return (
      <main className="cadastro">
        <section className="cadastro__apresentacao">
          <Marca />
          <div className="cadastro__chamada">
            <h2>Seu mês inteiro, sem planilha.</h2>
            <p>Contas, renda e investimentos num lugar só — e quanto vai sobrar antes de o mês acabar.</p>
            <ul>
              <li>Vencimentos do dia e atrasados em destaque</li>
              <li>Investimentos rendendo pelo CDI do Banco Central</li>
              <li>Feche o mês com um clique e comece o próximo pronto</li>
            </ul>
          </div>
        </section>
        <div className="cadastro__lado">
          <div className="cadastro__efeito" aria-hidden="true" />
          <form className="cartao cadastro__cartao" onSubmit={criar}>
            <h1 className="entrada__titulo">Criar sua conta</h1>
            {GOOGLE && (
              <>
                <BotaoGoogle onErro={setErro} />
                <Ou />
              </>
            )}
            <label className="campo-grupo">
              <span className="campo-rotulo">Seu nome</span>
              <input className="campo" autoComplete="name" required maxLength={100} autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            {campoEmail}
            <SenhaNova senha={senha} repetida={repetida} onSenha={setSenha} onRepetida={setRepetida} />
            <label className="consentimento">
              <input type="checkbox" checked={novidades} onChange={(e) => setNovidades(e.target.checked)} />
              <span>Quero receber novidades e dicas do FinanceOS por e-mail. Dá para cancelar quando quiser.</span>
            </label>
            {erro && <Erro>{erro}</Erro>}
            <button className="btn btn--grande" type="submit" disabled={ocupado || !pronto}>
              {ocupado ? 'Aguarde…' : 'Criar conta'}
            </button>
            <p className="entrada__rodape">
              Já tem uma conta?{' '}
              <button type="button" className="link" onClick={() => trocar('entrar')}>
                Entrar
              </button>
            </p>
          </form>
        </div>
      </main>
    );
  }

  if (modo === 'esqueci')
    return (
      <Centro titulo="Esqueci minha senha" texto="Informe seu e-mail e enviamos um link para criar uma senha nova.">
        <form className="entrada__form" onSubmit={esqueci}>
          {campoEmail}
          {erro && <Erro>{erro}</Erro>}
          <button className="btn btn--grande" type="submit" disabled={ocupado}>
            {ocupado ? 'Aguarde…' : 'Enviar link'}
          </button>
        </form>
        <p className="entrada__rodape">
          <button type="button" className="link" onClick={() => trocar('entrar')}>
            Voltar para a entrada
          </button>
        </p>
      </Centro>
    );

  return (
    <Centro titulo="Entrar no FinanceOS" texto="Que bom te ver de novo. Entre para ver seu mês.">
      {avisoTopo}
      {GOOGLE && (
        <>
          <BotaoGoogle onErro={setErro} />
          <Ou />
        </>
      )}
      <form className="entrada__form" onSubmit={entrar}>
        {campoEmail}
        <CampoSenha
          rotulo="Senha"
          valor={senha}
          onChange={setSenha}
          acao={
            <button type="button" className="link link--pequeno" onClick={() => trocar('esqueci')}>
              Esqueci minha senha
            </button>
          }
        />
        {erro && <Erro>{erro}</Erro>}
        {naoConfirmado && (
          <button type="button" className="link" disabled={ocupado} onClick={reenviar}>
            Reenviar o link de confirmação
          </button>
        )}
        <button className="btn btn--grande" type="submit" disabled={ocupado}>
          {ocupado ? 'Aguarde…' : 'Entrar'}
        </button>
      </form>
      <div className="entrada__divisor">
        <span>Não tem uma conta ainda?</span>
      </div>
      <button type="button" className="btn btn--grande btn--convite" onClick={() => trocar('criar')}>
        Criar conta grátis
      </button>
    </Centro>
  );
}

/** Página do link "confirme seu e-mail" (/verificar-email?token=...). */
export function VerificarEmail({ onPronto }: { onPronto: () => void }) {
  const auth = useAuth();
  const token = useTokenDoLink();
  const [estado, setEstado] = useState<'conferindo' | 'ok' | 'erro'>('conferindo');
  const [erro, setErro] = useState('');
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current) return; // StrictMode chama o efeito duas vezes em desenvolvimento
    feito.current = true;
    if (!token) {
      setEstado('erro');
      setErro('Link incompleto. Abra o link direto do e-mail.');
      return;
    }
    void auth.verifyEmail(token).then(async (r) => {
      if (!r.ok) {
        setEstado('erro');
        setErro(r.message);
        return;
      }
      await auth.refresh();
      setEstado('ok');
    });
  }, [auth, token]);
  if (estado === 'conferindo') return <Centro titulo="Confirmando seu e-mail…">{null}</Centro>;
  if (estado === 'erro')
    return (
      <Centro titulo="Não foi possível confirmar" texto={erro}>
        <button className="btn btn--grande" onClick={onPronto}>
          Ir para a entrada
        </button>
      </Centro>
    );
  return (
    <Centro titulo="E-mail confirmado" texto="Tudo certo. Agora é só começar a organizar seu mês.">
      <button className="btn btn--grande" onClick={onPronto}>
        Continuar
      </button>
    </Centro>
  );
}

/** Página do link "criar senha nova" (/redefinir-senha?token=...). */
export function RedefinirSenha({ onPronto }: { onPronto: () => void }) {
  const auth = useAuth();
  const token = useTokenDoLink();
  const [senha, setSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState<string | null>(token ? null : 'Link incompleto. Abra o link direto do e-mail.');
  const [ok, setOk] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (!validPassword(senha) || senha !== repetida) return;
    setOcupado(true);
    const r = await auth.resetPassword(token, senha);
    setOcupado(false);
    if (r.ok) setOk(true);
    else setErro(r.message);
  }

  if (ok)
    return (
      <Centro titulo="Senha alterada" texto="Entre com a senha nova. Por segurança, as outras sessões da conta foram encerradas.">
        <button className="btn btn--grande" onClick={onPronto}>
          Entrar
        </button>
      </Centro>
    );
  return (
    <Centro titulo="Criar senha nova">
      <form className="entrada__form" onSubmit={enviar}>
        <SenhaNova senha={senha} repetida={repetida} onSenha={setSenha} onRepetida={setRepetida} autoFocus />
        {erro && <Erro>{erro}</Erro>}
        <button className="btn btn--grande" type="submit" disabled={ocupado || !token || !validPassword(senha) || senha !== repetida}>
          {ocupado ? 'Aguarde…' : 'Salvar senha nova'}
        </button>
      </form>
    </Centro>
  );
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const INV_TIPOS = [
  "CDB",
  "Ações",
  "FII",
  "Renda Fixa",
  "Tesouro Direto",
  "Criptomoedas",
  "Outro",
];

let yr = new Date().getFullYear(),
  mo = new Date().getMonth();
let state = {},
  curFilter = "todos",
  modalCtx = null,
  cdiDiary = null,
  dragId = null,
  dragSec = null;
let despSort = "asc",
  rendSort = "asc";
let undoStack = [];

// ─── CONFIG ─────────────────────────────────────────────
const API_URL = "https://financeos-api-production.up.railway.app";
let clerkToken = null;
let authReady = false;

// ─── KEY / MONTH ────────────────────────────────────────
function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function getKey(y, m) {
  y = y ?? yr;
  m = m ?? mo;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}
function getMonth(y, m) {
  const k = getKey(y, m);
  if (!state[k])
    state[k] = {
      saldoInicial: 0,
      despesas: [],
      rendas: [],
      investimentos: [],
    };
  return state[k];
}
// ─── SAVE / LOAD (API) ──────────────────────────────────
let saveTimer = null;
function save() {
  // Salva local imediatamente (para UX instantânea)
  localStorage.setItem("fos_v3", JSON.stringify(state));
  // Debounce: envia para API 800ms após última mudança
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => syncToAPI(), 800);
}

async function syncToAPI() {
  if (!clerkToken) return;
  try {
    await fetch(`${API_URL}/api/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${clerkToken}`,
      },
      body: JSON.stringify({ data: state }),
    });
  } catch (err) {
    console.warn("Sync falhou, dados salvos localmente:", err.message);
  }
}

async function loadFromAPI() {
  if (!clerkToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/state`, {
      headers: { "Authorization": `Bearer ${clerkToken}` },
    });
    if (!res.ok) return false;
    const { data } = await res.json();
    if (data && Object.keys(data).length > 0) {
      state = data;
      migrate();
      return true;
    }
    return false;
  } catch (err) {
    console.warn("Erro ao buscar dados da API:", err.message);
    return false;
  }
}

function load() {
  const s = localStorage.getItem("fos_v3") || localStorage.getItem("fos_v2");
  if (s) {
    state = JSON.parse(s);
    migrate();
  }
}

// ─── MIGRATE ────────────────────────────────────────────
function migrate() {
  Object.values(state).forEach((m) => {
    if (!m.despesas) m.despesas = [];
    if (!m.rendas) m.rendas = [];
    if (!m.investimentos) m.investimentos = [];
    m.despesas.forEach((d) => {
      if (d.tipo === "cartao") {
        d.tipo = "fixo";
        d.subtipo = "cartao";
      }
      if (d.tipo === "fixo" && !d.subtipo) d.subtipo = "boleto";
      if (d.data && typeof d.data === "string" && d.data.includes("-"))
        d.data = parseInt(d.data.split("-")[2], 10);
    });
    m.rendas.forEach((r) => {
      if (r.data && typeof r.data === "string" && r.data.includes("-"))
        r.data = parseInt(r.data.split("-")[2], 10);
      delete r.dividendoDe;
    });
    m.despesas.forEach((d) => {
      if (d.autoReplicar === undefined) d.autoReplicar = false;
      if (d.agendado === undefined) d.agendado = false;
    });
    m.investimentos.forEach((i) => {
      // old CDB with valorInicial → aportes
      if (i.valorInicial !== undefined && !i.aportes) {
        i.aportes = [
          {
            id: uid(),
            valor: i.valorInicial,
            data: i.dataInicio || new Date().toISOString().slice(0, 10),
            impacto: "nenhum",
            previsto: false,
          },
        ];
        delete i.valorInicial;
        delete i.dataInicio;
      }
      // ensure aportes array and previsto field
      if (!i.aportes) i.aportes = [];
      i.aportes.forEach((a) => {
        if (a.previsto === undefined) a.previsto = false;
      });
    });
  });
}

function load() {
  const s = localStorage.getItem("fos_v3") || localStorage.getItem("fos_v2");
  if (s) {
    state = JSON.parse(s);
    migrate();
    return;
  }
}

// ─── CDI ────────────────────────────────────────────────
async function fetchCDI() {
  try {
    const r = await fetch(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json",
    );
    if (!r.ok) throw 0;
    const data = await r.json();
    cdiDiary = parseFloat(data[0].valor) / 100;
    localStorage.setItem(
      "fos_cdi",
      JSON.stringify({ val: cdiDiary, ts: Date.now() }),
    );
    const aa = (Math.pow(1 + cdiDiary, 252) - 1) * 100;
    document.getElementById("cdiDot").classList.add("live");
    document.getElementById("cdiLabel").textContent =
      `CDI ${aa.toFixed(2)}% a.a.`;
  } catch {
    const cached = JSON.parse(localStorage.getItem("fos_cdi") || "null");
    if (cached && Date.now() - cached.ts < 7 * 86400000) {
      cdiDiary = cached.val;
      document.getElementById("cdiLabel").textContent =
        `CDI ~${((Math.pow(1 + cdiDiary, 252) - 1) * 100).toFixed(2)}% a.a.`;
    } else {
      cdiDiary = Math.pow(1 + 13.75 / 100, 1 / 252) - 1;
      document.getElementById("cdiLabel").textContent = "CDI ~13.75%";
    }
  }
  render();
}

function businessDays(s, e) {
  const sd = new Date(s + "T12:00:00"),
    ed = new Date(e + "T12:00:00");
  let n = 0,
    d = new Date(sd);
  while (d <= ed) {
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// CDB: only count aportes where previsto !== true
function calcCDB(inv) {
  if (!inv.aportes || !inv.aportes.length) return null;
  const active = inv.aportes.filter((a) => !a.previsto);
  if (!active.length) return null;
  const rate = cdiDiary ?? Math.pow(1 + 13.75 / 100, 1 / 252) - 1;
  const myRate = rate * ((inv.percentualCDI || 100) / 100);
  const today = new Date().toISOString().slice(0, 10);
  let valorAtual = 0,
    valorTotal = 0;
  active.forEach((a) => {
    const days = businessDays(a.data, today);
    valorAtual += days > 0 ? a.valor * Math.pow(1 + myRate, days) : a.valor;
    valorTotal += a.valor;
  });
  return {
    valorAtual,
    rendimento: valorAtual - valorTotal,
    rendPct:
      valorTotal > 0 ? ((valorAtual - valorTotal) / valorTotal) * 100 : 0,
    valorTotal,
  };
}

// investment impact totals
function calcInvImpact(data) {
  let planejado = 0,
    realizado = 0;
  data.investimentos.forEach((i) => {
    (i.aportes || []).forEach((a) => {
      if (a.impacto === "planejado" || a.impacto === "realizado")
        planejado += a.valor;
      // "realizado" = abate sobra + conta | "confirmado" = só conta (veio de previsto)
      if (a.impacto === "realizado" || a.impacto === "confirmado") realizado += a.valor;
    });
    if (!i.aportes || i.aportes.length === 0) {
      if (i.impacto === "planejado" || i.impacto === "realizado")
        planejado += i.valor || 0;
      if (i.impacto === "realizado") realizado += i.valor || 0;
    }
  });
  return { planejado, realizado };
}

// ─── FORMAT ─────────────────────────────────────────────
function brl(v) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v || 0);
}
function fmtDay(d) {
  if (!d && d !== 0) return "—";
  let n;
  if (typeof d === "number") n = d;
  else if (typeof d === "string" && d.includes("-"))
    n = parseInt(d.split("-")[2], 10);
  else n = parseInt(d, 10);
  return isNaN(n) ? "—" : String(n).padStart(2, "0");
}
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function dayVal(d) {
  if (!d && d !== 0) return 99;
  return typeof d === "number"
    ? d
    : parseInt(String(d).split("-")[2] || 99, 10);
}

// ─── CURRENCY MASK ──────────────────────────────────────
function maskBRL(el) {
  let raw = el.value.replace(/\D/g, "");
  if (!raw) {
    el.value = "";
    return;
  }
  let cents = parseInt(raw, 10);
  let str = String(cents).padStart(3, "0");
  let intPart = str.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  el.value = intPart + "," + str.slice(-2);
}
function parseBRL(el) {
  const v = el.value.replace(/\./g, "").replace(",", ".");
  return parseFloat(v) || 0;
}
function brlInputVal(n) {
  if (!n && n !== 0) return "";
  const str = n.toFixed(2).replace(".", ",");
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ─── NAVIGATE ───────────────────────────────────────────
function prevMonth() {
  mo--;
  if (mo < 0) {
    mo = 11;
    yr--;
  }
  despSort = "asc";
  rendSort = "asc";
  autoReplicate();
  render();
}
function nextMonth() {
  mo++;
  if (mo > 11) {
    mo = 0;
    yr++;
  }
  despSort = "asc";
  rendSort = "asc";
  autoReplicate();
  render();
}
function autoReplicate() {
  const curr = getMonth(),
    pmo = mo === 0 ? 11 : mo - 1,
    pyr = mo === 0 ? yr - 1 : yr,
    prev = getMonth(pyr, pmo);
  const toRep = prev.despesas.filter(
    (d) => d.tipo === "fixo" && d.autoReplicar,
  );
  if (!toRep.length) return;
  const existing = new Set(curr.despesas.map((d) => d.nome.toLowerCase()));
  let added = 0;
  toRep.forEach((d) => {
    if (!existing.has(d.nome.toLowerCase())) {
      curr.despesas.push({ ...d, id: uid(), realizado: 0 });
      added++;
    }
  });
  if (added) {
    save();
    setTimeout(
      () => toast(added + " despesa(s) replicada(s) automaticamente", "ok"),
      100,
    );
  }
}

// ─── SORT ───────────────────────────────────────────────
function toggleSort(sec) {
  if (sec === "d") {
    despSort = despSort === "asc" ? "desc" : "asc";
    document.getElementById("despDiaHead").textContent =
      "Dia " + (despSort === "asc" ? "↑" : "↓");
  } else {
    rendSort = rendSort === "asc" ? "desc" : "asc";
    document.getElementById("rendDiaHead").textContent =
      "Dia " + (rendSort === "asc" ? "↑" : "↓");
  }
  render();
}

// ─── RENDER ─────────────────────────────────────────────
function render() {
  const data = getMonth();
  const today = new Date();
  const todayDay = today.getDate();
  const isCurrentMonth = yr === today.getFullYear() && mo === today.getMonth();

  // ── Today banner ──
  const banner = document.getElementById("todayBanner");
  if (isCurrentMonth) {
    const todayDesp = data.despesas.filter(
      (d) => d.data === todayDay && d.tipo === "fixo",
    );
    const todayRend = data.rendas.filter((r) => r.data === todayDay);
    if (todayDesp.length || todayRend.length) {
      const allItems = [
        ...todayDesp.map(
          (d) =>
            `<span class="today-item ${d.realizado > 0 ? "done" : ""}">${esc(d.nome)} <span class="today-item-val">${brl(d.planejado)}</span></span>`,
        ),
        ...todayRend.map(
          (r) =>
            `<span class="today-item ${r.realizado > 0 ? "done" : ""}" style="${r.realizado > 0 ? "" : "border-color:rgba(16,185,129,0.25);background:rgba(16,185,129,0.06)"}">${esc(r.nome)} <span class="today-item-val" style="color:var(--green)">${brl(r.planejado)}</span></span>`,
        ),
      ].join("");
      const pendentes =
        todayDesp.filter((d) => d.realizado === 0).length +
        todayRend.filter((r) => r.realizado === 0).length;
      banner.style.display = "";
      banner.innerHTML = `<div class="today-banner">
  <div class="today-banner-icon">📅</div>
  <div>
    <div class="today-banner-title">Hoje, dia ${todayDay} — ${pendentes > 0 ? `${pendentes} pendente(s)` : "Tudo em dia ✓"}</div>
    <div class="today-banner-items">${allItems}</div>
  </div>
</div>`;
    } else {
      banner.style.display = "none";
    }
  } else {
    banner.style.display = "none";
  }
  document.getElementById("monthLabel").textContent = MONTHS[mo] + " " + yr;

  const tDP = data.despesas.reduce((s, d) => s + d.planejado, 0);
  const tDR = data.despesas.reduce((s, d) => s + d.realizado, 0);
  const tRP = data.rendas.reduce((s, r) => s + r.planejado, 0);
  const tRR = data.rendas.reduce((s, r) => s + r.realizado, 0);
  const inv = calcInvImpact(data);

  // Agendado: saiu da conta mas não pagou de fato
  const tAgendado = data.despesas
    .filter((d) => d.agendado && d.realizado === 0)
    .reduce((s, d) => s + d.planejado, 0);

  // Sobra = saldoInicial + renda - despesas - investimentos planejados
  const sobra = data.saldoInicial + tRP - tDP - inv.planejado;
  const base = data.saldoInicial + tRP;
  // % economia = quanto da renda não foi gasto (investimento = poupança, não gasto)
  const econ = tRP > 0 ? ((tRP - tDP) / tRP) * 100 : 0;
  // Na conta = saldoInicial + recebido - pago - agendado - investimentos realizados
  const naConta = data.saldoInicial + tRR - tDR - tAgendado - inv.realizado;

  let tInvCarteira = 0;
  data.investimentos.forEach((i) => {
    if (i.tipo === "CDB" && i.aportes && i.aportes.length) {
      const c = calcCDB(i);
      tInvCarteira += c ? c.valorAtual : 0;
    } else
      tInvCarteira +=
        (i.valor || 0) +
        (i.aportes || [])
          .filter((a) => !a.previsto)
          .reduce((s, a) => s + a.valor, 0);
  });

  // ── Summary cards ──
  document.getElementById("summary").innerHTML = `
<div class="scard c-blue">
<div class="scard-label">Saldo Inicial</div>
<div class="scard-value">${brl(data.saldoInicial)}</div>
<div class="scard-sub"><a href="#" onclick="editSaldo(event)" style="color:var(--text3);text-decoration:none;font-size:16px"><i class="fa-solid fa-pen"></i> editar</a></div>
</div>
<div class="scard c-green">
<div class="scard-label">Renda Planejada</div>
<div class="scard-value pos">${brl(tRP)}</div>
<div class="scard-sub">${brl(tRR)} recebidos</div>
</div>
<div class="scard c-red">
<div class="scard-label">Despesas Planejadas</div>
<div class="scard-value">${brl(tDP)}</div>
<div class="scard-sub">${brl(tDR)} pagos</div>
</div>
<div class="scard c-orange">
<div class="scard-label">Sobra Planejada</div>
<div class="scard-value ${sobra >= 0 ? "pos" : "neg"}">${brl(sobra)}</div>
<div class="scard-sub">${econ.toFixed(1)}% de economia</div>
</div>
<div class="scard c-destaque ${naConta < 0 ? "saldo-neg" : ""}">
<div class="scard-label">Na Conta (Atual)</div>
<div class="scard-value ${naConta >= 0 ? "pos" : "neg"}">${brl(naConta)}</div>
</div>`;

  // ── Progress ──
  const dRaw = tDP > 0 ? (tDR / tDP) * 100 : 0,
    dPct = Math.min(dRaw, 100),
    dOver = dRaw > 100;
  const rPct = tRP > 0 ? Math.min((tRR / tRP) * 100, 100) : 0;
  document.getElementById("progressRow").innerHTML = `
<div class="pcard">
<div class="pcard-head"><span class="pcard-title">Despesas${dOver ? ' <span style="color:var(--yellow);font-size:10px">⚠ acima do planejado</span>' : ""}</span>
  <div class="pcard-amounts"><span class="pamt-plan">Planejado ${brl(tDP)}</span><span class="pamt-real" style="${dOver ? "color:var(--yellow)" : ""}">Pago ${brl(tDR)}</span></div>
</div>
<div class="pbar"><div class="pbar-fill ${dOver ? "fill-yellow" : "fill-red"}" style="width:${dPct}%"></div></div>
</div>
<div class="pcard">
<div class="pcard-head"><span class="pcard-title">Renda</span>
  <div class="pcard-amounts"><span class="pamt-plan">Planejado ${brl(tRP)}</span><span class="pamt-real">Recebido ${brl(tRR)}</span></div>
</div>
<div class="pbar"><div class="pbar-fill fill-green" style="width:${rPct}%"></div></div>
</div>`;

  // ── Despesas breakdown ──
  const tBoleto = data.despesas
    .filter((d) => d.tipo === "fixo" && d.subtipo === "boleto")
    .reduce((s, d) => s + d.planejado, 0);
  const tCartao = data.despesas
    .filter((d) => d.tipo === "fixo" && d.subtipo === "cartao")
    .reduce((s, d) => s + d.planejado, 0);
  const tEspora = data.despesas
    .filter((d) => d.tipo === "esporadico")
    .reduce((s, d) => s + d.planejado, 0);
  document.getElementById("despBreak").innerHTML = `
<div class="sub2-row">
<span class="sub2-tag"><span class="sub2-dot" style="background:#8b9ab0"></span>Fixas ${brl(tBoleto + tCartao)}</span>
<span class="sub2-tag"><span class="sub2-dot" style="background:#fbbf24"></span>Esporádico ${brl(tEspora)}</span>
</div>
<div class="sub2-row">
<span class="sub2-tag"><span class="sub2-dot" style="background:#0ea5e9"></span>Boleto ${brl(tBoleto)}</span>
<span class="sub2-tag"><span class="sub2-dot" style="background:#a78bfa"></span>Cartão ${brl(tCartao)}</span>
</div>`;

  // ── Despesas table ──
  let dlist = data.despesas.filter(
    (d) => curFilter === "todos" || d.tipo === curFilter,
  );
  // Sort: fixos first (by date), then esporádicos (by date)
  dlist = [...dlist].sort((a, b) => {
    const ga = a.tipo === "fixo" ? 0 : 1;
    const gb = b.tipo === "fixo" ? 0 : 1;
    if (ga !== gb) return ga - gb;
    const da = dayVal(a.data),
      db = dayVal(b.data);
    return despSort === "desc" ? db - da : da - db;
  });
  const fP = dlist.reduce((s, d) => s + d.planejado, 0);
  const fR = dlist.reduce((s, d) => s + d.realizado, 0);
  const fA = dlist
    .filter((d) => d.agendado && d.realizado === 0)
    .reduce((s, d) => s + d.planejado, 0);
  document.getElementById("despSub").textContent =
    `${brl(fP)} planejado · ${brl(fR)} pago${fA > 0 ? ` · ${brl(fA)} agendado` : ""}`;

  if (dlist.length === 0) {
    document.getElementById("despBody").innerHTML = "";
    document.getElementById("despEmpty").style.display = "";
  } else {
    document.getElementById("despEmpty").style.display = "none";
    document.getElementById("despBody").innerHTML = dlist
      .map((d) => {
        const done = d.realizado > 0;
        const agendado = d.agendado && !done;
        const hoje = d.data === todayDay && isCurrentMonth;
        let tc = d.tipo === "esporadico" ? "tr-espora" : d.subtipo === "cartao" ? "tr-cartao" : "tr-boleto";
        if (done) tc = "tr-done";
        else if (agendado) tc += " tr-agendado"; // mantém cor do tipo + agendado por cima
        const badge = done
          ? '<span class="badge-inline">Pago</span>'
          : agendado
            ? '<span class="badge-inline badge-agendado">Agendado</span>'
            : hoje && d.tipo === "fixo"
              ? '<span class="badge-inline badge-hoje">Hoje</span>'
              : "";
        return `<tr class="${tc}" draggable="true"
  ondragstart="dStart(event,'${d.id}','d')" ondragover="dOver(event)"
  ondrop="dDrop(event,'${d.id}','d')" ondragleave="dLeave(event)" ondragend="dEnd()">
  <td title="${esc(d.nome)}">${esc(d.nome)}${badge}${d.autoReplicar ? '<span class="auto-rep-badge"><i class="fa-solid fa-rotate"></i></span>' : ""}</td>
  <td>${brl(d.planejado)}</td>
  <td class="td-muted">${fmtDay(d.data)}</td>
  <td class="right"><div class="row-acts">
    <button class="ibt sch ${agendado ? "is-sch" : ""}" onclick="toggleAgendado('${d.id}')" title="${agendado ? "Cancelar agendamento" : "Agendar pagamento"}" ${done ? "style='opacity:0.3;pointer-events:none'" : ""}><i class="fa-solid fa-calendar-check"></i></button>
    <button class="ibt chk ${done ? "is-done" : ""}" onclick="toggle('d','${d.id}')" title="${done ? "Desmarcar" : "Marcar pago"}"><i class="fa-solid fa-check"></i></button>
    <button class="ibt" onclick="openModal('despesa','${d.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
    <button class="ibt del" onclick="del('d','${d.id}')" title="Excluir"><i class="fa-solid fa-xmark"></i></button>
  </div></td>
</tr>`;
      })
      .join("");
  }

  // ── Renda table ──
  let rlist = [...data.rendas];
  rlist.sort((a, b) =>
    rendSort === "desc"
      ? dayVal(b.data) - dayVal(a.data)
      : dayVal(a.data) - dayVal(b.data),
  );
  document.getElementById("rendSub").textContent =
    `${brl(tRP)} planejado · ${brl(tRR)} recebido`;
  if (rlist.length === 0) {
    document.getElementById("rendBody").innerHTML = "";
    document.getElementById("rendEmpty").style.display = "";
  } else {
    document.getElementById("rendEmpty").style.display = "none";
    document.getElementById("rendBody").innerHTML = rlist
      .map((r) => {
        const done = r.realizado > 0;
        return `<tr class="${done ? "tr-done" : ""}" draggable="true"
  ondragstart="dStart(event,'${r.id}','r')" ondragover="dOver(event)"
  ondrop="dDrop(event,'${r.id}','r')" ondragleave="dLeave(event)" ondragend="dEnd()">
  <td title="${esc(r.nome)}">${esc(r.nome)}${done ? '<span class="badge-inline">Recebido</span>' : ""}</td>
  <td>${brl(r.planejado)}</td>
  <td class="td-muted">${fmtDay(r.data)}</td>
  <td class="right"><div class="row-acts">
    <button class="ibt chk ${done ? "is-done" : ""}" onclick="toggle('r','${r.id}')" title="${done ? "Desmarcar" : "Marcar recebido"}"><i class="fa-solid fa-check"></i></button>
    <button class="ibt" onclick="openModal('renda','${r.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
    <button class="ibt del" onclick="del('r','${r.id}')" title="Excluir"><i class="fa-solid fa-xmark"></i></button>
  </div></td>
</tr>`;
      })
      .join("");
  }

  // ── Investimentos ──
  document.getElementById("invSub").textContent =
    `${brl(tInvCarteira)} em carteira`;
  if (data.investimentos.length === 0) {
    document.getElementById("invGrid").innerHTML = "";
    document.getElementById("invEmpty").style.display = "";
    document.getElementById("invTotal").style.display = "none";
  } else {
    document.getElementById("invEmpty").style.display = "none";
    document.getElementById("invTotal").style.display = "flex";
    document.getElementById("invTotalVal").textContent = brl(tInvCarteira);
    document.getElementById("invGrid").innerHTML = data.investimentos
      .map((i) => {
        const aporteFmt = (a, invId) => {
          const isConf = !a.previsto;
          const dt = a.data
            ? new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "2-digit",
              })
            : "";
          return `<div class="inv-aporte-row${isConf ? "" : " pending"}">
      <button class="inv-aporte-chk${isConf ? " done" : ""}" onclick="toggleAportePrevisto('${invId}','${a.id}')" title="${isConf ? "Marcar como previsto" : "Confirmar aporte"}"><i class="fa-solid ${isConf ? "fa-check" : "fa-circle"}"></i></button>
      <span>${dt}</span>
      <span class="inv-aporte-val">${brl(a.valor)}</span>
      ${a.previsto ? '<span class="inv-aporte-tag">Previsto</span>' : ""}
      <button class="inv-aporte-del" onclick="delAporte('${invId}','${a.id}')" title="Remover aporte"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
        };

        if (i.tipo === "CDB" && i.aportes && i.aportes.length) {
          const c = calcCDB(i);
          const va = c ? c.valorAtual : 0,
            rd = c ? c.rendimento : 0,
            rp = c ? c.rendPct : 0,
            vt = c ? c.valorTotal : 0;
          const sg = rd >= 0 ? "+" : "";
          const aporteRows = [...i.aportes]
            .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
            .map((a) => aporteFmt(a, i.id)).join("");
          return `<div class="inv-card cdb-card">
    <div class="inv-card-acts">
      <button class="btn-ghost" onclick="openAporte('${i.id}')"><i class="fa-solid fa-plus"></i> Aporte</button>
      <button class="ibt" onclick="openModal('investimento','${i.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
      <button class="ibt del" onclick="del('i','${i.id}')"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="inv-name">${esc(i.nome)}</div>
    <div class="inv-type">CDB · ${i.percentualCDI || 100}% CDI</div>
    <div class="inv-val">${brl(va)}</div>
    <div class="inv-rend ${rd < 0 ? "neg" : ""}">${sg}${brl(rd)} (${sg}${rp.toFixed(3)}%)</div>
    <div class="inv-meta"><span>Confirmado: ${brl(vt)}</span><span>${i.aportes.length} aporte(s)</span></div>
    ${i.aportes.length ? `<div class="inv-aportes">${aporteRows}</div>` : ""}
    <div style="margin-top:8px"><button class="btn-ghost" style="width:100%;justify-content:center" onclick="carryInvest('${i.id}')"><i class="fa-solid fa-arrow-right"></i> Próximo mês</button></div>
  </div>`;
        }
        // outros investimentos
        const totalVal =
          (i.valor || 0) +
          (i.aportes || [])
            .filter((a) => !a.previsto)
            .reduce((s, a) => s + a.valor, 0);
        const aporteRows = [...(i.aportes || [])]
          .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
          .map((a) => aporteFmt(a, i.id))
          .join("");
        return `<div class="inv-card">
  <div class="inv-card-acts">
    <button class="btn-ghost" onclick="openAporte('${i.id}')"><i class="fa-solid fa-plus"></i> Aporte</button>
    <button class="ibt" onclick="openModal('investimento','${i.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
    <button class="ibt del" onclick="del('i','${i.id}')"><i class="fa-solid fa-xmark"></i></button>
  </div>
  <div class="inv-name">${esc(i.nome)}</div>
  <div class="inv-type">${esc(i.tipo)}</div>
  <div class="inv-val">${brl(totalVal)}</div>
  ${i.aportes && i.aportes.length ? `<div class="inv-aportes">${aporteRows}</div>` : ""}
  <div style="margin-top:8px"><button class="btn-ghost" style="width:100%;justify-content:center" onclick="carryInvest('${i.id}')"><i class="fa-solid fa-arrow-right"></i> Próximo mês</button></div>
</div>`;
      })
      .join("");
  }
}

// ─── DRAG ───────────────────────────────────────────────
function dStart(e, id, sec) {
  dragId = id;
  dragSec = sec;
  e.dataTransfer.effectAllowed = "move";
  setTimeout(() => e.currentTarget.classList.add("dragging"), 0);
}
function dOver(e) {
  e.preventDefault();
  const tr = e.currentTarget;
  if (!tr.classList.contains("dragging")) {
    document
      .querySelectorAll("tr.drag-target")
      .forEach((el) => el.classList.remove("drag-target"));
    tr.classList.add("drag-target");
  }
}
function dLeave(e) {
  e.currentTarget.classList.remove("drag-target");
}
function dDrop(e, tid, sec) {
  e.preventDefault();
  if (!dragId || dragId === tid || sec !== dragSec) return;
  const data = getMonth(),
    arr = sec === "d" ? data.despesas : data.rendas;
  const fi = arr.findIndex((x) => x.id === dragId),
    ti = arr.findIndex((x) => x.id === tid);
  if (fi < 0 || ti < 0) return;
  const [item] = arr.splice(fi, 1);
  arr.splice(ti, 0, item);
  save();
  render();
}
function dEnd() {
  document
    .querySelectorAll(".dragging,.drag-target")
    .forEach((el) => el.classList.remove("dragging", "drag-target"));
  dragId = null;
  dragSec = null;
}

// ─── SALDO ──────────────────────────────────────────────
function editSaldo(e) {
  e.preventDefault();
  const data = getMonth();
  const card = document.querySelector(".scard.c-blue .scard-value");
  card.innerHTML = `<input class="saldo-fi" id="saldoIn" type="number" step="0.01" value="${data.saldoInicial}" onblur="saveSaldo()" onkeydown="if(event.key==='Enter')saveSaldo()">`;
  document.getElementById("saldoIn").focus();
  document.getElementById("saldoIn").select();
}
function saveSaldo() {
  const v = parseFloat(document.getElementById("saldoIn")?.value) || 0;
  getMonth().saldoInicial = v;
  save();
  render();
  toast("Saldo inicial atualizado", "ok");
}

// ─── FILTER ─────────────────────────────────────────────
function setFilter(f, btn) {
  curFilter = f;
  btn
    .closest(".ftabs")
    .querySelectorAll(".ftab")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  render();
}

// ─── TOGGLE ─────────────────────────────────────────────
function toggle(t, id) {
  const data = getMonth();
  if (t === "d") {
    const it = data.despesas.find((d) => d.id === id);
    if (it) {
      if (it.realizado > 0) {
        it.realizado = 0;
      } else {
        it.realizado = it.planejado;
        it.agendado = false; // pago = cancela agendamento
      }
    }
  } else {
    const it = data.rendas.find((r) => r.id === id);
    if (it) it.realizado = it.realizado > 0 ? 0 : it.planejado;
  }
  save();
  render();
}

// ─── AGENDAR PAGAMENTO ──────────────────────────────────
function toggleAgendado(id) {
  const data = getMonth();
  const it = data.despesas.find((d) => d.id === id);
  if (!it || it.realizado > 0) return;
  it.agendado = !it.agendado;
  save();
  render();
  toast(it.agendado ? "Pagamento agendado 📅" : "Agendamento cancelado", "ok");
}

// ─── TOGGLE APORTE PREVISTO ─────────────────────────────
function toggleAportePrevisto(invId, aporteId) {
  const data = getMonth();
  const inv = data.investimentos.find((i) => i.id === invId);
  if (!inv || !inv.aportes) return;
  const a = inv.aportes.find((a) => a.id === aporteId);
  if (!a) return;
  a.previsto = !a.previsto;

  if (!a.previsto) {
    // Confirmando: guarda impacto original e escala para o próximo nível
    a.impactoOriginal = a.impacto;
    if (a.impacto === "nenhum") a.impacto = "confirmado";    // só Na Conta
    else if (a.impacto === "planejado") a.impacto = "realizado"; // Sobra + Na Conta
    // se já era "realizado" ou "confirmado", mantém
  } else {
    // Voltando para previsto: restaura impacto original
    a.impacto = a.impactoOriginal ?? "nenhum";
    delete a.impactoOriginal;
  }

  save();
  render();
  toast(
    a.previsto ? "Aporte marcado como previsto" : "Aporte confirmado ✓",
    "ok",
  );
}

// ─── DELETE + UNDO ──────────────────────────────────────
function del(t, id) {
  const data = getMonth();
  let removed, idx, label;
  if (t === "d") {
    idx = data.despesas.findIndex((d) => d.id === id);
    removed = data.despesas[idx];
    data.despesas.splice(idx, 1);
    label = `Despesa "${removed.nome}" removida`;
    undoStack = [
      {
        restore: () => {
          data.despesas.splice(idx, 0, removed);
          save();
          render();
        },
      },
    ];
  } else if (t === "r") {
    idx = data.rendas.findIndex((r) => r.id === id);
    removed = data.rendas[idx];
    data.rendas.splice(idx, 1);
    label = `Renda "${removed.nome}" removida`;
    undoStack = [
      {
        restore: () => {
          data.rendas.splice(idx, 0, removed);
          save();
          render();
        },
      },
    ];
  } else {
    idx = data.investimentos.findIndex((i) => i.id === id);
    removed = data.investimentos[idx];
    data.investimentos.splice(idx, 1);
    label = `Investimento "${removed.nome}" removido`;
    undoStack = [
      {
        restore: () => {
          data.investimentos.splice(idx, 0, removed);
          save();
          render();
        },
      },
    ];
  }
  save();
  render();
  toastUndo(label);
}

function undoLast() {
  if (!undoStack.length) return;
  undoStack.pop().restore();
  undoStack = [];
  toast("Ação desfeita", "ok");
}

// ─── DEL APORTE ─────────────────────────────────────────
function delAporte(invId, aporteId) {
  const data = getMonth();
  const inv = data.investimentos.find((i) => i.id === invId);
  if (!inv || !inv.aportes) return;
  const idx = inv.aportes.findIndex((a) => a.id === aporteId);
  if (idx < 0) return;
  const removed = inv.aportes[idx];
  inv.aportes.splice(idx, 1);
  save();
  render();
  undoStack = [
    {
      restore: () => {
        inv.aportes.splice(idx, 0, removed);
        save();
        render();
      },
    },
  ];
  toastUndo("Aporte removido");
}

// ─── CARRY INVESTMENT ───────────────────────────────────
function carryInvest(invId) {
  const data = getMonth();
  const inv = data.investimentos.find((i) => i.id === invId);
  if (!inv) return;
  const nmo = mo === 11 ? 0 : mo + 1,
    nyr = mo === 11 ? yr + 1 : yr;
  const next = getMonth(nyr, nmo);
  const exists = next.investimentos.find(
    (i) => i.nome === inv.nome && i.tipo === inv.tipo,
  );
  if (exists) {
    toast("Investimento já existe no próximo mês", "warn");
    return;
  }
  next.investimentos.push({
    ...JSON.parse(JSON.stringify(inv)),
    id: uid(),
  });
  save();
  toast(`"${inv.nome}" copiado para ${MONTHS[nmo]}/${nyr}`, "ok");
}

// ─── APORTE MODAL ───────────────────────────────────────
function openAporte(invId) {
  const data = getMonth();
  const inv = data.investimentos.find((i) => i.id === invId);
  if (!inv) return;
  modalCtx = { type: "aporte", invId };
  document.getElementById("modalTitle").textContent =
    `Novo Aporte — ${inv.nome}`;
  const cdiAA =
    cdiDiary && inv.tipo === "CDB"
      ? (
          ((Math.pow(1 + cdiDiary, 252) - 1) *
            100 *
            (inv.percentualCDI || 100)) /
          100
        ).toFixed(2)
      : null;
  document.getElementById("modalBody").innerHTML = `
${cdiAA ? `<div class="modal-info">Rendimento efetivo: ${cdiAA}% a.a. (${inv.percentualCDI || 100}% CDI)</div>` : ""}
<div class="frow">
<div class="fg"><label>Valor do Aporte (R$)</label>
  <input class="fi" id="fAporteValor" type="text" inputmode="numeric" placeholder="0,00" oninput="maskBRL(this)">
</div>
<div class="fg"><label>Data do Aporte</label>
  <input class="fi" id="fAporteData" type="date" value="${new Date().toISOString().slice(0, 10)}">
</div>
</div>
<label class="check-row">
<input type="checkbox" id="fAportePrevisto">
<span><i class="fa-solid fa-calendar-check"></i> <strong>Aporte futuro/previsto</strong> — não conta na carteira nem no CDI ainda</span>
</label>
<div class="fg"><label>Impacto no saldo deste mês</label>
<div class="radio-group">
  <label class="radio-opt selected" id="ropt-nenhum">
    <input type="radio" name="impacto" value="nenhum" checked onchange="selRadio('nenhum')">
    <span class="radio-opt-text"><strong>Sem impacto</strong>Registra o investimento sem afetar o saldo</span>
  </label>
  <label class="radio-opt" id="ropt-planejado">
    <input type="radio" name="impacto" value="planejado" onchange="selRadio('planejado')">
    <span class="radio-opt-text"><strong>Abater da sobra planejada</strong>Desconta da sobra, não da conta atual</span>
  </label>
  <label class="radio-opt" id="ropt-realizado">
    <input type="radio" name="impacto" value="realizado" onchange="selRadio('realizado')">
    <span class="radio-opt-text"><strong>Abater da sobra e conta atual</strong>Dinheiro já saiu da conta este mês</span>
  </label>
</div>
</div>`;
  document.getElementById("overlay").classList.add("open");
  setTimeout(() => document.getElementById("fAporteValor")?.focus(), 120);
}
function selRadio(v) {
  ["nenhum", "planejado", "realizado"].forEach((x) =>
    document.getElementById(`ropt-${x}`)?.classList.toggle("selected", x === v),
  );
}

// ─── MODAL ──────────────────────────────────────────────
function openModal(type, editId = null) {
  modalCtx = { type, editId };
  const data = getMonth();
  let item = null;
  if (editId) {
    if (type === "despesa") item = data.despesas.find((d) => d.id === editId);
    if (type === "renda") item = data.rendas.find((r) => r.id === editId);
    if (type === "investimento")
      item = data.investimentos.find((i) => i.id === editId);
  }
  const isEdit = !!item;
  document.getElementById("modalTitle").textContent =
    (isEdit ? "Editar " : "Adicionar ") +
    { despesa: "Despesa", renda: "Renda", investimento: "Investimento" }[type];

  if (type === "despesa") {
    const tipoVal = item?.tipo || "fixo";
    const subtipoVal = item?.subtipo || "boleto";
    const pago = item ? item.realizado > 0 : false;
    document.getElementById("modalBody").innerHTML = `
<div class="fg"><label>Nome</label>
  <input class="fi" id="fNome" placeholder="Ex: Plano de Saúde" value="${esc(item?.nome || "")}">
</div>
<div class="frow">
  <div class="fg"><label>Valor (R$)</label>
    <input class="fi" id="fValor" type="text" inputmode="numeric" placeholder="0,00" value="${item?.planejado ? brlInputVal(item.planejado) : ""}" oninput="maskBRL(this)">
  </div>
  <div class="fg"><label>Dia de Vencimento</label>
    <input class="fi" id="fData" type="number" min="1" max="31" placeholder="Ex: 15" value="${item?.data || ""}">
  </div>
</div>
<div class="frow">
  <div class="fg"><label>Tipo</label>
    <select class="fs" id="fTipo" onchange="toggleSubtipo()">
      <option value="fixo" ${tipoVal === "fixo" ? "selected" : ""}>Fixo</option>
      <option value="esporadico" ${tipoVal === "esporadico" ? "selected" : ""}>Esporádico</option>
    </select>
  </div>
  <div class="fg" id="subtipoWrap" style="display:${tipoVal === "fixo" ? "block" : "none"}">
    <label>Forma de Pagamento</label>
    <select class="fs" id="fSubtipo">
      <option value="boleto" ${subtipoVal === "boleto" ? "selected" : ""}>Boleto</option>
      <option value="cartao" ${subtipoVal === "cartao" ? "selected" : ""}>Cartão</option>
    </select>
  </div>
</div>
<label class="check-row">
  <input type="checkbox" id="fPago" ${pago ? "checked" : ""}>
  <span>Já foi pago</span>
</label>
${tipoVal === "fixo" ? `<label class="check-row" id="fAutoRepWrap"><input type="checkbox" id="fAutoRep" ${item?.autoReplicar ? "checked" : ""}><span><i class="fa-solid fa-rotate"></i> Replicar automaticamente nos próximos meses</span></label>` : ""}`;
  } else if (type === "renda") {
    const rec = item ? item.realizado > 0 : false;
    document.getElementById("modalBody").innerHTML = `
<div class="fg"><label>Nome</label>
  <input class="fi" id="fNome" placeholder="Ex: Jogo de Ouro" value="${esc(item?.nome || "")}">
</div>
<div class="frow">
  <div class="fg"><label>Valor (R$)</label>
    <input class="fi" id="fValor" type="text" inputmode="numeric" placeholder="0,00" value="${item?.planejado ? brlInputVal(item.planejado) : ""}" oninput="maskBRL(this)">
  </div>
  <div class="fg"><label>Dia de Recebimento</label>
    <input class="fi" id="fData" type="number" min="1" max="31" placeholder="Ex: 5" value="${item?.data || ""}">
  </div>
</div>
<label class="check-row">
  <input type="checkbox" id="fRec" ${rec ? "checked" : ""}>
  <span>Já foi recebido</span>
</label>`;
  } else {
    const isCDB = (item?.tipo || "CDB") === "CDB";
    const cdiAA = cdiDiary
      ? ((Math.pow(1 + cdiDiary, 252) - 1) * 100).toFixed(2)
      : null;
    document.getElementById("modalBody").innerHTML = `
<div class="fg"><label>Nome / Ticker</label>
  <input class="fi" id="fNome" placeholder="Ex: CDB Nubank" value="${esc(item?.nome || "")}">
</div>
<div class="fg"><label>Tipo</label>
  <select class="fs" id="fInvTipo" onchange="toggleCDBFields()">
    ${INV_TIPOS.map((t) => `<option value="${t}" ${(item?.tipo || "CDB") === t ? "selected" : ""}>${t}</option>`).join("")}
  </select>
</div>
<div id="cdbFields" style="display:${isCDB ? "block" : "none"}">
  <div class="frow">
    <div class="fg"><label>Valor 1º Aporte (R$)</label>
      <input class="fi" id="fValorInicial" type="text" inputmode="numeric" placeholder="0,00" value="${item?.aportes?.[0]?.valor ? brlInputVal(item.aportes[0].valor) : ""}" oninput="maskBRL(this)">
    </div>
    <div class="fg"><label>% do CDI</label>
      <input class="fi" id="fPctCDI" type="number" step="0.5" placeholder="100" value="${item?.percentualCDI || 100}">
      ${cdiAA ? `<div class="cdi-hint">CDI atual: <span>${cdiAA}% a.a.</span></div>` : ""}
    </div>
  </div>
  <div class="fg"><label>Data do 1º Aporte</label>
    <input class="fi" id="fDataInicio" type="date" value="${item?.aportes?.[0]?.data || ""}">
  </div>
</div>
<div id="outroFields" style="display:${isCDB ? "none" : "block"}">
  <div class="fg"><label>Valor Inicial (R$)</label>
    <input class="fi" id="fValor" type="text" inputmode="numeric" placeholder="0,00" value="${item?.valor ? brlInputVal(item.valor) : ""}" oninput="maskBRL(this)">
  </div>
</div>`;
  }
  document.getElementById("overlay").classList.add("open");
  setTimeout(() => document.getElementById("fNome")?.focus(), 120);
}

function toggleSubtipo() {
  const t = document.getElementById("fTipo")?.value;
  document.getElementById("subtipoWrap").style.display =
    t === "fixo" ? "block" : "none";
  const arWrap = document.getElementById("fAutoRepWrap");
  if (arWrap) arWrap.style.display = t === "fixo" ? "" : "none";
}
function toggleCDBFields() {
  const t = document.getElementById("fInvTipo")?.value;
  document.getElementById("cdbFields").style.display =
    t === "CDB" ? "block" : "none";
  document.getElementById("outroFields").style.display =
    t === "CDB" ? "none" : "block";
}
function closeModal() {
  document.getElementById("overlay").classList.remove("open");
  const acts = document.querySelector(".modal-actions");
  if (acts)
    acts.innerHTML = `<button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-save" onclick="saveModal()">Salvar</button>`;
  modalCtx = null;
}
function handleOverlayClick(e) {
  if (e.target === document.getElementById("overlay")) closeModal();
}

function saveModal() {
  if (!modalCtx) return;
  const { type, editId, invId } = modalCtx;
  const data = getMonth();

  // ── APORTE ──
  if (type === "aporte") {
    const valor = parseBRL(document.getElementById("fAporteValor"));
    const dt = document.getElementById("fAporteData")?.value;
    const impacto =
      document.querySelector('input[name="impacto"]:checked')?.value ||
      "nenhum";
    const previsto = !!document.getElementById("fAportePrevisto")?.checked;
    if (!valor || valor <= 0) {
      toast("Informe o valor", "err");
      return;
    }
    if (!dt) {
      toast("Informe a data", "err");
      return;
    }
    const inv = data.investimentos.find((i) => i.id === invId);
    if (!inv) return;
    if (!inv.aportes) inv.aportes = [];
    inv.aportes.push({ id: uid(), valor, data: dt, impacto, previsto });
    save();
    render();
    closeModal();
    toast(
      previsto
        ? `Aporte de ${brl(valor)} registrado como previsto 📅`
        : `Aporte de ${brl(valor)} confirmado ✓`,
      "ok",
    );
    return;
  }

  const nome = document.getElementById("fNome")?.value.trim();
  if (!nome) {
    toast("Preencha o nome", "err");
    return;
  }

  if (type === "despesa") {
    const val = parseBRL(document.getElementById("fValor"));
    const pago = document.getElementById("fPago")?.checked;
    const tipo = document.getElementById("fTipo")?.value;
    const subtipo =
      tipo === "fixo"
        ? document.getElementById("fSubtipo")?.value || "boleto"
        : null;
    const dt = parseInt(document.getElementById("fData")?.value) || null;
    const autoReplicar =
      tipo === "fixo" && !!document.getElementById("fAutoRep")?.checked;
    const obj = {
      nome,
      planejado: val,
      realizado: pago ? val : 0,
      tipo,
      subtipo,
      data: dt,
      autoReplicar,
    };
    if (editId) {
      const it = data.despesas.find((d) => d.id === editId);
      if (it) Object.assign(it, obj);
    } else data.despesas.push({ id: uid(), ...obj });
  } else if (type === "renda") {
    const val = parseBRL(document.getElementById("fValor"));
    const rec = document.getElementById("fRec")?.checked;
    const dt = parseInt(document.getElementById("fData")?.value) || null;
    const obj = {
      nome,
      planejado: val,
      realizado: rec ? val : 0,
      data: dt,
    };
    if (editId) {
      const it = data.rendas.find((r) => r.id === editId);
      if (it) Object.assign(it, obj);
    } else data.rendas.push({ id: uid(), ...obj });
  } else {
    const tipo = document.getElementById("fInvTipo")?.value;
    if (tipo === "CDB") {
      const vi = parseBRL(document.getElementById("fValorInicial"));
      const pct = parseFloat(document.getElementById("fPctCDI")?.value) || 100;
      const di = document.getElementById("fDataInicio")?.value;
      if (!di) {
        toast("Informe a data do 1º aporte", "err");
        return;
      }
      if (editId) {
        const it = data.investimentos.find((i) => i.id === editId);
        if (it) {
          it.nome = nome;
          it.percentualCDI = pct;
          if (!it.aportes || !it.aportes.length)
            it.aportes = [
              { id: uid(), valor: vi, data: di, impacto: "nenhum" },
            ];
        }
      } else {
        data.investimentos.push({
          id: uid(),
          nome,
          tipo,
          percentualCDI: pct,
          aportes: [
            {
              id: uid(),
              valor: vi,
              data: di,
              impacto: "nenhum",
              previsto: false,
            },
          ],
        });
      }
    } else {
      const val = parseBRL(document.getElementById("fValor"));
      if (editId) {
        const it = data.investimentos.find((i) => i.id === editId);
        if (it) Object.assign(it, { nome, tipo, valor: val });
      } else
        data.investimentos.push({
          id: uid(),
          nome,
          tipo,
          valor: val,
          aportes: [],
        });
    }
  }
  save();
  render();
  closeModal();
  toast("Salvo!", "ok");
}

// ─── COPY ───────────────────────────────────────────────
function copyPrevMonthFixed() {
  const pmo = mo === 0 ? 11 : mo - 1,
    pyr = mo === 0 ? yr - 1 : yr;
  const prev = getMonth(pyr, pmo),
    curr = getMonth();
  const fixed = prev.despesas.filter((d) => d.tipo === "fixo");
  if (!fixed.length) {
    toast("Nenhuma despesa fixa no mês anterior", "warn");
    return;
  }
  const existing = new Set(curr.despesas.map((d) => d.nome.toLowerCase()));
  let added = 0;
  fixed.forEach((d) => {
    if (!existing.has(d.nome.toLowerCase())) {
      curr.despesas.push({ ...d, id: uid(), realizado: 0 });
      added++;
    }
  });
  if (!added) {
    toast("Fixas já existem neste mês", "warn");
    return;
  }
  save();
  render();
  toast(`${added} fixas copiadas!`, "ok");
}

function copyPrevMonthRenda() {
  const pmo = mo === 0 ? 11 : mo - 1,
    pyr = mo === 0 ? yr - 1 : yr;
  const prev = getMonth(pyr, pmo),
    curr = getMonth();
  if (!prev.rendas.length) {
    toast("Nenhuma renda no mês anterior", "warn");
    return;
  }
  const existing = new Set(curr.rendas.map((r) => r.nome.toLowerCase()));
  let added = 0;
  prev.rendas.forEach((r) => {
    if (!existing.has(r.nome.toLowerCase())) {
      curr.rendas.push({ ...r, id: uid(), realizado: 0 });
      added++;
    }
  });
  if (!added) {
    toast("Rendas já existem neste mês", "warn");
    return;
  }
  save();
  render();
  toast(`${added} rendas copiadas!`, "ok");
}

// ─── CLEAR ALL ──────────────────────────────────────────
function clearMonth() {
  modalCtx = { type: "__confirm_clear_month__" };
  document.getElementById("modalTitle").textContent = "🗑 Limpar mês atual";
  document.getElementById("modalBody").innerHTML =
    `<p class="confirm-msg">Apaga todas as despesas, rendas e investimentos de <strong>${MONTHS[mo]} ${yr}</strong>. O saldo inicial será zerado também.</p><p class="confirm-warn">⚠ Esta ação não pode ser desfeita.</p>`;
  document.querySelector(".modal-actions").innerHTML =
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-confirm-del" onclick="doConfirmClearMonth()">Sim, limpar mês</button>`;
  document.getElementById("overlay").classList.add("open");
}
function doConfirmClearMonth() {
  const k = getKey();
  delete state[k];
  save();
  closeModal();
  render();
  toast(`${MONTHS[mo]} ${yr} foi limpo`, "ok");
}

function clearAll() {
  modalCtx = { type: "__confirm_clear__" };
  document.getElementById("modalTitle").textContent = "⚠ Limpar todos os dados";
  document.getElementById("modalBody").innerHTML =
    `<p class="confirm-msg">Esta ação vai apagar <strong>todos os meses</strong> registrados, incluindo despesas, rendas e investimentos.</p><p class="confirm-warn">⚠ Esta ação não pode ser desfeita.</p>`;
  document.querySelector(".modal-actions").innerHTML =
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button><button class="btn-confirm-del" onclick="doConfirmClear()">Sim, limpar tudo</button>`;
  document.getElementById("overlay").classList.add("open");
}
function doConfirmClear() {
  state = {};
  save();
  closeModal();
  render();
  toast("Todos os dados foram apagados", "ok");
}

// ─── EXPORT / IMPORT ────────────────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `financeos_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast("Exportado!", "ok");
}
function importClick() {
  document.getElementById("importFile").click();
}
function exportCSV() {
  const data = getMonth();
  const rows = [
    [
      "Tipo",
      "Nome",
      "Planejado (R$)",
      "Realizado (R$)",
      "Dia",
      "Info",
      "Status",
    ],
  ];
  data.rendas.forEach((r) =>
    rows.push([
      "Renda",
      r.nome,
      r.planejado.toFixed(2),
      r.realizado.toFixed(2),
      r.data || "",
      "",
      r.realizado > 0 ? "Recebido" : "Pendente",
    ]),
  );
  data.despesas.forEach((d) =>
    rows.push([
      "Despesa",
      d.nome,
      d.planejado.toFixed(2),
      d.realizado.toFixed(2),
      d.data || "",
      d.subtipo || d.tipo,
      d.realizado > 0 ? "Pago" : "Pendente",
    ]),
  );
  data.investimentos.forEach((i) => {
    if (i.tipo === "CDB" && i.aportes && i.aportes.length) {
      const cv = calcCDB(i);
      rows.push([
        "Investimento",
        i.nome,
        (cv ? cv.valorTotal : 0).toFixed(2),
        (cv ? cv.valorAtual : 0).toFixed(2),
        "",
        "CDB " + (i.percentualCDI || 100) + "% CDI",
        "",
      ]);
    } else {
      const t =
        (i.valor || 0) + (i.aportes || []).reduce((s, a) => s + a.valor, 0);
      rows.push([
        "Investimento",
        i.nome,
        t.toFixed(2),
        t.toFixed(2),
        "",
        i.tipo,
        "",
      ]);
    }
  });
  const csv = rows
    .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `financeos_${yr}-${String(mo + 1).padStart(2, "0")}.csv`;
  a.click();
  toast("CSV exportado!", "ok");
}
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = (ev) => {
    try {
      state = JSON.parse(ev.target.result);
      migrate();
      save();
      render();
      toast("Importado!", "ok");
    } catch {
      toast("Arquivo inválido", "err");
    }
  };
  r.readAsText(file);
  e.target.value = "";
}

// ─── TOAST ──────────────────────────────────────────────
function toast(msg, type = "ok") {
  document.getElementById("toastMsg").textContent = msg;
  document.getElementById("toastUndo").style.display = "none";
  const t = document.getElementById("toast");
  t.className = `toast ${type} show`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3000);
}
function toastUndo(msg) {
  document.getElementById("toastMsg").textContent = msg;
  document.getElementById("toastUndo").style.display = "";
  const t = document.getElementById("toast");
  t.className = "toast warn show";
  clearTimeout(t._t);
  t._t = setTimeout(() => {
    t.classList.remove("show");
    undoStack = [];
  }, 5000);
}

function toggleUtilMenu(e) {
  e.stopPropagation();
  document.getElementById("utilMenu").classList.toggle("open");
}
function closeUtilMenu() {
  document.getElementById("utilMenu").classList.remove("open");
}
document.addEventListener("click", () => closeUtilMenu());

function toggleHistPanel() {
  const panel = document.getElementById("histPanel");
  panel.classList.toggle("open");
  if (panel.classList.contains("open")) renderHistory();
}
function renderHistory() {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(yr, mo - i, 1),
      y = d.getFullYear(),
      m = d.getMonth();
    const k = `${y}-${String(m + 1).padStart(2, "0")}`;
    if (state[k]) {
      const md = state[k];
      const tRP = md.rendas.reduce((s, r) => s + r.planejado, 0);
      const tDP = md.despesas.reduce((s, d) => s + d.planejado, 0);
      months.push({
        label: MONTHS[m].slice(0, 3) + "/" + String(y).slice(2),
        tRP,
        tDP,
        sobra: md.saldoInicial + tRP - tDP,
      });
    }
  }
  const body = document.getElementById("histBody");
  if (!months.length) {
    body.innerHTML = `<div class="hist-empty">Sem dados históricos. Navegue por outros meses e adicione dados para ver o histórico aqui.</div>`;
    return;
  }
  const maxVal = Math.max(
    ...months.flatMap((m) => [m.tRP, m.tDP, Math.abs(m.sobra)]),
    1,
  );
  const bW = 26,
    gap = 5,
    gW = bW * 3 + gap * 2,
    padB = 32,
    padL = 60,
    padT = 10,
    cH = 190;
  const sH = (v) => Math.max(2, (v / maxVal) * (cH - padB - padT));
  const fmtK = (v) =>
    v >= 1000 ? (v / 1000).toFixed(1) + "k" : Math.round(v).toString();
  let bars = "",
    lbls = "",
    grid = "";
  for (let i = 0; i <= 4; i++) {
    const val = (maxVal * i) / 4,
      y = cH - padB - (val / maxVal) * (cH - padB - padT);
    grid += `<line x1="${padL}" y1="${y}" x2="${padL + months.length * (gW + 18) + 10}" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3"/>`;
    grid += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text3)">${fmtK(val)}</text>`;
  }
  months.forEach((m, idx) => {
    const x = padL + idx * (gW + 18) + 6,
      hRP = sH(m.tRP),
      hDP = sH(m.tDP),
      hSobra = sH(Math.abs(m.sobra));
    const sc = m.sobra >= 0 ? "var(--blue)" : "var(--yellow)";
    bars += `<rect x="${x}" y="${cH - padB - hRP}" width="${bW}" height="${hRP}" fill="var(--green)" rx="3" opacity=".85"><title>Renda: ${brl(m.tRP)}</title></rect>`;
    bars += `<rect x="${x + bW + gap}" y="${cH - padB - hDP}" width="${bW}" height="${hDP}" fill="var(--red)" rx="3" opacity=".85"><title>Despesas: ${brl(m.tDP)}</title></rect>`;
    bars += `<rect x="${x + bW * 2 + gap * 2}" y="${cH - padB - hSobra}" width="${bW}" height="${hSobra}" fill="${sc}" rx="3" opacity=".85"><title>Sobra: ${brl(m.sobra)}</title></rect>`;
    lbls += `<text x="${x + gW / 2}" y="${cH - padB + 18}" text-anchor="middle" font-size="10" fill="var(--text3)">${m.label}</text>`;
  });
  const svgW = padL + months.length * (gW + 18) + 16;
  body.innerHTML = `<div class="hist-legend"><div class="hist-leg-item"><div class="hist-leg-dot" style="background:var(--green)"></div>Renda</div><div class="hist-leg-item"><div class="hist-leg-dot" style="background:var(--red)"></div>Despesas</div><div class="hist-leg-item"><div class="hist-leg-dot" style="background:var(--blue)"></div>Sobra positiva</div><div class="hist-leg-item"><div class="hist-leg-dot" style="background:var(--yellow)"></div>Sobra negativa</div></div><div class="hist-chart"><svg width="${svgW}" height="${cH}" style="display:block;overflow:visible">${grid}${bars}${lbls}</svg></div>`;
}

// ─── AUTH UI ────────────────────────────────────────────
function renderAuthUI(user) {
  const headerRight = document.querySelector(".header-right");
  const existing = document.getElementById("authBtn");
  if (existing) existing.remove();

  const btn = document.createElement("div");
  btn.id = "authBtn";
  btn.style.cssText = "display:flex;align-items:center;gap:8px;margin-left:4px";
  btn.innerHTML = `
    <span style="font-size:12px;color:var(--text3)">${user.firstName || user.emailAddresses?.[0]?.emailAddress || ""}</span>
    <button class="btn-sm" onclick="signOut()" title="Sair">
      <i class="fa-solid fa-right-from-bracket"></i> Sair
    </button>`;
  headerRight.appendChild(btn);
}

function showLoginScreen() {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;">
      <div style="font-family:'Outfit',sans-serif;font-size:28px;font-weight:800;color:var(--text)">
        Finance<span style="color:var(--orange)">OS</span>
      </div>
      <div id="clerk-sign-in"></div>
    </div>`;
  window.Clerk.mountSignIn(document.getElementById("clerk-sign-in"));
}

async function signOut() {
  await window.Clerk.signOut();
  clerkToken = null;
  window.location.reload();
}

// ─── INIT ───────────────────────────────────────────────
async function initApp() {
  load();
  render();
  fetchCDI();

  await window.Clerk.load({
    localization: {
      locale: "pt-BR",
      signIn: {
        start: {
          title: "Entrar",
          subtitle: "para continuar no FinanceOS",
          actionText: "Não tem uma conta?",
          actionLink: "Criar conta",
        },
        password: {
          title: "Digite sua senha",
          actionLink: "Esqueci a senha",
        },
      },
      signUp: {
        start: {
          title: "Criar conta",
          subtitle: "para começar a usar o FinanceOS",
          actionText: "Já tem uma conta?",
          actionLink: "Entrar",
        },
      },
      userButton: {
        action__signOut: "Sair",
        action__manageAccount: "Gerenciar conta",
      },
      formFieldLabel__emailAddress: "E-mail",
      formFieldLabel__password: "Senha",
      formButtonPrimary: "Continuar",
      dividerText: "ou",
      socialButtonsBlockButton: "Continuar com {{provider|titleize}}",
      footerActionLink__useAnotherMethod: "Usar outro método",
    },
  });
  const user = window.Clerk.user;

  if (!user) {
    showLoginScreen();
    return;
  }

  clerkToken = await window.Clerk.session.getToken();
  authReady = true;
  renderAuthUI(user);

  const loaded = await loadFromAPI();
  if (loaded) {
    const local = localStorage.getItem("fos_v3");
    if (local) {
      const localData = JSON.parse(local);
      const serverKeys = Object.keys(state);
      const localKeys = Object.keys(localData);
      const newKeys = localKeys.filter(k => !serverKeys.includes(k));
      if (newKeys.length > 0) {
        newKeys.forEach(k => { state[k] = localData[k]; });
        await syncToAPI();
      }
    }
    render();
  } else if (Object.keys(state).length > 0) {
    toast("Migrando dados locais para a nuvem...", "ok");
    await syncToAPI();
  }

  setInterval(async () => {
    if (window.Clerk.session) {
      clerkToken = await window.Clerk.session.getToken();
    }
  }, 55000);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  if (e.key === "Enter" && modalCtx) {
    e.preventDefault();
    saveModal();
  }
  if (!modalCtx) {
    if (e.key === "ArrowLeft") prevMonth();
    if (e.key === "ArrowRight") nextMonth();
  }
});

// Aguarda Clerk carregar antes de iniciar
window.addEventListener("load", () => {
  if (window.Clerk) {
    initApp();
  } else {
    document.addEventListener("clerk:ready", initApp);
  }
});
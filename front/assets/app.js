/* Vagabs — telas principais
   Rotas: #/hoje, #/triagem, #/candidaturas, #/vaga/<id>, #/empresas, #/base, #/pedidos, #/varreduras,
   e as de extras.js (#/claude, #/config) e setup.js (#/setup).
   Dados: api/c/<colecao> (GET lê, PUT grava e devolve a coleção mesclada por item). Eventos ao vivo em api/eventos. */
(() => {
  "use strict";

  const COLECOES = ["vagas", "empresas", "feitos", "perfil", "preferencias", "sigilo", "pedidos", "varreduras", "config"];
  const db = {};
  const app = document.getElementById("app");
  const DIA = 86400000;
  const VG = (window.VG = { db, telas: {}, ligar: {}, titulos: {}, estado: {} });

  /* ---------- utilitários ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const data = (s) => { const [a, m, d] = String(s || "").slice(0, 10).split("-").map(Number); return a ? new Date(a, m - 1, d) : hoje(); };
  const dias = (de, ate = hoje()) => Math.round((ate - data(de)) / DIA);
  const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const p2 = (n) => String(n).padStart(2, "0");
  const dm = (s) => { const d = data(s); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`; };
  const mil = (n) => Number(n || 0).toLocaleString("pt-BR");
  const agoraTxt = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const hojeTxt = () => agoraTxt().slice(0, 10);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lista = (a) => (Array.isArray(a) ? a : a ? [a] : []);

  const ICONES = {
    hoje: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
    triagem: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    candidaturas: '<path d="M4 6h9M4 12h14M4 18h6"/><circle cx="17" cy="6" r="2"/><circle cx="20" cy="18" r="2"/>',
    empresas: '<path d="M4 21V6l8-3v18M12 9h8v12M3 21h18M8 8v.01M8 12v.01M8 16v.01M16 13v.01M16 17v.01"/>',
    base: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.7-6 8-6s6.5 2 8 6"/>',
    pedidos: '<path d="M4 5h16v11H9l-5 4z"/>',
    claude: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    atualizar: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    check: '<path d="M5 12.5 10 17.5 19 7"/>',
    alerta: '<path d="M12 3 2 20h20zM12 10v4M12 17v.01"/>',
    virar: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/>',
    externo: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    enviar: '<path d="M4 12 20 4l-6 16-3-7z"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    versao: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8"/>',
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    parar: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    sobe: '<path d="m6 15 6-6 6 6"/>',
    desce: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    arquivo: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
  };
  const ic = (n, extra = "") => `<svg class="svg ${extra}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[n] || ""}</svg>`;

  /* estado da vaga -> código de cor e rótulo */
  const ESTADOS = {
    nova: ["nova", "Para triar"], depois: ["agu", "Para depois"], aprovada: ["vez", "Aprovada, kit na fila"],
    kit: ["vez", "Sua vez: kit pronto"], enviada: ["agu", "Aguardando a empresa"], processo: ["proc", "Em processo"],
    proposta: ["prop", "Proposta"], encerrada: ["enc", "Encerrada"], reprovada: ["enc", "Reprovada"],
  };
  const ETAPA = { nova: "Para triar", processo: "Em processo", aprovada: "Aprovada", kit: "Kit pronto", enviada: "Enviada", triagem: "Triagem do RH", case: "Case ou teste", entrevista: "Entrevista", proposta: "Proposta", encerrada: "Encerrada", reprovada: "Reprovada", depois: "Para depois" };
  const COR_ETAPA = { processo: "proc", aprovada: "vez", kit: "vez", enviada: "agu", triagem: "proc", case: "proc", entrevista: "proc", proposta: "prop" };
  const ATIVAS = ["aprovada", "kit", "enviada", "processo", "proposta"];
  const pilula = (estado) => { const [c, r] = ESTADOS[estado] || ["agu", estado]; return `<span class="pilula ${c}">${esc(r)}</span>`; };
  const seloExemplo = (v) => (v?.exemplo ? `<span class="selo-exemplo" title="Vaga de exemplo, criada para o tutorial">Exemplo</span>` : "");

  /* ---------- chamadas ao app ---------- */
  async function api(caminho, { metodo = "GET", corpo, cabecalhos } = {}) {
    const r = await fetch(`api/${caminho}`, { method: metodo, headers: corpo !== undefined && !(corpo instanceof Blob) ? { "Content-Type": "application/json", ...cabecalhos } : cabecalhos, body: corpo === undefined ? undefined : corpo instanceof Blob ? corpo : JSON.stringify(corpo), cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || `erro ${r.status}`);
    return j;
  }

  /* ---------- dados ---------- */
  // sincronia: cada item carrega "mod" (hora UTC da última mudança); o app mescla e vale o mais novo
  const CHAVE = { varreduras: "data" };
  const OBJETOS = ["perfil", "preferencias", "sigilo", "config"];
  const espelho = {};
  const agoraUtc = () => new Date().toISOString().slice(0, 19) + "Z";
  const chaveDe = (c, i) => i && i[CHAVE[c] || "id"];
  function fotografar(c) { espelho[c] = Array.isArray(db[c]) ? new Map(db[c].map((i) => [chaveDe(c, i), JSON.stringify(i)])) : JSON.stringify(db[c]); }
  function carimbar(c) {
    if (!Array.isArray(db[c])) return;
    const m = espelho[c] instanceof Map ? espelho[c] : new Map();
    db[c].forEach((i) => { const k = chaveDe(c, i); if (k != null && m.get(k) !== JSON.stringify(i)) i.mod = agoraUtc(); });
  }
  // traz a versão do disco sem trocar os objetos que as telas já seguram
  function absorver(c, dados) {
    if (!Array.isArray(dados) || !Array.isArray(db[c])) { db[c] = dados; fotografar(c); return; }
    const atuais = new Map(db[c].map((i) => [chaveDe(c, i), i]));
    db[c].length = 0;
    dados.forEach((novo) => {
      const velho = atuais.get(chaveDe(c, novo));
      if (velho && typeof velho === "object") { Object.keys(velho).forEach((k) => { if (!(k in novo)) delete velho[k]; }); db[c].push(Object.assign(velho, novo)); }
      else db[c].push(novo);
    });
    fotografar(c);
  }
  async function carregar(so = COLECOES) {
    if (!VG.estado.pasta) so = []; // sem pasta ainda (começo do setup): coleções vazias
    await Promise.all(so.map(async (c) => {
      try { const d = await api(`c/${c}`); if (c in db) absorver(c, d); else { db[c] = d; fotografar(c); } }
      catch { if (!(c in db)) db[c] = OBJETOS.includes(c) ? {} : []; }
    }));
    OBJETOS.forEach((c) => { if (!db[c] || Array.isArray(db[c])) db[c] = {}; });
    COLECOES.forEach((c) => { if (!(c in db)) { db[c] = OBJETOS.includes(c) ? {} : []; fotografar(c); } });
  }
  let toastT;
  function toast(msg) { if (!msg) return; const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2800); }
  async function salvar(colecao, msg = "Salvo") {
    try {
      carimbar(colecao);
      const resp = await api(`c/${colecao}`, { metodo: "PUT", corpo: db[colecao] });
      if (resp && "dados" in resp) absorver(colecao, resp.dados);
      if (msg) toast(msg);
    } catch (e) { toast(`Não consegui salvar: ${e.message}`); }
  }
  const vaga = (id) => db.vagas.find((v) => v.id === id);
  const reais = () => db.vagas.filter((v) => !v.exemplo);
  const etapasPassadas = (v) => (v.etapas || []).filter((e) => data(e.data) <= hoje());
  const ultimaEtapa = (v) => etapasPassadas(v).at(-1);
  const temEtapa = (v, t) => (v.etapas || []).some((e) => e.tipo === t && data(e.data) <= hoje());
  // conta só o que segue de pé: vaga que voltou para a triagem não conta como aprovada
  const passou = (v, t) => temEtapa(v, t) && !["nova", "depois"].includes(v.estado);

  function contagens() {
    const V = reais();
    return {
      novas: db.vagas.filter((v) => v.estado === "nova").length,
      kits: db.vagas.filter((v) => v.estado === "kit").length,
      pedidosResp: db.pedidos.filter((p) => (p.status === "respondido" && !p.lido) || p.status === "revisao" || (p.status === "erro" && !p.lido)).length,
      naFila: db.pedidos.filter((p) => p.status === "fila").length,
      captadas: db.varreduras.reduce((s, x) => s + (x.lidas || 0), 0),
      bloqueadas: db.varreduras.reduce((s, x) => s + (x.bloqueadas || 0), 0),
      paraVoce: V.length,
      aprovadas: V.filter((v) => passou(v, "aprovada") || ["processo", "proposta"].includes(v.estado)).length,
      enviadas: V.filter((v) => passou(v, "enviada") || ["processo", "proposta"].includes(v.estado)).length,
      processo: V.filter((v) => v.estado === "processo" || v.estado === "proposta").length,
      propostas: V.filter((v) => v.estado === "proposta").length,
    };
  }

  /* ---------- casca ---------- */
  const NAV = [["hoje", "Hoje"], ["triagem", "Triagem"], ["candidaturas", "Candidaturas"], ["empresas", "Empresas"], ["base", "Base"], ["pedidos", "Pedidos"], ["claude", "Claude"]];
  function desenharNav(rota) {
    const c = contagens();
    const cont = {
      triagem: c.novas ? `<span class="cont nova" aria-label="${c.novas} para triar">${c.novas}</span>` : "",
      pedidos: c.pedidosResp ? `<span class="cont vez" aria-label="${c.pedidosResp} respostas novas">${c.pedidosResp}</span>` : "",
    };
    document.getElementById("nav").innerHTML = NAV.map(([id, rot]) =>
      `<a href="#/${id}" data-nav="${id}" class="${rota === id ? "on" : ""}" ${rota === id ? 'aria-current="page"' : ""}>${ic(id)}<span>${rot}</span>${cont[id] || ""}</a>`).join("");
    const ult = db.varreduras[0];
    const b = document.getElementById("carimbo");
    if (ult) { const [d, h] = String(ult.data).split(" "); b.innerHTML = `${ic("atualizar")}<span class="carimbo">Varredura ${d === hojeTxt() ? "hoje" : dm(d)}${h ? `, ${h}` : ""}</span>`; }
    else b.innerHTML = `${ic("atualizar")}<span class="carimbo">Sem varredura</span>`;
    b.onclick = () => (location.hash = "#/varreduras");
    const nome = String(db.perfil?.nome || "").trim().split(/\s+/);
    document.getElementById("avatar").innerHTML = nome[0] ? esc((nome[0][0] + (nome.length > 1 ? nome.at(-1)[0] : "")).toUpperCase()) : ic("config");
    VG.desenharTrabalho?.();
  }

  /* ---------- trilhas (acompanhamento das candidaturas) ---------- */
  function dominio(lst) {
    const ini = Math.min(...lst.map((v) => data(v.etapas[0].data).getTime())) - 3 * DIA;
    const fimDados = Math.max(...lst.flatMap((v) => v.etapas.map((e) => data(e.data).getTime())), hoje().getTime());
    return [ini, Math.max(fimDados + 5 * DIA, hoje().getTime() + 12 * DIA)];
  }
  function trilhas(lst, { eixo = true } = {}) {
    if (!lst.length) return `<div class="vazio">Nenhuma candidatura em andamento. Aprove uma vaga na triagem para começar.</div>`;
    const [ini, fim] = dominio(lst);
    const pos = (t) => ((t - ini) / (fim - ini)) * 100;
    const h = hoje().getTime();
    const semanas = [];
    const primeiraSeg = new Date(ini); primeiraSeg.setDate(primeiraSeg.getDate() + ((8 - primeiraSeg.getDay()) % 7));
    for (let t = primeiraSeg.getTime(); t < fim; t += 7 * DIA) semanas.push(t);
    const linhaSemanas = semanas.map((t) => `<i class="grade-sem" style="left:${pos(t)}%"></i>`).join("");
    const cab = eixo ? `<div class="trilha-eixo" aria-hidden="true"><span></span><div class="eixo">${semanas.filter((t) => Math.abs(t - h) > 2.5 * DIA).map((t) => { const d = new Date(t); return `<span style="left:${pos(t)}%">${p2(d.getDate())}/${p2(d.getMonth() + 1)}</span>`; }).join("")}<span style="left:${pos(h)}%;color:var(--ink);font-weight:700">hoje</span></div><span></span></div>` : "";
    const linhas = lst.map((v) => {
      const passadas = etapasPassadas(v);
      const futuras = (v.etapas || []).filter((e) => data(e.data) > hoje());
      let segs = "", marcos = "";
      passadas.forEach((e, i) => {
        const a = data(e.data).getTime();
        const b = i + 1 < passadas.length ? data(passadas[i + 1].data).getTime() : h;
        if (b > a) segs += `<i class="seg ${COR_ETAPA[e.tipo] || "agu"} cresce" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%;animation-delay:${i * 90}ms" title="${esc(ETAPA[e.tipo] || e.tipo)} · ${dm(e.data)}"></i>`;
      });
      const atual = passadas.at(-1);
      if (atual) marcos += `<span class="marco atual" style="left:${pos(data(atual.data).getTime())}%"><b>${esc(ETAPA[atual.tipo] || atual.tipo)}</b> · ${dm(atual.data)}</span>`;
      futuras.forEach((e) => {
        const b = data(e.data).getTime();
        segs += `<i class="seg futuro" style="left:${pos(h)}%;width:${pos(b) - pos(h)}%" title="${esc(e.nota || ETAPA[e.tipo])}"></i>`;
        marcos += `<span class="marco fut" style="left:${pos(b)}%;transform:translateX(-100%)"><b>${esc(ETAPA[e.tipo] || e.tipo)}</b> · ${dm(e.data)}</span>`;
      });
      const corAtual = atual ? COR_ETAPA[atual.tipo] || "agu" : "agu";
      let n = "—", sub = "";
      const env = (v.etapas || []).find((e) => e.tipo === "enviada") || (v.etapas || [])[0];
      if (v.estado === "kit" || v.estado === "aprovada") { n = `${dias(atual?.data)} d`; sub = v.estado === "kit" ? "falta enviar" : "kit na fila"; }
      else if (v.estado === "enviada") { n = `${dias(env.data)} d`; sub = "aguardando"; }
      else if (futuras.length) { n = `${dias(env.data)} d`; sub = "no processo"; }
      else { n = `${dias(atual?.data)} d`; sub = { case: "desde o teste", triagem: "desde a triagem", entrevista: "desde a entrevista" }[atual?.tipo] || "sem movimento"; }
      return `<a class="trilha" href="#/vaga/${v.id}">
        <span class="quem"><span class="empresa">${esc(v.empresa)}</span><span class="cargo">${esc(v.cargo)}</span></span>
        <span class="pista">${linhaSemanas}<i class="hoje" style="left:${pos(h)}%"></i>${segs}<i class="ponto ${corAtual}" style="left:${pos(h)}%"></i>${marcos}</span>
        <span class="dias">${n}<small>${esc(sub)}</small></span></a>`;
    }).join("");
    return `<div class="trilhas">${cab}${linhas}</div>`;
  }
  const HACHURA = "repeating-linear-gradient(135deg,var(--proc-bg) 0 5px,#fff 5px 9px)";
  const legendaTrilhas = `<div class="legenda"><span><i style="background:var(--vez)"></i>Sua vez</span><span><i style="background:var(--agu)"></i>Aguardando a empresa</span><span><i style="background:var(--proc)"></i>Em processo</span><span><i style="background:${HACHURA};box-shadow:inset 0 0 0 1.5px var(--proc)"></i>Agendado</span></div>`;

  /* ---------- lista de vagas para triar ---------- */
  function linhaVaga(v, primeira) {
    const risco = v.alertas && v.alertas.length;
    return `<div class="vaga">
      <span class="dot ${risco ? "risco" : ""}" aria-hidden="true"></span>
      <div style="min-width:0">
        <div class="linha1"><span class="empresa">${esc(v.empresa)}</span>${seloExemplo(v)}<span class="cargo">${esc(v.cargo)}</span></div>
        <div class="linha2"><span>${esc(v.local || "Local a confirmar")}${v.modelo ? `, ${esc(String(v.modelo).toLowerCase())}` : ""}</span><span class="etiqueta ${v.contrato === "PJ" ? "pj" : ""}">${esc(v.contrato || "Contrato a confirmar")}</span><span>${esc(v.fonte)} · ${dias(v.captada) === 0 ? "hoje" : `há ${plural(dias(v.captada), "dia", "dias")}`}</span></div>
        ${risco ? `<div class="alerta">${ic("cadeado")}<span>${esc(v.alertas[0])}</span></div>` : ""}
      </div>
      <div class="aderencia"><b>${v.nota ?? "—"}</b><span class="barrinha"><i style="width:${v.nota || 0}%"></i></span><small>aderência</small></div>
      <a class="btn ${primeira ? "p" : ""} acao" href="#/triagem/${v.id}">Triar ${ic("seta")}</a>
    </div>`;
  }

  /* ---------- funil 3D ---------- */
  function funil(c) {
    const camadas = [["Captadas", c.captadas, "#c9ced6"], ["Para você", c.paraVoce, "var(--nova)"], ["Aprovadas", c.aprovadas, "var(--vez)"], ["Enviadas", c.enviadas, "var(--agu)"], ["Em processo", c.processo, "var(--proc)"], ["Propostas", c.propostas, "var(--prop)"]];
    const pilha = camadas.map(([, n, cor], i) => {
      const lado = 148 - i * 20, vazio = n === 0;
      return `<i class="camada" data-i="${i}" style="width:${lado}px;height:${lado}px;margin:${-lado / 2}px 0 0 ${-lado / 2}px;background:${vazio ? "rgba(255,255,255,.4)" : cor};${vazio ? "outline:2px dashed var(--prop);outline-offset:-2px;" : ""}transform:translateZ(0px)"></i>`;
    }).join("");
    const leg = camadas.map(([r, n, cor], i) => `<button type="button" data-i="${i}"><i style="background:${n === 0 ? "transparent;outline:2px dashed var(--prop);outline-offset:-2px" : cor}"></i><span>${r}</span><b>${mil(n)}</b></button>`).join("");
    return `<div class="funil"><div class="funil-cena" aria-hidden="true"><div class="funil-pilha">${pilha}</div></div><div class="funil-legenda">${leg}</div></div>`;
  }
  function animarFunil(raiz) {
    const cena = raiz.querySelector(".funil-cena"); if (!cena) return;
    const pilha = cena.querySelector(".funil-pilha");
    const cams = [...pilha.querySelectorAll(".camada")];
    const subir = (alvo) => cams.forEach((cm) => { const i = +cm.dataset.i; cm.style.transform = `translateZ(calc(${i * 24}px + ${alvo === i ? 26 : 0}px))`; cm.classList.toggle("on", alvo === i); });
    requestAnimationFrame(() => setTimeout(() => subir(-1), reduzido ? 0 : 120));
    if (!reduzido) {
      cena.addEventListener("pointermove", (e) => { const r = cena.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; pilha.style.setProperty("--rz", `${-38 + x * 26}deg`); pilha.style.setProperty("--rx", `${58 - y * 16}deg`); });
      cena.addEventListener("pointerleave", () => { pilha.style.removeProperty("--rz"); pilha.style.removeProperty("--rx"); });
    }
    raiz.querySelectorAll(".funil-legenda button").forEach((b) => {
      const i = +b.dataset.i;
      b.addEventListener("mouseenter", () => { subir(i); b.classList.add("on"); });
      b.addEventListener("mouseleave", () => { subir(-1); b.classList.remove("on"); });
      b.addEventListener("focus", () => subir(i)); b.addEventListener("blur", () => subir(-1));
      b.addEventListener("click", () => (location.hash = i <= 1 ? "#/varreduras" : "#/candidaturas"));
    });
  }

  /* ---------- pedidos ao Claude: fila (roda só no botão) ---------- */
  const ST_PEDIDO = {
    fila: ["nova", "Na fila"], processando: ["agu", "Claude trabalhando"], revisao: ["vez", "Para você revisar"],
    respondido: ["proc", "Respondido"], aplicado: ["proc", "Aplicado"], descartado: ["enc", "Descartado"], erro: ["risco", "Não terminou"],
  };
  const MSG_FILA = "Na fila. Clique em Rodar fila quando quiser.";
  function novoPedido({ onde, alvo = null, tipo = "pedido", texto }) {
    const n = db.pedidos.reduce((m, p) => Math.max(m, parseInt(String(p.id).slice(1), 10) || 0), 0) + 1;
    const p = { id: `p${p2(n)}`, tipo, onde, alvo, texto, status: "fila", criado: agoraTxt(), resposta: null };
    db.pedidos.unshift(p);
    return p;
  }
  const mesmoAlvo = (a, b) => a && b && a.col === b.col && (a.id ?? null) === (b.id ?? null) && JSON.stringify(a.campo) === JSON.stringify(b.campo);
  function gravarAlvo(alvo, valor) {
    let o = alvo.id != null ? db[alvo.col].find((x) => x.id === alvo.id) : db[alvo.col];
    alvo.campo.slice(0, -1).forEach((k) => { o = typeof k === "object" ? o.find((x) => x.id === k.id) : o[k]; });
    o[alvo.campo.at(-1)] = valor;
  }
  function campoPedido(onde, placeholder = "Pedir algo ao Claude…", alvo = null) {
    const versao = alvo ? `<button class="btn" type="button" data-versao title="O Claude escreve uma versão final; você aprova ou edita">${ic("versao")}Pedir uma versão</button>` : "";
    return `<form class="campo-pedido" data-onde='${esc(JSON.stringify(onde))}' ${alvo ? `data-alvo='${esc(JSON.stringify(alvo))}'` : ""}><input name="t" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off"><button class="btn" type="submit">${ic("enviar")}Pôr na fila</button>${versao}</form>`;
  }
  function blocoVersao(alvo) {
    const ps = db.pedidos.filter((p) => p.tipo === "versao" && mesmoAlvo(p.alvo, alvo) && ["fila", "processando", "revisao"].includes(p.status));
    return ps.map((p) => p.status === "revisao"
      ? `<div class="versao" data-pedido="${p.id}"><div class="versao-cab"><b>${ic("versao")}Versão do Claude</b><span class="pilula vez">Para você revisar</span></div>
          <textarea aria-label="Versão sugerida pelo Claude">${esc(p.versao || "")}</textarea>
          ${p.resposta ? `<p class="meta">${esc(p.resposta)}</p>` : ""}
          <div class="versao-acoes"><button class="btn ok" type="button" data-usar>${ic("check")}Usar esta versão</button><button class="btn" type="button" data-descartar>Descartar</button></div></div>`
      : `<p class="versao-espera">${ic("relogio")}Versão pedida ao Claude · ${ST_PEDIDO[p.status][1].toLowerCase()}${p.status === "fila" ? ` desde ${p.criado.slice(11)}` : ""}</p>`).join("");
  }
  function ligarPedidos(raiz) {
    raiz.querySelectorAll("form.campo-pedido[data-onde]").forEach((f) => {
      const onde = JSON.parse(f.dataset.onde);
      const alvo = f.dataset.alvo ? JSON.parse(f.dataset.alvo) : null;
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const t = f.t.value.trim(); if (!t) { f.t.focus(); return; }
        novoPedido({ onde, alvo, texto: t });
        f.reset(); salvar("pedidos", MSG_FILA); render(true);
      });
      f.querySelector("[data-versao]")?.addEventListener("click", () => {
        if (db.pedidos.some((p) => p.tipo === "versao" && mesmoAlvo(p.alvo, alvo) && ["fila", "processando", "revisao"].includes(p.status))) return toast("Já existe uma versão pedida para isto");
        novoPedido({ onde, alvo, tipo: "versao", texto: f.t.value.trim() || "Escrever uma versão final deste texto." });
        f.reset(); salvar("pedidos", `Versão pedida. ${MSG_FILA}`); render(true);
      });
    });
    raiz.querySelectorAll(".versao[data-pedido]").forEach((box) => {
      const p = db.pedidos.find((x) => x.id === box.dataset.pedido);
      box.querySelector("[data-usar]").addEventListener("click", async () => {
        gravarAlvo(p.alvo, box.querySelector("textarea").value);
        p.status = "aplicado"; p.aplicado = agoraTxt();
        await salvar(p.alvo.col, ""); await salvar("pedidos", "Versão aplicada"); render(true);
      });
      box.querySelector("[data-descartar]").addEventListener("click", () => { p.status = "descartado"; salvar("pedidos", "Versão descartada"); render(true); });
    });
  }
  function itemPedido(p, { controles = false, pos = 0, total = 0 } = {}) {
    const st = ST_PEDIDO[p.status] || ["agu", p.status];
    const rotas = { vaga: `#/vaga/${p.onde?.id}`, feito: "#/base/feitos", empresa: "#/empresas", empresas: "#/empresas", base: "#/base" };
    const onde = p.onde && p.onde.tipo !== "geral" ? `<a class="btn txt" href="${rotas[p.onde.tipo] || "#/pedidos"}">${esc(p.onde.rotulo || p.onde.id)}</a>` : "<span>Geral</span>";
    const tipo = p.tipo === "versao" ? `<span class="etiqueta">${ic("versao")}Versão</span>` : p.tipo === "kit" ? `<span class="etiqueta">Kit</span>` : "";
    const quando = String(p.respondido || p.criado || "");
    const revisar = p.tipo === "versao" && p.status === "revisao" ? blocoVersao(p.alvo) : "";
    const ctl = controles && p.status === "fila" ? `<span class="ctl-fila"><button class="btn txt" type="button" data-mover="${p.id}" data-dir="-1" ${pos === 0 ? "disabled" : ""} aria-label="Subir na fila">${ic("sobe")}</button><button class="btn txt" type="button" data-mover="${p.id}" data-dir="1" ${pos === total - 1 ? "disabled" : ""} aria-label="Descer na fila">${ic("desce")}</button><button class="btn txt nao" type="button" data-tirar="${p.id}">Tirar da fila</button></span>`
      : controles && p.status === "erro" ? `<span class="ctl-fila"><button class="btn txt" type="button" data-repor="${p.id}">${ic("atualizar")}Pôr de novo na fila</button></span>` : "";
    return `<div class="pedido ${p.status}"><div class="q">${esc(p.texto)}</div>${p.resposta && !revisar ? `<div class="r">${esc(p.resposta)}</div>` : ""}${revisar}<div class="meta"><span class="pilula ${st[0]}">${st[1]}</span>${tipo}${onde}<span>${esc(quando.slice(8, 10) + "/" + quando.slice(5, 7) + ", " + quando.slice(11))}</span>${ctl}</div></div>`;
  }

  /* ---------- tela: Hoje ---------- */
  function telaHoje() {
    const c = contagens();
    const ativas = db.vagas.filter((v) => ATIVAS.includes(v.estado) && (v.etapas || []).length).sort((a, b) => ATIVAS.indexOf(b.estado) - ATIVAS.indexOf(a.estado) || data(a.etapas[0].data) - data(b.etapas[0].data));
    const novas = db.vagas.filter((v) => v.estado === "nova").sort((a, b) => (b.nota || 0) - (a.nota || 0));
    const d = hoje();
    // frase do dia: o fato mais importante primeiro
    const partes = [];
    const ev = db.vagas.filter((v) => v.proxima?.hora && dias(v.proxima.data) <= 0 && dias(v.proxima.data) > -8).sort((a, b) => data(a.proxima.data) - data(b.proxima.data))[0];
    if (ev) { const de = data(ev.proxima.data); partes.push(`<b>${esc(String(ev.proxima.texto).split(",")[0])} com ${esc(ev.empresa)} na ${SEMANA_LONGA[de.getDay()]}, ${dm(ev.proxima.data)}, às ${esc(String(ev.proxima.hora).replace(":00", "h"))}.</b>`); }
    const kits = db.vagas.filter((v) => v.estado === "kit");
    if (kits.length) partes.push(`O kit ${kits.length === 1 ? `da ${esc(kits[0].empresa)} está pronto` : `de ${kits.length} vagas está pronto`}`);
    const comAlerta = novas.filter((v) => v.alertas && v.alertas.length).length;
    if (novas.length) partes.push(`${plural(novas.length, "vaga espera", "vagas esperam")} triagem${comAlerta ? `, ${comAlerta} com alerta de sigilo` : ""}.`);
    if (c.naFila) partes.push(`${plural(c.naFila, "pedido espera", "pedidos esperam")} na fila do Claude.`);
    const frase = partes.length > 1 ? `${partes[0]} ${partes.slice(1).join(" E ")}` : partes[0] || "Nada urgente hoje. Até vagabs merece um respiro.";

    const acoes = [];
    novas.length && acoes.push({ data: hojeTxt(), t: `Triar ${plural(novas.length, "vaga", "vagas")}`, m: `${novas[0].empresa} lidera com aderência ${novas[0].nota}`, href: "#/triagem" });
    c.naFila && acoes.push({ data: hojeTxt(), t: `Rodar a fila (${c.naFila})`, m: "O Claude faz um pedido de cada vez", href: "#/pedidos" });
    kits.forEach((v) => acoes.push({ data: hojeTxt(), t: `Enviar kit · ${v.empresa}`, m: `Kit pronto${ultimaEtapa(v) ? ` desde ${dm(ultimaEtapa(v).data)}` : ""}`, href: `#/vaga/${v.id}` }));
    db.vagas.filter((v) => v.proxima && dias(v.proxima.data) <= 0).forEach((v) => acoes.push({ data: v.proxima.data, t: `${String(v.proxima.texto).split(" (")[0]} · ${v.empresa}`, m: v.proxima.hora ? `${String(v.proxima.hora).replace(":00", "h")} · preparação no kit` : "", href: `#/vaga/${v.id}` }));
    acoes.sort((a, b) => data(a.data) - data(b.data));

    const conf = db.feitos.filter((f) => f.confirmado).length;
    const comeco = [
      { ok: !!db.config.setup?.concluido, t: "Setup", m: "Seu perfil e o que você busca", href: "#/base" },
      { ok: db.feitos.length > 0 && conf === db.feitos.length, t: "Revisar os feitos", m: db.feitos.length ? `${conf} de ${db.feitos.length} confirmados` : "Anexe o CV na Base para o Claude montar", href: "#/base/feitos" },
      { ok: db.empresas.filter((e) => e.prioridade !== "bloqueio").length >= 5, t: "Empresas-alvo", m: `${db.empresas.filter((e) => e.prioridade !== "bloqueio").length} na lista`, href: "#/empresas" },
      { ok: db.varreduras.length > 0, t: "Primeira varredura", m: db.varreduras.length ? "Feita" : "Busca vagas nas fontes", href: "#/varreduras" },
      { ok: !!db.config.tutorial?.concluido, t: "Tutorial", m: "Aprenda a usar com a vaga de exemplo", href: "#/hoje", tut: true },
    ];
    const prox = comeco.find((s) => !s.ok);
    return `<section class="tela entra">
      <div class="titulo"><div><h1>Hoje<small>${SEMANA_LONGA[d.getDay()]}, ${d.getDate()} de ${MES[d.getMonth()]}</small></h1><p class="frase">${frase}</p></div></div>
      <div class="grade">
        <div class="coluna">
          <section class="painel" data-tut="andamento"><div class="cab"><h2>Candidaturas em andamento</h2><span class="meta">${plural(ativas.length, "processo", "processos")} · o comprimento é o tempo real em cada etapa</span></div>${trilhas(ativas)}<div style="margin-top:14px">${legendaTrilhas}</div></section>
          <section class="painel" data-tut="triar"><div class="cab"><h2>Para triar</h2><span class="meta">${novas.length} esperando · ${mil(c.captadas)} lidas nas varreduras · <a href="#/varreduras">ver varreduras</a></span></div>
            <div class="vagas">${novas.length ? novas.map((v, i) => linhaVaga(v, i === 0)).join("") : `<div class="vazio">Nada para triar. Rode uma varredura para trazer vagas novas.</div>`}</div></section>
          ${prox ? `<section class="painel"><div class="cab"><h2>Comece por aqui</h2><span class="meta">${comeco.filter((s) => s.ok).length} de ${comeco.length}</span></div>
            <ol class="faixa-intro comeco">${comeco.map((s) => `<li class="${s.ok ? "concluido" : ""} ${s === prox ? "prox" : ""}"><a href="${s.href}" ${s.tut ? "data-tutorial-abrir" : ""}><span class="check">${ic("check")}</span><span><b>${esc(s.t)}</b><small>${esc(s.m)}</small></span></a></li>`).join("")}</ol></section>` : ""}
        </div>
        <div class="coluna lateral-hoje">
          <section class="painel"><div class="cab"><h2>Panorama da busca</h2><span class="meta">${db.varreduras.length ? `desde ${dm(db.varreduras.at(-1).data)}` : "sem varreduras ainda"}</span></div>${funil(c)}</section>
          <section class="painel"><div class="cab"><h2>Próximas ações</h2></div><div class="agenda">${acoes.slice(0, 5).map((a) => { const dd = data(a.data); return `<a class="ag" href="${a.href}"><span class="dia">${dd.getDate()}<small>${dias(a.data) === 0 ? "hoje" : SEMANA[dd.getDay()]}</small></span><span><b>${esc(a.t)}</b><span class="meta" style="display:block">${esc(a.m)}</span></span></a>`; }).join("") || `<div class="vazio">Nada agendado.</div>`}</div></section>
          <section class="painel" data-tut="pedir"><div class="cab"><h2>Pedidos ao Claude</h2><a class="meta" href="#/pedidos">ver todos</a></div><div>${db.pedidos.slice(0, 3).map((p) => itemPedido(p)).join("") || `<p class="meta">Peça qualquer coisa: entra na fila e o Claude faz quando você rodar.</p>`}</div>${campoPedido({ tipo: "geral" })}</section>
        </div>
      </div></section>`;
  }

  /* ---------- tela: Triagem ---------- */
  let triSel = null, virado = false, confirmarAlerta = false;
  const MOTIVOS_REPROVA = ["Senioridade alta", "Senioridade baixa", "Exige formação ou curso que não tenho", "Exige experiência em setor que não tenho", "Salário baixo", "Contrato", "Presencial demais", "Longe", "Empresa não me interessa", "Sigilo"];
  function telaTriagem(id) {
    const fila = db.vagas.filter((v) => v.estado === "nova").sort((a, b) => (b.nota || 0) - (a.nota || 0)).concat(db.vagas.filter((v) => v.estado === "depois"));
    if (id && fila.some((v) => v.id === id)) triSel = id;
    if (!fila.some((v) => v.id === triSel)) { triSel = fila[0]?.id || null; virado = false; }
    const v = triSel && vaga(triSel);
    const aprov = db.vagas.filter((x) => passou(x, "aprovada")).length;
    const repr = db.vagas.filter((x) => x.estado === "reprovada").length;
    const dep = db.vagas.filter((x) => x.estado === "depois").length;
    const pilhas = `<div class="pilhas"><div class="pilha" id="p-aprovada"><b>${aprov}</b><span class="meta">Aprovadas</span></div><div class="pilha" id="p-depois"><b>${dep}</b><span class="meta">Para depois</span></div><div class="pilha" id="p-reprovada"><b>${repr}</b><span class="meta">Reprovadas</span></div></div>`;
    if (!v) return `<section class="tela entra"><div class="titulo"><div><h1>Triagem</h1><p class="frase">Nada para triar agora. Uma varredura traz vagas novas.</p></div></div><div class="painel" style="max-width:640px">${pilhas}<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><a class="btn" href="#/varreduras">${ic("atualizar")}Ir para as varreduras</a><a class="btn" href="#/candidaturas">Ver candidaturas ${ic("seta")}</a></div></div></section>`;
    const dims = Object.entries(v.dimensoes || {});
    const risco = v.alertas && v.alertas.length;
    const S = db.sigilo || {};
    return `<section class="tela entra">
      <div class="titulo"><div><h1>Triagem<small>${plural(fila.length, "vaga na fila", "vagas na fila")}</small></h1><p class="frase">Aprove o que vale um kit. Reprovar pede um motivo, que ajusta as próximas notas.</p></div><span class="meta atalhos">Atalhos: <kbd>A</kbd> aprovar · <kbd>R</kbd> reprovar · <kbd>D</kbd> depois · <kbd>V</kbd> virar · <kbd>J</kbd>/<kbd>K</kbd> navegar</span></div>
      <div class="triagem">
        <div class="fila" role="listbox" aria-label="Fila de triagem">${fila.map((x) => `<button type="button" role="option" aria-selected="${x.id === v.id}" class="${x.id === v.id ? "sel" : ""}" data-id="${x.id}"><span class="empresa">${esc(x.empresa)}</span><span class="cargo">${esc(x.cargo)}</span><span class="linha">${x.exemplo ? seloExemplo(x) : x.estado === "depois" ? pilula("depois") : x.alertas?.length ? `<span class="pilula risco">Alerta de sigilo</span>` : `<span class="meta">${esc(x.contrato || "Contrato a confirmar")} · ${esc(x.local || "")}</span>`}<b>${x.nota ?? "—"}</b></span></button>`).join("")}</div>
        <div class="palco" data-tut="cartao">
          <div class="cartao ${virado ? "virado" : ""}" id="cartao">
            <article class="face frente" aria-hidden="${virado}">
              <div class="topo"><div><span class="empresa">${esc(v.empresa)}</span><h2>${esc(v.cargo)}</h2>${v.exemplo ? `<div style="margin-top:8px">${seloExemplo(v)}</div>` : ""}</div><div class="nota-grande"><b>${v.nota ?? "—"}</b><small>aderência</small></div></div>
              <div class="chips"><span class="etiqueta ${v.contrato === "PJ" ? "pj" : ""}">${esc(v.contrato || "Contrato a confirmar")}</span><span class="etiqueta">${esc(v.local || "Local a confirmar")}</span>${v.modelo ? `<span class="etiqueta">${esc(v.modelo)}</span>` : ""}${v.area ? `<span class="etiqueta">${esc(v.area)}</span>` : ""}<span class="etiqueta">${v.faixa ? esc(v.faixa) : "Faixa não informada"}</span></div>
              <p class="resumo">${esc(v.resumo)}</p>
              ${risco ? `<div class="alertas-box">${v.alertas.map((a) => `<p>${ic("cadeado")}<span>${esc(a)}</span></p>`).join("")}</div>` : ""}
              ${observacoes(v)}
              <ul class="motivos">${(v.motivos || []).map((m) => `<li>${ic("check")}<span>${esc(m)}</span></li>`).join("")}</ul>
              ${usaFeitos(v)}
              <div class="rodape"><span class="meta">${esc(v.fonte)}${v.publicada ? ` · publicada ${dm(v.publicada)}` : ""} · captada ${dm(v.captada)}</span><button class="btn" type="button" data-virar>${ic("virar")}Ver a nota por dimensão</button></div>
            </article>
            <article class="face verso" aria-hidden="${!virado}">
              <div class="topo"><div><span class="empresa">${esc(v.empresa)}</span><h2>A nota, por dimensão</h2></div><div class="nota-grande"><b>${v.nota ?? "—"}</b><small>aderência</small></div></div>
              <div class="dims">${dims.map(([k, n]) => `<div class="dim"><span>${esc(k)}</span><span class="t"><i class="${n < 50 ? "baixo" : ""}" style="width:${n}%"></i></span><b>${n}</b></div>`).join("") || `<p class="meta">Sem detalhamento para esta vaga.</p>`}</div>
              <p class="meta" style="margin-top:18px">As dimensões e os pesos ficam na Base, em Preferências. Seus motivos de reprovação ajustam as próximas notas.</p>
              <div class="rodape"><span class="meta">Nota de 0 a 100</span><button class="btn" type="button" data-virar>${ic("virar")}Voltar para a vaga</button></div>
            </article>
          </div>
          <div class="acoes" data-tut="decidir">
            <button class="btn nao g" type="button" data-acao="reprovar"><kbd>R</kbd>Reprovar</button>
            <button class="btn g" type="button" data-acao="depois"><kbd>D</kbd>Depois</button>
            <button class="btn ok g" type="button" data-acao="aprovar"><kbd>A</kbd>${risco && confirmarAlerta ? "Confirmar aprovação" : "Aprovar"}</button>
          </div>
          ${risco ? `<p class="meta" style="margin-top:8px;color:var(--risco-t)">${confirmarAlerta ? "Alerta de sigilo: aperte de novo para confirmar." : "Esta vaga tem alerta de sigilo: aprovar pede confirmação."}</p>` : ""}
          <div class="motivo-rapido" id="motivos" role="group" aria-label="Motivos da reprovação">
            <p class="meta">Marque um ou mais motivos. Eles ajustam as próximas notas.</p>
            <div class="chips">${MOTIVOS_REPROVA.map((m) => `<button type="button" aria-pressed="false" data-motivo="${esc(m)}">${esc(m)}</button>`).join("")}</div>
            <div class="campo-pedido"><input id="motivo-outro" placeholder="Outro motivo (ex.: exige 10 anos de experiência)" aria-label="Outro motivo" autocomplete="off"><button class="btn nao" type="button" id="confirmar-reprova">Reprovar</button></div>
          </div>
        </div>
        <div class="coluna lateral">
          <section class="painel"><div class="cab"><h2>Sigilo</h2><a class="meta" href="#/base/sigilo">regras</a></div>${!S.ativo ? `<p class="meta">Sigilo desligado. Se você busca sem o seu empregador saber, ligue em Base › Sigilo.</p>` : risco ? `<p class="meta">O filtro marcou esta vaga pela sua lista de alerta em Base › Sigilo.</p>` : `<p class="meta" style="display:flex;gap:8px;align-items:center;color:var(--proc-t)">${ic("check")}Passou no filtro de sigilo.</p>`}</section>
          <section class="painel"><div class="cab"><h2>Origem</h2></div><div class="lista-kv"><div><span>Fonte</span><b>${esc(v.fonte)}</b></div><div><span>Publicada</span><b>${v.publicada ? dm(v.publicada) : "—"}</b></div><div><span>Captada</span><b>${dm(v.captada)}</b></div></div>${v.url ? `<a class="btn" style="margin-top:12px" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${ic("externo")}Abrir vaga original</a>` : `<p class="meta" style="margin-top:12px">${v.exemplo ? "Vaga de exemplo: não tem link." : "Sem link."}</p>`}</section>
          <section class="painel"><div class="cab"><h2>Pedir ao Claude</h2></div><p class="meta">Uma dúvida sobre esta vaga, antes de decidir.</p>${campoPedido({ tipo: "vaga", id: v.id, rotulo: v.empresa }, "Ex.: quem lidera esse time?")}</section>
          ${pilhas}
        </div>
      </div></section>`;
  }
  // pontos de atenção que não são sigilo (senioridade, faixa, contrato…): neutros, sem pedir confirmação
  const observacoes = (v) => (lista(v.observacoes).length ? `<ul class="observacoes">${v.observacoes.map((o) => `<li>${ic("alerta")}<span>${esc(o)}</span></li>`).join("")}</ul>` : "");
  function usaFeitos(v) {
    const citados = [...new Set((v.motivos || []).join(" ").match(/F\d+/g) || [])];
    const L = (citados.length ? citados.map((id) => db.feitos.find((f) => f.id === id)) : db.feitos.filter((f) => f.uso === "cv")).filter(Boolean).slice(0, 4);
    if (!L.length) return "";
    return `<div class="usa"><h3>Feitos que o kit vai destacar</h3><ul>${L.map((f) => `<li><b>${f.id}</b><span>${esc(f.texto)}</span></li>`).join("")}</ul></div>`;
  }
  function ligarTriagem() {
    app.querySelectorAll(".fila button").forEach((b) => b.addEventListener("click", () => { triSel = b.dataset.id; virado = false; confirmarAlerta = false; history.replaceState(null, "", `#/triagem/${triSel}`); render(true); }));
    app.querySelectorAll("[data-virar]").forEach((b) => b.addEventListener("click", virar));
    app.querySelectorAll("[data-acao]").forEach((b) => b.addEventListener("click", () => acaoTriagem(b.dataset.acao)));
    app.querySelectorAll("[data-motivo]").forEach((b) => b.addEventListener("click", () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true")));
    const reprova = () => {
      const tags = [...app.querySelectorAll('[data-motivo][aria-pressed="true"]')].map((b) => b.dataset.motivo);
      const outro = document.getElementById("motivo-outro")?.value.trim();
      if (outro) tags.push(outro);
      if (!tags.length) { toast("Marque ao menos um motivo"); return; }
      decidir("reprovada", tags);
    };
    document.getElementById("confirmar-reprova")?.addEventListener("click", reprova);
    document.getElementById("motivo-outro")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); reprova(); } });
  }
  function virar() { const c = document.getElementById("cartao"); if (!c) return; virado = !virado; c.classList.toggle("virado", virado); c.querySelector(".frente").setAttribute("aria-hidden", virado); c.querySelector(".verso").setAttribute("aria-hidden", !virado); }
  function acaoTriagem(a) {
    const v = vaga(triSel); if (!v) return;
    if (a === "reprovar") { document.getElementById("motivos").classList.toggle("on"); document.querySelector("#motivos button")?.focus(); return; }
    if (a === "depois") return decidir("depois");
    if (a === "aprovar") {
      if (v.alertas?.length && !confirmarAlerta) { confirmarAlerta = true; render(true); return; }
      return decidir("aprovada");
    }
  }
  function decidir(estado, motivo) {
    const v = vaga(triSel); if (!v) return;
    const cartao = document.getElementById("cartao");
    const alvo = document.getElementById(`p-${estado}`);
    const fim = () => {
      v.estado = estado;
      v.etapas = (v.etapas || []).filter((e) => e.tipo !== "depois");
      v.etapas.push({ data: hojeTxt(), tipo: estado, nota: motivo ? motivo.join(" · ") : "" });
      if (motivo) v.motivos_reprovacao = motivo;
      let msg = { aprovada: `Aprovada: ${v.empresa}. O kit entrou na fila.`, reprovada: `Reprovada: ${v.empresa} (${motivo?.join(", ")}).`, depois: `${v.empresa} foi para depois.` }[estado];
      if (estado === "aprovada" && v.exemplo && v.kit) {
        // o exemplo já vem com o kit: não gasta o plano
        v.estado = "kit"; v.etapas.push({ data: hojeTxt(), tipo: "kit", nota: "Kit de exemplo (numa vaga real, ele entra na fila)" });
        msg = "Aprovada! Numa vaga real o kit entra na fila; no exemplo, ele já está pronto.";
      } else if (estado === "aprovada" && !db.pedidos.some((p) => p.tipo === "kit" && p.onde?.id === v.id && ["fila", "processando"].includes(p.status))) {
        novoPedido({ onde: { tipo: "vaga", id: v.id, rotulo: v.empresa }, tipo: "kit", texto: `Montar o kit de candidatura: ${v.empresa}, ${v.cargo}.` });
        salvar("pedidos", "");
      }
      confirmarAlerta = false; virado = false;
      salvar("vagas", msg);
      render(true);
      const p = document.getElementById(`p-${estado}`); if (p && !reduzido) { p.classList.add("pulo"); setTimeout(() => p.classList.remove("pulo"), 400); }
      VG.aoDecidir?.(v, estado);
    };
    if (reduzido || !cartao || !alvo) return fim();
    const r = cartao.getBoundingClientRect(), a = alvo.getBoundingClientRect();
    const voa = cartao.cloneNode(true); voa.removeAttribute("id"); voa.classList.add("voando");
    Object.assign(voa.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: 0 });
    document.body.appendChild(voa); cartao.style.visibility = "hidden";
    const dx = a.left + a.width / 2 - (r.left + r.width / 2), dy = a.top + a.height / 2 - (r.top + r.height / 2);
    const giro = estado === "aprovada" ? 14 : estado === "reprovada" ? -14 : 0;
    requestAnimationFrame(() => { voa.style.transform = `translate(${dx}px, ${dy}px) perspective(1200px) rotateY(${giro * 2}deg) rotateZ(${giro}deg) scale(.12)`; voa.style.opacity = "0.2"; });
    setTimeout(() => { voa.remove(); fim(); }, 650);
  }

  /* ---------- tela: Vaga / Kit ---------- */
  function telaVaga(id) {
    const v = vaga(id);
    if (!v) return `<section class="tela"><h1>Vaga não encontrada</h1><p class="frase"><a class="btn txt" href="#/candidaturas">Voltar para candidaturas</a></p></section>`;
    const k = v.kit;
    const passosK = k?.passos || [];
    const feitos = passosK.filter((p) => p.feito).length;
    const hist = (v.etapas || []).map((e) => `<div><span class="meta">${dm(e.data)}</span><i style="background:var(--${COR_ETAPA[e.tipo] || (e.tipo === "reprovada" || e.tipo === "encerrada" ? "enc" : "agu")})"></i><span><b>${esc(ETAPA[e.tipo] || e.tipo)}</b>${e.origem === "email" ? `<span class="origem" title="Lido do seu e-mail na varredura">${ic("email")}e-mail</span>` : ""}${e.nota ? `<span class="meta" style="display:block">${esc(e.nota)}</span>` : ""}</span></div>`).join("");
    const passos = passosK.map((p) => `<div class="passo ${p.feito ? "concluido" : ""}" data-p="${p.id}">
        <button class="check" type="button" aria-pressed="${!!p.feito}" aria-label="Marcar passo ${p.id} como feito">${ic("check")}</button>
        <div style="min-width:0"><div class="passo-titulo">${esc(p.titulo)}</div>
          ${p.tipo === "campos" ? `<div class="campos">${lista(p.campos).map((c) => `<div><span><small>${esc(c.rotulo)}</small>${esc(c.valor)}</span><button class="btn txt" type="button" data-copiar="${esc(c.valor)}" aria-label="Copiar ${esc(c.rotulo)}">${ic("copiar")}</button></div>`).join("")}</div>` : ""}
          ${p.tipo === "resposta" ? `<div class="resposta"><textarea data-resposta="${p.id}" aria-label="Resposta sugerida: ${esc(p.titulo)}">${esc(p.texto)}</textarea><div class="rod"><span>${String(p.texto || "").length} caracteres · editável, salva ao sair do campo</span><span><button class="btn txt" type="button" data-versao-rapida='${esc(JSON.stringify({ col: "vagas", id: v.id, campo: ["kit", "passos", { id: p.id }, "texto"] }))}' data-rotulo="${esc(p.titulo)}">${ic("versao")}Pedir uma versão</button><button class="btn txt" type="button" data-copiar-de="${p.id}">${ic("copiar")}Copiar</button></span></div></div>${blocoVersao({ col: "vagas", id: v.id, campo: ["kit", "passos", { id: p.id }, "texto"] })}` : ""}
          ${p.tipo !== "resposta" && p.texto ? `<p class="texto">${esc(p.texto)}</p>` : ""}
        </div></div>`).join("");
    const pk = db.pedidos.find((p) => p.tipo === "kit" && p.onde?.id === v.id && ["fila", "processando", "erro"].includes(p.status));
    const pend = v.estado === "aprovada" && !k ? `<div class="vazio">${pk ? `Kit ${ST_PEDIDO[pk.status][1].toLowerCase()} desde ${dm(pk.criado)}, ${String(pk.criado).slice(11)}. ` : ""}${pk?.status === "processando" ? "O Claude está montando agora." : pk?.status === "erro" ? "O Claude não terminou. Ponha de novo na fila na tela Pedidos." : `Clique em <b>Rodar fila</b> (lá em cima) quando quiser, e o kit aparece aqui.`}</div>` : "";
    return `<section class="tela entra">
      <div class="cab-vaga"><div><a class="btn txt" href="#/candidaturas" style="padding:0">${ic("seta", "icone-volta")}Candidaturas</a><span class="empresa" style="display:block;margin-top:8px">${esc(v.empresa)}</span><h1>${esc(v.cargo)}</h1><div class="linha2">${pilula(v.estado)}<label class="fase" data-tut="fase"><span>Fase</span><select id="mudar-fase" aria-label="Mudar a fase desta vaga">${Object.entries(ESTADOS).map(([key, [, r]]) => `<option value="${key}" ${key === v.estado ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label><span class="etiqueta">${esc(v.contrato || "Contrato a confirmar")}</span><span class="meta">${esc(v.local || "")}${v.modelo ? ` · ${esc(v.modelo)}` : ""} · aderência <b style="color:var(--ink)">${v.nota ?? "—"}</b></span>${seloExemplo(v)}</div></div>
        ${v.estado === "kit" ? `<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ok g" type="button" id="marcar-enviada" data-tut="enviada">${ic("check")}Marquei como enviada</button></div>` : ""}</div>
      <div class="grade">
        <div class="coluna">
          ${k ? `<section class="painel" data-tut="guia"><div class="cab"><h2>Guia de candidatura</h2><span class="meta">${feitos} de ${passosK.length} passos · ${esc(k.plataforma || "")}</span></div><div class="medidor"><i style="width:${passosK.length ? (feitos / passosK.length) * 100 : 0}%"></i></div><div class="passos">${passos}</div></section>
          <section class="painel"><div class="cab"><h2>Carta</h2><span><button class="btn txt" type="button" data-versao-rapida='${esc(JSON.stringify({ col: "vagas", id: v.id, campo: ["kit", "carta"] }))}' data-rotulo="Carta">${ic("versao")}Pedir uma versão</button><button class="btn txt" type="button" data-copiar-carta>${ic("copiar")}Copiar</button></span></div><div class="resposta"><textarea id="carta" style="min-height:220px" aria-label="Carta">${esc(k.carta || "")}</textarea></div>${blocoVersao({ col: "vagas", id: v.id, campo: ["kit", "carta"] })}</section>` : ""}
          ${pend}
          ${!k && !pend ? `<section class="painel"><div class="cab"><h2>Sobre a vaga</h2></div><p class="frase">${esc(v.resumo || "Sem resumo.")}</p>${observacoes(v)}${(v.motivos || []).length ? `<ul class="motivos">${v.motivos.map((m) => `<li>${ic("check")}<span>${esc(m)}</span></li>`).join("")}</ul>` : ""}</section><section class="painel"><div class="cab"><h2>Acompanhamento</h2></div>${ATIVAS.includes(v.estado) && (v.etapas || []).length ? trilhas([v], { eixo: true }) : `<p class="meta">Fase: ${esc(ESTADOS[v.estado]?.[1].toLowerCase() || v.estado)}.</p>`}</section>` : ""}
        </div>
        <div class="coluna lateral-fixa">
          <section class="painel"><div class="cab"><h2>Anexos</h2></div><div class="lista-kv">${lista(k?.anexos || ["CV (o kit indica a versão)"]).map((a) => `<div><span>${ic("arquivo")}</span><b style="flex:1">${esc(a)}</b></div>`).join("")}</div></section>
          <section class="painel"><div class="cab"><h2>Histórico</h2></div><div class="historico">${hist || `<p class="meta">Sem movimentação.</p>`}</div></section>
          <section class="painel"><div class="cab"><h2>Pedir ao Claude</h2></div>${campoPedido({ tipo: "vaga", id: v.id, rotulo: v.empresa }, "Ex.: deixa a resposta 3 mais curta")}${db.pedidos.filter((p) => p.onde?.id === v.id).map((p) => itemPedido(p)).join("")}</section>
          <section class="painel"><div class="cab"><h2>Vaga original</h2></div><div class="lista-kv"><div><span>Fonte</span><b>${esc(v.fonte)}</b></div><div><span>Publicada</span><b>${v.publicada ? dm(v.publicada) : "—"}</b></div></div>${v.url ? `<a class="btn" style="margin-top:12px" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${ic("externo")}Abrir</a>` : ""}${v.exemplo ? `<button class="btn nao" type="button" id="apagar-exemplo" style="margin-top:12px">Apagar a vaga de exemplo</button>` : ""}</section>
        </div>
      </div></section>`;
  }
  function ligarVaga(id) {
    const v = vaga(id); if (!v) return;
    app.querySelectorAll(".passo .check").forEach((b) => b.addEventListener("click", () => {
      const p = v.kit.passos.find((x) => String(x.id) === b.closest(".passo").dataset.p); p.feito = !p.feito; salvar("vagas", p.feito ? "Passo feito" : "Passo reaberto"); render(true);
    }));
    app.querySelectorAll("textarea[data-resposta]").forEach((t) => t.addEventListener("change", () => { v.kit.passos.find((x) => String(x.id) === t.dataset.resposta).texto = t.value; salvar("vagas", "Resposta salva"); }));
    const carta = document.getElementById("carta"); carta?.addEventListener("change", () => { v.kit.carta = carta.value; salvar("vagas", "Carta salva"); });
    app.querySelectorAll("[data-versao-rapida]").forEach((b) => b.addEventListener("click", () => {
      const alvo = JSON.parse(b.dataset.versaoRapida);
      if (db.pedidos.some((p) => p.tipo === "versao" && mesmoAlvo(p.alvo, alvo) && ["fila", "processando", "revisao"].includes(p.status))) return toast("Já existe uma versão pedida para isto");
      novoPedido({ onde: { tipo: "vaga", id: v.id, rotulo: v.empresa }, alvo, tipo: "versao", texto: `Versão final: ${b.dataset.rotulo}` });
      salvar("pedidos", `Versão pedida. ${MSG_FILA}`); render(true);
    }));
    const copiar = async (txt) => { try { await navigator.clipboard.writeText(txt); toast("Copiado"); } catch { toast("Não consegui copiar"); } };
    app.querySelectorAll("[data-copiar]").forEach((b) => b.addEventListener("click", () => copiar(b.dataset.copiar)));
    app.querySelectorAll("[data-copiar-de]").forEach((b) => b.addEventListener("click", () => copiar(app.querySelector(`textarea[data-resposta="${b.dataset.copiarDe}"]`).value)));
    app.querySelector("[data-copiar-carta]")?.addEventListener("click", () => copiar(carta.value));
    document.getElementById("mudar-fase")?.addEventListener("change", (e) => {
      const novo = e.target.value, antes = v.estado;
      if (novo === antes) return;
      v.estado = novo;
      (v.etapas = v.etapas || []).push({ data: hojeTxt(), tipo: novo, nota: `Fase ajustada à mão: ${ESTADOS[antes]?.[1]} → ${ESTADOS[novo][1]}`, manual: true });
      if (novo !== "reprovada") delete v.motivos_reprovacao;
      // voltou para antes do kit: o pedido de kit que ainda não começou sai da fila
      if (["nova", "depois", "reprovada"].includes(novo)) db.pedidos.filter((p) => p.tipo === "kit" && p.onde?.id === v.id && p.status === "fila").forEach((p) => { p.status = "descartado"; });
      salvar("pedidos", "");
      salvar("vagas", `${v.empresa}: fase agora é "${ESTADOS[novo][1]}".`);
      render(true);
      VG.aoMudarFase?.(v, novo);
    });
    document.getElementById("marcar-enviada")?.addEventListener("click", () => { v.estado = "enviada"; v.etapas.push({ data: hojeTxt(), tipo: "enviada", nota: "" }); salvar("vagas", `${v.empresa}: enviada. O acompanhamento começou.`); render(true); VG.aoMudarFase?.(v, "enviada"); });
    document.getElementById("apagar-exemplo")?.addEventListener("click", () => VG.apagarExemplo());
  }
  VG.apagarExemplo = async () => {
    const ids = db.vagas.filter((v) => v.exemplo).map((v) => v.id);
    if (!ids.length) return;
    db.pedidos.forEach((p) => { if (ids.includes(p.onde?.id) && ["fila", "erro"].includes(p.status)) p.status = "descartado"; });
    // apagar não passa pela mesclagem (que nunca deixa item sumir): o app tira direto do disco
    await api("exemplo/apagar", { metodo: "POST" }).catch(() => {});
    db.vagas.splice(0, db.vagas.length, ...db.vagas.filter((v) => !v.exemplo));
    await salvar("pedidos", "");
    await carregar(["vagas"]);
    toast("Vaga de exemplo apagada");
    if (location.hash.startsWith("#/vaga/")) location.hash = "#/hoje"; else render(true);
  };

  /* ---------- tela: Candidaturas ---------- */
  let abaCand = null;
  function telaCandidaturas() {
    const grupos = {
      ativas: ["Ativas", (v) => ATIVAS.includes(v.estado)], triar: ["Para triar", (v) => v.estado === "nova" || v.estado === "depois"],
      encerradas: ["Encerradas", (v) => v.estado === "encerrada"], reprovadas: ["Reprovadas", (v) => v.estado === "reprovada"], todas: ["Todas", () => true],
    };
    if (!abaCand) abaCand = db.vagas.some(grupos.ativas[1]) || !db.vagas.some(grupos.triar[1]) ? "ativas" : "triar";
    const L = db.vagas.filter(grupos[abaCand][1]).sort((a, b) => String(ultimaEtapa(b)?.data || b.captada).localeCompare(String(ultimaEtapa(a)?.data || a.captada)));
    const ativas = db.vagas.filter((v) => grupos.ativas[1](v) && (v.etapas || []).length);
    const proxAcao = (v) => v.proxima ? `${v.proxima.texto} · ${dm(v.proxima.data)}` : v.estado === "kit" ? "Enviar o kit" : v.estado === "aprovada" ? "Rodar a fila (kit)" : v.estado === "nova" ? "Triar" : v.estado === "enviada" ? (dias(ultimaEtapa(v)?.data) >= 10 ? "Cobrar retorno" : "Aguardar") : "—";
    return `<section class="tela entra">
      <div class="titulo"><div><h1>Candidaturas</h1><p class="frase">${plural(ativas.length, "processo ativo", "processos ativos")}. Cada barra mostra quanto tempo a vaga ficou em cada etapa.</p></div></div>
      <div class="coluna">
        <section class="painel"><div class="cab"><h2>Linha do tempo</h2><span class="meta">só as ativas</span></div>${trilhas(ativas)}<div style="margin-top:14px">${legendaTrilhas}</div></section>
        <section class="painel">
          <div class="abas" role="tablist">${Object.entries(grupos).map(([key, [r, f]]) => `<button role="tab" type="button" aria-selected="${key === abaCand}" class="${key === abaCand ? "on" : ""}" data-aba="${key}">${r}<b>${db.vagas.filter(f).length}</b></button>`).join("")}</div>
          ${L.length ? `<table class="tabela"><thead><tr><th>Empresa e cargo</th><th>Estado</th><th class="esconde-cel">Última movimentação</th><th class="n esconde-cel">Dias</th><th class="esconde-cel">Próxima ação</th><th class="n">Aderência</th></tr></thead><tbody>
          ${L.map((v) => { const u = ultimaEtapa(v); return `<tr data-href="#/vaga/${v.id}"><td><span class="empresa">${esc(v.empresa)}</span> ${seloExemplo(v)}<span class="meta" style="display:block">${esc(v.cargo)}</span></td><td>${pilula(v.estado)}</td><td class="esconde-cel">${u ? `${esc(ETAPA[u.tipo] || u.tipo)} · ${dm(u.data)}` : `Captada · ${dm(v.captada)}`}</td><td class="n esconde-cel">${dias(u ? u.data : v.captada)}</td><td class="esconde-cel">${esc(proxAcao(v))}</td><td class="n" data-rot="aderência"><b>${v.nota ?? "—"}</b></td></tr>`; }).join("")}
          </tbody></table>` : `<div class="vazio">Nada nesta aba.</div>`}
        </section>
      </div></section>`;
  }
  function ligarCandidaturas() {
    app.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => { abaCand = b.dataset.aba; render(true); }));
    app.querySelectorAll("tr[data-href]").forEach((tr) => tr.addEventListener("click", () => (location.hash = tr.dataset.href)));
  }

  /* ---------- tela: Empresas ---------- */
  const PRIOS = ["alta", "média", "baixa", "bloqueio"];
  function telaEmpresas() {
    const ordem = { alta: 0, "média": 1, baixa: 2, bloqueio: 3 };
    const L = [...db.empresas].sort((a, b) => (ordem[a.prioridade] ?? 1) - (ordem[b.prioridade] ?? 1) || String(a.nome).localeCompare(String(b.nome)));
    return `<section class="tela entra"><div class="titulo"><div><h1>Empresas<small>${L.filter((e) => e.prioridade !== "bloqueio").length} no alvo</small></h1><p class="frase">Onde você quer estar. Com o link de carreiras (Gupy, Greenhouse, Lever ou Workday), a varredura lê as vagas direto do site da empresa.</p></div></div>
      <div class="grade"><section class="painel">${L.length ? `<table class="tabela empresas"><thead><tr><th>Empresa</th><th>Prioridade</th><th class="esconde-cel">Setor</th><th class="esconde-cel">Site de vagas</th><th class="n">Abertas</th><th></th></tr></thead><tbody>
      ${L.map((e) => `<tr data-e="${esc(e.id)}"><td><span class="empresa">${esc(e.nome)}</span>${e.nota ? `<span class="meta" style="display:block">${esc(e.nota)}</span>` : ""}${e.sigilo ? `<span style="display:block;color:var(--risco-t);font-size:13px">${esc(e.sigilo)}</span>` : ""}</td>
        <td><select class="sel-mini" data-prio aria-label="Prioridade de ${esc(e.nome)}">${PRIOS.map((p) => `<option value="${p}" ${e.prioridade === p ? "selected" : ""}>${p === "bloqueio" ? "Bloqueada" : p[0].toUpperCase() + p.slice(1)}</option>`).join("")}</select></td>
        <td class="esconde-cel">${esc(e.setor || "—")}</td><td class="esconde-cel">${e.url_carreiras ? `<a class="btn txt" href="${esc(e.url_carreiras)}" target="_blank" rel="noopener noreferrer">${esc(e.ats && e.ats !== "a mapear" ? e.ats : "abrir")}</a>` : `<span class="meta">${esc(e.ats || "a mapear")}</span>`}</td><td class="n">${e.abertas || 0}</td>
        <td class="n"><button class="btn txt nao" type="button" data-tirar-empresa aria-label="Tirar ${esc(e.nome)} da lista">${ic("x")}</button></td></tr>`).join("")}
      </tbody></table>` : `<div class="vazio">Nenhuma empresa ainda. Adicione ao lado ou peça ao Claude uma lista.</div>`}</section>
      <div class="coluna">
        <section class="painel"><div class="cab"><h2>Adicionar empresa</h2></div><form id="nova-empresa" class="form-col"><input name="nome" placeholder="Nome da empresa" aria-label="Nome da empresa" required autocomplete="off"><input name="url" placeholder="Link da página de vagas (opcional)" aria-label="Link da página de vagas" autocomplete="off"><select name="prio" aria-label="Prioridade">${PRIOS.slice(0, 3).map((p) => `<option value="${p}">${p[0].toUpperCase() + p.slice(1)}</option>`).join("")}</select><button class="btn p" type="submit">${ic("mais")}Adicionar</button></form></section>
        <section class="painel"><div class="cab"><h2>Pedir ao Claude</h2></div><p class="meta">Sugerir empresas, achar a página de vagas de cada uma, mapear contatos.</p>${campoPedido({ tipo: "empresas", rotulo: "Empresas" }, "Ex.: sugere 10 empresas parecidas com as minhas")}</section></div></div></section>`;
  }
  function ligarEmpresas() {
    app.querySelectorAll("tr[data-e]").forEach((tr) => {
      const e = db.empresas.find((x) => String(x.id) === tr.dataset.e);
      tr.querySelector("[data-prio]").addEventListener("change", (ev) => { e.prioridade = ev.target.value; salvar("empresas", `${e.nome}: prioridade salva`); });
      tr.querySelector("[data-tirar-empresa]").addEventListener("click", async () => {
        if (!confirm(`Tirar ${e.nome} da lista?`)) return;
        await api("empresas/tirar", { metodo: "POST", corpo: { id: e.id } }); await carregar(["empresas"]); toast(`${e.nome} saiu da lista`); render(true);
      });
    });
    document.getElementById("nova-empresa")?.addEventListener("submit", (ev) => {
      ev.preventDefault(); const f = ev.target; const nome = f.nome.value.trim(); if (!nome) return;
      const n = db.empresas.reduce((m, x) => Math.max(m, parseInt(String(x.id).slice(1), 10) || 0), 0) + 1;
      const url = f.url.value.trim();
      const ats = /gupy\.io/.test(url) ? "Gupy" : /greenhouse/.test(url) ? "Greenhouse" : /lever\.co/.test(url) ? "Lever" : /myworkdayjobs/.test(url) ? "Workday" : url ? "site próprio" : "a mapear";
      db.empresas.unshift({ id: `e${p2(n)}`, nome, prioridade: f.prio.value, setor: "", ats, url_carreiras: url, abertas: 0 });
      salvar("empresas", `${nome} entrou na lista`); render(true);
    });
  }

  /* ---------- tela: Base ---------- */
  let abaBase = "perfil";
  function telaBase(arg) {
    if (arg && ["perfil", "preferencias", "feitos", "sigilo", "documentos"].includes(arg)) abaBase = arg;
    const P = db.perfil, R = db.preferencias, S = db.sigilo;
    const campo = (col, k, rot, dica = "") => `<dt>${rot}</dt><dd><input class="inline" data-col="${col}" data-k="${k}" value="${esc(Array.isArray(db[col][k]) ? db[col][k].join(", ") : db[col][k] ?? "")}" aria-label="${rot}" placeholder="${esc(dica)}"></dd>`;
    const abas = { perfil: "Perfil", preferencias: "Preferências", feitos: "Feitos", sigilo: "Sigilo", documentos: "Documentos" };
    let corpo = "";
    if (abaBase === "perfil") corpo = `${P.resumo ? `<div class="destaque-pos"><h3>Resumo</h3><p class="frase">${esc(P.resumo)}</p>${campoPedido({ tipo: "base", rotulo: "Resumo" }, "Ex.: uma frase mais curta para o título do LinkedIn", { col: "perfil", id: null, campo: ["resumo"] })}${blocoVersao({ col: "perfil", id: null, campo: ["resumo"] })}</div>` : ""}
      <dl class="dl">${campo("perfil", "nome", "Nome")}${campo("perfil", "email", "E-mail para candidaturas")}${campo("perfil", "telefone", "Telefone")}${campo("perfil", "cidade", "Cidade")}${campo("perfil", "linkedin", "LinkedIn")}${campo("perfil", "cargo_atual", "Cargo atual")}${campo("perfil", "formacao", "Formação")}${campo("perfil", "idiomas", "Idiomas", "separe por vírgula")}${campo("perfil", "resumo", "Resumo")}</dl>
      ${lista(P.trajetoria).length ? `<h3 style="margin-top:22px">Trajetória</h3><div class="lista-kv" style="margin-top:8px">${P.trajetoria.map((t) => `<div><span>${esc(t.periodo || "")}</span><b style="flex:1;text-align:right">${esc([t.cargo, t.empresa].filter(Boolean).join(" · "))}</b></div>`).join("")}</div>` : ""}`;
    if (abaBase === "preferencias") corpo = `<dl class="dl">${campo("preferencias", "setor", "Área")}${campo("preferencias", "cargos", "Cargos", "separe por vírgula")}${campo("preferencias", "senioridade", "Senioridade")}${campo("preferencias", "contratos", "Contratos que aceita", "separe por vírgula")}${campo("preferencias", "contrato_preferido", "Contrato preferido")}${campo("preferencias", "modelos", "Modelo de trabalho", "separe por vírgula")}${campo("preferencias", "cidades", "Cidades", "separe por vírgula")}${campo("preferencias", "faixa_minima", "Faixa mínima")}${campo("preferencias", "empresas_tipo", "Tipos de empresa", "separe por vírgula")}${campo("preferencias", "evitar", "Evitar", "separe por vírgula")}</dl>
      <h3 style="margin-top:22px">Dimensões da nota</h3><p class="meta" style="margin:4px 0 10px">O Claude dá a nota de aderência por estas dimensões. Peso 2 conta em dobro.</p>
      <div class="dims-edit">${lista(R.dimensoes).map((d, i) => `<div><input data-dim="${i}" value="${esc(d.nome)}" aria-label="Dimensão ${i + 1}"><select data-peso="${i}" aria-label="Peso">${[1, 2].map((n) => `<option value="${n}" ${+d.peso === n ? "selected" : ""}>peso ${n}</option>`).join("")}</select><button class="btn txt nao" type="button" data-tirar-dim="${i}" aria-label="Tirar dimensão">${ic("x")}</button></div>`).join("")}<button class="btn" type="button" id="nova-dim">${ic("mais")}Dimensão</button></div>`;
    if (abaBase === "sigilo") corpo = `<label class="interruptor"><input type="checkbox" id="sigilo-ativo" ${S.ativo ? "checked" : ""}><span>Busco emprego sem o meu empregador atual saber</span></label>
      <dl class="dl" style="margin-top:16px">${campo("sigilo", "empregador", "Empregador atual")}${campo("sigilo", "bloqueio", "Bloqueio total", "empresas que nunca viram vaga (vírgula)")}${campo("sigilo", "alerta", "Alerta", "empresas que entram com aviso (vírgula)")}</dl>
      <p class="meta" style="margin-top:14px">Com o sigilo ligado, o Claude descarta as empresas do bloqueio, avisa nas de alerta e desconfia de vaga "confidencial" do mesmo ramo do seu empregador. Nada disso sai do seu computador.</p>`;
    if (abaBase === "feitos") {
      const grupos = [...new Set(db.feitos.map((f) => f.grupo || "Outros"))];
      const conf = db.feitos.filter((f) => f.confirmado).length;
      corpo = db.feitos.length ? `<div class="cab"><h2>Banco de feitos</h2><span class="meta">${conf} de ${db.feitos.length} confirmados</span></div>
        <p class="meta">Confirme cada feito, corrija o texto se precisar e diga onde ele pode ser usado. É daqui que saem as respostas e as cartas.</p>
        ${grupos.map((g) => `<div class="feitos-grupo"><h3>${esc(g)}</h3>${db.feitos.filter((f) => (f.grupo || "Outros") === g).map((f) => `<div class="feito ${f.confirmado ? "ok" : ""}" data-f="${esc(f.id)}"><span class="id">${esc(f.id)}</span><div><div class="txt" contenteditable="true" role="textbox" aria-label="Texto do feito ${esc(f.id)}">${esc(f.texto)}</div>${f.confirmar ? (f.confirmado ? `<span class="conf ok">Detalhe que ainda pode entrar: ${esc(f.confirmar)}</span>` : `<span class="conf">Confirmar: ${esc(f.confirmar)}</span>`) : ""}</div>
          <select aria-label="Onde usar ${esc(f.id)}"><option value="cv" ${f.uso === "cv" ? "selected" : ""}>CV e candidaturas</option><option value="entrevista" ${f.uso === "entrevista" ? "selected" : ""}>Só entrevista</option><option value="nao" ${f.uso === "nao" ? "selected" : ""}>Não usar agora</option></select>
          <button class="btn ${f.confirmado ? "ok" : ""}" type="button" data-conf>${f.confirmado ? `${ic("check")}Confirmado` : "Confirmar"}</button>
          <button class="btn txt" type="button" data-pede aria-label="Pedir ao Claude sobre ${esc(f.id)}">${ic("pedidos")}</button>
          <div class="pede">${campoPedido({ tipo: "feito", id: f.id, rotulo: f.id }, `Ex.: deixa o ${f.id} com o número certo`, { col: "feitos", id: f.id, campo: ["texto"] })}</div>
          ${blocoVersao({ col: "feitos", id: f.id, campo: ["texto"] }) ? `<div class="pede on">${blocoVersao({ col: "feitos", id: f.id, campo: ["texto"] })}</div>` : ""}</div>`).join("")}</div>`).join("")}`
        : `<div class="vazio">Nenhum feito ainda. Anexe seu CV na aba Documentos e peça ao Claude: "monte meu banco de feitos a partir do CV".</div>${campoPedido({ tipo: "base", rotulo: "Feitos" }, "Ex.: monte meu banco de feitos a partir do CV")}`;
    }
    if (abaBase === "documentos") corpo = `<p class="meta">CV, PDF do LinkedIn, portfólio em PDF. Ficam na pasta <b>documentos</b> do Vagabs, e o Claude lê quando precisa.</p>
      <div id="docs-lista" class="lista-kv" style="margin-top:14px"><p class="meta">Carregando…</p></div>
      <label class="soltar" style="margin-top:14px"><input type="file" id="doc-arquivo" accept=".pdf,.doc,.docx,.txt,.md,.rtf,.odt" multiple hidden><span>${ic("arquivo")}Escolher arquivos (PDF, Word ou texto)</span></label>
      <button class="btn txt" type="button" id="abrir-pasta" style="margin-top:10px">${ic("pasta")}Abrir a pasta do Vagabs</button>`;
    return `<section class="tela entra"><div class="titulo"><div><h1>Base</h1><p class="frase">Uma fonte só: alimenta as notas, as respostas e as cartas.</p></div></div>
      <div class="grade"><section class="painel"><div class="abas" role="tablist">${Object.entries(abas).map(([key, r]) => `<button role="tab" type="button" aria-selected="${key === abaBase}" class="${key === abaBase ? "on" : ""}" data-aba="${key}">${r}</button>`).join("")}</div>${corpo}</section>
      <div class="coluna"><section class="painel"><div class="cab"><h2>Pedir ao Claude</h2></div>${campoPedido({ tipo: "base", rotulo: "Base" }, "Ex.: reescreve meu resumo para vagas de gestão")}</section>
        <section class="painel"><div class="cab"><h2>Refazer o setup</h2></div><p class="meta">Passa de novo pelas telas iniciais, com o que você já preencheu. Nada se perde.</p><a class="btn" style="margin-top:12px" href="#/setup">Refazer o setup</a></section></div></div></section>`;
  }
  function ligarBase() {
    app.querySelectorAll("[data-aba]").forEach((b) => b.addEventListener("click", () => { abaBase = b.dataset.aba; history.replaceState(null, "", `#/base/${abaBase}`); render(true); }));
    app.querySelectorAll("input.inline").forEach((i) => i.addEventListener("change", () => {
      const atual = db[i.dataset.col][i.dataset.k];
      const LISTAS = ["idiomas", "cargos", "contratos", "modelos", "cidades", "empresas_tipo", "evitar", "bloqueio", "alerta"];
      db[i.dataset.col][i.dataset.k] = Array.isArray(atual) || LISTAS.includes(i.dataset.k) ? i.value.split(",").map((s) => s.trim()).filter(Boolean) : i.value;
      salvar(i.dataset.col);
    }));
    document.getElementById("sigilo-ativo")?.addEventListener("change", (e) => { db.sigilo.ativo = e.target.checked; salvar("sigilo", e.target.checked ? "Sigilo ligado" : "Sigilo desligado"); });
    const R = db.preferencias;
    app.querySelectorAll("[data-dim]").forEach((i) => i.addEventListener("change", () => { R.dimensoes[+i.dataset.dim].nome = i.value.trim(); salvar("preferencias"); }));
    app.querySelectorAll("[data-peso]").forEach((s) => s.addEventListener("change", () => { R.dimensoes[+s.dataset.peso].peso = +s.value; salvar("preferencias"); }));
    app.querySelectorAll("[data-tirar-dim]").forEach((b) => b.addEventListener("click", () => { R.dimensoes.splice(+b.dataset.tirarDim, 1); salvar("preferencias"); render(true); }));
    document.getElementById("nova-dim")?.addEventListener("click", () => { (R.dimensoes = lista(R.dimensoes)).push({ nome: "Nova dimensão", peso: 1 }); salvar("preferencias"); render(true); });
    app.querySelectorAll(".feito[data-f]").forEach((row) => {
      const f = db.feitos.find((x) => String(x.id) === row.dataset.f);
      row.querySelector(".txt").addEventListener("blur", (e) => { const t = e.target.textContent.trim(); if (t && t !== f.texto) { f.texto = t; salvar("feitos", `${f.id} atualizado`); } });
      row.querySelector("select").addEventListener("change", (e) => { f.uso = e.target.value; salvar("feitos", `${f.id}: uso salvo`); });
      row.querySelector("[data-pede]").addEventListener("click", () => { const p = row.querySelector(".pede"); p.classList.toggle("on"); p.querySelector("input")?.focus(); });
      row.querySelector("[data-conf]").addEventListener("click", () => { f.confirmado = !f.confirmado; salvar("feitos", f.confirmado ? `${f.id} confirmado` : `${f.id} desmarcado`); render(true); });
    });
    if (abaBase === "documentos") VG.ligarDocumentos?.(document.getElementById("docs-lista"), document.getElementById("doc-arquivo"));
    document.getElementById("abrir-pasta")?.addEventListener("click", () => api("pasta/abrir", { metodo: "POST" }));
  }

  /* ---------- tela: Pedidos (a fila) ---------- */
  function telaPedidos() {
    db.pedidos.forEach((p) => { if (p.status === "respondido" || p.status === "erro") p.lido = true; });
    const n = (s) => db.pedidos.filter((p) => p.status === s).length;
    const ordemFila = (a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9) || String(a.criado).localeCompare(String(b.criado)) || String(a.id).localeCompare(String(b.id));
    const fila = db.pedidos.filter((p) => p.status === "fila").sort(ordemFila);
    const ordem = { processando: 0, erro: 1, revisao: 2, respondido: 3, aplicado: 4, descartado: 5 };
    const resto = db.pedidos.filter((p) => p.status !== "fila").sort((a, b) => (ordem[a.status] ?? 9) - (ordem[b.status] ?? 9) || String(b.criado || "").localeCompare(String(a.criado || "")));
    const ex = VG.estado.execucao;
    return `<section class="tela entra"><div class="titulo"><div><h1>Pedidos<small>${[[n("fila"), "na fila"], [n("processando"), "em andamento"], [n("revisao"), "para revisar"], [n("erro"), "sem terminar"]].filter(([q]) => q).map(([q, r]) => `${q} ${r}`).join(" · ") || "nada pendente"}</small></h1><p class="frase">Todo pedido ao Claude, de qualquer tela, entra nesta fila e espera. Ela só roda quando você clica em <b>Rodar fila</b>, e o Claude faz um pedido de cada vez.</p></div></div>
      <div class="grade"><div class="coluna">
        <section class="painel" data-tut="fila"><div class="cab"><h2>Na fila</h2><span class="meta">na ordem em que o Claude vai fazer</span></div>${fila.map((p, i) => itemPedido(p, { controles: true, pos: i, total: fila.length })).join("") || `<div class="vazio">A fila está vazia.</div>`}</section>
        <section class="painel"><div class="cab"><h2>Feitos e em andamento</h2></div>${resto.map((p) => itemPedido(p, { controles: true })).join("") || `<div class="vazio">Nenhum pedido ainda.</div>`}</section>
      </div>
      <div class="coluna">
        <section class="painel"><div class="cab"><h2>Rodar a fila</h2>${ex ? `<span class="pilula agu">Claude trabalhando</span>` : fila.length ? `<span class="pilula nova">${fila.length} esperando</span>` : ""}</div>
          ${ex ? `<p class="meta">${esc(ex.tipo === "fila" ? `Pedido ${ex.indice || 1} de ${ex.total || 1}` : ex.rotulo)}</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${ex.tipo === "fila" ? `<button class="btn" type="button" id="parar-fila">${ic("parar")}Parar depois deste</button>` : ""}<button class="btn" type="button" data-ver-trabalho>Ver o que ele está fazendo</button></div>`
            : `<p class="meta">Cada pedido gasta um pouco do seu plano Claude. Kits gastam mais (o Claude pensa mais).</p><button class="btn p g" type="button" id="rodar-fila" style="margin-top:12px;width:100%" ${fila.length ? "" : "disabled"}>${ic("play")}Rodar fila${fila.length ? ` (${fila.length})` : ""}</button>`}
          ${VG.estado.limite ? `<p class="meta" style="margin-top:12px;color:var(--vez-t)">${ic("alerta")} O plano bateu no limite de uso${VG.estado.limite.ate ? `. Volta por volta de ${new Date(VG.estado.limite.ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}.</p>` : ""}</section>
        <section class="painel"><div class="cab"><h2>Novo pedido</h2></div><form class="campo-pedido" data-onde='{"tipo":"geral"}' style="flex-direction:column"><textarea name="t" placeholder="Ex.: monta uma versão do meu CV focada em liderança" aria-label="Novo pedido"></textarea><button class="btn p" type="submit">${ic("enviar")}Pôr na fila</button></form></section>
      </div></div></section>`;
  }
  function ligarFila() {
    document.getElementById("rodar-fila")?.addEventListener("click", () => VG.rodarFila());
    document.getElementById("parar-fila")?.addEventListener("click", async () => { await api("fila/parar", { metodo: "POST" }); toast("A fila para depois do pedido atual"); });
    app.querySelectorAll("[data-mover]").forEach((b) => b.addEventListener("click", () => {
      const ordemFila = (a, c) => (a.ordem ?? 1e9) - (c.ordem ?? 1e9) || String(a.criado).localeCompare(String(c.criado)) || String(a.id).localeCompare(String(c.id));
      const fila = db.pedidos.filter((p) => p.status === "fila").sort(ordemFila);
      const i = fila.findIndex((p) => p.id === b.dataset.mover), j = i + +b.dataset.dir;
      if (j < 0 || j >= fila.length) return;
      [fila[i], fila[j]] = [fila[j], fila[i]];
      fila.forEach((p, k) => { p.ordem = k; });
      salvar("pedidos", ""); render(true);
    }));
    app.querySelectorAll("[data-tirar]").forEach((b) => b.addEventListener("click", () => { const p = db.pedidos.find((x) => x.id === b.dataset.tirar); p.status = "descartado"; salvar("pedidos", "Tirado da fila"); render(true); }));
    app.querySelectorAll("[data-repor]").forEach((b) => b.addEventListener("click", () => { const p = db.pedidos.find((x) => x.id === b.dataset.repor); p.status = "fila"; p.resposta = null; salvar("pedidos", MSG_FILA); render(true); }));
  }

  /* ---------- tela: Varreduras ---------- */
  function telaVarreduras() {
    const V = db.varreduras; const t = (k) => V.reduce((s, x) => s + (x[k] || 0), 0);
    const cfg = db.config.varredura || {};
    const F = cfg.fontes || { gupy: true, linkedin: true, empresas: true };
    const ex = VG.estado.execucao;
    const empresasLink = db.empresas.filter((e) => /gupy\.io|greenhouse|lever\.co|myworkdayjobs/.test(e.url_carreiras || "")).length;
    const fontes = [
      ["gupy", "Gupy", "Portal de vagas da Gupy, pelos seus termos de busca."],
      ["linkedin", "LinkedIn (busca pública)", "Sem entrar na sua conta. Poucas buscas, com pausas."],
      ["empresas", "Sites das empresas-alvo", `${plural(empresasLink, "empresa com página de vagas lida direto", "empresas com página de vagas lidas direto")}.`],
    ];
    const email = db.config.email?.modo === "gmail";
    return `<section class="tela entra"><div class="titulo"><div><h1>Varreduras</h1><p class="frase">A varredura lê as fontes, aplica o seu filtro de sigilo, e o Claude dá nota às vagas novas${email ? " e atualiza as candidaturas com o que chegou no seu e-mail" : ""}. Ela só roda com o app aberto e com o seu ok.</p></div></div>
      <div class="grade">
        <section class="painel"><div class="cab"><h2>Histórico</h2><span class="meta">${cfg.ultima ? `última: ${new Date(cfg.ultima).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "nenhuma ainda"}</span></div>${V.length ? `<table class="tabela"><thead><tr><th>Quando</th><th class="esconde-cel">Fontes</th><th class="n">Lidas</th><th class="n">Bloqueadas</th><th class="n esconde-cel">Abaixo do corte</th><th class="n">Para você</th></tr></thead><tbody>
      ${V.map((x) => `<tr><td>${dm(x.data)}${String(x.data).slice(11) ? `, ${String(x.data).slice(11)}` : ""}</td><td class="esconde-cel">${esc(lista(x.fontes).join(", "))}</td><td class="n">${mil(x.lidas)}</td><td class="n">${x.bloqueadas || 0}</td><td class="n esconde-cel">${mil(x.abaixo_do_corte)}</td><td class="n" data-rot="para você"><b>${x.novas || 0}</b></td></tr>`).join("")}
      <tr><td><b>Total</b></td><td class="esconde-cel"></td><td class="n"><b>${mil(t("lidas"))}</b></td><td class="n"><b>${t("bloqueadas")}</b></td><td class="n esconde-cel"><b>${mil(t("abaixo_do_corte"))}</b></td><td class="n" data-rot="para você"><b>${t("novas")}</b></td></tr></tbody></table>` : `<div class="vazio">Nenhuma varredura ainda.</div>`}</section>
        <div class="coluna">
          <section class="painel" data-tut="varrer"><div class="cab"><h2>Rodar agora</h2></div><p class="meta">Leva alguns minutos. A coleta não gasta o plano; a avaliação das vagas pelo Claude, sim. Sem vaga nova, o Claude nem é chamado.</p>
            <button class="btn p g" type="button" id="rodar-varredura" style="margin-top:12px;width:100%" ${ex ? "disabled" : ""}>${ic("atualizar")}${ex?.tipo === "varredura" ? "Varredura em andamento…" : ex ? "O Claude está ocupado" : "Rodar varredura"}</button></section>
          <section class="painel"><div class="cab"><h2>Fontes</h2><a class="meta" href="#/config">ajustar</a></div><div class="fontes">${fontes.map(([k, nome, papel]) => `<div class="fonte"><span>${ic("triagem")}</span><div><b>${esc(nome)}</b><p class="meta">${esc(papel)}</p></div>${F[k] !== false ? `<span class="pilula proc">Ligada</span>` : `<span class="pilula enc">Desligada</span>`}</div>`).join("")}
            <div class="fonte"><span>${ic("email")}</span><div><b>E-mail (Gmail)</b><p class="meta">${email ? "Lê só retornos de processos seletivos, sem enviar nada." : "Desligado: você atualiza as fases à mão."}</p></div>${email ? `<span class="pilula proc">Ligado</span>` : `<span class="pilula enc">À mão</span>`}</div></div></section>
          <section class="painel"><div class="cab"><h2>Termos de busca</h2><a class="meta" href="#/config">editar</a></div>${lista(cfg.termos).length ? `<ul class="lista-simples">${cfg.termos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="meta">Nenhum termo ainda.</p>`}</section>
        </div>
      </div></section>`;
  }

  /* ---------- roteador ---------- */
  let ultimaRota = "";
  const TITULOS = { hoje: "Hoje", triagem: "Triagem", candidaturas: "Candidaturas", empresas: "Empresas", base: "Base", pedidos: "Pedidos", varreduras: "Varreduras" };
  function rotaAtual() { const [, rota = "hoje", arg] = location.hash.replace(/^#\/?/, "#/").split("/"); return [rota || "hoje", arg]; }
  function render(semEntrada = false) {
    const [rota, arg] = rotaAtual();
    if (rota !== "setup" && !VG.estado.setup) { location.hash = "#/setup"; return; }
    const telas = { hoje: telaHoje, triagem: () => telaTriagem(arg), candidaturas: telaCandidaturas, vaga: () => telaVaga(arg), empresas: telaEmpresas, base: () => telaBase(arg), pedidos: telaPedidos, varreduras: telaVarreduras, ...VG.telas };
    const f = telas[rota] || telaHoje;
    document.body.classList.toggle("modo-setup", rota === "setup");
    const navRota = rota === "vaga" ? "candidaturas" : rota === "varreduras" ? "" : rota;
    app.innerHTML = f(arg);
    if (semEntrada || ultimaRota === location.hash) app.querySelector(".tela")?.classList.remove("entra");
    ultimaRota = location.hash;
    if (rota !== "setup") desenharNav(navRota);
    document.title = `${TITULOS[rota] || VG.titulos[rota] || (rota === "vaga" ? vaga(arg)?.empresa || "Vaga" : "Hoje")} · Vagabs`;
    ligarPedidos(app);
    if (rota === "hoje" || !telas[rota]) animarFunil(app);
    if (rota === "triagem") ligarTriagem();
    if (rota === "vaga") ligarVaga(arg);
    if (rota === "candidaturas") ligarCandidaturas();
    if (rota === "empresas") ligarEmpresas();
    if (rota === "base") ligarBase();
    if (rota === "pedidos") { ligarFila(); salvarLidos(); }
    if (rota === "varreduras") document.getElementById("rodar-varredura")?.addEventListener("click", () => VG.rodarVarredura());
    VG.ligar[rota]?.(arg);
    app.querySelectorAll("[data-ver-trabalho]").forEach((b) => b.addEventListener("click", () => VG.verTrabalho?.()));
    app.querySelectorAll("[data-tutorial-abrir]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); VG.tutorial?.iniciar(); }));
    VG.aoRender?.(rota, arg);
  }
  let lidosT = null;
  function salvarLidos() { clearTimeout(lidosT); lidosT = setTimeout(() => salvar("pedidos", "").then(() => desenharNav("pedidos")), 400); }

  document.addEventListener("keydown", (e) => {
    if (!location.hash.startsWith("#/triagem") || e.target.closest?.("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".modal")) return;
    const k = e.key.toLowerCase();
    if (k === "a") acaoTriagem("aprovar"); else if (k === "r") acaoTriagem("reprovar"); else if (k === "d") acaoTriagem("depois"); else if (k === "v") virar();
    else if (k === "j" || k === "k") {
      const b = [...app.querySelectorAll(".fila button")]; const i = b.findIndex((x) => x.classList.contains("sel"));
      b[Math.max(0, Math.min(b.length - 1, i + (k === "j" ? 1 : -1)))]?.click(); app.querySelector(".fila button.sel")?.focus();
    } else return;
    e.preventDefault();
  });
  window.addEventListener("hashchange", () => { render(); window.scrollTo({ top: 0 }); });

  Object.assign(VG, { esc, ic, api, carregar, salvar, toast, render, rotaAtual, novoPedido, itemPedido, campoPedido, ligarPedidos, pilula, seloExemplo, dm, dias, hojeTxt, agoraTxt, plural, lista, contagens, ESTADOS, COLECOES, desenharNav, p2 });
})();

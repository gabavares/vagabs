/* Vagabs — o que liga a tela ao app: eventos ao vivo, console embutido, telas Claude e
   Configurações, popups (novidades, varredura, atualização), tutorial em balões e o botão da fila. */
(() => {
  "use strict";
  const { esc, ic, api, toast, db } = VG;
  const est = VG.estado;

  /* ---------- popups ---------- */
  function modal({ titulo, corpo, botoes = [], fechar = true, classe = "" }) {
    const camada = document.getElementById("camada");
    const el = document.createElement("div");
    el.className = `modal-fundo ${classe}`;
    el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="modal-cab"><h2>${esc(titulo)}</h2>${fechar ? `<button class="btn txt" type="button" data-fechar aria-label="Fechar">${ic("x")}</button>` : ""}</div><div class="modal-corpo">${corpo}</div>${botoes.length ? `<div class="modal-botoes">${botoes.map((b, i) => `<button class="btn g ${b.cls || ""}" type="button" data-b="${i}">${b.rot}</button>`).join("")}</div>` : ""}</div>`;
    const sair = () => { el.remove(); document.removeEventListener("keydown", tecla); };
    const tecla = (e) => { if (e.key === "Escape" && fechar) sair(); };
    el.querySelector("[data-fechar]")?.addEventListener("click", sair);
    if (fechar) el.addEventListener("click", (e) => { if (e.target === el) sair(); });
    el.querySelectorAll("[data-b]").forEach((b) => b.addEventListener("click", async () => { const acao = botoes[+b.dataset.b].acao; if ((await acao?.(el)) !== false) sair(); }));
    document.addEventListener("keydown", tecla);
    camada.appendChild(el);
    el.querySelector(".modal-botoes .btn.p, .modal-botoes .btn.ok, [data-b]")?.focus();
    el.sair = sair;
    return el;
  }
  VG.modal = modal;
  const fmtNovidade = (n) => `<div class="novidade"><h3>${esc(n.titulo || `Versão ${n.versao}`)} <span class="meta">${esc(n.versao)} · ${VG.dm(n.data)}</span></h3><ul class="lista-ok">${(n.itens || []).map((i) => `<li>${ic("check")}${esc(i)}</li>`).join("")}</ul></div>`;
  function mostrarNovidades(lista) {
    if (!lista?.length) return;
    modal({ titulo: `Novidades da versão ${est.versao}`, corpo: `<p class="frase" style="margin:0 0 12px">O Vagabs foi atualizado. Seus dados continuam todos aqui.</p>${[...lista].reverse().map(fmtNovidade).join("")}`, botoes: [{ rot: "Entendi", cls: "p", acao: () => api("novidades/vistas", { metodo: "POST" }) }] });
    api("novidades/vistas", { metodo: "POST" }).catch(() => {});
  }

  /* ---------- trabalho do Claude: indicador, fila, detalhes ---------- */
  const relogio = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function desenharTrabalho() {
    const el = document.getElementById("trabalho"); if (!el) return;
    const ex = est.execucao;
    const naFila = (db.pedidos || []).filter((p) => p.status === "fila").length;
    if (ex) {
      const ROT = { fila: `Pedido ${ex.indice || 1} de ${ex.total || 1}`, varredura: "Varredura", preparar: "Preparando" };
      el.innerHTML = `<button type="button" class="trab on" data-ver-trab><i class="pulso"></i><span>Claude trabalhando · ${esc(ROT[ex.tipo] || ex.rotulo)} · <b data-relogio>${relogio(Date.now() - ex.inicio)}</b></span></button>`;
    } else if (naFila) el.innerHTML = `<button type="button" class="trab fila" data-rodar-fila>${ic("play")}<span>Rodar fila (${naFila})</span></button>`;
    else el.innerHTML = est.limite ? `<span class="trab limite" title="O plano do Claude bateu no limite de uso">${ic("alerta")}<span>Plano no limite</span></span>` : "";
    el.querySelector("[data-ver-trab]")?.addEventListener("click", verTrabalho);
    el.querySelector("[data-rodar-fila]")?.addEventListener("click", rodarFila);
  }
  setInterval(() => {
    if (!est.execucao) return;
    const r = document.querySelector("[data-relogio]"); if (r) r.textContent = relogio(Date.now() - est.execucao.inicio);
    const m = painelTrab?.isConnected && painelTrab.querySelector("[data-trab-tempo]"); if (m) m.textContent = relogio(Date.now() - est.execucao.inicio);
  }, 1000);
  VG.desenharTrabalho = desenharTrabalho;

  function precisaClaude() {
    if (est.claude?.instalado && est.claude?.logado) return false;
    modal({ titulo: "O Claude ainda não está pronto", corpo: `<p class="frase" style="margin:0">${est.claude?.instalado ? "O Claude Code não está conectado à sua conta." : "O Claude Code não foi encontrado neste computador."} Abra a aba Claude para resolver.</p>`, botoes: [{ rot: "Ir para a aba Claude", cls: "p", acao: () => { location.hash = "#/claude"; } }] });
    return true;
  }
  async function rodarFila() {
    if (precisaClaude()) return;
    try { await api("fila/rodar", { metodo: "POST" }); toast("O Claude começou a fila"); } catch (e) { toast(e.message); }
  }
  async function rodarVarredura() {
    if (precisaClaude()) return;
    try { await api("varredura/rodar", { metodo: "POST" }); toast("Varredura começou. Leva alguns minutos."); verTrabalho(); } catch (e) { toast(e.message); }
  }
  VG.rodarFila = rodarFila; VG.rodarVarredura = rodarVarredura;

  let painelTrab = null;
  function corpoTrabalho() {
    const ex = est.execucao;
    if (!ex) return `<p class="frase" style="margin:0">Terminou.</p>`;
    const passos = ex.passos || [];
    return `<p class="meta" style="margin-bottom:10px">${esc(ex.rotulo || "")} · <span data-trab-tempo>${relogio(Date.now() - ex.inicio)}</span></p><ol class="passos-trab">${passos.slice(-60).map((p) => `<li>${esc(p.txt)}${p.n > 1 ? ` <b class="conta-passo">×${p.n}</b>` : ""}</li>`).join("") || "<li>Começando…</li>"}</ol>`;
  }
  function verTrabalho() {
    if (painelTrab?.isConnected) return;
    painelTrab = modal({ titulo: "O que o Claude está fazendo", corpo: `<div data-trab-corpo>${corpoTrabalho()}</div>`, classe: "largo",
      botoes: est.execucao?.tipo === "fila" ? [{ rot: "Parar depois deste", acao: () => api("fila/parar", { metodo: "POST" }).then(() => toast("Para depois do atual")) }, { rot: "Fechar", cls: "p" }] : [{ rot: "Fechar", cls: "p" }] });
  }
  function atualizarPainelTrab() {
    const c = painelTrab?.isConnected && painelTrab.querySelector("[data-trab-corpo]");
    if (c) { c.innerHTML = corpoTrabalho(); const ol = c.querySelector("ol"); if (ol) ol.scrollTop = ol.scrollHeight; }
  }
  VG.verTrabalho = verTrabalho;

  // preparação do fim do setup: um popup acompanhando
  let painelPrep = null;
  VG.preparando = () => {
    painelPrep = modal({ titulo: "Preparando o seu Vagabs", fechar: false, classe: "largo",
      corpo: `<p class="frase" style="margin:0 0 12px">O Claude está lendo o seu material, montando o perfil, os feitos e a busca, e criando uma vaga de exemplo. Leva alguns minutos.</p><div data-trab-corpo>${corpoTrabalho()}</div>`,
      botoes: [{ rot: "Continuar enquanto ele trabalha", acao: () => { painelPrep = null; } }] });
    painelTrab = painelPrep;
  };

  /* ---------- console embutido (xterm) ---------- */
  const terminais = new Set();
  VG.terminal = async (el, { altura = 420 } = {}) => {
    el.style.height = `${altura}px`;
    const term = new Terminal({ fontFamily: "Cascadia Mono, Consolas, monospace", fontSize: 13, lineHeight: 1.15, cursorBlink: true, convertEol: false, scrollback: 5000,
      theme: { background: "#121417", foreground: "#e8eaed", cursor: "#e39b00", selectionBackground: "#3a4150", black: "#121417", brightBlack: "#6b717b" } });
    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit); term.open(el);
    const ajustar = () => { try { fit.fit(); api("console/tamanho", { metodo: "POST", corpo: { cols: term.cols, rows: term.rows } }).catch(() => {}); } catch {} };
    const t = { term, el, ajustar };
    terminais.add(t);
    term.onData((d) => api("console/entrada", { metodo: "POST", corpo: { dados: d } }).catch(() => {}));
    // copiar com Ctrl+C quando houver seleção; colar com Ctrl+V
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      if (e.ctrlKey && e.key.toLowerCase() === "c" && term.hasSelection()) { navigator.clipboard.writeText(term.getSelection()); return false; }
      if (e.ctrlKey && e.key.toLowerCase() === "v") { navigator.clipboard.readText().then((x) => x && api("console/entrada", { metodo: "POST", corpo: { dados: x } })); return false; }
      return true;
    });
    new ResizeObserver(ajustar).observe(el);
    try { const s = await api("console/iniciar", { metodo: "POST" }); if (s.saida) term.write(s.saida); } catch (e) { term.write(`\r\nNão consegui abrir o console: ${e.message}\r\n`); }
    setTimeout(ajustar, 50);
    return t;
  };
  function paraTerminais(fn) { for (const t of [...terminais]) { if (!t.el.isConnected) { t.term.dispose(); terminais.delete(t); continue; } fn(t); } }

  /* ---------- tela: Claude (chat) ----------
     Conversa com o Claude Code da pessoa: cada mensagem continua a mesma sessão, a resposta chega
     enquanto ele escreve e, embaixo, aparece o que ele está fazendo. O terminal fica recolhido no pé. */
  est.conversa = est.conversa || { mensagens: [], carregada: false };

  // markdown simples e seguro: escapa tudo antes, depois aplica negrito, itálico, código, links e listas
  function md(texto) {
    const blocos = [];
    let t = esc(texto).replace(/```[a-z]*\n?([\s\S]*?)```/g, (m, c) => { blocos.push(`<pre><code>${c.replace(/\n$/, "")}</code></pre>`); return `\u0000${blocos.length - 1}\u0000`; });
    const inline = (x) => x
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    const saida = [];
    for (const par of t.split(/\n{2,}/)) {
      const linhas = par.split("\n");
      if (/^\u0000\d+\u0000$/.test(par.trim())) { saida.push(blocos[+par.trim().slice(1, -1)]); continue; }
      if (linhas.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l) || !l.trim())) {
        const num = /^\s*\d/.test(linhas[0]);
        saida.push(`<${num ? "ol" : "ul"}>${linhas.filter((l) => l.trim()).map((l) => `<li>${inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>`).join("")}</${num ? "ol" : "ul"}>`);
        continue;
      }
      const h = /^(#{1,4})\s+(.*)$/.exec(linhas[0]);
      if (h && linhas.length === 1) { saida.push(`<h4>${inline(h[2])}</h4>`); continue; }
      saida.push(`<p>${linhas.map(inline).join("<br>")}</p>`);
    }
    return saida.join("").replace(/\u0000(\d+)\u0000/g, (m, i) => blocos[+i]);
  }

  const MARCA_CLAUDE = `<span class="chat-quem" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#121417"/><path d="M7.5 9.5 16 24l8.5-14.5" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24.5" cy="9.5" r="3.6" fill="#e39b00"/></svg></span>`;
  function bolha(m, ultima) {
    if (m.papel === "voce") return `<div class="chat-msg voce"><div class="chat-bolha">${md(m.texto)}</div></div>`;
    const trabalhando = ultima && est.conversa.ocupado;
    const passos = m.passos || [];
    const rodape = trabalhando
      ? `<div class="chat-fazendo"><i class="pulso"></i>${esc(passos.at(-1) || "Pensando…")}</div>`
      : passos.length ? `<details class="chat-passos"><summary>${VG.plural(passos.length, "passo", "passos")} até a resposta</summary><ol>${passos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></details>` : "";
    const corpo = m.texto ? md(m.texto) : trabalhando ? `<span class="chat-digitando"><i></i><i></i><i></i></span>` : "";
    return `<div class="chat-msg claude ${m.erro ? "erro" : ""}">${MARCA_CLAUDE}<div><div class="chat-bolha">${corpo}</div>${rodape}</div></div>`;
  }
  const SUGESTOES = ["Qual das vagas para triar vale mais a pena para mim?", "Revisa meus feitos e diz o que falta de número.", "Me prepara para uma entrevista de emprego.", "Sugere 10 empresas parecidas com as minhas."];
  function corpoChat() {
    const M = est.conversa.mensagens;
    if (!M.length) {
      const nome = String(db.perfil?.nome || "").split(/\s+/)[0];
      return `<div class="chat-vazio"><div class="chat-vazio-marca">${MARCA_CLAUDE}</div><h2>E aí${nome ? `, ${esc(nome)}` : ", vagabs"}? Sobre o que vamos conversar?</h2><p class="meta">O Claude enxerga as suas vagas, os seus feitos e as suas preferências, e pode mudar as coisas por aqui.</p><div class="opcoes chat-sugestoes">${SUGESTOES.map((x) => `<button type="button" class="ficha" data-sugestao="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>`;
    }
    return M.map((m, i) => bolha(m, i === M.length - 1)).join("");
  }
  function telaClaude() {
    const c = est.claude, u = est.uso;
    const janela = u?.unifiedWindows?.five_hour, semana = u?.unifiedWindows?.seven_day;
    const pct = (x) => (x?.utilization != null ? `${Math.round(x.utilization * 100)}%` : "—");
    const outro = est.execucao && est.execucao.tipo !== "conversa";
    const pronto = c?.instalado && c?.logado;
    return `<section class="tela entra"><div class="titulo"><div><h1>Claude</h1><p class="frase">Converse com o seu Claude sobre a busca. Ele lembra do que vocês já falaram nesta conversa.</p></div>
        <button class="btn" type="button" data-nova-conversa ${est.conversa.ocupado || !est.conversa.mensagens.length ? "disabled" : ""}>${ic("mais")}Nova conversa</button></div>
      <div class="grade">
        <section class="painel chat">
          <div class="chat-msgs" id="chat-msgs">${corpoChat()}</div>
          ${outro ? `<p class="aviso-linha chat-aviso">${ic("relogio")}O Claude está ocupado com ${est.execucao.tipo === "varredura" ? "a varredura" : "a fila"}. A conversa volta quando ele terminar.</p>` : ""}
          ${!pronto && c ? `<p class="aviso-linha chat-aviso">${ic("alerta")}${c.instalado ? "O Claude Code não está conectado. Faça o login no terminal aqui ao lado." : "O Claude Code não foi encontrado. Instale pelo terminal aqui ao lado."}</p>` : ""}
          <form class="chat-caixa" id="chat-form"><textarea id="chat-texto" rows="1" placeholder="Escreva para o Claude…" aria-label="Mensagem para o Claude"></textarea>
            ${est.conversa.ocupado ? `<button class="btn g" type="button" id="chat-parar">${ic("parar")}Parar</button>` : `<button class="btn p g" type="submit" ${outro || !pronto ? "disabled" : ""}>${ic("enviar")}Enviar</button>`}</form>
          <p class="meta chat-dica">Enter envia · Shift+Enter quebra a linha</p>
        </section>
        <div class="coluna">
          <section class="painel"><div class="cab"><h2>Situação</h2><button class="btn txt" type="button" data-checar>${ic("atualizar")}Conferir</button></div><div class="lista-kv">
            <div><span>Claude Code</span><b>${c ? (c.instalado ? `instalado · ${esc(c.versao)}` : "não encontrado") : "…"}</b></div>
            <div><span>Conta</span><b>${c?.logado ? esc(c.email || "conectada") : "não conectada"}</b></div>
            <div><span>Plano</span><b>${esc(c?.plano || "—")}</b></div>
            <div><span>Uso da janela de 5 h</span><b>${pct(janela)}</b></div>
            <div><span>Uso da semana</span><b>${pct(semana)}</b></div></div>
            ${est.limite ? `<p class="aviso-linha" style="margin-top:12px">${ic("alerta")}O plano bateu no limite${est.limite.ate ? `; volta por volta de ${new Date(est.limite.ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}.</p>` : ""}
            <p class="meta" style="margin-top:12px">O uso aparece depois que o Claude trabalha pela primeira vez nesta sessão. Pedidos longos funcionam melhor pela fila (tela Pedidos).</p></section>
          <details class="painel terminal-avancado" ${!pronto && c ? "open" : ""}><summary><b>Terminal (avançado)</b><span class="meta">login, instalação e o Claude Code puro</span></summary>
            <div class="botoes" style="margin-top:12px">${c && !c.instalado ? `<button class="btn p" type="button" data-cmd="instalar">${ic("play")}Instalar o Claude Code</button>` : ""}${c?.instalado && !c.logado ? `<button class="btn p" type="button" data-cmd="login">${ic("play")}Fazer login</button>` : ""}<button class="btn" type="button" data-cmd="claude">${ic("play")}Abrir o Claude aqui</button><button class="btn txt" type="button" data-reiniciar>${ic("atualizar")}Reiniciar</button></div>
            <div class="console" data-console style="margin-top:12px"></div></details>
        </div></div></section>`;
  }
  const rolar = (forcar) => { const el = document.getElementById("chat-msgs"); if (el && (forcar || el.scrollHeight - el.scrollTop - el.clientHeight < 160)) el.scrollTop = el.scrollHeight; };
  // atualiza só a última bolha (sem redesenhar a tela, para não perder o que a pessoa está digitando)
  function atualizarChat(forcar = false) {
    const el = document.getElementById("chat-msgs"); if (!el) return;
    const M = est.conversa.mensagens;
    const ult = el.querySelector(".chat-msg:last-child");
    if (ult && M.length && el.children.length === M.length) { ult.outerHTML = bolha(M.at(-1), true); }
    else el.innerHTML = corpoChat();
    rolar(forcar);
  }
  async function carregarConversa() {
    try { const c = await api("conversa"); est.conversa = { ...est.conversa, mensagens: c.mensagens || [], carregada: true, ocupado: est.execucao?.tipo === "conversa" }; } catch {}
  }
  async function enviar(texto) {
    texto = String(texto || "").trim(); if (!texto) return;
    if (precisaClaude()) return;
    const r = await api("conversa/enviar", { metodo: "POST", corpo: { texto } }).catch((e) => ({ ok: false, motivo: e.message }));
    if (!r.ok) return toast(r.motivo || "Não consegui enviar");
    await carregarConversa(); est.conversa.ocupado = !!r.ocupado;
    VG.render(true); rolar(true);
    document.getElementById("chat-texto")?.focus();
  }
  function ligarClaude() {
    if (!est.conversa.carregada) carregarConversa().then(() => { if (VG.rotaAtual()[0] === "claude") { VG.render(true); } });
    rolar(true);
    const ta = document.getElementById("chat-texto");
    const ajustar = () => { ta.style.height = "auto"; ta.style.height = `${Math.min(200, ta.scrollHeight)}px`; };
    ta?.addEventListener("input", ajustar);
    ta?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!est.conversa.ocupado) document.getElementById("chat-form").requestSubmit(); } });
    document.getElementById("chat-form")?.addEventListener("submit", (e) => { e.preventDefault(); const t = ta.value; if (!t.trim() || est.conversa.ocupado) return; ta.value = ""; ajustar(); enviar(t); });
    document.getElementById("chat-parar")?.addEventListener("click", () => api("conversa/parar", { metodo: "POST" }));
    document.querySelectorAll("[data-sugestao]").forEach((b) => b.addEventListener("click", () => enviar(b.dataset.sugestao)));
    document.querySelector("[data-nova-conversa]")?.addEventListener("click", async () => {
      const r = await api("conversa/nova", { metodo: "POST" }); if (!r.ok) return toast(r.motivo);
      est.conversa.mensagens = []; VG.render(true); toast("Conversa nova. A anterior fica guardada na pasta conversas.");
    });
    const det = document.querySelector(".terminal-avancado"), cons = document.querySelector("[data-console]");
    const abrirTerminal = () => { if (det.open && cons && !cons.dataset.ligado) { cons.dataset.ligado = "1"; VG.terminal(cons, { altura: 300 }); } };
    det?.addEventListener("toggle", abrirTerminal); abrirTerminal();
    document.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => { if (det) det.open = true; api("console/comando", { metodo: "POST", corpo: { qual: b.dataset.cmd } }); }));
    document.querySelector("[data-reiniciar]")?.addEventListener("click", async () => { await api("console/reiniciar", { metodo: "POST" }); });
    document.querySelector("[data-checar]")?.addEventListener("click", async () => { est.claude = await api("claude/checar"); VG.render(true); });
  }
  VG.chatEvento = (e) => {
    const M = est.conversa.mensagens;
    if (e.mensagem) { if (M.length && M.at(-1).papel === "claude") M[M.length - 1] = e.mensagem; else M.push(e.mensagem); }
    est.conversa.ocupado = !!e.ocupado;
    if (VG.rotaAtual()[0] !== "claude") return;
    if (e.fim || e.nova) { const ta = document.getElementById("chat-texto"); const t = ta?.value || "", foco = document.activeElement === ta; VG.render(true); const n = document.getElementById("chat-texto"); if (n) { n.value = t; if (foco) n.focus(); } rolar(true); }
    else atualizarChat();
  };
  VG.telas.claude = telaClaude; VG.ligar.claude = ligarClaude; VG.titulos.claude = "Claude";

  /* ---------- tela: Configurações ---------- */
  const MODELOS = [["claude-opus-5-5", "Opus 5.5 · o melhor (padrão)"], ["claude-sonnet-5-5", "Sonnet 5.5 · gasta menos do plano"]];
  function telaConfig() {
    const C = db.config || {}, V = C.varredura || {}, F = V.fontes || { gupy: true, linkedin: true, empresas: true };
    const a = est.atualizacao || {};
    const ESTA = { dev: "Versão de desenvolvimento: sem atualização automática.", "sem-repositorio": "Atualização automática ainda não configurada nesta versão.", procurando: "Procurando…", "em-dia": "Você está na versão mais nova.", disponivel: `Versão ${a.versao} disponível.`, baixando: `Baixando… ${a.progresso || 0}%`, pronta: `Versão ${a.versao} baixada. Reinicie para instalar.`, erro: `Não consegui conferir: ${a.erro || ""}`, parada: "—" };
    const linhas = (k) => esc((V[k] || []).join("\n"));
    return `<section class="tela entra"><div class="titulo"><div><h1>Configurações<small>Vagabs ${esc(est.versao)}</small></h1></div></div>
      <div class="grade"><div class="coluna">
        <section class="painel"><div class="cab"><h2>Busca de vagas</h2></div>
          <div class="campos-config">
            <label><span>Termos de busca <small class="meta">(um por linha)</small></span><textarea data-lista="termos" rows="6">${linhas("termos")}</textarea></label>
            <label><span>O título precisa ter <small class="meta">(um por linha; vazio = qualquer)</small></span><textarea data-lista="palavras_titulo" rows="4">${linhas("palavras_titulo")}</textarea></label>
            <label><span>Nunca no título <small class="meta">(um por linha)</small></span><textarea data-lista="excluir_titulo" rows="4">${linhas("excluir_titulo")}</textarea></label>
            <label><span>Local para o LinkedIn</span><input data-v="local" value="${esc(V.local || "")}" placeholder="Ex.: São Paulo, Brazil"></label>
            <label><span>Nota mínima: <b id="corte-cfg">${V.corte || 60}</b></span><input type="range" min="40" max="85" step="5" data-corte value="${V.corte || 60}" class="faixa"></label>
          </div>
          <div class="opcoes" style="margin-top:12px">${[["gupy", "Gupy"], ["linkedin", "LinkedIn público"], ["empresas", "Sites das empresas"]].map(([k, r]) => `<button type="button" class="ficha" data-fonte="${k}" aria-pressed="${F[k] !== false}">${r}</button>`).join("")}</div>
          <button class="btn p" type="button" id="salvar-busca" style="margin-top:14px">${ic("check")}Salvar a busca</button></section>
        <section class="painel"><div class="cab"><h2>E-mail</h2></div>
          <div class="opcoes"><button type="button" class="ficha" data-email="manual" aria-pressed="${C.email?.modo !== "gmail"}">À mão</button><button type="button" class="ficha" data-email="gmail" aria-pressed="${C.email?.modo === "gmail"}">Pelo Gmail (só leitura)</button></div>
          <p class="meta" style="margin-top:10px">Pelo Gmail, a varredura lê retornos de processos com o conector do Gmail da sua conta Claude (claude.ai › Configurações › Conectores). Nada é enviado.</p>
          ${C.email?.modo === "gmail" ? `<div class="botoes"><button class="btn" type="button" data-testar-gmail>${ic("atualizar")}Testar o Gmail</button>${est.ferramentas?.gmail ? (est.ferramentas.gmail.ferramentas.length ? `<span class="ok-linha">${ic("check")}Gmail conectado.</span>` : `<span class="aviso-linha">${ic("alerta")}Gmail não encontrado na sua conta Claude.</span>`) : ""}</div>` : ""}</section>
        <section class="painel"><div class="cab"><h2>Claude</h2></div>
          <label class="campo"><span>Modelo</span><select id="modelo">${MODELOS.map(([v, r]) => `<option value="${v}" ${(C.claude?.modelo || "claude-opus-5-5") === v ? "selected" : ""}>${r}</option>`).join("")}</select></label>
          <p class="meta" style="margin-top:8px">Esforço médio nos pedidos e alto nos kits. Se o seu plano bater no limite com frequência, troque para o Sonnet.</p></section>
      </div>
      <div class="coluna">
        <section class="painel"><div class="cab"><h2>Atualizações</h2></div><p class="meta">${esc(ESTA[a.estado] || a.estado || "—")}</p>
          ${a.estado === "disponivel" && a.notas ? `<div class="notas-txt">${esc(a.notas).replace(/\n/g, "<br>")}</div>` : ""}
          <div class="botoes">${a.estado === "disponivel" ? `<button class="btn p" type="button" data-atu="baixar">Baixar a atualização</button>` : a.estado === "pronta" ? `<button class="btn ok" type="button" data-atu="instalar">Reiniciar e atualizar</button>` : `<button class="btn" type="button" data-atu="procurar" ${["dev", "sem-repositorio", "procurando", "baixando"].includes(a.estado) ? "disabled" : ""}>${ic("atualizar")}Procurar atualizações</button>`}</div>
          <p class="meta" style="margin-top:10px">A atualização troca só o programa. Seus dados, documentos e configurações ficam onde estão.</p></section>
        <section class="painel"><div class="cab"><h2>Pasta do Vagabs</h2></div><p class="caminho-txt"><code>${esc(est.pasta || "")}</code></p><button class="btn" type="button" id="abrir-pasta-cfg">${ic("pasta")}Abrir a pasta</button></section>
        <section class="painel"><div class="cab"><h2>Ajuda</h2></div><div class="botoes" style="margin-top:0"><button class="btn" type="button" id="refazer-tutorial">Refazer o tutorial</button><a class="btn" href="#/setup">Refazer o setup</a><button class="btn" type="button" id="ver-novidades">Novidades</button></div></section>
      </div></div></section>`;
  }
  function ligarConfig() {
    const C = db.config;
    const fontes = { ...(C.varredura?.fontes || { gupy: true, linkedin: true, empresas: true }) };
    document.querySelectorAll("[data-fonte]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.fonte; fontes[k] = fontes[k] === false; b.setAttribute("aria-pressed", fontes[k] !== false); }));
    document.querySelector("[data-corte]")?.addEventListener("input", (e) => { document.getElementById("corte-cfg").textContent = e.target.value; });
    document.getElementById("salvar-busca")?.addEventListener("click", () => {
      const v = { ...C.varredura, fontes };
      document.querySelectorAll("[data-lista]").forEach((t) => { v[t.dataset.lista] = t.value.split("\n").map((s) => s.trim()).filter(Boolean); });
      v.local = document.querySelector('[data-v="local"]').value.trim();
      v.corte = +document.querySelector("[data-corte]").value;
      C.varredura = v; VG.salvar("config", "Busca salva");
    });
    document.querySelectorAll("[data-email]").forEach((b) => b.addEventListener("click", () => { C.email = { ...C.email, modo: b.dataset.email }; VG.salvar("config", b.dataset.email === "gmail" ? "E-mail pelo Gmail" : "E-mail à mão"); VG.render(true); }));
    document.querySelector("[data-testar-gmail]")?.addEventListener("click", async () => { toast("Testando…"); try { est.ferramentas = await api("claude/ferramentas", { metodo: "POST" }); } catch (e) { toast(e.message); } VG.render(true); });
    document.getElementById("modelo")?.addEventListener("change", (e) => { C.claude = { ...C.claude, modelo: e.target.value }; VG.salvar("config", "Modelo salvo"); });
    document.querySelectorAll("[data-atu]").forEach((b) => b.addEventListener("click", async () => { est.atualizacao = await api(`atualizacao/${b.dataset.atu}`, { metodo: "POST" }); VG.render(true); }));
    document.getElementById("abrir-pasta-cfg")?.addEventListener("click", () => api("pasta/abrir", { metodo: "POST" }));
    document.getElementById("refazer-tutorial")?.addEventListener("click", () => tutorial.iniciar());
    document.getElementById("ver-novidades")?.addEventListener("click", () => modal({ titulo: "Novidades", corpo: (est.todasNovidades || []).map(fmtNovidade).join(""), botoes: [{ rot: "Fechar", cls: "p" }] }));
  }
  VG.telas.config = telaConfig; VG.ligar.config = ligarConfig; VG.titulos.config = "Configurações";

  /* ---------- documentos (Base e setup) ---------- */
  VG.ligarDocumentos = async (listaEl, input) => {
    if (!listaEl) return;
    const desenhar = async () => {
      let docs = []; try { docs = await api("documentos"); } catch {}
      listaEl.innerHTML = docs.length ? docs.map((d) => `<div><span>${ic("arquivo")}</span><b style="flex:1">${esc(d.nome)}</b><span class="meta">${d.kb} KB</span><button class="btn txt nao" type="button" data-tirar-doc="${esc(d.nome)}" aria-label="Tirar ${esc(d.nome)}">${ic("x")}</button></div>`).join("") : `<p class="meta">Nenhum documento ainda.</p>`;
      listaEl.querySelectorAll("[data-tirar-doc]").forEach((b) => b.addEventListener("click", async () => { if (!confirm(`Tirar ${b.dataset.tirarDoc} da pasta documentos?`)) return; await api(`documentos?nome=${encodeURIComponent(b.dataset.tirarDoc)}`, { metodo: "DELETE" }); desenhar(); }));
    };
    input?.addEventListener("change", async () => {
      for (const f of input.files) {
        try { await api("documentos", { metodo: "POST", corpo: f, cabecalhos: { "X-Nome": encodeURIComponent(f.name), "Content-Type": "application/octet-stream" } }); toast(`${f.name} guardado`); }
        catch (e) { toast(`${f.name}: ${e.message}`); }
      }
      input.value = ""; desenhar();
    });
    desenhar();
  };

  /* ---------- tutorial em balões ---------- */
  const tutorial = (() => {
    let i = -1, passos = [];
    const exemplo = () => db.vagas.find((v) => v.exemplo);
    function montar() {
      const ex = exemplo();
      return [
        { rota: "#/hoje", alvo: null, titulo: "Bem-vindo, vagabs", texto: "Um tour rápido usando a <b>vaga de exemplo</b> que o Claude criou para você. Ela é de mentira e tem o selo EXEMPLO em todo lugar." },
        { rota: "#/hoje", alvo: '[data-tut="triar"]', titulo: "Vagas para triar", texto: "As vagas novas chegam aqui, com a nota de aderência (0 a 100) calculada pelo que importa para você." },
        { rota: ex && ex.estado === "nova" ? `#/triagem/${ex.id}` : "#/triagem", alvo: '[data-tut="cartao"]', titulo: "O cartão da vaga", texto: "Resumo, motivos da nota e alertas de sigilo. O botão \"Ver a nota por dimensão\" vira o cartão e mostra o detalhe." },
        { rota: ex && ex.estado === "nova" ? `#/triagem/${ex.id}` : "#/triagem", alvo: '[data-tut="decidir"]', titulo: "Você decide", texto: "Aprovar, deixar para depois ou reprovar (com o motivo, que ajusta as próximas notas). <b>Experimente aprovar o exemplo agora.</b>", espera: true },
        { rota: "#/pedidos", alvo: '[data-tut="fila"]', titulo: "A fila do Claude", texto: "Numa vaga real, aprovar põe o pedido do kit nesta fila. Nada roda sozinho: você clica em <b>Rodar fila</b> quando quiser, e o Claude faz um pedido de cada vez." },
        { rota: "#/pedidos", alvo: ".barra .direita", titulo: "Rodar fila", texto: "Quando houver pedidos esperando, o botão <b>Rodar fila</b> aparece aqui em cima, com o número. Enquanto o Claude trabalha, ele mostra o tempo; clique para ver o que ele está fazendo." },
        { rota: ex ? `#/vaga/${ex.id}` : "#/candidaturas", alvo: '[data-tut="guia"]', titulo: "O kit de candidatura", texto: "Passo a passo para se candidatar, com os seus dados para copiar, respostas sugeridas (editáveis) e a carta. Marque cada passo quando fizer." },
        { rota: ex ? `#/vaga/${ex.id}` : "#/candidaturas", alvo: '[data-tut="fase"]', titulo: "Acompanhar o processo", texto: "Depois de enviar, mude a fase quando a empresa responder: triagem, teste, entrevista, proposta. Se você ligou o Gmail, a varredura faz isso por você." },
        { rota: "#/varreduras", alvo: '[data-tut="varrer"]', titulo: "Varredura", texto: "Busca vagas novas nas fontes. Ela só roda quando você pede, e o app pergunta ao abrir se já passou um dia." },
        { rota: "#/claude", alvo: '[data-nav="claude"]', titulo: "A aba Claude", texto: "O seu Claude Code, aqui dentro. Converse sobre a busca, peça análises, prepare entrevistas." },
      ];
    }
    let alvoAtual = null;
    function limpar() { document.getElementById("tutorial").innerHTML = ""; alvoAtual = null; }
    // holofote: escurece em volta do alvo sem bloquear a tela (dá para clicar no que ele mostra)
    function luz() {
      const l = document.querySelector(".tut-luz"); if (!l || !alvoAtual) return;
      const r = alvoAtual.getBoundingClientRect();
      Object.assign(l.style, { top: `${r.top - 6}px`, left: `${r.left - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    }
    addEventListener("scroll", luz, { passive: true });
    function mostrar() {
      limpar();
      const p = passos[i]; if (!p) return fim();
      const alvo = p.alvo && document.querySelector(p.alvo);
      const camada = document.getElementById("tutorial");
      camada.innerHTML = `${alvo ? `<div class="tut-luz"></div>` : `<div class="tut-fundo"></div>`}<div class="tut-balao" role="dialog" aria-label="${esc(p.titulo)}"><span class="meta">${i + 1} de ${passos.length}</span><h3>${esc(p.titulo)}</h3><p>${p.texto}</p><div class="tut-botoes"><button class="btn txt" type="button" data-tut-sair>Pular o tutorial</button>${i ? `<button class="btn" type="button" data-tut-voltar>Voltar</button>` : ""}<button class="btn p" type="button" data-tut-prox>${i === passos.length - 1 ? "Terminar" : "Próximo"}</button></div></div>`;
      const balao = camada.querySelector(".tut-balao");
      if (alvo) {
        const alto = alvo.getBoundingClientRect().height > innerHeight * 0.55;
        alvo.scrollIntoView({ block: alto ? "start" : "center", behavior: "instant" });
        if (alto) scrollBy(0, -80);
        alvoAtual = alvo; luz();
        const r = alvo.getBoundingClientRect();
        const b = balao.getBoundingClientRect();
        let top, left;
        if (alto) {
          // alvo grande: o balão fica ao lado, sem cobrir
          top = Math.max(80, Math.min(r.top, innerHeight - b.height - 16));
          left = r.right + 16 + b.width < innerWidth - 8 ? r.right + 16 : r.left - b.width - 16 > 8 ? r.left - b.width - 16 : innerWidth - b.width - 16;
          if (left === innerWidth - b.width - 16) top = innerHeight - b.height - 16;
        } else {
          top = r.bottom + 14; left = Math.min(Math.max(16, r.left), innerWidth - b.width - 16);
          if (top + b.height > innerHeight - 16) top = Math.max(16, r.top - b.height - 14);
        }
        Object.assign(balao.style, { top: `${top}px`, left: `${left}px` });
      } else balao.classList.add("centro");
      camada.querySelector("[data-tut-prox]").addEventListener("click", () => ir(i + 1));
      camada.querySelector("[data-tut-voltar]")?.addEventListener("click", () => ir(i - 1));
      camada.querySelector("[data-tut-sair]").addEventListener("click", fim);
      camada.querySelector("[data-tut-prox]").focus();
    }
    function ir(n) {
      i = n; if (i >= passos.length) return fim();
      passos = montar(); // a vaga de exemplo muda de estado durante o tour
      const p = passos[i];
      if (location.hash !== p.rota) { location.hash = p.rota; setTimeout(mostrar, 420); } else mostrar();
    }
    async function iniciar() {
      if (!exemplo()) { try { await api("exemplo/criar", { metodo: "POST" }); await VG.carregar(["vagas"]); } catch {} }
      passos = montar(); ir(0);
    }
    function fim() {
      limpar(); i = -1;
      db.config.tutorial = { concluido: true, quando: new Date().toISOString() }; VG.salvar("config", "");
      if (exemplo()) modal({ titulo: "Pronto, vagabs formado", corpo: `<p class="frase" style="margin:0">Quer apagar a vaga de exemplo agora? Dá para refazer o tutorial depois em Configurações, e ele cria outra.</p>`, botoes: [{ rot: "Guardar o exemplo" }, { rot: "Apagar o exemplo", cls: "p", acao: () => VG.apagarExemplo() }] });
      else location.hash = "#/hoje";
    }
    VG.aoDecidir = (v) => { if (i >= 0 && passos[i]?.espera && v.exemplo) setTimeout(() => ir(i + 1), 500); };
    addEventListener("resize", () => { if (i >= 0) mostrar(); });
    const oferecer = () => {
      if (db.config.tutorial?.concluido) return;
      modal({ titulo: "Quer um tour rápido, vagabs?", corpo: `<p class="frase" style="margin:0">Dois minutos, usando a vaga de exemplo, para ver como triar, pedir ao Claude, rodar a fila e acompanhar as candidaturas.</p>`, botoes: [{ rot: "Agora não", acao: () => { db.config.tutorial = { pulado: true }; VG.salvar("config", ""); } }, { rot: "Fazer o tutorial", cls: "p", acao: () => { iniciar(); } }] });
    };
    return { iniciar, oferecer, ativo: () => i >= 0 };
  })();
  VG.tutorial = tutorial;

  /* ---------- aviso de varredura (passou de 24 h) ---------- */
  let perguntouVarredura = false;
  function talvezVarredura() {
    const V = db.config?.varredura || {};
    if (perguntouVarredura || !est.setup || est.execucao || !(V.termos || []).length || !est.claude?.logado || tutorial.ativo()) return;
    if (V.adiada_em === new Date().toISOString().slice(0, 10)) return;
    const ultima = V.ultima ? new Date(V.ultima).getTime() : 0;
    if (Date.now() - ultima < 24 * 3600 * 1000) return;
    perguntouVarredura = true;
    modal({ titulo: "Bora caçar vaga hoje?", corpo: `<p class="frase" style="margin:0">${ultima ? `A última varredura foi ${new Date(ultima).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.` : "Você ainda não rodou nenhuma varredura."} Ela busca vagas novas nas suas fontes e o Claude dá nota a elas. Leva alguns minutos e usa um pouco do seu plano.</p>`,
      botoes: [{ rot: "Hoje não", acao: () => api("varredura/adiar", { metodo: "POST" }) }, { rot: "Rodar agora", cls: "p", acao: () => rodarVarredura() }] });
  }

  /* ---------- atualização disponível ---------- */
  let avisouVersao = null;
  function avisarAtualizacao() {
    const a = est.atualizacao || {};
    if (a.estado === "disponivel" && avisouVersao !== a.versao) {
      avisouVersao = a.versao;
      modal({ titulo: `Versão ${a.versao} disponível`, corpo: `<p class="frase" style="margin:0 0 10px">Tem uma versão nova do Vagabs. A atualização troca só o programa: seus dados ficam onde estão.</p>${a.notas ? `<div class="notas-txt">${esc(a.notas).replace(/\n/g, "<br>")}</div>` : ""}`,
        botoes: [{ rot: "Depois" }, { rot: "Atualizar agora", cls: "p", acao: () => api("atualizacao/baixar", { metodo: "POST" }).then(() => toast("Baixando a atualização…")) }] });
    }
    if (a.estado === "pronta" && avisouVersao !== `pronta-${a.versao}`) {
      avisouVersao = `pronta-${a.versao}`;
      modal({ titulo: "Atualização pronta", corpo: `<p class="frase" style="margin:0">A versão ${esc(a.versao)} foi baixada. O Vagabs reinicia para instalar e volta em seguida.</p>`, botoes: [{ rot: "Depois (instala ao fechar)" }, { rot: "Reiniciar agora", cls: "p", acao: () => api("atualizacao/instalar", { metodo: "POST" }) }] });
    }
  }

  /* ---------- eventos ao vivo ---------- */
  let pendente = false, recarga = null;
  const digitando = () => !!document.activeElement?.closest?.("input, textarea, select, [contenteditable], .xterm");
  function redesenhar() {
    if (VG.rotaAtual()[0] === "setup" || document.querySelector(".voando") || tutorial.ativo()) { pendente = true; return; }
    if (digitando()) { pendente = true; return; }
    pendente = false; VG.render(true);
  }
  document.addEventListener("focusout", () => setTimeout(() => { if (pendente && !digitando()) redesenhar(); }, 100));
  const colecoesSujas = new Set();
  function conectar() {
    const fonte = new EventSource("api/eventos");
    fonte.onmessage = async (m) => {
      let e; try { e = JSON.parse(m.data); } catch { return; }
      if (e.tipo === "pty") paraTerminais((t) => t.term.write(e.dados));
      else if (e.tipo === "conversa") VG.chatEvento(e);
      else if (e.tipo === "pty-fim") paraTerminais((t) => t.term.write("\r\n[console encerrado — clique em Reiniciar o console]\r\n"));
      else if (e.tipo === "dados") {
        colecoesSujas.add(e.colecao); clearTimeout(recarga);
        recarga = setTimeout(async () => { const c = [...colecoesSujas]; colecoesSujas.clear(); await VG.carregar(c); redesenhar(); desenharTrabalho(); }, 300);
      } else if (e.tipo === "execucao") {
        est.execucao = e.execucao; desenharTrabalho(); atualizarPainelTrab();
        if (e.fim) fimTrabalho(e.fim);
      } else if (e.tipo === "claude") est.claude = e.claude;
      else if (e.tipo === "uso") est.uso = e.uso;
      else if (e.tipo === "limite") { est.limite = e.limite; desenharTrabalho(); }
      else if (e.tipo === "atualizacao") { est.atualizacao = e.atualizacao; avisarAtualizacao(); if (VG.rotaAtual()[0] === "config") redesenhar(); }
      else if (e.tipo === "estado") Object.assign(est, await api("estado"));
    };
    fonte.onerror = () => {}; // o EventSource reconecta sozinho
  }
  async function fimTrabalho(f) {
    await VG.carregar();
    // o chat se atualiza sozinho; só as outras telas precisam redesenhar com o que o Claude gravou
    if (f.silencioso) { if (VG.rotaAtual()[0] !== "claude") redesenhar(); return; }
    let msg = "";
    if (f.tipo === "fila") msg = f.limite ? "O plano bateu no limite. O resto da fila espera." : `Fila terminada: ${VG.plural(f.feitos || 0, "pedido feito", "pedidos feitos")}${f.falhas ? `, ${f.falhas} sem terminar` : ""}.`;
    if (f.tipo === "varredura") msg = f.ok ? (f.semClaude ? "Varredura feita: nenhuma vaga nova desta vez." : `Varredura feita: ${VG.plural(f.novas || 0, "vaga nova", "vagas novas")} para triar.`) : `A varredura não terminou: ${f.erro || ""}`;
    if (msg) {
      toast(msg);
      // o popup de progresso, se aberto, vira o resumo com um atalho para o que mudou
      const c = painelTrab?.isConnected && painelTrab !== painelPrep && painelTrab.querySelector("[data-trab-corpo]");
      if (c) { const h = painelTrab.querySelector(".modal-cab h2"); if (h) h.textContent = f.tipo === "varredura" ? "Varredura terminada" : "Fila terminada";
        const ir = f.tipo === "varredura" ? ["#/triagem", "Ir para a triagem"] : ["#/pedidos", "Ver os pedidos"]; c.innerHTML = `<p class="frase" style="margin:0">${esc(msg)}</p><a class="btn p" style="margin-top:14px" href="${ir[0]}" data-fechar-trab>${ir[1]} ${ic("seta")}</a>`; c.querySelector("[data-fechar-trab]").addEventListener("click", () => painelTrab.sair()); }
    }
    if (f.tipo === "preparar") {
      if (painelPrep?.isConnected) painelPrep.sair();
      painelPrep = null;
      if (!f.ok) toast(`A preparação não terminou (${f.erro || "erro"}). Criei uma vaga de exemplo simples.`);
      setTimeout(() => tutorial.oferecer(), 400);
    }
    redesenhar();
  }

  /* ---------- começo ---------- */
  VG.iniciar = async () => {
    try { Object.assign(est, await api("estado")); } catch (e) { document.getElementById("app").innerHTML = `<section class="tela"><h1>Não consegui abrir o Vagabs</h1><p class="frase">${esc(e.message)}</p></section>`; return; }
    await VG.carregar();
    conectar();
    if (!est.setup) { location.hash = "#/setup"; VG.render(); VG.setupEntrar(); return; }
    if (VG.rotaAtual()[0] === "setup") VG.setupEntrar();
    VG.render();
    setTimeout(() => {
      if (est.novidades?.length) mostrarNovidades(est.novidades);
      else if (est.execucao?.tipo === "preparar") VG.preparando();
      else if (!db.config.tutorial && db.vagas.some((v) => v.exemplo)) tutorial.oferecer();
      else talvezVarredura();
      avisarAtualizacao();
    }, 700);
    // a checagem do Claude chega depois da janela abrir
    setTimeout(async () => { try { est.claude = await api("claude/checar"); } catch {} if (!document.querySelector(".modal") && db.config.tutorial) talvezVarredura(); }, 2500);
  };
  VG.aoRender = (rota) => { if (rota === "setup") return; desenharTrabalho(); };
  addEventListener("hashchange", () => { if (VG.rotaAtual()[0] === "setup") VG.setupEntrar(); });
  VG.iniciar();
})();

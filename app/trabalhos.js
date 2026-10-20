/* Vagabs — trabalhos do Claude
   Um de cada vez, sempre: a fila de pedidos (só quando a pessoa clica em "Rodar fila"), a
   varredura (só com o ok dela) e a preparação do fim do setup. Cada um vira uma execução escondida
   do Claude Code, com o progresso contado para a tela. */
"use strict";
const path = require("path");
const { vivo, emitir } = require("./estado");
const claude = require("./claude");
const pasta = require("./pasta");
const coletor = require("../nucleo/coletor");
const { agoraUtc } = require("../nucleo/dados");

const SISTEMA = "Você está rodando dentro do app Vagabs, sem ninguém olhando. Siga .vagabs/instrucoes.md (importado no CLAUDE.md). Grave tudo pelas ferramentas do MCP vagabs e termine o trabalho.";
const p2 = (n) => String(n).padStart(2, "0");
const agoraTxt = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const hojeTxt = () => agoraTxt().slice(0, 10);

let db = null, pararDepois = false, controle = null;
// modo teste do Gab: texto com esta frase é aceito na hora, sem chamar o Claude (não gasta o plano)
const MODO_TESTE = /miojo de chocolate/i;
const ehTeste = (t) => MODO_TESTE.test(String(t || ""));
function ligar(banco) { db = banco; }
const ocupado = () => !!vivo.execucao;

/* ---------- progresso legível ---------- */
const NOMES = { vagas: "as vagas", pedidos: "os pedidos", feitos: "os feitos", perfil: "o perfil", preferencias: "as preferências", sigilo: "o sigilo", empresas: "as empresas", config: "a configuração", varreduras: "as varreduras" };
function legivel(p) {
  if (p.tipo === "texto") return p.texto.length > 220 ? `${p.texto.slice(0, 220)}…` : p.texto;
  const e = p.entrada || {}, n = p.nome || "";
  const c = NOMES[e.colecao] || e.colecao || "";
  const em = c.replace(/^(as|os|a|o) /, (m, art) => ({ as: "nas ", os: "nos ", a: "na ", o: "no " }[art]));
  const m = {
    mcp__vagabs__ler: `Lendo ${c}`, mcp__vagabs__atualizar: `Gravando ${em}`, mcp__vagabs__adicionar: `Acrescentando ${em}`, mcp__vagabs__objeto: `Atualizando ${c}`,
    mcp__vagabs__etapa: "Registrando uma etapa", mcp__vagabs__captura: `Lendo a coleta do dia${e.pagina > 1 ? ` (página ${e.pagina})` : ""}`, mcp__vagabs__documentos: "Abrindo seus documentos",
    mcp__vagabs__buscar_vagas: `Buscando vagas: ${e.termo || ""}`, mcp__vagabs__proximo_id: null, ToolSearch: null,
    WebSearch: `Pesquisando: ${e.query || ""}`, WebFetch: `Abrindo ${(() => { try { return new URL(e.url).hostname; } catch { return "uma página"; } })()}`,
    Read: `Lendo ${e.file_path ? path.basename(e.file_path) : "um arquivo"}`, Write: `Escrevendo ${e.file_path ? path.basename(e.file_path) : "um arquivo"}`, Edit: `Editando ${e.file_path ? path.basename(e.file_path) : "um arquivo"}`,
    Glob: "Procurando arquivos", Grep: "Procurando nos arquivos",
  };
  if (n in m) return m[n];
  if (/gmail/i.test(n)) return "Lendo seu e-mail";
  return `Usando ${n.replace(/^mcp__/, "").replace(/__/g, " · ")}`;
}

function comecar(tipo, rotulo, extra = {}) {
  vivo.execucao = { tipo, rotulo, inicio: Date.now(), passos: [], ...extra };
  emitir("execucao", { execucao: vivo.execucao });
}
// linhas repetidas viram uma só com contador ("Acrescentando nas empresas ×12"); progresso "(3 de 27)" troca no lugar
const REPETE = /^(Acrescentando|Gravando|Atualizando|Registrando|Lendo|Buscando|Pesquisando|Abrindo) /;
const semConta = (s) => s.replace(/\s*\(\d+ de \d+\)$/, "");
function passo(txt) {
  if (!vivo.execucao || !txt) return;
  const P = vivo.execucao.passos, ult = P[P.length - 1], agora = Date.now();
  if (ult && ult.txt === txt) { ult.n = (ult.n || 1) + 1; ult.t = agora; }
  else if (ult && /\(\d+ de \d+\)$/.test(txt) && semConta(ult.txt) === semConta(txt)) { ult.txt = txt; ult.t = agora; }
  else {
    const i = REPETE.test(txt) ? P.slice(-6).findIndex((x) => x.txt === txt) : -1;
    if (i >= 0) { const [x] = P.splice(P.length - Math.min(6, P.length) + i, 1); x.n = (x.n || 1) + 1; x.t = agora; P.push(x); }
    else P.push({ t: agora, txt, n: 1 });
  }
  if (P.length > 300) P.shift();
  emitir("execucao", { execucao: vivo.execucao });
}
function terminar(fim) {
  const ex = vivo.execucao; vivo.execucao = null; controle = null;
  emitir("execucao", { execucao: null, fim: { tipo: ex?.tipo, rotulo: ex?.rotulo, ...fim } });
}

function modelo() { return db.ler("config").claude?.modelo || "claude-opus-5-5"; }
async function rodarClaude(prompt, esforco, extra = {}) {
  controle = new AbortController();
  const r = await claude.executar({
    pasta: db.pasta, prompt, modelo: modelo(), esforco, ferramentas: pasta.ferramentas(db), mcpConfig: path.join(db.pasta, ".vagabs", "mcp.json"),
    sistema: SISTEMA, aoPasso: (p) => passo(legivel(p)), sinal: controle.signal, ...extra,
  });
  if (r.limite) {
    const ate = r.limite.resetsAt ? new Date(r.limite.resetsAt * 1000).toISOString() : null;
    vivo.limite = { ate, quando: agoraUtc() }; emitir("limite", { limite: vivo.limite });
  }
  return r;
}
const explicar = (r) => {
  if (r.limite) return "O plano do Claude bateu no limite de uso.";
  const t = `${r.resultado || ""} ${r.erro || ""}`;
  if (/not.*(found|available)|model/i.test(t) && /model/i.test(t)) return "O modelo escolhido não está disponível no seu plano. Troque em Configurações › Claude.";
  if (/log ?in|auth|credential|401/i.test(t)) return "O Claude Code não está conectado. Refaça o login na aba Claude.";
  return (r.resultado || r.erro || "O Claude parou sem terminar.").slice(0, 400);
};

/* ---------- fila de pedidos ---------- */
const ordemFila = (a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9) || String(a.criado).localeCompare(String(b.criado)) || String(a.id).localeCompare(String(b.id));
const naFila = () => db.ler("pedidos").filter((p) => p.status === "fila").sort(ordemFila);
function promptPedido(p) {
  return `Processe o pedido ${p.id} do Vagabs (tipo "${p.tipo || "pedido"}"), seguindo a seção "Pedidos" de .vagabs/instrucoes.md. Agora são ${agoraTxt()}. Leia o pedido com a ferramenta ler (colecao pedidos, id ${p.id}). Termine com o status certo (respondido ou revisao) e uma resposta curta.`;
}
async function rodarFila() {
  if (ocupado()) return { ok: false, motivo: "O Claude já está trabalhando." };
  if (!naFila().length) return { ok: false, motivo: "A fila está vazia." };
  pararDepois = false;
  let feitos = 0, falhas = 0, total = naFila().length;
  comecar("fila", "Rodando a fila", { indice: 0, total });
  try {
    for (;;) {
      const lista = naFila();
      if (!lista.length || pararDepois) break;
      const p = lista[0];
      total = Math.max(total, feitos + falhas + lista.length);
      Object.assign(vivo.execucao, { indice: feitos + falhas + 1, total, pedido: p.id, rotulo: p.texto.slice(0, 90) });
      passo(`Pedido ${feitos + falhas + 1} de ${total}: ${p.texto.slice(0, 120)}`);
      if (ehTeste(p.texto)) {
        passo("Modo teste: aceito sem chamar o Claude");
        db.atualizar("pedidos", p.id, p.tipo === "versao"
          ? { status: "revisao", respondido: agoraTxt(), versao: `Versão de teste (modo miojo de chocolate): ${p.texto}`, resposta: "Modo teste: nada foi processado pelo Claude." }
          : { status: "respondido", respondido: agoraTxt(), resposta: "Modo teste: pedido aceito sem chamar o Claude. Nada foi mudado." });
        feitos++; continue;
      }
      db.atualizar("pedidos", p.id, { status: "processando", iniciado: agoraTxt() });
      const r = await rodarClaude(promptPedido(p), p.tipo === "kit" ? "high" : "medium");
      const atual = db.lerItem("pedidos", p.id) || {};
      if (atual.status === "processando") {
        if (r.limite) { db.atualizar("pedidos", p.id, { status: "fila" }); break; }
        db.atualizar("pedidos", p.id, { status: "erro", resposta: `Não consegui terminar: ${explicar(r)}`, log: r.log ? path.basename(r.log) : null });
        falhas++;
        if (!r.init) break; // o Claude nem começou (login, instalação): não adianta seguir
      } else feitos++;
      if (r.limite) break;
    }
  } finally {
    terminar({ feitos, falhas, restantes: naFila().length, limite: vivo.limite });
  }
  return { ok: true, feitos, falhas };
}
function pararFila() { pararDepois = true; passo("Vai parar depois deste pedido."); return true; }
function cancelar() { pararDepois = true; controle?.abort(); return true; }

/* ---------- varredura ---------- */
async function rodarVarredura() {
  if (ocupado()) return { ok: false, motivo: "O Claude já está trabalhando." };
  const cfg = db.ler("config");
  if (!(cfg.varredura?.termos || []).length) return { ok: false, motivo: "Ainda não há termos de busca. Termine o setup ou configure em Configurações › Busca." };
  const hoje = hojeTxt();
  comecar("varredura", "Varredura do dia");
  let res = { ok: false };
  try {
    passo("Coletando vagas nas fontes");
    const cap = await coletor.coletar(db, { progresso: passo, log: () => {} });
    passo(`${cap.lidas} vagas novas lidas, ${cap.candidatas.length} para o Claude avaliar`);
    const email = cfg.email?.modo === "gmail";
    if (!cap.candidatas.length && !email) {
      // nada para avaliar: registra sem gastar o plano
      db.adicionar("varreduras", { data: agoraTxt(), fontes: cap.fontes, lidas: cap.lidas, bloqueadas: cap.bloqueadas, novas: 0, abaixo_do_corte: Math.max(0, cap.lidas - cap.bloqueadas) });
      res = { ok: true, novas: 0, semClaude: true };
    } else {
      const antes = db.ler("vagas").length;
      const r = await rodarClaude(`Faça a varredura de ${hoje} seguindo a seção "Varredura" de .vagabs/instrucoes.md. A coleta está na ferramenta captura (data ${hoje}). Agora são ${agoraTxt()}.${email ? " O e-mail está ligado (Gmail): leia só os retornos de processos." : " O e-mail está desligado: pule o passo 5."}`, "medium");
      const registrou = db.ler("varreduras").some((v) => String(v.data).startsWith(hoje));
      res = { ok: r.ok && registrou, novas: db.ler("vagas").length - antes, erro: r.ok ? null : explicar(r) };
    }
    // backup junto com a varredura (se ligado e se houver pasta de backup)
    if (res.ok) {
      try {
        const b = require("./backup"), e = b.estado(db);
        if (e.auto && e.destino) { passo("Fazendo o backup"); const r = b.fazer(db); res.backup = r.ok; }
      } catch {}
    }
    const ultima = res.ok ? agoraUtc() : cfg.varredura?.ultima || null;
    db.objeto("config", { varredura: { ...db.ler("config").varredura, ultima, ultima_tentativa: agoraUtc() } });
  } catch (e) {
    res = { ok: false, erro: e.message };
  } finally {
    terminar(res);
  }
  return res;
}

/* ---------- preparação do fim do setup ---------- */
function exemploPadrao() {
  const P = db.ler("perfil"), R = db.ler("preferencias");
  const cargo = (R.cargos || [])[0] || "Cargo que você busca";
  const cidade = (R.cidades || [])[0] || P.cidade || "Sua cidade";
  return {
    id: db.proximoId("vagas", "v"), exemplo: true, fonte: "Exemplo do Vagabs", id_fonte: "exemplo", url: "", empresa: "Empresa Exemplo", cargo: `Exemplo: ${cargo}`,
    area: (R.setores || [])[0] || R.setor || "", local: cidade, modelo: (R.modelos || [])[0] || "Híbrido", contrato: R.contrato_preferido || (R.contratos || [])[0] || "CLT", faixa: null,
    publicada: hojeTxt(), captada: hojeTxt(), estado: "nova", nota: 82,
    dimensoes: { "Cargo e senioridade": 88, "Área e setor": 85, "Encaixe com os feitos": 70, Contrato: 90, "Local e modelo": 80 },
    motivos: ["Exemplo: o cargo bate com o que você marcou no setup.", "Exemplo: o contrato e o modelo são os que você prefere.", "Exemplo: numa vaga real, aqui aparecem os seus feitos que pesam a favor."],
    alertas: [], resumo: "Esta vaga é só um exemplo, criada para o tutorial. Ela mostra como uma vaga real aparece: nota, motivos e o kit de candidatura.",
    etapas: [{ data: hojeTxt(), tipo: "nova", nota: "Vaga de exemplo" }],
    kit: { plataforma: "Exemplo (numa vaga real: Gupy, site da empresa, LinkedIn…)", carta: `Olá, time da Empresa Exemplo.\n\nEsta é uma carta de exemplo. Numa vaga real, o Claude escreve aqui uma carta de 120 a 200 palavras para a vaga, usando os seus feitos.\n\n${P.nome || "Seu nome"}`,
      anexos: ["CV (exemplo)"], passos: [
        { id: 1, titulo: "Conferir se a vaga está aberta", tipo: "acao", texto: "Numa vaga real, abra o link e veja se ela ainda recebe candidaturas.", feito: false },
        { id: 2, titulo: "Preencher seus dados", tipo: "campos", texto: "", campos: [{ rotulo: "Nome", valor: P.nome || "" }, { rotulo: "E-mail", valor: P.email || "" }, { rotulo: "Cidade", valor: P.cidade || "" }], feito: false },
        { id: 3, titulo: "Por que esta empresa?", tipo: "resposta", texto: "Resposta de exemplo. Numa vaga real, o Claude escreve aqui uma resposta curta, em primeira pessoa, apoiada nos seus feitos.", feito: false },
        { id: 4, titulo: "Anexar o CV", tipo: "arquivo", texto: "Anexe a versão do CV indicada no kit.", feito: false },
        { id: 5, titulo: "Revisar e enviar", tipo: "acao", texto: "Releia tudo e envie. Depois, marque a vaga como enviada aqui no Vagabs.", feito: false },
      ] },
  };
}
function garantirExemplo() {
  if (db.ler("vagas").some((v) => v.exemplo)) return false;
  db.adicionar("vagas", exemploPadrao());
  return true;
}
async function preparar({ sugerirEmpresas = false, temDocumentos = false } = {}) {
  if (ocupado()) return { ok: false, motivo: "O Claude já está trabalhando." };
  comecar("preparar", "Preparando o seu Vagabs");
  let res = { ok: false };
  try {
    const r = await rodarClaude(`Faça a preparação do Vagabs seguindo a seção "Preparação (fim do setup)" de .vagabs/instrucoes.md. Agora são ${agoraTxt()}.
- Documentos: ${temDocumentos ? "há documentos em documentos/; leia todos." : "a pessoa não anexou documentos; pule os passos 1 e 2."}
- Sugerir empresas-alvo: ${sugerirEmpresas ? "sim" : "não (mantenha só as que ela escreveu)"}.
- Não esqueça a vaga de exemplo com o kit completo.`, "high");
    res = { ok: r.ok, erro: r.ok ? null : explicar(r) };
  } catch (e) { res = { ok: false, erro: e.message }; }
  finally {
    // o que o Claude não fez, o app completa: exemplo e termos de busca
    try {
      const criouPadrao = garantirExemplo();
      const cfg = db.ler("config"); const R = db.ler("preferencias");
      if (!(cfg.varredura?.termos || []).length) db.objeto("config", { varredura: { ...cfg.varredura, termos: (R.cargos || []).slice(0, 10) } });
      db.objeto("config", { setup: { ...db.ler("config").setup, preparado: res.ok, preparado_em: agoraUtc() } });
      res.exemploPadrao = criouPadrao;
    } catch {}
    terminar(res);
  }
  return res;
}

/* ---------- checagem rápida (sem gastar o plano): o Claude carrega e para ---------- */
async function checarFerramentas() {
  const r = await claude.executar({ pasta: db?.pasta, prompt: "ok", ate: "init", mcpConfig: db ? path.join(db.pasta, ".vagabs", "mcp.json") : undefined });
  const tools = r.init?.tools || [];
  const servidores = r.init?.mcp_servers || [];
  const LER = /(search|get_|list_|read)/i, ESCREVER = /(send|draft|trash|delete|label|spam|forward|reply|update|create|modify|move|archive)/i;
  const gmail = tools.filter((t) => /gmail/i.test(t) && LER.test(t.split("__").pop()) && !ESCREVER.test(t.split("__").pop()));
  return {
    ok: !!r.init, erro: r.init ? null : (r.erro || r.resultado || "O Claude Code não respondeu.").slice(-600),
    vagabs: servidores.find((s) => s.name === "vagabs")?.status || "ausente",
    gmail: { conectado: servidores.some((s) => /gmail/i.test(s.name) && s.status === "connected"), ferramentas: gmail },
    modelo: r.init?.model || null, versao: r.init?.claude_code_version || null,
  };
}

/* ---------- chat com o Claude (aba Claude) ----------
   Cada mensagem é uma execução escondida que continua a mesma sessão (--resume), com o texto chegando
   enquanto ele escreve. Divide a vez com a fila e a varredura: um Claude de cada vez. */
const fs = require("fs");
const SISTEMA_CHAT = "Você está no chat do app Vagabs, conversando com a pessoa dona desta busca de emprego. Responda em português do Brasil, direto e caloroso, em markdown simples (parágrafos curtos, listas, negrito). Use as ferramentas do MCP vagabs para ler e gravar os dados, e siga .vagabs/instrucoes.md. Antes de mudar um dado importante, diga o que vai mudar.";
const arqConversa = () => path.join(db.pasta, "conversas", "atual.json");
function conversa() { try { return JSON.parse(fs.readFileSync(arqConversa(), "utf8")); } catch { return { sessao: null, mensagens: [] }; } }
function gravarConversa(c) { fs.mkdirSync(path.dirname(arqConversa()), { recursive: true }); fs.writeFileSync(arqConversa(), JSON.stringify(c, null, 1), "utf8"); }
async function conversar(texto) {
  if (ocupado()) return { ok: false, motivo: vivo.execucao.tipo === "conversa" ? "O Claude ainda está respondendo." : "O Claude está ocupado com a fila ou a varredura. A conversa volta quando ele terminar." };
  texto = String(texto || "").trim();
  if (!texto) return { ok: false, motivo: "Mensagem vazia." };
  const c = conversa();
  const quando = agoraTxt();
  c.mensagens.push({ papel: "voce", texto, quando });
  const resp = { papel: "claude", texto: "", passos: [], quando };
  c.mensagens.push(resp);
  gravarConversa(c);
  if (ehTeste(texto)) {
    resp.texto = "Modo teste: recebi a mensagem sem chamar o Claude. Nada foi processado, e o plano não foi usado.";
    resp.passos = []; gravarConversa(c);
    emitir("conversa", { mensagem: resp, ocupado: false, fim: true });
    return { ok: true, teste: true };
  }
  comecar("conversa", "Conversa", { silencioso: true });
  let quebra = false, aviso = null;
  const mandar = () => { clearTimeout(aviso); aviso = setTimeout(() => emitir("conversa", { mensagem: resp, ocupado: true }), 60); };
  emitir("conversa", { mensagem: resp, ocupado: true, nova: true });
  try {
    const r = await rodarClaude(texto, "medium", {
      sistema: SISTEMA_CHAT, retomar: c.sessao,
      // texto depois de usar ferramentas começa parágrafo novo
      aoTexto: (t) => { if (quebra && resp.texto) resp.texto += "\n\n"; quebra = false; resp.texto += t; mandar(); },
      aoPasso: (p) => { const l = legivel(p); if (l) { resp.passos.push(l); passo(l); quebra = true; mandar(); } },
    });
    if (r.sessao) c.sessao = r.sessao;
    if (!resp.texto.trim()) resp.texto = r.ok ? (r.resultado || "(sem resposta)") : `Não consegui responder: ${explicar(r)}`;
    if (!r.ok && resp.texto && !resp.erro) resp.erro = true;
  } catch (e) { resp.texto = resp.texto || `Não consegui responder: ${e.message}`; resp.erro = true; }
  finally {
    clearTimeout(aviso);
    gravarConversa(c);
    terminar({ silencioso: true });
    emitir("conversa", { mensagem: resp, ocupado: false, fim: true });
  }
  return { ok: true };
}
function novaConversa() {
  if (vivo.execucao?.tipo === "conversa") return { ok: false, motivo: "Espere o Claude terminar de responder." };
  const c = conversa();
  if (c.mensagens.length) { const d = new Date(); fs.renameSync(arqConversa(), path.join(path.dirname(arqConversa()), `${d.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`)); }
  return { ok: true };
}

module.exports = { ehTeste, ligar, ocupado, rodarFila, pararFila, cancelar, rodarVarredura, preparar, checarFerramentas, garantirExemplo, ordemFila, conversa, conversar, novaConversa };

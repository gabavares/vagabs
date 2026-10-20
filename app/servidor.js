/* Vagabs — servidor interno (só 127.0.0.1, com chave)
   A janela é uma página servida daqui: telas em front/, dados em /api/c/<colecao> (GET lê, PUT
   grava mesclando por "mod"), eventos em /api/eventos (SSE) e as ações
   do app (console, fila, varredura, setup, atualização) em /api/... */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { dialog, shell, BrowserWindow, app } = require("electron");
const est = require("./estado");
const pasta = require("./pasta");
const claude = require("./claude");
const consoleP = require("./console");
const trab = require("./trabalhos");
const atual = require("./atualizacao");
const backup = require("./backup");
const { criar, COLECOES } = require("../nucleo/dados");

const RAIZ = path.join(__dirname, "..");
const FRONT = path.join(RAIZ, "front");
const VENDOR = {
  "/vendor/xterm.js": path.join(RAIZ, "node_modules/@xterm/xterm/lib/xterm.js"),
  "/vendor/xterm.css": path.join(RAIZ, "node_modules/@xterm/xterm/css/xterm.css"),
  "/vendor/addon-fit.js": path.join(RAIZ, "node_modules/@xterm/addon-fit/lib/addon-fit.js"),
};
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
const CHAVE = crypto.randomBytes(24).toString("hex");
const NOVIDADES = JSON.parse(fs.readFileSync(path.join(RAIZ, "novidades.json"), "utf8"));
const cmpVersao = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

let db = null, vigia = null;
function abrirPasta(p) {
  db = pasta.montar(p);
  trab.ligar(db);
  // a tela recarrega sozinha quando o Claude grava algo
  try { vigia?.close(); } catch {}
  const avisos = new Map();
  try {
    vigia = fs.watch(db.DADOS, (ev, arq) => {
      const c = String(arq || "").replace(/\.json$/, "");
      if (!COLECOES.includes(c)) return;
      clearTimeout(avisos.get(c)); avisos.set(c, setTimeout(() => est.emitir("dados", { colecao: c }), 250));
    });
  } catch {}
  return db;
}

function estadoApp() {
  const c = est.config();
  const visto = c.versao_vista || null;
  const novidades = visto ? NOVIDADES.filter((n) => cmpVersao(n.versao, visto) > 0 && cmpVersao(n.versao, pasta.VERSAO) <= 0) : [];
  const dcfg = db ? db.ler("config") : {};
  return {
    versao: pasta.VERSAO, pasta: c.pasta || null, pastaPadrao: pasta.padrao(), setup: !!dcfg.setup?.concluido, tutorial: dcfg.tutorial || null,
    claude: est.vivo.claude, execucao: est.vivo.execucao, comando: est.vivo.comando || null, uso: est.vivo.uso, limite: est.vivo.limite, atualizacao: est.vivo.atualizacao,
    novidades, todasNovidades: NOVIDADES, console: { ativo: consoleP.estado().ativo },
  };
}

/* ---------- utilitários de resposta ---------- */
function json(res, status, corpo) {
  const b = Buffer.from(JSON.stringify(corpo));
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": b.length });
  res.end(b);
}
function corpo(req, limite = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const partes = []; let n = 0;
    req.on("data", (d) => { n += d.length; if (n > limite) { reject(new Error("arquivo grande demais")); req.destroy(); } else partes.push(d); });
    req.on("end", () => resolve(Buffer.concat(partes)));
    req.on("error", reject);
  });
}
const lerJson = async (req) => { const b = await corpo(req); return b.length ? JSON.parse(b.toString("utf8")) : {}; };
function estatico(res, arq) {
  fs.readFile(arq, (err, b) => {
    if (err) { res.writeHead(404); return res.end("não achei"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arq)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(b);
  });
}
const precisaPasta = (res) => { if (db) return false; json(res, 409, { erro: "A pasta do Vagabs ainda não foi escolhida." }); return true; };
const nomeSeguro = (n) => String(n || "arquivo").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^\.+/, "").slice(0, 120) || "arquivo";

/* ---------- rotas ---------- */
const ROTAS = {
  "GET /api/estado": () => estadoApp(),
  "POST /api/pasta/escolher": async () => {
    const janela = BrowserWindow.getAllWindows()[0];
    const r = await dialog.showOpenDialog(janela, { title: "Onde guardar o Vagabs", defaultPath: est.config().pasta || pasta.padrao(), properties: ["openDirectory", "createDirectory"] });
    return { pasta: r.canceled ? null : r.filePaths[0] };
  },
  "POST /api/pasta/usar": async (req) => {
    const { pasta: p } = await lerJson(req);
    if (!p || !path.isAbsolute(p)) throw new Error("caminho inválido");
    const final = /vagabs$/i.test(path.basename(p)) || fs.existsSync(path.join(p, ".vagabs")) ? p : path.join(p, "Vagabs");
    abrirPasta(final);
    est.salvarConfig({ pasta: final, versao_vista: est.config().versao_vista || pasta.VERSAO });
    return { pasta: final };
  },
  "POST /api/pasta/abrir": () => { if (db) shell.openPath(db.pasta); return { ok: true }; },
  "POST /api/abrir": async (req) => {
    const { url } = await lerJson(req);
    if (!/^https?:\/\//i.test(url || "")) throw new Error("só links da web");
    await shell.openExternal(url); return { ok: true };
  },
  "GET /api/claude/checar": () => claude.checar(),
  "POST /api/claude/ferramentas": async () => {
    const r = await trab.checarFerramentas();
    if (db && r.gmail.ferramentas.length) db.objeto("config", { email: { ...db.ler("config").email, ferramentas: r.gmail.ferramentas } });
    return r;
  },
  "POST /api/console/iniciar": () => consoleP.iniciar(db?.pasta),
  "POST /api/console/reiniciar": () => consoleP.reiniciar(db?.pasta),
  "POST /api/console/entrada": async (req) => ({ ok: consoleP.escrever((await lerJson(req)).dados || "") }),
  "POST /api/console/tamanho": async (req) => { const { cols, rows } = await lerJson(req); consoleP.tamanho(cols, rows); return { ok: true }; },
  "POST /api/console/comando": async (req) => {
    // só os comandos que o app oferece em botões; nada vindo de fora
    const { qual } = await lerJson(req);
    const CMDS = {
      instalar: "irm https://claude.ai/install.ps1 | iex",
      login: "claude auth login",
      claude: "claude",
      status: "claude auth status --text",
      sair: "/exit",
    };
    if (!CMDS[qual]) throw new Error("comando desconhecido");
    if (est.vivo.comando) throw new Error("Espere o comando que está rodando terminar.");
    // instalar e login são acompanhados até o fim: o setup não deixa seguir enquanto rodam
    await consoleP.comando(db?.pasta, CMDS[qual], { acompanhar: ["instalar", "login"].includes(qual) ? qual : null });
    return { ok: true };
  },
  "POST /api/fila/rodar": () => { if (!db) throw new Error("sem pasta"); trab.rodarFila(); return { ok: true }; },
  "POST /api/fila/parar": () => ({ ok: trab.pararFila() }),
  "POST /api/trabalho/cancelar": () => ({ ok: trab.cancelar() }),
  "POST /api/varredura/rodar": () => { if (!db) throw new Error("sem pasta"); trab.rodarVarredura(); return { ok: true }; },
  "POST /api/varredura/adiar": () => { db.objeto("config", { varredura: { ...db.ler("config").varredura, adiada_em: new Date().toISOString().slice(0, 10) } }); return { ok: true }; },
  "POST /api/setup/concluir": async (req) => {
    const d = await lerJson(req);
    for (const c of ["perfil", "preferencias", "sigilo"]) if (d[c]) db.substituir(c, { ...db.ler(c), ...d[c] });
    if (Array.isArray(d.empresas)) d.empresas.forEach((e) => { try { db.adicionar("empresas", e); } catch {} });
    db.objeto("config", { ...d.config, setup: { concluido: true, quando: new Date().toISOString() } });
    pasta.gerarClaudeMd(db.pasta, db, { forcar: !!d.refazer });
    // modo teste: a frase em qualquer campo do setup pula a preparação pelo Claude
    if (trab.ehTeste(JSON.stringify(d))) d.preparar = false;
    if (d.preparar) trab.preparar({ sugerirEmpresas: !!d.sugerirEmpresas, temDocumentos: fs.readdirSync(path.join(db.pasta, "documentos")).length > 0 });
    else trab.garantirExemplo();
    return { ok: true };
  },
  "GET /api/backup": () => backup.estado(db),
  "POST /api/backup/fazer": () => { if (!db) throw new Error("sem pasta"); return backup.fazer(db); },
  "POST /api/backup/pasta": async () => {
    const r = await dialog.showOpenDialog(BrowserWindow.getAllWindows()[0], { title: "Onde guardar os backups do Vagabs", defaultPath: backup.estado(db).destino || undefined, properties: ["openDirectory", "createDirectory"] });
    if (r.canceled) return backup.estado(db);
    db.objeto("config", { backup: { ...db.ler("config").backup, pasta: r.filePaths[0] } });
    return backup.estado(db);
  },
  "POST /api/backup/auto": async (req) => { const { auto } = await lerJson(req); db.objeto("config", { backup: { ...db.ler("config").backup, auto: !!auto } }); return backup.estado(db); },
  "POST /api/backup/restaurar": async () => {
    if (trab.ocupado()) throw new Error("Espere o Claude terminar o que está fazendo.");
    const e = backup.estado(db);
    const r = await dialog.showOpenDialog(BrowserWindow.getAllWindows()[0], { title: "Escolha o backup do Vagabs", defaultPath: e.destino ? path.join(e.destino, backup.RAIZ_BACKUP) : undefined, properties: ["openDirectory"] });
    if (r.canceled) return { ok: false, cancelado: true };
    const res = backup.restaurar(db, r.filePaths[0]);
    if (res.ok) pasta.renovar(db.pasta);
    return res;
  },
  "GET /api/conversa": () => (db ? trab.conversa() : { mensagens: [] }),
  "POST /api/conversa/enviar": async (req) => {
    if (!db) throw new Error("sem pasta");
    const { texto } = await lerJson(req);
    if (trab.ocupado()) return { ok: false, motivo: est.vivo.execucao?.tipo === "conversa" ? "O Claude ainda está respondendo." : "O Claude está ocupado com a fila ou a varredura. A conversa volta quando ele terminar." };
    trab.conversar(texto);
    return { ok: true, ocupado: trab.ocupado() }; // false no modo teste: a resposta já está pronta
  },
  "POST /api/conversa/nova": () => trab.novaConversa(),
  "POST /api/conversa/parar": () => ({ ok: trab.cancelar() }),
  "POST /api/exemplo/criar": () => ({ criado: trab.garantirExemplo() }),
  "POST /api/exemplo/apagar": () => {
    const ids = db.ler("vagas").filter((v) => v.exemplo).map((v) => v.id);
    ids.forEach((id) => db.remover("vagas", id));
    return { apagadas: ids.length };
  },
  "POST /api/empresas/tirar": async (req) => ({ tiradas: db.remover("empresas", (await lerJson(req)).id) }),
  "POST /api/novidades/vistas": () => { est.salvarConfig({ versao_vista: pasta.VERSAO }); return { ok: true }; },
  "POST /api/atualizacao/procurar": () => atual.procurar(),
  "POST /api/atualizacao/baixar": () => atual.baixar(),
  "POST /api/atualizacao/instalar": () => ({ ok: atual.instalar() }),
  "GET /api/documentos": () => {
    if (!db) return [];
    const dir = path.join(db.pasta, "documentos");
    return fs.readdirSync(dir, { withFileTypes: true }).filter((f) => f.isFile()).map((f) => ({ nome: f.name, kb: Math.round(fs.statSync(path.join(dir, f.name)).size / 1024) }));
  },
};

async function tratar(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  // a chave entra pela URL na primeira carga e vira cookie; sem ela, nada
  const cookie = /(?:^|;\s*)vagabs=([a-f0-9]+)/.exec(req.headers.cookie || "")?.[1];
  if (url.searchParams.get("chave") === CHAVE) {
    res.writeHead(302, { "Set-Cookie": `vagabs=${CHAVE}; HttpOnly; SameSite=Strict; Path=/`, Location: "/" + (url.hash || "") });
    return res.end();
  }
  if (cookie !== CHAVE) { res.writeHead(403); return res.end("Vagabs: acesso só pelo app."); }

  const p = decodeURIComponent(url.pathname);
  if (!p.startsWith("/api/")) {
    if (VENDOR[p]) return estatico(res, VENDOR[p]);
    const arq = path.normalize(path.join(FRONT, p === "/" ? "index.html" : p));
    if (!arq.startsWith(FRONT)) { res.writeHead(403); return res.end(); }
    return estatico(res, arq);
  }
  if (p === "/api/eventos") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write(`data: ${JSON.stringify({ tipo: "ola" })}\n\n`);
    const enviar = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
    est.eventos.on("evento", enviar);
    const pulso = setInterval(() => res.write(": pulso\n\n"), 20000);
    req.on("close", () => { est.eventos.off("evento", enviar); clearInterval(pulso); });
    return;
  }
  try {
    const col = /^\/api\/c\/([a-z]+)$/.exec(p);
    if (col) {
      if (precisaPasta(res)) return;
      if (!COLECOES.includes(col[1])) return json(res, 404, { erro: "coleção desconhecida" });
      if (req.method === "GET") return json(res, 200, db.ler(col[1]));
      if (req.method === "PUT") return json(res, 200, { ok: true, dados: db.receber(col[1], await lerJson(req)) });
    }
    if (p === "/api/documentos" && req.method === "POST") {
      if (precisaPasta(res)) return;
      const nome = nomeSeguro(decodeURIComponent(req.headers["x-nome"] || ""));
      if (!/\.(pdf|docx?|txt|md|rtf|odt|png|jpe?g)$/i.test(nome)) return json(res, 400, { erro: "Envie PDF, Word, texto ou imagem." });
      // material do Enriquecer fica numa subpasta própria
      const dir = path.join(db.pasta, "documentos", req.headers["x-pasta"] === "enriquecer" ? "enriquecer" : "");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, nome), await corpo(req));
      return json(res, 200, { ok: true, nome });
    }
    if (p === "/api/documentos" && req.method === "DELETE") {
      const nome = nomeSeguro(url.searchParams.get("nome"));
      fs.rmSync(path.join(db.pasta, "documentos", url.searchParams.get("pasta") === "enriquecer" ? "enriquecer" : "", nome), { force: true });
      return json(res, 200, { ok: true });
    }
    const rota = ROTAS[`${req.method} ${p}`];
    if (!rota) return json(res, 404, { erro: "rota desconhecida" });
    return json(res, 200, (await rota(req)) ?? { ok: true });
  } catch (e) {
    return json(res, 500, { erro: e.message });
  }
}

// terminou de instalar ou de fazer login: confere o Claude Code de novo sozinho
consoleP.quandoTerminar(() => claude.checar().catch(() => {}));

function iniciar() {
  const p = est.config().pasta;
  if (p && fs.existsSync(p)) { try { abrirPasta(p); } catch (e) { console.error(e); } }
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => tratar(req, res).catch((e) => { try { json(res, 500, { erro: e.message }); } catch {} }));
    srv.listen(0, "127.0.0.1", () => resolve({ porta: srv.address().port, chave: CHAVE }));
  });
}

module.exports = { iniciar };

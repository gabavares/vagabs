/* Vagabs — o Claude Code da pessoa
   Acha o executável, confere versão e login, e roda execuções escondidas (claude -p) com saída
   stream-json, contando o progresso para a tela. Nada de API: é o plano Claude da própria pessoa. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFile } = require("child_process");
const { vivo, emitir } = require("./estado");

const LIMITE_TXT = ["hit your session limit", "usage limit", "rate limit", "limite de uso", "session limit reached", "weekly limit"];

function candidatos() {
  const h = os.homedir();
  return [
    path.join(h, ".local", "bin", "claude.exe"),
    path.join(process.env.LOCALAPPDATA || path.join(h, "AppData", "Local"), "Programs", "claude", "claude.exe"),
    path.join(process.env.APPDATA || path.join(h, "AppData", "Roaming"), "npm", "claude.cmd"),
  ];
}
function onde() {
  return new Promise((resolve) => {
    const achado = candidatos().find((c) => fs.existsSync(c));
    if (achado) return resolve(achado);
    execFile("where.exe", ["claude"], { windowsHide: true, timeout: 8000 }, (err, out) => {
      const linhas = String(out || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      resolve(err ? null : linhas.find((l) => /\.exe$/i.test(l)) || linhas.find((l) => /\.cmd$/i.test(l)) || null);
    });
  });
}
// .cmd (instalação pelo npm) precisa passar pelo cmd.exe; o .exe nativo roda direto
function preparar(exe, args) {
  if (!/\.cmd$/i.test(exe)) return [exe, args, {}];
  const q = (s) => (/[\s"&|<>^]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
  return [process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", [q(exe), ...args.map(q)].join(" ")], { windowsVerbatimArguments: true }];
}
function rodarSimples(exe, args, timeout = 20000) {
  return new Promise((resolve) => {
    const [cmd, a, o] = preparar(exe, args);
    execFile(cmd, a, { ...o, windowsHide: true, timeout, env: ambiente() }, (err, out, errOut) => resolve({ ok: !err, out: String(out || ""), err: String(errOut || "") }));
  });
}
function ambiente(extra = {}) {
  const bin = path.join(os.homedir(), ".local", "bin");
  const PATH = (process.env.PATH || process.env.Path || "").split(";").includes(bin) ? (process.env.PATH || process.env.Path) : `${bin};${process.env.PATH || process.env.Path || ""}`;
  const env = { ...process.env, PATH, ...extra };
  delete env.Path; delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

async function checar() {
  const caminho = await onde();
  const r = { caminho, instalado: !!caminho, versao: null, logado: false, email: null, plano: null, quando: Date.now() };
  if (caminho) {
    const v = await rodarSimples(caminho, ["--version"]);
    r.versao = (v.out.match(/\d+\.\d+\.\d+/) || [null])[0];
    if (!r.versao) r.instalado = false;
    const a = await rodarSimples(caminho, ["auth", "status", "--json"]);
    try { const j = JSON.parse(a.out); r.logado = !!j.loggedIn; r.email = j.email || null; r.plano = j.subscriptionType || null; r.metodo = j.authMethod || null; } catch {}
  }
  vivo.claude = r;
  emitir("claude", { claude: r });
  return r;
}

/* Execução escondida. Devolve {ok, resultado, limite, custo, log}. `ate` pode ser "init" para parar
   assim que o Claude carregar as ferramentas (checagem sem gastar o plano). */
/* Para o chat: `retomar` continua uma sessão (a conversa lembra do que veio antes) e `aoTexto` recebe o texto
   enquanto o Claude escreve (pedaço a pedaço; se a versão do Claude Code não mandar pedaços, vem o bloco inteiro). */
function executar({ pasta, prompt, modelo, esforco, ferramentas = [], mcpConfig, sistema, ate = null, aoPasso = () => {}, aoInit = () => {}, aoTexto = null, retomar = null, sinal }) {
  return new Promise(async (resolve) => {
    const exe = vivo.claude?.caminho || (await onde());
    if (!exe) return resolve({ ok: false, erro: "Claude Code não encontrado" });
    const conversa = !!aoTexto;
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "dontAsk"];
    if (!conversa) args.push("--no-session-persistence"); // só o chat guarda sessão, para poder continuar
    if (conversa) args.push("--include-partial-messages");
    if (retomar) args.push("--resume", retomar);
    if (modelo) args.push("--model", modelo);
    if (esforco) args.push("--effort", esforco);
    if (mcpConfig) args.push("--mcp-config", mcpConfig);
    if (ferramentas.length) args.push("--allowedTools", ferramentas.join(","));
    if (sistema) args.push("--append-system-prompt", sistema);
    const [cmd, a, o] = preparar(exe, args);
    const logArq = pasta ? path.join(pasta, "logs", `${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19)}.jsonl`) : null;
    if (logArq) fs.mkdirSync(path.dirname(logArq), { recursive: true });
    const log = logArq ? fs.createWriteStream(logArq) : null;
    const filho = spawn(cmd, a, { ...o, cwd: pasta || os.homedir(), windowsHide: true, env: ambiente() });
    let resto = "", resultado = null, limite = null, init = null, erroTxt = "", pedacos = false;
    const parar = () => { try { filho.kill(); } catch {} };
    sinal?.addEventListener?.("abort", parar);
    filho.stdout.on("data", (buf) => {
      resto += buf.toString("utf8");
      const linhas = resto.split("\n"); resto = linhas.pop();
      for (const l of linhas) {
        if (!l.trim()) continue;
        log?.write(l + "\n");
        let d; try { d = JSON.parse(l); } catch { continue; }
        if (d.type === "system" && d.subtype === "init") { init = d; aoInit(d); if (ate === "init") parar(); }
        else if (d.type === "rate_limit_event") {
          vivo.uso = d.rate_limit_info || null; emitir("uso", { uso: vivo.uso });
          if (d.rate_limit_info && !String(d.rate_limit_info.status || "").startsWith("allowed")) limite = d.rate_limit_info;
        } else if (d.type === "stream_event") {
          const ev = d.event || {};
          if (conversa && ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) { pedacos = true; aoTexto(ev.delta.text); }
          if (conversa && ev.type === "message_start") pedacos = false;
        } else if (d.type === "assistant") {
          for (const c of d.message?.content || []) {
            if (c.type === "tool_use") aoPasso({ tipo: "ferramenta", nome: c.name, entrada: c.input });
            else if (c.type === "text" && c.text?.trim()) {
              if (conversa) { if (!pedacos) aoTexto(c.text); }
              else aoPasso({ tipo: "texto", texto: c.text.trim() });
            }
          }
        } else if (d.type === "result") resultado = d;
      }
    });
    filho.stderr.on("data", (b) => { erroTxt += b.toString("utf8"); });
    filho.on("error", (e) => { erroTxt += e.message; });
    filho.stdin.on("error", () => {});
    filho.stdin.end(prompt, "utf8");
    filho.on("close", (codigo) => {
      log?.end();
      const texto = `${resultado?.result || ""} ${erroTxt}`.toLowerCase();
      if (!limite && resultado?.is_error && LIMITE_TXT.some((t) => texto.includes(t))) limite = { status: "rejected" };
      resolve({ ok: !!resultado && !resultado.is_error, codigo, init, sessao: resultado?.session_id || init?.session_id || null, resultado: resultado?.result || "", custo: resultado?.total_cost_usd, limite, erro: erroTxt.trim().slice(-1500), log: logArq });
    });
  });
}

module.exports = { checar, executar, onde, ambiente };

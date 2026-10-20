/* Vagabs — a pasta do Vagabs (onde ficam os dados e onde o Claude roda)
   Monta a estrutura na primeira vez e, a cada abertura, renova só o que é do app (.vagabs/,
   .mcp.json, .claude/settings.json). Nunca toca em CLAUDE.md, dados/, documentos/ nem logs/
   depois de criados. */
"use strict";
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { criar } = require("../nucleo/dados");

const RAIZ_APP = path.join(__dirname, "..");
const desempacotado = (p) => p.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
const VERSAO = require("../package.json").version;

const LEIA_ME = `Esta é a pasta do Vagabs.

dados\\        o banco (um arquivo por coleção) e o histórico de cada gravação
documentos\\   seu CV, o PDF do LinkedIn e o que o Claude escrever para você
logs\\         o registro de cada vez que o Claude trabalhou
CLAUDE.md     suas notas para o Claude (pode editar)
.vagabs\\      instruções do app (trocadas a cada atualização)

As atualizações do Vagabs nunca apagam nada daqui.
Com amor, Gab <3
`;

function mcpServidor(pasta) {
  return {
    command: process.execPath,
    args: [desempacotado(path.join(RAIZ_APP, "mcp", "servidor.js"))],
    env: { ELECTRON_RUN_AS_NODE: "1", VAGABS_PASTA: pasta, VAGABS_VERSAO: VERSAO },
  };
}

// ferramentas liberadas nas execuções escondidas (o resto é negado: modo dontAsk)
function ferramentas(db) {
  const base = ["mcp__vagabs", "WebSearch", "WebFetch", "Read(./**)", "Glob", "Grep", "Edit(./documentos/**)", "Write(./documentos/**)"];
  const email = db.ler("config").email || {};
  if (email.modo === "gmail") base.push(...(email.ferramentas?.length ? email.ferramentas : ["mcp__claude_ai_Gmail__search_threads", "mcp__claude_ai_Gmail__get_thread", "mcp__claude_ai_Gmail__get_message"]));
  return base;
}

function escreverSeMudou(arq, conteudo) {
  try { if (fs.readFileSync(arq, "utf8") === conteudo) return; } catch {}
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo, "utf8");
}

// o que é do app: renovado a cada abertura e a cada versão nova
function renovar(pasta) {
  const mcp = JSON.stringify({ mcpServers: { vagabs: mcpServidor(pasta) } }, null, 2);
  escreverSeMudou(path.join(pasta, ".vagabs", "instrucoes.md"), fs.readFileSync(path.join(RAIZ_APP, "modelos", "instrucoes.md"), "utf8"));
  escreverSeMudou(path.join(pasta, ".vagabs", "mcp.json"), mcp);
  escreverSeMudou(path.join(pasta, ".vagabs", "versao.json"), JSON.stringify({ versao: VERSAO }, null, 2));
  escreverSeMudou(path.join(pasta, ".mcp.json"), mcp);
  // permissões para o console (sessão interativa); as escondidas recebem as suas na linha de comando
  const arqSet = path.join(pasta, ".claude", "settings.json");
  let set = {}; try { set = JSON.parse(fs.readFileSync(arqSet, "utf8")); } catch {}
  const base = JSON.parse(fs.readFileSync(path.join(RAIZ_APP, "modelos", "settings.json"), "utf8"));
  set.enableAllProjectMcpServers = true;
  set.enabledMcpjsonServers = [...new Set([...(set.enabledMcpjsonServers || []), "vagabs"])];
  set.permissions = set.permissions || {};
  for (const k of ["allow", "deny"]) set.permissions[k] = [...new Set([...(set.permissions[k] || []), ...(base.permissions[k] || [])])];
  escreverSeMudou(arqSet, JSON.stringify(set, null, 2));
}

function montar(pasta) {
  ["dados", "documentos", "logs", "captura", ".vagabs", ".claude"].forEach((d) => fs.mkdirSync(path.join(pasta, d), { recursive: true }));
  if (!fs.existsSync(path.join(pasta, "LEIA-ME.txt"))) fs.writeFileSync(path.join(pasta, "LEIA-ME.txt"), LEIA_ME, "utf8");
  const db = criar(pasta);
  const vazio = { perfil: {}, preferencias: {}, sigilo: { ativo: false, bloqueio: [], alerta: [] }, config: {}, vagas: [], empresas: [], feitos: [], pedidos: [], varreduras: [] };
  for (const [c, v] of Object.entries(vazio)) if (!fs.existsSync(path.join(pasta, "dados", `${c}.json`))) db.substituir(c, v);
  renovar(pasta);
  return db;
}

const lista = (a) => (Array.isArray(a) && a.length ? a.join(", ") : "—");
function claudeMd(db) {
  const P = db.ler("perfil"), R = db.ler("preferencias"), S = db.ler("sigilo");
  const hoje = new Date().toLocaleDateString("pt-BR");
  return `@.vagabs/instrucoes.md

# Sobre quem usa este Vagabs

Gerado pelo setup em ${hoje}. Os dados completos estão em \`dados/\` (perfil, preferencias, sigilo). Pode editar este arquivo: o app não sobrescreve.

- **Nome:** ${P.nome || "—"} · ${P.cidade || "—"}
- **Áreas:** ${lista(R.setores || [R.setor].filter(Boolean))} · **Cargos:** ${lista(R.cargos)} · **Senioridade:** ${lista(R.senioridades || [R.senioridade].filter(Boolean))}
- **Contrato:** ${lista(R.contratos)}${R.contrato_preferido ? ` (prefere ${R.contrato_preferido})` : ""} · **Modelo:** ${lista(R.modelos)} · **Cidades:** ${lista(R.cidades)}${R.muda_cidade ? " (aceita mudar)" : ""}
- **O que mais importa:** ${lista((R.criterios || []).map((c) => c.nome))}
- **Sigilo:** ${S.ativo ? `ligado. Busca sem o empregador atual saber${S.empregador ? ` (${S.empregador})` : ""}.` : "desligado."}

## Notas para o Claude

(Escreva aqui o que o Claude deve sempre lembrar: tom das respostas, coisas para evitar, histórico que não está no CV.)
`;
}
function gerarClaudeMd(pasta, db, { forcar = false } = {}) {
  const arq = path.join(pasta, "CLAUDE.md");
  if (fs.existsSync(arq) && !forcar) return false;
  fs.writeFileSync(arq, claudeMd(db), "utf8");
  return true;
}

// pasta sugerida no setup
const padrao = () => path.join(app.getPath("documents"), "Vagabs");

module.exports = { montar, renovar, gerarClaudeMd, ferramentas, padrao, mcpServidor, VERSAO };

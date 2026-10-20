/* Trava contra vazamento: roda antes de todo pacote e de toda publicação.
   Procura no código (e, com --pacote, dentro do instalador gerado) os termos de uma lista que fica
   fora deste repositório. Achou, para tudo. Sem a lista, também para: melhor não publicar no escuro.
   Uso: node ferramentas/conferir.js [--pacote] */
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const LISTA = process.env.VAGABS_TRAVA || path.join(RAIZ, "..", "docs", "vagabs-trava.txt");
const SIGILO = path.join(RAIZ, "..", "plataforma", "dados", "sigilo.json");
const IGNORAR = new Set(["node_modules", "dist", ".git"]);
const TEXTO = /\.(js|json|md|html|css|txt|nsh|yml|yaml|svg)$/i;

function termos() {
  if (!fs.existsSync(LISTA)) { console.error(`✗ Lista da trava não encontrada (${LISTA}). Nada é publicado sem ela.`); process.exit(2); }
  const t = fs.readFileSync(LISTA, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  try {
    const s = JSON.parse(fs.readFileSync(SIGILO, "utf8"));
    [...(s.bloqueio || []), ...(s.alerta || [])].forEach((x) => { const nome = String(x).replace(/\s+e grupo$/i, "").trim(); if (nome && !/\s(de|em)\s/i.test(nome)) t.push(`=${nome}`); });
  } catch {}
  return [...new Set(t)].map((l) => {
    const exato = l.startsWith("="), termo = exato ? l.slice(1) : l;
    const esc = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { termo, re: exato ? new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "u") : new RegExp(esc, "iu") };
  });
}

function* arquivos(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* arquivos(p); else yield p;
  }
}

function conferir(lista, ondes) {
  const achados = [];
  for (const { nome, texto } of ondes) {
    texto.split(/\r?\n/).forEach((linha, i) => { for (const t of lista) if (t.re.test(linha)) achados.push(`${nome}:${i + 1}  "${t.termo}"`); });
  }
  return achados;
}

function doCodigo() {
  const r = [];
  for (const p of arquivos(RAIZ)) if (TEXTO.test(p) && !p.endsWith(path.join("ferramentas", "conferir.js"))) r.push({ nome: path.relative(RAIZ, p), texto: fs.readFileSync(p, "utf8") });
  return r;
}
function doPacote() {
  const asar = require("@electron/asar");
  const arq = path.join(RAIZ, "dist", "win-unpacked", "resources", "app.asar");
  if (!fs.existsSync(arq)) { console.error("✗ Pacote não encontrado em dist/win-unpacked. Rode o build antes."); process.exit(2); }
  const r = [];
  for (const f of asar.listPackage(arq)) {
    const rel = f.replace(/^[\\/]/, "");
    if (!TEXTO.test(rel) || rel.includes("node_modules")) continue;
    try { r.push({ nome: `app.asar/${rel}`, texto: asar.extractFile(arq, rel).toString("utf8") }); } catch {}
  }
  const solto = path.join(RAIZ, "dist", "win-unpacked", "resources", "app.asar.unpacked");
  if (fs.existsSync(solto)) for (const p of arquivos(solto)) if (TEXTO.test(p) && !p.includes("node_modules")) r.push({ nome: path.relative(RAIZ, p), texto: fs.readFileSync(p, "utf8") });
  return r;
}

const lista = termos();
const pacote = process.argv.includes("--pacote");
const achados = conferir(lista, pacote ? doPacote() : doCodigo());
if (achados.length) {
  console.error(`✗ Trava: ${achados.length} ocorrência(s) de termos proibidos${pacote ? " no pacote" : " no código"}:`);
  achados.slice(0, 50).forEach((a) => console.error(`  ${a}`));
  process.exit(1);
}
console.log(`✓ Trava: nenhum termo proibido ${pacote ? "no pacote" : "no código"} (${lista.length} termos conferidos).`);

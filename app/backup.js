/* Vagabs — backup
   Copia o que é da pessoa (dados, CLAUDE.md, documentos, conversas) para uma pasta de backup, de
   preferência a do Google Drive para computador, que sobe tudo para a nuvem sozinho. Sem login e
   sem gastar o plano do Claude. Guarda os 10 backups mais novos. Restaurar traz de volta, guardando
   antes uma cópia do que estava. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { VERSAO } = require("./pasta");
const { COLECOES } = require("../nucleo/dados");

const RAIZ_BACKUP = "Vagabs (backup)";
const GUARDAR = 10;
const p2 = (n) => String(n).padStart(2, "0");
const carimbo = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`; };

// a pasta do Google Drive para computador: "G:\Meu Drive" (ou outra letra), ou a pasta antiga no perfil
function acharDrive() {
  const nomes = ["Meu Drive", "My Drive"];
  for (const l of "GHIJKLMNOPQRSTUVWXYZDEF") for (const n of nomes) { const p = `${l}:\\${n}`; try { if (fs.statSync(p).isDirectory()) return p; } catch {} }
  for (const n of ["Google Drive", "Meu Drive", "My Drive"]) { const p = path.join(os.homedir(), n); try { if (fs.statSync(p).isDirectory()) return p; } catch {} }
  return null;
}
const destino = (db) => db.ler("config").backup?.pasta || acharDrive();

function copiar(de, para) {
  if (!fs.existsSync(de)) return 0;
  const st = fs.statSync(de);
  if (st.isFile()) { fs.mkdirSync(path.dirname(para), { recursive: true }); fs.copyFileSync(de, para); return 1; }
  let n = 0;
  for (const e of fs.readdirSync(de)) n += copiar(path.join(de, e), path.join(para, e));
  return n;
}
const tamanho = (p) => { try { const st = fs.statSync(p); return st.isFile() ? st.size : fs.readdirSync(p).reduce((s, e) => s + tamanho(path.join(p, e)), 0); } catch { return 0; } };

function fazer(db) {
  const base = destino(db);
  if (!base) return { ok: false, motivo: "Não achei a pasta do Google Drive neste computador. Instale o Google Drive para computador ou escolha outra pasta." };
  if (!fs.existsSync(base)) return { ok: false, motivo: `A pasta de backup não existe mais: ${base}` };
  const raiz = path.join(base, RAIZ_BACKUP);
  const alvo = path.join(raiz, carimbo());
  let n = 0;
  for (const c of COLECOES) n += copiar(path.join(db.DADOS, `${c}.json`), path.join(alvo, "dados", `${c}.json`));
  n += copiar(path.join(db.pasta, "CLAUDE.md"), path.join(alvo, "CLAUDE.md"));
  n += copiar(path.join(db.pasta, "documentos"), path.join(alvo, "documentos"));
  n += copiar(path.join(db.pasta, "conversas"), path.join(alvo, "conversas"));
  fs.writeFileSync(path.join(alvo, "backup.json"), JSON.stringify({ app: "Vagabs", versao: VERSAO, quando: new Date().toISOString(), arquivos: n }, null, 2), "utf8");
  // só os 10 mais novos ficam
  const todos = fs.readdirSync(raiz).filter((d) => /^\d{4}-\d\d-\d\d_\d{6}$/.test(d)).sort();
  todos.slice(0, Math.max(0, todos.length - GUARDAR)).forEach((d) => fs.rmSync(path.join(raiz, d), { recursive: true, force: true }));
  const r = { ok: true, caminho: alvo, arquivos: n, kb: Math.round(tamanho(alvo) / 1024), quando: new Date().toISOString() };
  db.objeto("config", { backup: { ...db.ler("config").backup, ultimo: { quando: r.quando, caminho: alvo, arquivos: n } } });
  return r;
}

// restaura um backup: guarda antes o que está aqui, depois traz os dados de volta
function restaurar(db, pastaBackup) {
  let dir = pastaBackup;
  // aceita a pasta "Vagabs (backup)" (pega o mais novo) ou um backup específico
  if (dir && !fs.existsSync(path.join(dir, "backup.json"))) {
    const filhos = fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "backup.json"))).sort() : [];
    if (filhos.length) dir = path.join(dir, filhos.at(-1));
  }
  if (!dir || !fs.existsSync(path.join(dir, "backup.json"))) return { ok: false, motivo: "Essa pasta não é um backup do Vagabs." };
  const seguranca = path.join(db.pasta, "_antes-de-restaurar", carimbo());
  copiar(db.DADOS, path.join(seguranca, "dados"));
  copiar(path.join(db.pasta, "CLAUDE.md"), path.join(seguranca, "CLAUDE.md"));
  let n = 0;
  for (const c of COLECOES) {
    const arq = path.join(dir, "dados", `${c}.json`);
    if (!fs.existsSync(arq)) continue;
    try { db.substituir(c, JSON.parse(fs.readFileSync(arq, "utf8"))); n++; } catch {}
  }
  copiar(path.join(dir, "CLAUDE.md"), path.join(db.pasta, "CLAUDE.md"));
  copiar(path.join(dir, "documentos"), path.join(db.pasta, "documentos"));
  copiar(path.join(dir, "conversas"), path.join(db.pasta, "conversas"));
  const info = JSON.parse(fs.readFileSync(path.join(dir, "backup.json"), "utf8"));
  return { ok: true, colecoes: n, de: info.quando, seguranca };
}

/* ---------- backup essencial (para o conector do Google Drive, pelo Claude) ----------
   Pelo conector, o Claude tem de escrever o conteúdo inteiro no Drive, e isso gasta o plano. Então vai
   só o essencial: perfil, preferências, sigilo, configuração, feitos, empresas, varreduras e as vagas
   (as encerradas e reprovadas, resumidas). Ficam de fora o histórico de pedidos, as conversas e os
   arquivos de documentos. */
const ATIVAS = ["nova", "depois", "aprovada", "kit", "enviada", "processo", "proposta"];
function pacoteEssencial(db) {
  const vagas = db.ler("vagas").filter((v) => !v.exemplo).map((v) => ATIVAS.includes(v.estado) ? v
    : { id: v.id, id_fonte: v.id_fonte, fonte: v.fonte, url: v.url, empresa: v.empresa, cargo: v.cargo, local: v.local, estado: v.estado, nota: v.nota, captada: v.captada, desfecho: v.desfecho, motivos_reprovacao: v.motivos_reprovacao, etapas: (v.etapas || []).slice(-2) });
  const config = { ...db.ler("config") }; delete config.backup;
  return { app: "Vagabs", tipo: "backup-essencial", versao: VERSAO, quando: new Date().toISOString(),
    colecoes: { perfil: db.ler("perfil"), preferencias: db.ler("preferencias"), sigilo: db.ler("sigilo"), config, feitos: db.ler("feitos"), empresas: db.ler("empresas"), varreduras: db.ler("varreduras"), vagas } };
}
// grava em <pasta>/backup/ com linhas curtas (a ferramenta de leitura do Claude corta linhas longas)
function gravarPacote(db) {
  const dir = path.join(db.pasta, "backup"); fs.mkdirSync(dir, { recursive: true });
  const texto = JSON.stringify(pacoteEssencial(db), null, 1);
  const arq = path.join(dir, "vagabs-backup.json");
  fs.writeFileSync(arq, texto, "utf8");
  return { arq, caracteres: texto.length, linhas: texto.split("\n").length };
}
const estimativa = (db) => { const n = JSON.stringify(pacoteEssencial(db), null, 1).length; return { kb: Math.round(n / 1024), tokens: Math.round(n / 3.2) }; };
// traz de volta um backup essencial baixado do Drive (guarda antes o que está aqui)
function restaurarPacote(db, arq) {
  let b; try { b = JSON.parse(fs.readFileSync(arq, "utf8")); } catch { return { ok: false, motivo: "O arquivo baixado do Drive não é um backup válido." }; }
  if (b?.app !== "Vagabs" || !b.colecoes) return { ok: false, motivo: "O arquivo baixado do Drive não é um backup do Vagabs." };
  const seguranca = path.join(db.pasta, "_antes-de-restaurar", carimbo());
  copiar(db.DADOS, path.join(seguranca, "dados"));
  let n = 0;
  for (const [c, dados] of Object.entries(b.colecoes)) { try { db.substituir(c, c === "config" ? { ...dados, backup: db.ler("config").backup } : dados); n++; } catch {} }
  return { ok: true, colecoes: n, de: b.quando, seguranca };
}

function estado(db) {
  const b = db?.ler("config").backup || {};
  return { drive: acharDrive(), pasta: b.pasta || null, destino: db ? destino(db) : acharDrive(), auto: b.auto !== false, ultimo: b.ultimo || null,
    // pelo conector do Drive na conta Claude
    autoClaude: !!b.autoClaude, ultimoClaude: b.ultimoClaude || null, ferramentasDrive: b.ferramentasDrive || [], estimativa: db ? estimativa(db) : null };
}

module.exports = { fazer, restaurar, estado, acharDrive, RAIZ_BACKUP, gravarPacote, restaurarPacote };

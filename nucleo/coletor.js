/* Vagabs — coletor de vagas (roda antes do Claude na varredura)
   Fontes sem login: portal da Gupy, busca pública do LinkedIn e os sites de carreira das
   empresas-alvo (Gupy, Greenhouse, Lever, Workday). Faz só o que não pede julgamento: junta,
   tira repetidas e já vistas, barra a lista de bloqueio do sigilo e o que não bate com os termos
   pelo título. O resto vai para <pasta>/captura/AAAA-MM-DD.json, e o Claude dá a nota. */
"use strict";
const fs = require("fs");
const path = require("path");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const CONTRATO = { vacancy_type_effective: "CLT", vacancy_legal_entity: "PJ", vacancy_type_internship: "Estágio", vacancy_type_temporary: "Temporário", vacancy_type_associate: "Associado", vacancy_type_talent_pool: "Banco de talentos", vacancy_type_apprentice: "Aprendiz", vacancy_type_freelancer: "Freela" };
const MODELO = { remote: "Remoto", hybrid: "Híbrido", "on-site": "Presencial" };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const hojeTxt = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
const desescapar = (s) => String(s || "").replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENTIDADES[e.toLowerCase()] ?? m;
});
function textoLimpo(h, limite = 4000) {
  let t = String(h || "").replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, "\n");
  t = desescapar(t.replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return t.slice(0, limite);
}

async function baixar(url, { tentativas = 3, json = false, corpo = null, log = () => {} } = {}) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, {
        method: corpo ? "POST" : "GET",
        headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9", ...(json ? { Accept: "application/json", "Content-Type": "application/json" } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(30000),
      });
      if (r.status === 429) throw new Error("429");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return json ? await r.json() : await r.text();
    } catch (e) {
      if (i + 1 === tentativas) { log(`falhou ${url}: ${e.message}`); return json ? null : ""; }
      await pausa(String(e.message).includes("429") ? 45000 : 5000); // 429 = pedidos demais seguidos
    }
  }
}
const nextData = (pagina) => { const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(pagina || ""); try { return m ? JSON.parse(m[1]) : null; } catch { return null; } };

async function gupy(termo, log) {
  const d = nextData(await baixar(`https://portal.gupy.io/job-search/term=${encodeURIComponent(termo)}`, { log }));
  const lista = d?.props?.pageProps?.initialJobList?.data || [];
  return lista.map((j) => ({
    fonte: "Gupy", id_fonte: `gupy-${j.id}`, url: j.jobUrl, empresa: (j.careerPageName || "").trim(), cargo: (j.name || "").trim(),
    local: [j.city, j.state].filter(Boolean).join(", "), modelo: MODELO[j.workplaceType] || j.workplaceType || "",
    contrato: CONTRATO[j.type] || j.type || "", publicada: (j.publishedDate || "").slice(0, 10), descricao: textoLimpo(j.description),
  }));
}

// f_WT do LinkedIn: 1 presencial, 2 remoto, 3 híbrido
async function linkedin(termo, local, log, wt = "") {
  const q = new URLSearchParams({ keywords: termo, location: local || "Brazil", f_TPR: "r604800", start: "0", ...(wt ? { f_WT: wt } : {}) });
  const pagina = await baixar(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${q}`, { log });
  return pagina.split("<li>").slice(1).map((card) => {
    const id = /jobPosting:(\d+)/.exec(card), titulo = /base-search-card__title[^>]*>([\s\S]*?)</.exec(card);
    if (!id || !titulo) return null;
    const empresa = /base-search-card__subtitle[^>]*>(?:\s*<a[^>]*>)?([\s\S]*?)</.exec(card);
    const loc = /job-search-card__location[^>]*>([\s\S]*?)</.exec(card), data = /<time[^>]*datetime="([\d-]+)"/.exec(card);
    return { fonte: "LinkedIn", id_fonte: `linkedin-${id[1]}`, url: `https://www.linkedin.com/jobs/view/${id[1]}`,
      empresa: empresa ? desescapar(empresa[1]).trim() : "", cargo: desescapar(titulo[1]).trim(), local: loc ? desescapar(loc[1]).trim() : "",
      modelo: "", contrato: "", publicada: data ? data[1] : "", descricao: "" };
  }).filter(Boolean);
}
async function detalheLinkedin(item, log) {
  const pagina = await baixar(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${item.id_fonte.split("-")[1]}`, { log });
  const m = /show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/.exec(pagina);
  item.descricao = m ? textoLimpo(m[1]) : "";
  const c = /(Tipo de emprego|Employment type)[\s\S]*?description__job-criteria-text[^>]*>([\s\S]*?)</.exec(pagina);
  if (c && !item.contrato) item.contrato = desescapar(c[2]).trim();
}

/* ---------- sites de carreira das empresas-alvo ---------- */
const BRASIL = /(brasil|brazil|são paulo|sao paulo|rio de janeiro|belo horizonte|curitiba|porto alegre|recife|salvador|fortaleza|bras[ií]lia|campinas|florian[óo]polis|\b(sp|rj|mg|pr|rs|sc|pe|ba|ce|df|go)\b|remot)/i;
const OUTRO_PAIS = /\b(US|USA|United States|Canada|Mexico|México|Colombia|Argentina|Chile|Peru|UK|United Kingdom|Spain|Portugal|India|Germany|France|Netherlands)\b/;
const noBrasil = (local) => BRASIL.test(local) && !(OUTRO_PAIS.test(local) && !/(brasil|brazil)/i.test(local));

async function alvoGupy(emp, sub, log) {
  const jobs = nextData(await baixar(`https://${sub}.gupy.io/`, { log }))?.props?.pageProps?.jobs || [];
  return jobs.map((j) => { const end = j.workplace?.address || {}; return {
    fonte: `Gupy (${emp.nome})`, id_fonte: `gupy-${j.id}`, url: `https://${sub}.gupy.io/jobs/${j.id}`, empresa: emp.nome, cargo: (j.title || "").trim(),
    local: [end.city, end.stateShortName].filter(Boolean).join(", "), modelo: MODELO[j.workplace?.workplaceType] || "",
    contrato: CONTRATO[j.type] || j.type || "", publicada: "", descricao: "", _detalhe: ["gupy", sub, j.id] }; });
}
async function alvoGreenhouse(emp, token, log) {
  const d = await baixar(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`, { json: true, log }) || {};
  return (d.jobs || []).filter((j) => noBrasil(j.location?.name || "")).map((j) => ({
    fonte: `Greenhouse (${emp.nome})`, id_fonte: `greenhouse-${token}-${j.id}`, url: j.absolute_url, empresa: emp.nome, cargo: (j.title || "").trim(),
    local: j.location?.name || "", modelo: "", contrato: "", publicada: (j.first_published || j.updated_at || "").slice(0, 10), descricao: textoLimpo(desescapar(j.content)) }));
}
async function alvoLever(emp, conta, log) {
  const d = await baixar(`https://api.lever.co/v0/postings/${conta}?mode=json`, { json: true, log });
  return (Array.isArray(d) ? d : []).filter((j) => noBrasil(`${j.categories?.location || ""} ${j.country || ""}`)).map((j) => ({
    fonte: `Lever (${emp.nome})`, id_fonte: `lever-${j.id}`, url: j.hostedUrl, empresa: emp.nome, cargo: (j.text || "").trim(),
    local: j.categories?.location || j.country || "", modelo: MODELO[j.workplaceType] || "", contrato: "",
    publicada: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : "", descricao: String(j.descriptionPlain || "").slice(0, 4000) }));
}
async function alvoWorkday(emp, url, termos, log) {
  const m = /https:\/\/([^.]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)/.exec(url);
  if (!m) return [];
  const [, tenant, wd, site] = m; const base = `https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}`;
  const saida = [];
  for (const termo of termos.slice(0, 5)) {
    const d = await baixar(`${base}/jobs`, { json: true, corpo: { appliedFacets: {}, limit: 20, offset: 0, searchText: termo }, log }) || {};
    for (const j of d.jobPostings || []) {
      if (!noBrasil(j.locationsText || "")) continue;
      saida.push({ fonte: `Workday (${emp.nome})`, id_fonte: `workday-${tenant}${j.externalPath}`, url: `https://${tenant}.${wd}.myworkdayjobs.com/${site}${j.externalPath}`,
        empresa: emp.nome, cargo: (j.title || "").trim(), local: j.locationsText || "", modelo: "", contrato: "", publicada: "", descricao: "", _detalhe: ["workday", base, j.externalPath] });
    }
    await pausa(1500);
  }
  return saida;
}
async function detalheAlvo(item, log) {
  const t = item._detalhe; delete item._detalhe;
  if (!t) return;
  if (t[0] === "gupy") {
    const job = nextData(await baixar(`https://${t[1]}.gupy.io/jobs/${t[2]}`, { log }))?.props?.pageProps?.job || {};
    item.descricao = textoLimpo([job.description, job.responsibilities, job.prerequisites].filter(Boolean).join(" "));
    item.publicada = (job.publishedAt || "").slice(0, 10);
    // perguntas do formulário da candidatura: o kit responde a elas
    const perguntas = (job.questionForm?.questions || []).map((q) => q && (q.title || q.question)).filter(Boolean);
    if (perguntas.length) item.perguntas = perguntas.slice(0, 15);
  } else if (t[0] === "workday") {
    const info = (await baixar(t[1] + t[2], { json: true, log }) || {}).jobPostingInfo || {};
    item.descricao = textoLimpo(info.jobDescription); item.publicada = (info.startDate || "").slice(0, 10);
  }
}
async function empresasAlvo(empresas, termos, log) {
  const saida = [];
  for (const emp of empresas) {
    if (emp.prioridade === "bloqueio" || emp.sigilo) continue; // empresa com regra de sigilo não é varrida aqui
    const url = emp.url_carreiras || "";
    try {
      const g = /https?:\/\/([a-z0-9-]+)\.gupy\.io/.exec(url);
      if (g) saida.push(...await alvoGupy(emp, g[1], log));
      else if (url.includes("greenhouse.io/")) saida.push(...await alvoGreenhouse(emp, url.replace(/\/+$/, "").split("/").pop(), log));
      else if (url.includes("jobs.lever.co/")) saida.push(...await alvoLever(emp, url.replace(/\/+$/, "").split("/").pop(), log));
      else if (url.includes("myworkdayjobs.com")) saida.push(...await alvoWorkday(emp, url, termos, log));
      else continue;
    } catch (e) { log(`empresa ${emp.nome}: ${e.message}`); }
    await pausa(1500);
  }
  return saida;
}

/* ---------- onde a pessoa topa trabalhar ----------
   Remoto vale qualquer cidade do Brasil; híbrido e presencial, só nas cidades de cada um
   (ou em qualquer lugar, se ela aceita mudar). */
function locaisDe(db) {
  const R = db.ler("preferencias") || {};
  const modelos = (R.modelos || []).map((m) => norm(m));
  const locais = R.locais || Object.fromEntries((R.modelos || []).filter((m) => norm(m) !== "remoto").map((m) => [m, R.cidades || []]));
  const cid = (nome) => (Object.entries(locais).find(([k]) => norm(k) === nome)?.[1] || []).map(norm).filter(Boolean);
  return { remoto: modelos.includes("remoto"), hibrido: modelos.includes("hibrido"), presencial: modelos.includes("presencial"), cidHibrido: cid("hibrido"), cidPresencial: cid("presencial"), muda: !!R.muda_cidade, definido: modelos.length > 0 };
}
// buscas do LinkedIn: remoto no Brasil; cada cidade com os formatos que ela aceita ali
function buscasLinkedin(L, localAntigo) {
  if (!L.definido) return [[localAntigo || "Brazil", ""]];
  const b = [];
  if (L.remoto) b.push(["Brazil", "2"]);
  if (L.muda && (L.hibrido || L.presencial)) b.push(["Brazil", [L.presencial && "1", L.hibrido && "3"].filter(Boolean).join(",")]);
  else {
    const cidades = [...new Set([...(L.hibrido ? L.cidHibrido : []), ...(L.presencial ? L.cidPresencial : [])])].slice(0, 4);
    for (const c of cidades) b.push([`${c}, Brazil`, [L.presencial && L.cidPresencial.includes(c) && "1", L.hibrido && L.cidHibrido.includes(c) && "3"].filter(Boolean).join(",")]);
  }
  return b;
}
function encaixaLocal(item, L) {
  if (!L.definido) return true;
  const modelo = norm(item.modelo), local = norm(item.local);
  const naCidade = (lista) => L.muda || lista.some((c) => local.includes(c));
  if (/remot/.test(modelo) || (!modelo && /remot/.test(local))) return L.remoto;
  if (/hibrid|hybrid/.test(modelo)) return L.hibrido && naCidade(L.cidHibrido);
  if (/presencial|on site|onsite/.test(modelo)) return L.presencial && naCidade(L.cidPresencial);
  // modelo desconhecido: fica se a cidade bate com algum formato aceito, ou se a pessoa topa remoto (o Claude confere)
  return L.remoto || (L.hibrido && naCidade(L.cidHibrido)) || (L.presencial && naCidade(L.cidPresencial));
}

/* ---------- a coleta do dia ---------- */
async function coletar(db, { log = () => {}, progresso = () => {} } = {}) {
  const CAPTURA = path.join(db.pasta, "captura");
  const VISTAS = path.join(CAPTURA, "vistas.json");
  fs.mkdirSync(CAPTURA, { recursive: true });
  const hoje = hojeTxt();
  const cfg = db.ler("config").varredura || {};
  const termos = (cfg.termos || []).filter(Boolean);
  const fontesOn = cfg.fontes || { gupy: true, linkedin: true, empresas: true };
  const palavras = (cfg.palavras_titulo || []).map(norm).filter(Boolean);
  const excluir = (cfg.excluir_titulo || []).map(norm).filter(Boolean);
  const diasMax = cfg.dias_max || 45;
  const bloqueio = (db.ler("sigilo").bloqueio || []).map(norm).filter(Boolean);
  const L = locaisDe(db);
  const buscasLI = buscasLinkedin(L, cfg.local);
  let vistas = new Set(); try { vistas = new Set(JSON.parse(fs.readFileSync(VISTAS, "utf8"))); } catch {}
  db.ler("vagas").forEach((v) => v.id_fonte && vistas.add(v.id_fonte));

  const brutas = new Map(), fontes = new Set();
  const somar = (lista, rotulo) => lista.forEach((i) => { if (!brutas.has(i.id_fonte)) brutas.set(i.id_fonte, i); fontes.add(rotulo || i.fonte); });
  let n = 0;
  for (const termo of termos) {
    progresso(`Buscando "${termo}" (${++n} de ${termos.length})`);
    if (fontesOn.gupy !== false) { somar(await gupy(termo, log)); await pausa(1500); }
    if (fontesOn.linkedin !== false) for (const [onde, wt] of buscasLI) { somar(await linkedin(termo, onde, log, wt)); await pausa(6000); }
  }
  if (fontesOn.empresas !== false) { progresso("Lendo os sites das empresas-alvo"); somar(await empresasAlvo(db.ler("empresas"), termos, log), "Sites das empresas"); }

  let lidas = brutas.size, bloqueadas = 0, foraFiltro = 0, jaVistas = 0;
  let candidatas = [];
  const limite = new Date(Date.now() - diasMax * 86400000).toISOString().slice(0, 10);
  for (const [k, item] of brutas) {
    if (vistas.has(k)) { jaVistas++; continue; }
    if (bloqueio.some((b) => norm(item.empresa).includes(b))) { bloqueadas++; vistas.add(k); continue; }
    const t = norm(item.cargo);
    const velha = item.publicada && item.publicada < limite; // anúncio velho não é vaga aberta de verdade
    const semTermo = palavras.length && !palavras.some((p) => t.includes(p));
    if (velha || semTermo || excluir.some((p) => t.includes(p))) { foraFiltro++; vistas.add(k); continue; }
    // fora de onde a pessoa topa trabalhar: não marca como vista (se ela mudar as cidades, a vaga volta)
    if (!encaixaLocal(item, L)) { foraFiltro++; continue; }
    candidatas.push(item);
  }
  let d = 0;
  for (const item of candidatas) {
    progresso(`Lendo as descrições (${++d} de ${candidatas.length})`);
    if (item.fonte === "LinkedIn" && !item.descricao) { await detalheLinkedin(item, log); await pausa(5000); }
    else if (item._detalhe) { await detalheAlvo(item, log); await pausa(1500); }
  }
  // a coleta do dia soma com a anterior enquanto o Claude não avaliou o dia
  const arqDia = path.join(CAPTURA, `${hoje}.json`);
  const avaliado = db.ler("varreduras").some((r) => String(r.data || "").startsWith(hoje));
  if (fs.existsSync(arqDia) && !avaliado) {
    try {
      const antes = JSON.parse(fs.readFileSync(arqDia, "utf8")); const ids = new Set(candidatas.map((c) => c.id_fonte));
      candidatas = (antes.candidatas || []).filter((c) => !ids.has(c.id_fonte)).concat(candidatas);
      lidas += antes.lidas || 0; bloqueadas += antes.bloqueadas || 0; foraFiltro += antes.fora_do_filtro || 0;
      (antes.fontes || []).forEach((f) => fontes.add(f));
    } catch {}
  }
  candidatas.forEach((c) => delete c._detalhe);
  lidas -= jaVistas; // "lidas" = vagas que ainda não tinham sido vistas
  const saida = { data: hoje, fontes: [...fontes].sort(), termos, lidas: Math.max(0, lidas), ja_vistas: jaVistas, bloqueadas, fora_do_filtro: foraFiltro, candidatas };
  fs.writeFileSync(arqDia, JSON.stringify(saida, null, 2), "utf8");
  candidatas.forEach((c) => vistas.add(c.id_fonte));
  fs.writeFileSync(VISTAS, JSON.stringify([...vistas].sort()), "utf8");
  return saida;
}

// busca avulsa (para pedidos do tipo "procura vagas de X")
async function buscar(termo, local, log = () => {}) {
  const r = [...await gupy(termo, log), ...await linkedin(termo, local, log)];
  return r.slice(0, 40).map(({ descricao, ...x }) => ({ ...x, descricao: (descricao || "").slice(0, 600) }));
}

module.exports = { coletar, buscar, textoLimpo, locaisDe, encaixaLocal, buscasLinkedin };

/* Vagabs — fontes de vagas que a pessoa acrescenta (ex.: trampos.co)
   O Claude investiga o site e monta uma "receita": o endereço de busca e onde ficam cargo, empresa,
   link etc. A coleta segue a receita sozinha, sem gastar o plano. Duas formas:
   - json: o site tem uma busca que devolve JSON. `itens` é o caminho até a lista ("data.jobs") e cada
     campo é um caminho dentro do item ("company.name", "locations[0].city").
   - html: a página de busca traz as vagas no HTML. `itens` é uma expressão regular que pega o bloco de
     cada vaga e cada campo é uma expressão com um grupo, aplicada dentro do bloco.
   Na url, no corpo e nos cabeçalhos, {termo} e {local} viram o termo e o local da busca. */
"use strict";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const CAMPOS = ["id", "cargo", "empresa", "url", "local", "modelo", "contrato", "publicada", "descricao", "faixa"];

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
const limpar = (s) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m).replace(/\s+/g, " ").trim();
const preencher = (t, vars) => String(t).replace(/\{(termo|local)\}/g, (m, k) => encodeURIComponent(vars[k] || ""));
const preencherObj = (o, vars) => JSON.parse(JSON.stringify(o || {}), (k, v) => (typeof v === "string" ? v.replace(/\{(termo|local)\}/g, (m, c) => vars[c] || "") : v));

// caminho "a.b[0].c" dentro de um objeto
function pegar(obj, caminho) {
  if (!caminho) return undefined;
  return String(caminho).replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean).reduce((o, k) => (o == null ? o : o[k]), obj);
}

async function baixar(url, { metodo = "GET", corpo = null, cabecalhos = {}, limite = 30000 } = {}) {
  const r = await fetch(url, {
    method: metodo, body: corpo ? (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) : undefined,
    headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9", ...(corpo && typeof corpo !== "string" ? { "Content-Type": "application/json" } : {}), ...cabecalhos },
    signal: AbortSignal.timeout(limite), redirect: "follow",
  });
  const texto = await r.text();
  return { status: r.status, tipo: r.headers.get("content-type") || "", texto };
}

// roda a receita para um termo e devolve vagas no formato da coleta
async function rodarReceita(fonte, termo, local = "") {
  const rc = fonte.receita || {};
  if (!rc.url) throw new Error("a receita não tem url");
  const vars = { termo, local };
  const resp = await baixar(preencher(rc.url, vars), { metodo: rc.metodo || "GET", corpo: rc.corpo ? preencherObj(rc.corpo, vars) : null, cabecalhos: preencherObj(rc.cabecalhos, vars) });
  if (resp.status >= 400) throw new Error(`o site respondeu ${resp.status}`);
  const base = rc.url_base || new URL(rc.url.replace(/\{(termo|local)\}/g, "x")).origin;
  const absoluto = (u) => { if (!u) return ""; try { return new URL(String(u), base).href; } catch { return String(u); } };
  let brutos = [];
  if ((rc.tipo || "json") === "json") {
    let dados; try { dados = JSON.parse(resp.texto); } catch { throw new Error("a resposta não é JSON"); }
    const lista = rc.itens ? pegar(dados, rc.itens) : dados;
    if (!Array.isArray(lista)) throw new Error(`não achei a lista em "${rc.itens}"`);
    brutos = lista.map((it) => Object.fromEntries(CAMPOS.map((c) => [c, rc.campos?.[c] ? pegar(it, rc.campos[c]) : undefined])));
  } else {
    const re = new RegExp(rc.itens, "gis");
    for (const m of resp.texto.matchAll(re)) {
      const bloco = m[0];
      brutos.push(Object.fromEntries(CAMPOS.map((c) => { const r = rc.campos?.[c] ? new RegExp(rc.campos[c], "is").exec(bloco) : null; return [c, r ? r[1] : undefined]; })));
      if (brutos.length >= 100) break;
    }
  }
  return brutos.filter((b) => b.cargo).map((b) => {
    const url = absoluto(b.url);
    return { fonte: fonte.nome, id_fonte: `${fonte.id}-${limpar(b.id ?? url ?? b.cargo).slice(0, 120)}`, url, empresa: limpar(b.empresa), cargo: limpar(b.cargo),
      local: limpar(b.local), modelo: limpar(b.modelo), contrato: limpar(b.contrato), faixa: limpar(b.faixa) || null,
      publicada: /^\d{4}-\d\d-\d\d/.test(limpar(b.publicada)) ? limpar(b.publicada).slice(0, 10) : "", descricao: limpar(b.descricao).slice(0, 4000) };
  });
}

module.exports = { rodarReceita, baixar, limpar };

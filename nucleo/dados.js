/* Vagabs — dados
   Uma coleção por arquivo JSON em <pasta>/dados. Toda gravação passa por aqui, tanto a da tela
   quanto a do Claude (pelo MCP): trava entre processos, cópia anterior em _historico/ e carimbo
   "mod" (UTC) em cada item mudado. A tela manda a coleção inteira e vale, item a item, o "mod" mais novo. */
"use strict";
const fs = require("fs");
const path = require("path");

const LISTAS = ["vagas", "empresas", "feitos", "pedidos", "varreduras"];
const OBJETOS = ["perfil", "preferencias", "sigilo", "config"];
const COLECOES = [...LISTAS, ...OBJETOS];
const CHAVE = { varreduras: "data" };
const HISTORICO_MAX = 40; // cópias guardadas por coleção

const agoraUtc = () => new Date().toISOString().slice(0, 19) + "Z";
const esperar = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const carimbo = () => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, "0")}`; };

function criar(pasta) {
  const DADOS = path.join(pasta, "dados");
  const HIST = path.join(DADOS, "_historico");
  const TRAVA = path.join(DADOS, ".trava");

  function caminho(c) {
    if (!COLECOES.includes(c)) throw new Error(`coleção desconhecida: ${c}`);
    return path.join(DADOS, `${c}.json`);
  }
  function ler(c) {
    const arq = caminho(c);
    try { return JSON.parse(fs.readFileSync(arq, "utf8")); }
    catch (e) {
      if (e.code !== "ENOENT") {
        // arquivo quebrado: guarda o estrago e devolve a última cópia boa do histórico
        try { fs.copyFileSync(arq, path.join(HIST, `${c}-quebrado-${carimbo()}.json`)); } catch {}
        const boa = ultimaCopia(c);
        if (boa !== undefined) return boa;
      }
      return OBJETOS.includes(c) ? {} : [];
    }
  }
  function ultimaCopia(c) {
    try {
      const arqs = fs.readdirSync(HIST).filter((f) => f.startsWith(`${c}-`) && !f.includes("quebrado")).sort().reverse();
      for (const f of arqs) { try { return JSON.parse(fs.readFileSync(path.join(HIST, f), "utf8")); } catch {} }
    } catch {}
    return undefined;
  }
  function gravar(c, dados) {
    const arq = caminho(c);
    fs.mkdirSync(HIST, { recursive: true });
    if (fs.existsSync(arq)) {
      fs.copyFileSync(arq, path.join(HIST, `${c}-${carimbo()}.json`));
      podar(c);
    }
    const tmp = `${arq}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(dados, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, arq);
  }
  function podar(c) {
    try {
      const arqs = fs.readdirSync(HIST).filter((f) => f.startsWith(`${c}-`) && !f.includes("quebrado")).sort();
      arqs.slice(0, Math.max(0, arqs.length - HISTORICO_MAX)).forEach((f) => fs.rmSync(path.join(HIST, f), { force: true }));
    } catch {}
  }
  // trava entre processos (app e MCP): uma pasta criada de forma atômica
  function comTrava(fn) {
    fs.mkdirSync(DADOS, { recursive: true });
    const ini = Date.now();
    for (;;) {
      try { fs.mkdirSync(TRAVA); break; }
      catch (e) {
        if (e.code !== "EEXIST") throw e;
        try { if (Date.now() - fs.statSync(TRAVA).mtimeMs > 15000) { fs.rmSync(TRAVA, { recursive: true, force: true }); continue; } } catch {}
        if (Date.now() - ini > 20000) throw new Error("os dados estão travados por outro processo");
        esperar(25);
      }
    }
    try { return fn(); } finally { fs.rmSync(TRAVA, { recursive: true, force: true }); }
  }

  const chaveDe = (c) => CHAVE[c] || "id";
  const acha = (lista, c, id) => lista.find((i) => i && String(i[chaveDe(c)]) === String(id));

  // vale o item com "mod" mais novo; nada some (item que só existe no disco continua)
  function mesclar(disco, cliente, chave) {
    const porChave = new Map(disco.filter((i) => i && typeof i === "object" && chave in i).map((i) => [i[chave], i]));
    const saida = [], vistos = new Set();
    for (const c of cliente) {
      const k = c && typeof c === "object" ? c[chave] : undefined;
      if (k === undefined) { saida.push(c); continue; }
      const d = porChave.get(k);
      saida.push(d && (d.mod || "") > (c.mod || "") ? d : c);
      vistos.add(k);
    }
    disco.forEach((d) => { const k = d && d[chave]; if (k !== undefined && !vistos.has(k)) saida.unshift(d); });
    return saida;
  }

  return {
    pasta, DADOS, COLECOES, LISTAS, OBJETOS,
    ler,
    lerItem(c, id) { const d = ler(c); return Array.isArray(d) ? acha(d, c, id) || null : d; },
    // gravação da tela: a coleção inteira, mesclada com o que está no disco
    receber(c, corpo) {
      return comTrava(() => {
        const atual = ler(c);
        const final = Array.isArray(corpo) && Array.isArray(atual) ? mesclar(atual, corpo, chaveDe(c)) : corpo;
        gravar(c, final);
        return final;
      });
    },
    substituir(c, dados) { return comTrava(() => { gravar(c, dados); return dados; }); },
    atualizar(c, id, campos) {
      return comTrava(() => {
        const d = ler(c); const item = acha(d, c, id);
        if (!item) throw new Error(`não achei ${id} em ${c}`);
        Object.assign(item, campos, { mod: agoraUtc() });
        gravar(c, d); return item;
      });
    },
    adicionar(c, item) {
      return comTrava(() => {
        const d = ler(c); const k = chaveDe(c);
        if (item[k] === undefined) throw new Error(`o item precisa de "${k}"`);
        if (acha(d, c, item[k])) throw new Error(`já existe ${item[k]} em ${c}`);
        item.mod = agoraUtc(); d.unshift(item); gravar(c, d); return item;
      });
    },
    remover(c, id) {
      return comTrava(() => { const d = ler(c); const k = chaveDe(c); const n = d.filter((i) => String(i[k]) !== String(id)); gravar(c, n); return d.length - n.length; });
    },
    objeto(c, chaves) {
      return comTrava(() => { let d = ler(c); if (Array.isArray(d)) d = {}; Object.assign(d, chaves, { mod: agoraUtc() }); gravar(c, d); return d; });
    },
    proximoId(c, prefixo) {
      const maior = ler(c).reduce((m, i) => { const s = String(i.id || ""); return s.startsWith(prefixo) && /^\d+$/.test(s.slice(prefixo.length)) ? Math.max(m, +s.slice(prefixo.length)) : m; }, 0);
      return `${prefixo}${String(maior + 1).padStart(prefixo === "v" ? 3 : 2, "0")}`;
    },
    etapa(idVaga, e) {
      return comTrava(() => {
        const d = ler("vagas"); const v = acha(d, "vagas", idVaga);
        if (!v) throw new Error(`vaga não achada: ${idVaga}`);
        (v.etapas = v.etapas || []).push(e);
        v.etapas.sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
        v.mod = agoraUtc(); gravar("vagas", d); return v;
      });
    },
  };
}

module.exports = { criar, COLECOES, LISTAS, OBJETOS, agoraUtc };

/* Vagabs — MCP "vagabs" (stdio)
   As ferramentas que o Claude usa para ler e gravar os dados do Vagabs e buscar vagas.
   Roda com o próprio executável do app (ELECTRON_RUN_AS_NODE=1); a pasta vem em VAGABS_PASTA.
   Protocolo: JSON-RPC 2.0, uma mensagem por linha. */
"use strict";
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { criar, COLECOES, OBJETOS } = require("../nucleo/dados.js");
const coletor = require("../nucleo/coletor.js");

const PASTA = process.env.VAGABS_PASTA || process.cwd();
const db = criar(PASTA);
// empacotado, o package.json fica dentro do app.asar, que o modo node não lê: a versão vem do app
const VERSAO = process.env.VAGABS_VERSAO || (() => { try { return require("../package.json").version; } catch { return "0"; } })();

const col = { type: "string", enum: COLECOES, description: "Coleção: " + COLECOES.join(", ") };
const FERRAMENTAS = [
  { name: "ler", description: "Lê uma coleção inteira, ou um item dela pelo id (em varreduras, a chave é a data). perfil, preferencias, sigilo e config são objetos.",
    inputSchema: { type: "object", properties: { colecao: col, id: { type: "string" } }, required: ["colecao"] },
    fazer: ({ colecao, id }) => (id ? db.lerItem(colecao, id) : db.ler(colecao)) },
  { name: "atualizar", description: "Muda campos de um item de uma coleção-lista (vagas, empresas, feitos, pedidos, varreduras). Só os campos enviados mudam.",
    inputSchema: { type: "object", properties: { colecao: col, id: { type: "string" }, campos: { type: "object" } }, required: ["colecao", "id", "campos"] },
    fazer: ({ colecao, id, campos }) => db.atualizar(colecao, id, campos) },
  { name: "adicionar", description: "Acrescenta um item numa coleção-lista. Precisa de id (use proximo_id) ou, em varreduras, de data.",
    inputSchema: { type: "object", properties: { colecao: col, item: { type: "object" } }, required: ["colecao", "item"] },
    fazer: ({ colecao, item }) => db.adicionar(colecao, item) },
  { name: "objeto", description: "Muda chaves de uma coleção-objeto (perfil, preferencias, sigilo, config). Só as chaves enviadas mudam.",
    inputSchema: { type: "object", properties: { colecao: { type: "string", enum: OBJETOS }, chaves: { type: "object" } }, required: ["colecao", "chaves"] },
    fazer: ({ colecao, chaves }) => db.objeto(colecao, chaves) },
  { name: "proximo_id", description: "Próximo id livre. Prefixos: vagas v (v001), empresas e (e01), feitos F (F01), pedidos p (p01).",
    inputSchema: { type: "object", properties: { colecao: col, prefixo: { type: "string" } }, required: ["colecao", "prefixo"] },
    fazer: ({ colecao, prefixo }) => db.proximoId(colecao, prefixo) },
  { name: "etapa", description: "Acrescenta uma etapa na linha do tempo de uma vaga: {data: AAAA-MM-DD, tipo, nota, origem?}.",
    inputSchema: { type: "object", properties: { vaga: { type: "string" }, etapa: { type: "object" } }, required: ["vaga", "etapa"] },
    fazer: ({ vaga, etapa }) => { const v = db.etapa(vaga, etapa); return { id: v.id, estado: v.estado, etapas: v.etapas.length }; } },
  { name: "captura", description: "Lê a coleta do dia feita pelo app antes da varredura, em páginas de 8 candidatas com a descrição resumida. A resposta diz quantas páginas há; peça a próxima até a última. Sem data, a mais recente.",
    inputSchema: { type: "object", properties: { data: { type: "string", description: "AAAA-MM-DD" }, pagina: { type: "number", description: "1, 2, 3… (padrão 1)" } } },
    fazer: ({ data, pagina = 1 }) => {
      const dir = path.join(PASTA, "captura");
      const arq = data ? `${data}.json` : (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop() : null);
      if (!arq || !fs.existsSync(path.join(dir, arq))) return { erro: "nenhuma coleta encontrada" };
      const c = JSON.parse(fs.readFileSync(path.join(dir, arq), "utf8"));
      // em páginas e com a descrição resumida: a coleta inteira passa de 100 mil caracteres
      const POR = 8, total = (c.candidatas || []).length, paginas = Math.max(1, Math.ceil(total / POR));
      const p = Math.min(Math.max(1, Math.floor(pagina)), paginas);
      const { candidatas, ...resto } = c;
      return { ...resto, total_candidatas: total, pagina: p, paginas,
        candidatas: (candidatas || []).slice((p - 1) * POR, p * POR).map((x) => ({ ...x, descricao: String(x.descricao || "").slice(0, 1500) })) };
    } },
  { name: "documentos", description: "Lista os arquivos da pasta documentos (CVs, PDF do LinkedIn, cartas). Leia o conteúdo com a ferramenta Read no caminho devolvido.",
    inputSchema: { type: "object", properties: {} },
    fazer: () => {
      const dir = path.join(PASTA, "documentos"); if (!fs.existsSync(dir)) return [];
      // inclui as subpastas (o material do Enriquecer fica em documentos/enriquecer)
      return fs.readdirSync(dir, { withFileTypes: true, recursive: true }).filter((f) => f.isFile()).map((f) => { const c = path.join(f.parentPath || f.path || dir, f.name); return { nome: path.relative(dir, c), caminho: c, kb: Math.round(fs.statSync(c).size / 1024) }; });
    } },
  { name: "buscar_vagas", description: "Busca avulsa de vagas na Gupy e no LinkedIn público, sem gravar nada. Para pedidos do tipo 'procura vagas de X'.",
    inputSchema: { type: "object", properties: { termo: { type: "string" }, local: { type: "string", description: "ex.: São Paulo, Brazil" } }, required: ["termo"] },
    fazer: ({ termo, local }) => coletor.buscar(termo, local) },
];

function responder(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n"); }
function erro(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"); }

async function tratar(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return responder(id, { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "vagabs", version: VERSAO },
      instructions: "Dados e busca de vagas do Vagabs. Toda gravação nos dados passa por estas ferramentas (nunca edite os JSON da pasta dados à mão)." });
  }
  if (method === "ping") return responder(id, {});
  if (method === "tools/list") return responder(id, { tools: FERRAMENTAS.map(({ fazer, ...t }) => t) });
  if (method === "tools/call") {
    const f = FERRAMENTAS.find((x) => x.name === params?.name);
    if (!f) return erro(id, -32602, `ferramenta desconhecida: ${params?.name}`);
    try {
      const r = await f.fazer(params.arguments || {});
      return responder(id, { content: [{ type: "text", text: typeof r === "string" ? r : JSON.stringify(r, null, 1) }] });
    } catch (e) {
      return responder(id, { content: [{ type: "text", text: `Erro: ${e.message}` }], isError: true });
    }
  }
  if (id !== undefined && id !== null) erro(id, -32601, `método não suportado: ${method}`);
}

readline.createInterface({ input: process.stdin }).on("line", (linha) => {
  if (!linha.trim()) return;
  let msg; try { msg = JSON.parse(linha); } catch { return; }
  (Array.isArray(msg) ? msg : [msg]).forEach((m) => tratar(m).catch((e) => m.id != null && erro(m.id, -32603, e.message)));
});

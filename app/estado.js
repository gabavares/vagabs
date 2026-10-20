/* Vagabs — estado do app
   O que o processo principal sabe e a tela precisa ver: configuração do app (onde está a pasta,
   última versão vista), a execução do Claude em andamento e o barramento de eventos (SSE). */
"use strict";
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");
const { app } = require("electron");

const eventos = new EventEmitter();
eventos.setMaxListeners(50);

const ARQ = () => path.join(app.getPath("userData"), "config.json");
let cfg = null;
function config() {
  if (cfg) return cfg;
  try { cfg = JSON.parse(fs.readFileSync(ARQ(), "utf8")); } catch { cfg = {}; }
  return cfg;
}
function salvarConfig(mudancas) {
  Object.assign(config(), mudancas);
  fs.mkdirSync(path.dirname(ARQ()), { recursive: true });
  fs.writeFileSync(ARQ(), JSON.stringify(cfg, null, 2), "utf8");
  eventos.emit("evento", { tipo: "estado" });
  return cfg;
}

const vivo = {
  execucao: null,   // {tipo, rotulo, inicio, passos[], indice, total, pedido}
  uso: null,        // último rate_limit_event do Claude
  limite: null,     // {ate: iso} quando o plano bateu no limite
  atualizacao: { estado: "parada" },
  claude: null,     // última checagem {caminho, versao, logado, email, plano}
  comando: null,    // comando do app rodando no console {qual: instalar|login, inicio}
};
function emitir(tipo, extra = {}) { eventos.emit("evento", { tipo, ...extra }); }

module.exports = { eventos, config, salvarConfig, vivo, emitir };

/* Vagabs — atualização automática pelas Releases do GitHub
   Confere ao abrir e quando a pessoa clica em "Procurar atualizações". Mostra as notas antes de
   baixar. A atualização troca só o programa: a pasta do Vagabs (dados, documentos, CLAUDE.md)
   fica em outro lugar e nunca é tocada. */
"use strict";
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { vivo, emitir } = require("./estado");

let updater = null;
// liga quando o pacote traz o app-update.yml (o electron-builder gera a partir de build.publish e tira o
// "build" do package.json empacotado; por isso não dá para conferir o package.json)
const configurado = () => fs.existsSync(path.join(process.resourcesPath || "", "app-update.yml"));

function definir(estado) { vivo.atualizacao = { ...vivo.atualizacao, ...estado }; emitir("atualizacao", { atualizacao: vivo.atualizacao }); }
function notasTexto(n) {
  if (!n) return "";
  if (Array.isArray(n)) return n.map((x) => `${x.version}\n${x.note || ""}`).join("\n\n");
  return String(n);
}

function iniciar() {
  if (!app.isPackaged || !configurado()) { definir({ estado: app.isPackaged ? "sem-repositorio" : "dev" }); return; }
  ({ autoUpdater: updater } = require("electron-updater"));
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.on("checking-for-update", () => definir({ estado: "procurando", erro: null }));
  updater.on("update-available", (i) => definir({ estado: "disponivel", versao: i.version, notas: notasTexto(i.releaseNotes), data: i.releaseDate }));
  updater.on("update-not-available", () => definir({ estado: "em-dia", conferido: Date.now() }));
  updater.on("download-progress", (p) => definir({ estado: "baixando", progresso: Math.round(p.percent || 0) }));
  updater.on("update-downloaded", (i) => definir({ estado: "pronta", versao: i.version }));
  updater.on("error", (e) => definir({ estado: "erro", erro: String(e?.message || e).slice(0, 300) }));
  setTimeout(procurar, 4000);
}
async function procurar() {
  if (!updater) return vivo.atualizacao;
  try { await updater.checkForUpdates(); } catch (e) { definir({ estado: "erro", erro: String(e.message).slice(0, 300) }); }
  return vivo.atualizacao;
}
async function baixar() { if (updater) { try { await updater.downloadUpdate(); } catch (e) { definir({ estado: "erro", erro: String(e.message).slice(0, 300) }); } } return vivo.atualizacao; }
function instalar() { if (updater && vivo.atualizacao.estado === "pronta") setImmediate(() => updater.quitAndInstall(false, true)); return true; }

module.exports = { iniciar, procurar, baixar, instalar };

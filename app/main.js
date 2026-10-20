/* Vagabs — processo principal
   Abre a janela, sobe o servidor interno (só nesta máquina) e liga a atualização automática.
   Com amor, Gab <3 */
"use strict";
const path = require("path");
const { app, BrowserWindow, shell, dialog, Menu } = require("electron");

// testes: a configuração do app pode ir para outra pasta
if (process.env.VAGABS_DADOS_APP) app.setPath("userData", process.env.VAGABS_DADOS_APP);
if (!app.requestSingleInstanceLock()) { app.quit(); return; }
app.setAppUserModelId("com.vagabs.app");

const servidor = require("./servidor");
const atualizacao = require("./atualizacao");
const consoleP = require("./console");
const trab = require("./trabalhos");
const claude = require("./claude");

let janela = null;

async function abrir() {
  const { porta, chave } = await servidor.iniciar();
  const url = `http://127.0.0.1:${porta}/?chave=${chave}`;
  if (process.env.VAGABS_DEV) console.log(`[vagabs] ${url}`);
  Menu.setApplicationMenu(null);
  janela = new BrowserWindow({
    width: 1360, height: 880, minWidth: 980, minHeight: 640, title: "Vagabs", backgroundColor: "#e7eaf0", show: false,
    icon: path.join(__dirname, "..", "front", "assets", "icone.png"),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  janela.webContents.session.setSpellCheckerLanguages(["pt-BR"]);
  janela.once("ready-to-show", () => janela.show());
  // links externos abrem no navegador da pessoa; a janela só navega dentro do app
  janela.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https?:\/\//i.test(u) && !u.startsWith(`http://127.0.0.1:${porta}`)) shell.openExternal(u); return { action: "deny" }; });
  janela.webContents.on("will-navigate", (e, u) => { if (!u.startsWith(`http://127.0.0.1:${porta}`)) { e.preventDefault(); if (/^https?:\/\//i.test(u)) shell.openExternal(u); } });
  janela.webContents.on("before-input-event", (e, i) => { if (i.key === "F12" && process.env.VAGABS_DEV) janela.webContents.toggleDevTools(); if (i.control && i.key.toLowerCase() === "r") janela.webContents.reload(); });
  janela.on("close", (e) => {
    if (!trab.ocupado()) return;
    const r = dialog.showMessageBoxSync(janela, { type: "question", buttons: ["Esperar", "Fechar mesmo assim"], defaultId: 0, cancelId: 0, title: "Vagabs", message: "O Claude ainda está trabalhando.", detail: "Se fechar agora, o que ele está fazendo para no meio. Pedidos que não terminaram voltam a dar erro e podem ser rodados de novo." });
    if (r === 0) e.preventDefault(); else trab.cancelar();
  });
  await janela.loadURL(url);
  atualizacao.iniciar();
  claude.checar().catch(() => {});
}

app.on("second-instance", () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
app.whenReady().then(abrir);
app.on("window-all-closed", () => { consoleP.encerrar(); app.quit(); });

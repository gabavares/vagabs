/* Vagabs — console embutido
   Um terminal de verdade (PowerShell por baixo, via node-pty/ConPTY) dentro da janela do app,
   aberto na pasta do Vagabs. Serve para instalar o Claude Code, fazer o login e, no modo avançado,
   usar o Claude Code puro. A saída vai para a tela pelos eventos; guarda um trecho para quem abrir depois.
   Os comandos que o app manda (instalar, login) são acompanhados até a linha de comando voltar, para o
   setup não deixar seguir enquanto eles rodam. */
"use strict";
const os = require("os");
const pty = require("node-pty");
const { emitir, vivo } = require("./estado");
const { ambiente } = require("./claude");

const GUARDA = 200000; // caracteres de saída guardados para reabrir a aba
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[@-_]/g;
const PROMPT = /PS [A-Za-z]:\\[^\r\n]*>\s*$/; // a linha "PS C:\...> " do PowerShell
const limpo = (s) => s.replace(ANSI, "");
let sessao = null, saida = "", cols = 100, rows = 30;
let acompanhando = null; // {qual, inicio, depois}
let aoTerminar = () => {};

function iniciar(pasta) {
  if (sessao) return estado();
  saida = "";
  const shell = process.env.SystemRoot ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe` : "powershell.exe";
  sessao = pty.spawn(shell, ["-NoLogo"], { name: "xterm-256color", cols, rows, cwd: pasta || os.homedir(), env: ambiente({ TERM: "xterm-256color" }), useConpty: true });
  sessao.onData((d) => {
    saida = (saida + d).slice(-GUARDA);
    emitir("pty", { dados: d });
    if (acompanhando) { acompanhando.depois = (acompanhando.depois + d).slice(-20000); conferirFim(); }
  });
  sessao.onExit(({ exitCode }) => { sessao = null; emitir("pty-fim", { codigo: exitCode }); if (acompanhando) terminar(); });
  return estado();
}
let espera = null;
function conferirFim() {
  clearTimeout(espera);
  // espera a saída sossegar um pouco antes de decidir que a linha de comando voltou
  espera = setTimeout(() => { if (acompanhando && Date.now() - acompanhando.inicio > 1500 && PROMPT.test(limpo(acompanhando.depois).trimEnd() + " ")) terminar(); }, 500);
}
function terminar() {
  const qual = acompanhando?.qual; acompanhando = null; vivo.comando = null;
  emitir("comando", { comando: null, terminou: qual });
  aoTerminar(qual);
}
function escrever(texto) { if (!sessao) return false; sessao.write(texto); return true; }

// manda um comando; com `acompanhar`, avisa quando ele terminar (a linha de comando volta)
async function comando(pasta, linha, { acompanhar = null } = {}) {
  iniciar(pasta);
  // terminal recém-aberto: espera a primeira linha de comando aparecer antes de digitar
  for (let i = 0; i < 40 && !PROMPT.test(limpo(saida).trimEnd() + " "); i++) await new Promise((r) => setTimeout(r, 200));
  if (acompanhar) {
    acompanhando = { qual: acompanhar, inicio: Date.now(), depois: "" };
    vivo.comando = { qual: acompanhar, inicio: acompanhando.inicio };
    emitir("comando", { comando: vivo.comando });
  }
  escrever(`${linha}\r`);
  return true;
}
function tamanho(c, r) { cols = Math.max(20, c | 0); rows = Math.max(5, r | 0); try { sessao?.resize(cols, rows); } catch {} }
function encerrar() { try { sessao?.kill(); } catch {} sessao = null; if (acompanhando) terminar(); }
function reiniciar(pasta) { encerrar(); return iniciar(pasta); }
const estado = () => ({ ativo: !!sessao, saida, comando: vivo.comando || null });

module.exports = { iniciar, escrever, comando, tamanho, encerrar, reiniciar, estado, quandoTerminar: (fn) => { aoTerminar = fn; } };

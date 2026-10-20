/* Vagabs — console embutido
   Um terminal de verdade (PowerShell por baixo, via node-pty/ConPTY) dentro da janela do app,
   aberto na pasta do Vagabs. Serve para instalar o Claude Code, fazer o login e conversar com
   o Claude. A saída vai para a tela pelos eventos; guarda um trecho para quem abrir a aba depois. */
"use strict";
const os = require("os");
const pty = require("node-pty");
const { emitir } = require("./estado");
const { ambiente } = require("./claude");

const GUARDA = 200000; // caracteres de saída guardados para reabrir a aba
let sessao = null, saida = "", cols = 100, rows = 30;

function iniciar(pasta) {
  if (sessao) return estado();
  saida = "";
  const shell = process.env.SystemRoot ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe` : "powershell.exe";
  sessao = pty.spawn(shell, ["-NoLogo"], { name: "xterm-256color", cols, rows, cwd: pasta || os.homedir(), env: ambiente({ TERM: "xterm-256color" }), useConpty: true });
  sessao.onData((d) => { saida = (saida + d).slice(-GUARDA); emitir("pty", { dados: d }); });
  sessao.onExit(({ exitCode }) => { sessao = null; emitir("pty-fim", { codigo: exitCode }); });
  return estado();
}
function escrever(texto) { if (!sessao) return false; sessao.write(texto); return true; }
function comando(pasta, linha) { iniciar(pasta); setTimeout(() => escrever(`${linha}\r`), sessao && saida ? 0 : 900); return true; }
function tamanho(c, r) { cols = Math.max(20, c | 0); rows = Math.max(5, r | 0); try { sessao?.resize(cols, rows); } catch {} }
function encerrar() { try { sessao?.kill(); } catch {} sessao = null; }
function reiniciar(pasta) { encerrar(); return iniciar(pasta); }
const estado = () => ({ ativo: !!sessao, saida });

module.exports = { iniciar, escrever, comando, tamanho, encerrar, reiniciar, estado };

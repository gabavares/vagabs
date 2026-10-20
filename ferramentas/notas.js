/* Gera build/release-notes.md (o texto da Release no GitHub e do aviso de atualização no app)
   a partir da versão atual em novidades.json. Roda antes de publicar. */
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const versao = require("../package.json").version;
const n = JSON.parse(fs.readFileSync(path.join(RAIZ, "novidades.json"), "utf8")).find((x) => x.versao === versao);
if (!n) { console.error(`✗ novidades.json não tem a versão ${versao}. Escreva as notas antes de publicar.`); process.exit(1); }
const texto = `${n.titulo || `Versão ${versao}`}\n\n${(n.itens || []).map((i) => `- ${i}`).join("\n")}\n\nCom amor, Gab <3\n`;
fs.writeFileSync(path.join(RAIZ, "build", "release-notes.md"), texto, "utf8");
console.log(`✓ Notas da versão ${versao} prontas.`);

/* Vagabs — onde o app está rodando
   No PC (o normal), nada aqui é preenchido e tudo funciona como sempre. Quando o Vagabs roda num
   servidor, quem sobe o app preenche `servidor` antes de carregar o resto:
     socket, chave        onde o servidor interno escuta e a chave fixa (a ponte da web usa)
     negar[]              ferramentas que o Claude nunca usa ali (--disallowedTools)
     modelo               modelo travado
     antesDaVarredura()   gancho antes de coletar (ex.: ler o e-mail para captura/email-<data>.json)
     rotas()              rotas extras da API
     atualizacao          troca do programa pelo GitHub (no lugar do electron-updater)
     estado()             o que a tela precisa saber do servidor */
"use strict";
module.exports = { servidor: null };

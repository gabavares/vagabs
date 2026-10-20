# Vagabs

Sua busca de emprego organizada, com o seu próprio Claude Code.

O Vagabs é um app para Windows que acha vagas, dá nota pelo que importa para você, monta o kit de cada candidatura (passo a passo, respostas sugeridas e carta) e acompanha cada processo. Quem faz o trabalho pesado é o **Claude Code da própria pessoa**, rodando por dentro do app. Tudo fica no computador; só as buscas de vagas vão à internet.

## Para quem vai usar

1. Baixe o `Vagabs-Setup-x.y.z.exe` na página de [Releases](https://github.com/gabavares/vagabs/releases) e rode.
2. O Windows pode mostrar "O Windows protegeu o computador": clique em **Mais informações** e depois em **Executar assim mesmo**.
3. Siga o setup. Ele ajuda a instalar o Claude Code e a fazer o login, se precisar.

Precisa de um plano Claude (Pro ou Max). O Vagabs usa o seu plano; ele não tem servidor nem conta própria.

## Como funciona

- **Programa** em `%LOCALAPPDATA%\Programs\Vagabs`, trocado a cada atualização.
- **Pasta do Vagabs** (padrão `Documentos\Vagabs`), escolhida no setup: dados, documentos, instruções do Claude e registros. As atualizações nunca mexem nela.
- **Console embutido** (xterm.js + node-pty) com o `claude` aberto na pasta do Vagabs: login e conversa.
- **Fila de pedidos**: tudo o que você pede ao Claude espera na fila e só roda quando você clica em **Rodar fila**, um pedido de cada vez (`claude -p`, escondido).
- **Varredura**: Gupy, LinkedIn público e sites de carreira das empresas-alvo (Gupy, Greenhouse, Lever, Workday). Só roda com o app aberto e com o seu ok.
- **MCP `vagabs`**: as ferramentas que o Claude usa para ler e gravar os dados (com trava, histórico e carimbo de data).

## Desenvolvimento

```bash
npm install
npm start            # abre o app
npm run conferir     # trava contra vazamento de dados pessoais
npm run pacote       # gera dist/Vagabs-Setup-x.y.z.exe
npm run publicar     # gera e publica a Release no GitHub (precisa de GH_TOKEN)
```

Notas de cada versão: `novidades.json` (aparecem num popup depois de atualizar).

Com amor, Gab <3

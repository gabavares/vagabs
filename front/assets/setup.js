/* Vagabs — setup guiado (primeira abertura, ou "Refazer o setup")
   Telas curtas, uma decisão por tela, sempre com "Outro" para escrever. Ao fim, grava os dados,
   gera o CLAUDE.md e chama o Claude para preparar tudo (perfil, feitos, busca, vaga de exemplo). */
(() => {
  "use strict";
  const { esc, ic, api, toast } = VG;
  const RASCUNHO = "vagabs-setup";

  const SETORES = {
    "Tecnologia": ["Desenvolvedor(a)", "Engenheiro(a) de software", "Product Manager", "Analista de dados", "Designer de produto (UX/UI)", "Tech Lead", "Analista de suporte", "Analista de QA"],
    "Marketing, criação e comunicação": ["Gerente de marketing", "Analista de marketing", "Head de criação", "Redator(a)", "Diretor(a) de arte", "Social media", "Gerente de marca", "Analista de comunicação"],
    "Vendas e comercial": ["Executivo(a) de contas", "Gerente comercial", "SDR", "Customer Success", "Analista comercial", "Key Account Manager"],
    "Finanças e contabilidade": ["Analista financeiro", "Controller", "Contador(a)", "Analista de FP&A", "Gerente financeiro", "Analista de tesouraria"],
    "Administração e operações": ["Analista administrativo", "Gerente de operações", "Assistente administrativo", "Analista de processos", "Coordenador(a) de operações"],
    "Recursos humanos": ["Analista de RH", "Business Partner de RH", "Recrutador(a)", "Gerente de RH", "Analista de DP"],
    "Saúde": ["Enfermeiro(a)", "Médico(a)", "Farmacêutico(a)", "Fisioterapeuta", "Psicólogo(a)", "Técnico(a) de enfermagem"],
    "Educação": ["Professor(a)", "Coordenador(a) pedagógico(a)", "Designer instrucional", "Tutor(a)", "Analista de educação corporativa"],
    "Engenharia e indústria": ["Engenheiro(a) de produção", "Engenheiro(a) civil", "Engenheiro(a) mecânico(a)", "Supervisor(a) de produção", "Técnico(a) de manutenção", "Analista de qualidade"],
    "Logística e suprimentos": ["Analista de logística", "Comprador(a)", "Gerente de supply chain", "Coordenador(a) de logística", "Analista de PCP"],
    "Direito": ["Advogado(a)", "Analista jurídico", "Paralegal", "Gerente jurídico", "Analista de compliance"],
    "Varejo e atendimento": ["Gerente de loja", "Vendedor(a)", "Atendimento ao cliente", "Supervisor(a) de loja", "Visual merchandiser"],
    "Setor público e terceiro setor": ["Analista de projetos", "Gestor(a) de projetos sociais", "Captador(a) de recursos", "Assistente técnico(a)"],
  };
  const SENIORIDADE = ["Estágio", "Júnior", "Pleno", "Sênior", "Especialista", "Coordenação", "Gerência", "Diretoria ou Head"];
  const CONTRATOS = ["CLT", "PJ", "Estágio", "Temporário", "Freela"];
  const MODELOS = ["Presencial", "Híbrido", "Remoto"];
  const IDIOMAS = ["Inglês", "Espanhol", "Francês", "Alemão", "Italiano", "Mandarim"];
  const CRITERIOS = ["Salário", "Plano de carreira", "Trabalho remoto", "Empresa grande e estável", "Startup, ritmo rápido", "Propósito e impacto", "Benefícios", "Equilíbrio entre vida e trabalho", "Aprender coisas novas", "Liderar um time", "Perto de casa", "Ambiente diverso"];
  const TIPOS_EMPRESA = ["Multinacional", "Grande empresa brasileira", "Startup", "Empresa média", "Agência ou consultoria", "Setor público", "ONG"];

  const PASSOS = [
    ["ola", "Boas-vindas"], ["pasta", "Pasta"], ["claude", "Claude Code"], ["conectar", "Conectar"], ["voce", "Você"], ["area", "Sua área"],
    ["formato", "Formato"], ["material", "Seu material"], ["importa", "O que importa"], ["empresas", "Empresas"], ["sigilo", "Sigilo"], ["fontes", "Fontes e e-mail"], ["pronto", "Pronto"],
  ];

  let r = null, passo = 0, maximo = 0, ocupado = false, sondagem = null;
  const salvarRascunho = () => { try { localStorage.setItem(RASCUNHO, JSON.stringify({ r, passo, maximo })); } catch {} };
  function rascunho() {
    if (r) return;
    try { const s = JSON.parse(localStorage.getItem(RASCUNHO) || "null"); if (s?.r) { r = s.r; passo = s.passo || 0; maximo = Math.max(passo, s.maximo || 0); } } catch {}
    // rascunho de versão antiga: setor e senioridade eram um só
    if (r && !Array.isArray(r.setores)) { r.setores = r.setor ? [r.setor] : []; r.senioridades = r.senioridade ? [r.senioridade] : []; delete r.setor; delete r.senioridade; }
    const P = VG.db.perfil || {}, R = VG.db.preferencias || {}, S = VG.db.sigilo || {}, C = VG.db.config || {};
    r = r || {
      nome: P.nome || "", cidade: P.cidade || "", email: P.email || "", telefone: P.telefone || "", linkedin: P.linkedin || "",
      setores: R.setores || (R.setor ? [R.setor] : []), cargos: R.cargos || [], senioridades: R.senioridades || (R.senioridade ? [R.senioridade] : []),
      contratos: R.contratos || ["CLT"], contrato_preferido: R.contrato_preferido || "CLT", modelos: R.modelos || ["Híbrido", "Remoto"], cidades: R.cidades || [], muda_cidade: !!R.muda_cidade, faixa_minima: R.faixa_minima || "", idiomas: R.idiomas || [],
      criterios: (R.criterios || []).map((c) => c.nome), pesos: Object.fromEntries((R.criterios || []).map((c) => [c.nome, c.peso])),
      empresas: (VG.db.empresas || []).filter((e) => e.prioridade !== "bloqueio").map((e) => e.nome), empresas_tipo: R.empresas_tipo || [], sugerir: !(VG.db.empresas || []).length,
      sigilo: !!S.ativo, empregador: S.empregador || "", bloqueio: (S.bloqueio || []).filter((x) => x !== S.empregador), alerta: S.alerta || [],
      fontes: C.varredura?.fontes || { gupy: true, linkedin: true, empresas: true }, corte: C.varredura?.corte || 60, email: C.email?.modo || "manual", modelo: C.claude?.modelo || "claude-opus-5-5",
    };
  }

  /* ---------- peças ---------- */
  const fichas = (nome, opcoes, sel, { multi = true } = {}) => `<div class="opcoes" data-grupo="${nome}" data-multi="${multi}">${opcoes.map((o) => `<button type="button" class="ficha" aria-pressed="${(multi ? sel : [sel]).includes(o)}" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
  const outro = (nome, ph) => `<form class="outro" data-outro="${nome}"><input placeholder="${esc(ph)}" aria-label="${esc(ph)}" autocomplete="off"><button class="btn" type="submit">${ic("mais")}Pôr</button></form>`;
  const campo = (k, rot, ph = "", tipo = "text") => `<label class="campo"><span>${rot}</span><input data-k="${k}" type="${tipo}" value="${esc(r[k])}" placeholder="${esc(ph)}" autocomplete="off"></label>`;

  /* ---------- telas ---------- */
  function corpo(id) {
    const est = VG.estado;
    const cl = est.claude;
    if (id === "ola") return `<h1 class="setup-h">E aí, vagabs? Bora montar o seu perfil.</h1>
      <p class="frase">O Vagabs organiza a sua busca de emprego: acha vagas, dá nota pelo que importa para você, monta o kit de cada candidatura e acompanha cada processo. Quem faz o trabalho pesado é o <b>Claude Code</b>, o seu, rodando aqui dentro.</p>
      <ul class="lista-ok"><li>${ic("check")}Tudo fica no seu computador. Só as buscas de vagas vão à internet.</li><li>${ic("check")}Nada sai em seu nome: o Claude prepara, você envia.</li><li>${ic("check")}Você precisa de um plano Claude (Pro ou Max). O Vagabs usa o seu plano.</li></ul>
      <p class="meta">São 13 telas curtas. Dá para voltar e mudar tudo depois.</p>`;
    if (id === "pasta") return `<h1 class="setup-h">Onde guardar o Vagabs?</h1>
      <p class="frase">Uma pasta com seus dados, seus documentos e as instruções do Claude. O Claude trabalha só dentro dela. As atualizações do app nunca apagam nada daqui.</p>
      <div class="caminho"><span>${ic("pasta")}</span><code id="pasta-txt">${esc(r.pasta || est.pasta || est.pastaPadrao)}</code><button class="btn" type="button" id="escolher-pasta">Escolher outra</button></div>
      ${est.pasta ? `<p class="ok-linha">${ic("check")}Pasta pronta.</p>` : `<p class="meta">Se a pasta não se chamar Vagabs, o app cria uma pasta Vagabs dentro dela.</p>`}`;
    if (id === "claude") return `<h1 class="setup-h">O Claude Code está instalado?</h1>
      ${!cl ? `<p class="frase">Conferindo…</p>` : cl.instalado ? `<p class="ok-linha grande">${ic("check")}Claude Code ${esc(cl.versao)} encontrado.</p><p class="meta">${esc(cl.caminho)}</p>`
        : `<p class="frase">Não achei o Claude Code neste computador. Ele é o programa oficial da Anthropic que o Vagabs usa por baixo.</p>
          <div class="botoes"><button class="btn p g" type="button" data-cmd="instalar">${ic("play")}Instalar o Claude Code</button><button class="btn g" type="button" data-abrir="https://docs.claude.com/en/docs/claude-code/setup">${ic("externo")}Ver a página oficial</button><button class="btn g" type="button" data-checar>${ic("atualizar")}Conferir de novo</button></div>
          <p class="meta">"Instalar" roda o instalador oficial (<code>irm https://claude.ai/install.ps1 | iex</code>) no console abaixo. Quando ele terminar, clique em "Conferir de novo".</p>
          <div class="console-mini" data-console></div>`}`;
    if (id === "conectar") return `<h1 class="setup-h">Conecte o Claude à sua conta</h1>
      ${cl?.logado ? `<p class="ok-linha grande">${ic("check")}Conectado${cl.email ? ` como ${esc(cl.email)}` : ""}${cl.plano ? ` · plano ${esc(cl.plano)}` : ""}.</p>
          ${est.ferramentas ? (est.ferramentas.ok && est.ferramentas.vagabs === "connected" ? `<p class="ok-linha">${ic("check")}O Claude enxerga as ferramentas do Vagabs.</p>` : `<p class="aviso-linha">${ic("alerta")}O Claude abriu, mas não carregou as ferramentas do Vagabs (${esc(est.ferramentas.vagabs || est.ferramentas.erro || "sem resposta")}). Tente "Testar de novo"; se continuar, siga e veja a aba Claude depois.</p>`) : `<p class="meta">Testando as ferramentas do Vagabs…</p>`}
          <div class="botoes"><button class="btn" type="button" data-testar>${ic("atualizar")}Testar de novo</button></div>`
        : `<p class="frase">Clique em <b>Fazer login</b>. O navegador abre na página da Anthropic: entre com a sua conta Claude e autorize. Depois volte aqui; o Vagabs percebe sozinho.</p>
          <div class="botoes"><button class="btn p g" type="button" data-cmd="login">${ic("play")}Fazer login</button><button class="btn g" type="button" data-checar>${ic("atualizar")}Já fiz, conferir</button></div>
          <p class="meta">Se o navegador não abrir, o console mostra um link: copie e cole no navegador.</p>
          <div class="console-mini" data-console></div>`}`;
    if (id === "voce") return `<h1 class="setup-h">Primeiro: quem é você, vagabs?</h1><p class="frase">Vai nas candidaturas. Fica só aqui.</p>
      <div class="campos-setup">${campo("nome", "Nome completo", "Como aparece no CV")}${campo("cidade", "Cidade onde mora", "Ex.: Belo Horizonte, MG")}${campo("email", "E-mail para candidaturas", "seu e-mail pessoal", "email")}${campo("telefone", "Telefone", "(11) 90000-0000", "tel")}${campo("linkedin", "LinkedIn (link)", "linkedin.com/in/…")}</div>`;
    if (id === "area") {
      const sugestoes = r.setores.flatMap((x) => SETORES[x] || []);
      const cargos = [...new Set([...sugestoes, ...r.cargos])];
      return `<h1 class="setup-h">Qual é a sua área?</h1>
        <h3 class="setup-sub">Setor <span class="meta">(marque quantos quiser)</span></h3>${fichas("setores", [...new Set([...Object.keys(SETORES), ...r.setores])], r.setores)}${outro("setores", "Outra área")}
        <h3 class="setup-sub">Cargos que você busca <span class="meta">(marque quantos quiser)</span></h3>${cargos.length ? fichas("cargos", cargos, r.cargos) : `<p class="meta">Escolha um setor para ver sugestões, ou escreva abaixo.</p>`}${outro("cargos", "Outro cargo (ex.: Analista de BI)")}
        <h3 class="setup-sub">Senioridade <span class="meta">(pode marcar mais de uma)</span></h3>${fichas("senioridades", SENIORIDADE, r.senioridades)}`;
    }
    if (id === "formato") return `<h1 class="setup-h">Que tipo de vaga serve?</h1>
      <h3 class="setup-sub">Contrato que você aceita</h3>${fichas("contratos", CONTRATOS, r.contratos)}${outro("contratos", "Outro tipo")}
      <h3 class="setup-sub">Preferido</h3>${fichas("contrato_preferido", [...new Set(r.contratos)], r.contrato_preferido, { multi: false })}
      <h3 class="setup-sub">Modelo de trabalho</h3>${fichas("modelos", MODELOS, r.modelos)}
      <h3 class="setup-sub">Cidades</h3>${r.cidades.length ? fichas("cidades", r.cidades, r.cidades) : ""}${outro("cidades", "Cidade (ex.: São Paulo)")}
      <label class="interruptor"><input type="checkbox" data-bool="muda_cidade" ${r.muda_cidade ? "checked" : ""}><span>Aceito mudar de cidade</span></label>
      <div class="campos-setup">${campo("faixa_minima", "Salário mínimo que aceita (opcional)", "Ex.: R$ 8.000")}</div>
      <h3 class="setup-sub">Idiomas que você fala</h3>${fichas("idiomas", [...new Set([...IDIOMAS, ...r.idiomas])], r.idiomas)}${outro("idiomas", "Outro idioma")}`;
    if (id === "material") return `<h1 class="setup-h">Seu currículo</h1>
      <p class="frase">Com o CV (e, se quiser, o PDF do seu LinkedIn), o Claude monta o seu perfil e um banco de feitos: as conquistas que viram respostas e cartas. Pode pular e mandar depois, na Base.</p>
      <div id="docs-lista" class="lista-kv"><p class="meta">Carregando…</p></div>
      <label class="soltar"><input type="file" id="doc-arquivo" accept=".pdf,.doc,.docx,.txt,.md,.rtf,.odt" multiple hidden><span>${ic("arquivo")}Escolher arquivos (PDF, Word ou texto)</span></label>
      <p class="meta">Para baixar o PDF do LinkedIn: no seu perfil, clique em "Recursos" e depois "Salvar como PDF".</p>`;
    if (id === "importa") return `<h1 class="setup-h">O que mais importa numa vaga?</h1>
      <p class="frase">Vira parte da nota de aderência. Marque os que pesam e, nos mais importantes, clique de novo para dar peso dobrado.</p>
      <div class="opcoes" data-grupo="criterios-peso">${[...new Set([...CRITERIOS, ...r.criterios])].map((o) => { const on = r.criterios.includes(o); const p = r.pesos[o] || 1; return `<button type="button" class="ficha ${on && p === 2 ? "forte" : ""}" aria-pressed="${on}" data-v="${esc(o)}">${esc(o)}${on && p === 2 ? " ×2" : ""}</button>`; }).join("")}</div>${outro("criterios", "Outro critério")}`;
    if (id === "empresas") return `<h1 class="setup-h">Empresas onde você quer estar</h1>
      <p class="frase">Escreva as que você já tem em mente. O Claude procura as páginas de vagas delas.</p>
      ${r.empresas.length ? fichas("empresas", r.empresas, r.empresas) : ""}${outro("empresas", "Nome da empresa")}
      <h3 class="setup-sub">Tipos de empresa que você prefere</h3>${fichas("empresas_tipo", TIPOS_EMPRESA, r.empresas_tipo)}
      <label class="interruptor"><input type="checkbox" data-bool="sugerir" ${r.sugerir ? "checked" : ""}><span>Quero que o Claude sugira uma lista de empresas para mim</span></label>`;
    if (id === "sigilo") return `<h1 class="setup-h">Busca em segredo? A gente não conta.</h1>
      <p class="frase">Se você está empregado e o seu empregador não pode saber, o Vagabs filtra as vagas para não te expor.</p>
      <label class="interruptor"><input type="checkbox" data-bool="sigilo" ${r.sigilo ? "checked" : ""}><span>Sim, busco sem o meu empregador saber</span></label>
      ${r.sigilo ? `<div class="campos-setup">${campo("empregador", "Empregador atual", "Nunca vira vaga para você")}</div>
        <h3 class="setup-sub">Outras empresas para bloquear <span class="meta">(nunca viram vaga)</span></h3>${r.bloqueio.length ? fichas("bloqueio", r.bloqueio, r.bloqueio) : ""}${outro("bloqueio", "Empresa (ex.: um sócio do seu empregador)")}
        <h3 class="setup-sub">Empresas de alerta <span class="meta">(entram, mas com aviso; ex.: clientes do seu empregador)</span></h3>${r.alerta.length ? fichas("alerta", r.alerta, r.alerta) : ""}${outro("alerta", "Empresa")}` : ""}`;
    if (id === "fontes") {
      const g = est.ferramentas?.gmail;
      return `<h1 class="setup-h">Onde procurar, e o seu e-mail</h1>
      <h3 class="setup-sub">Fontes de vagas</h3>
      <div class="opcoes" data-grupo="fontes">${[["gupy", "Gupy"], ["linkedin", "LinkedIn (busca pública, sem a sua conta)"], ["empresas", "Sites das empresas-alvo"]].map(([k, rot]) => `<button type="button" class="ficha" aria-pressed="${r.fontes[k] !== false}" data-v="${k}">${esc(rot)}</button>`).join("")}</div>
      <h3 class="setup-sub">Nota mínima para uma vaga chegar até você: <b id="corte-txt">${r.corte}</b></h3>
      <input type="range" min="40" max="85" step="5" value="${r.corte}" data-num="corte" class="faixa" aria-label="Nota de corte">
      <p class="meta">Mais baixo traz mais vagas (e mais ruído). 60 é um bom começo.</p>
      <h3 class="setup-sub">Acompanhar os processos pelo e-mail</h3>
      <div class="opcoes" data-grupo="email" data-multi="false"><button type="button" class="ficha" aria-pressed="${r.email !== "gmail"}" data-v="manual">À mão (eu mudo as fases)</button><button type="button" class="ficha" aria-pressed="${r.email === "gmail"}" data-v="gmail">Pelo Gmail, junto com a varredura</button></div>
      ${r.email === "gmail" ? `<div class="caixa-info"><p>O Vagabs usa o <b>conector do Gmail da sua conta Claude</b>, só para <b>ler</b> retornos de processos seletivos. Enviar, responder, rascunhar e apagar ficam bloqueados.</p>
        <ol><li>Abra <button class="btn txt" type="button" data-abrir="https://claude.ai/settings/connectors">claude.ai › Configurações › Conectores</button> e conecte o Gmail (use o seu e-mail pessoal, não o do trabalho).</li><li>Volte e clique em "Testar o Gmail".</li></ol>
        <div class="botoes"><button class="btn" type="button" data-testar-gmail>${ic("atualizar")}Testar o Gmail</button>${g ? (g.conectado && g.ferramentas.length ? `<span class="ok-linha">${ic("check")}Gmail conectado.</span>` : `<span class="aviso-linha">${ic("alerta")}Ainda não achei o Gmail na sua conta Claude.</span>`) : ""}</div></div>` : ""}`;
    }
    if (id === "pronto") {
      const linhas = [["Você", [r.nome, r.cidade].filter(Boolean).join(" · ")], ["Área", [r.setores.join(", "), r.senioridades.join(", ")].filter(Boolean).join(" · ")], ["Cargos", r.cargos.join(", ")], ["Contrato e modelo", [r.contratos.join(", "), r.modelos.join(", ")].join(" · ")], ["Cidades", r.cidades.join(", ") + (r.muda_cidade ? " (aceita mudar)" : "")], ["O que importa", r.criterios.map((c) => (r.pesos[c] === 2 ? `${c} ×2` : c)).join(", ")], ["Empresas", r.empresas.join(", ") + (r.sugerir ? (r.empresas.length ? " + sugestões do Claude" : "Sugestões do Claude") : "")], ["Sigilo", r.sigilo ? `ligado${r.empregador ? ` (${r.empregador})` : ""}` : "desligado"], ["E-mail", r.email === "gmail" ? "pelo Gmail" : "à mão"]];
      return `<h1 class="setup-h">Tudo certo, vagabs. Bora?</h1>
        <div class="lista-kv resumo-setup">${linhas.map(([k, v]) => `<div><span>${k}</span><b>${esc(v || "—")}</b></div>`).join("")}</div>
        <div class="caixa-info"><p>Ao clicar em <b>Começar</b>, o Claude ${VG.estado.claude?.logado ? "lê o seu material, monta o perfil e os feitos, prepara os termos de busca e cria uma <b>vaga de exemplo</b> para o tutorial. Leva alguns minutos e usa um pouco do seu plano." : "ainda não está conectado: o Vagabs cria a vaga de exemplo sozinho e você pede a preparação depois."}</p></div>`;
    }
    return "";
  }

  // o que cada tela exige para seguir
  function podeSeguir(id) {
    const e = VG.estado;
    if (id === "pasta") return e.pasta ? null : "Escolha a pasta e clique em Próximo para criá-la.";
    if (id === "claude") return e.claude?.instalado ? null : "Instale o Claude Code para seguir.";
    if (id === "conectar") return e.claude?.logado ? null : "Faça o login para seguir.";
    if (id === "voce") return r.nome.trim() ? null : "Escreva pelo menos o seu nome.";
    if (id === "area") return r.setores.length && r.cargos.length && r.senioridades.length ? null : "Escolha pelo menos um setor, um cargo e uma senioridade.";
    if (id === "formato") return r.contratos.length && r.modelos.length && (r.cidades.length || r.modelos.includes("Remoto")) ? null : "Marque contrato, modelo e pelo menos uma cidade (ou remoto).";
    return null;
  }

  function tela() {
    rascunho();
    if (VG.estado.pasta == null && passo > 1) passo = 1;
    const [id] = PASTOS();
    const prox = passo < PASSOS.length - 1;
    return `<section class="setup">
      <aside class="setup-trilha"><div class="marca-setup"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#121417"/><path d="M7.5 9.5 16 24l8.5-14.5" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24.5" cy="9.5" r="3.6" fill="#e39b00"/></svg><b>vagabs</b></div>
        <ol>${PASSOS.map(([pid, rot], i) => `<li class="${i <= maximo && i !== passo ? "passou" : ""} ${i === passo ? "on" : ""}"><button type="button" data-ir="${i}" ${i > maximo ? "disabled" : ""}><span class="check">${ic("check")}</span>${esc(rot)}</button></li>`).join("")}</ol>
        <p class="meta">Passo ${passo + 1} de ${PASSOS.length}</p></aside>
      <div class="setup-cartao painel">
        <div class="setup-corpo">${corpo(id)}</div>
        <div class="setup-rodape"><span class="meta" id="setup-aviso"></span>
          ${passo > 0 ? `<button class="btn g" type="button" data-voltar>Voltar</button>` : ""}
          ${["material", "importa", "empresas", "sigilo"].includes(id) ? `<button class="btn txt" type="button" data-pular>Pular</button>` : ""}
          ${prox ? `<button class="btn p g" type="button" data-proximo>${passo === 0 ? "Começar o setup" : "Próximo"} ${ic("seta")}</button>` : `<button class="btn ok g" type="button" data-concluir ${ocupado ? "disabled" : ""}>${ic("check")}Começar</button>`}
        </div>
      </div></section>`;
  }
  const PASTOS = () => PASSOS[passo];

  async function seguir(pular = false) {
    const [id] = PASTOS();
    if (id === "pasta" && !VG.estado.pasta) {
      try { const p = await api("pasta/usar", { metodo: "POST", corpo: { pasta: r.pasta || VG.estado.pastaPadrao } }); VG.estado.pasta = p.pasta; await VG.carregar(); } catch (e) { return aviso(`Não consegui usar essa pasta: ${e.message}`); }
    }
    const falta = pular ? null : podeSeguir(id);
    if (falta) return aviso(falta);
    passo = Math.min(PASSOS.length - 1, passo + 1); maximo = Math.max(maximo, passo); salvarRascunho(); VG.render(true); aoEntrar();
  }
  const aviso = (t) => { const a = document.getElementById("setup-aviso"); if (a) { a.textContent = t; a.classList.add("on"); } };

  // ações ao entrar em cada tela
  async function aoEntrar() {
    clearInterval(sondagem); sondagem = null;
    const [id] = PASTOS();
    if (id === "claude" || id === "conectar") {
      await checar();
      if (id === "conectar" && VG.estado.claude?.logado && !VG.estado.ferramentas) testar();
      if (id === "conectar" && !VG.estado.claude?.logado) sondagem = setInterval(async () => { if (PASTOS()[0] !== "conectar") return clearInterval(sondagem); const antes = VG.estado.claude?.logado; await checar(false); if (!antes && VG.estado.claude?.logado) { VG.render(true); ligarSetup(); testar(); } }, 4000);
    }
  }
  async function checar(redesenhar = true) {
    try { VG.estado.claude = await api("claude/checar"); } catch {}
    if (redesenhar && VG.rotaAtual()[0] === "setup") VG.render(true);
  }
  async function testar() {
    VG.estado.ferramentas = null; if (VG.rotaAtual()[0] === "setup") VG.render(true);
    try { VG.estado.ferramentas = await api("claude/ferramentas", { metodo: "POST" }); } catch (e) { VG.estado.ferramentas = { ok: false, erro: e.message }; }
    if (VG.rotaAtual()[0] === "setup") VG.render(true);
  }

  async function concluir() {
    if (ocupado) return; ocupado = true; VG.render(true);
    const nomes = (l) => [...new Set(l.map((s) => s.trim()).filter(Boolean))];
    const criterios = r.criterios.map((nome) => ({ nome, peso: r.pesos[nome] || 1 }));
    const dimensoes = [{ nome: "Cargo e senioridade", peso: 2 }, { nome: "Área e setor", peso: 2 }, { nome: "Encaixe com os feitos", peso: 1 }, { nome: "Contrato", peso: 1 }, { nome: "Local e modelo", peso: 1 }, ...criterios.filter((c) => !/remoto|perto de casa/i.test(c.nome))].slice(0, 9);
    // filtro de título: abaixo do nível mais baixo marcado nunca serve
    const idx = Math.min(...r.senioridades.map((x) => SENIORIDADE.indexOf(x)).filter((i) => i >= 0), 99);
    const excluir = [...(idx >= 2 ? ["estagio", "estagiario", "trainee", "aprendiz", "jovem aprendiz"] : []), ...(idx >= 5 ? ["junior", "jr", "assistente", "auxiliar"] : [])];
    const existentes = new Set((VG.db.empresas || []).map((e) => e.nome.toLowerCase()));
    let n = (VG.db.empresas || []).reduce((m, e) => Math.max(m, parseInt(String(e.id).slice(1), 10) || 0), 0);
    const empresas = nomes(r.empresas).filter((e) => !existentes.has(e.toLowerCase())).map((nome) => ({ id: `e${VG.p2(++n)}`, nome, prioridade: "alta", setor: "", ats: "a mapear", url_carreiras: "", abertas: 0 }));
    const cfgAntes = VG.db.config || {};
    const corpoSetup = {
      refazer: !!cfgAntes.setup?.concluido,
      perfil: { nome: r.nome.trim(), cidade: r.cidade, email: r.email, telefone: r.telefone, linkedin: r.linkedin, idiomas: r.idiomas },
      preferencias: { setores: r.setores, setor: r.setores.join(", "), cargos: r.cargos, senioridades: r.senioridades, senioridade: r.senioridades.join(", "), contratos: r.contratos, contrato_preferido: r.contrato_preferido, modelos: r.modelos, cidades: r.cidades, muda_cidade: r.muda_cidade, faixa_minima: r.faixa_minima, idiomas: r.idiomas, criterios, empresas_tipo: r.empresas_tipo, ...(VG.db.preferencias?.dimensoes?.length ? {} : { dimensoes }) },
      sigilo: { ativo: r.sigilo, empregador: r.sigilo ? r.empregador.trim() : "", bloqueio: r.sigilo ? nomes([r.empregador, ...r.bloqueio]) : [], alerta: r.sigilo ? nomes(r.alerta) : [] },
      empresas,
      config: {
        varredura: { ...cfgAntes.varredura, termos: cfgAntes.varredura?.termos?.length ? cfgAntes.varredura.termos : r.cargos.slice(0, 10), local: r.cidades[0] ? `${r.cidades[0]}, Brazil` : "Brazil", corte: r.corte, fontes: r.fontes, excluir_titulo: cfgAntes.varredura?.excluir_titulo || excluir, palavras_titulo: cfgAntes.varredura?.palavras_titulo || [] },
        email: { ...cfgAntes.email, modo: r.email }, claude: { ...cfgAntes.claude, modelo: r.modelo },
      },
      // "miojo de chocolate" em qualquer campo = modo teste: não chama o Claude
      preparar: !!VG.estado.claude?.logado && !cfgAntes.setup?.concluido && !/miojo de chocolate/i.test(JSON.stringify(r)),
      sugerirEmpresas: r.sugerir,
    };
    try {
      await api("setup/concluir", { metodo: "POST", corpo: corpoSetup });
      try { localStorage.removeItem(RASCUNHO); } catch {}
      VG.estado.setup = true; await VG.carregar();
      location.hash = "#/hoje";
      if (corpoSetup.preparar) VG.preparando?.(); else setTimeout(() => VG.tutorial?.oferecer(), 600);
    } catch (e) { toast(`Não consegui terminar: ${e.message}`); }
    ocupado = false;
  }

  /* ---------- ligações ---------- */
  function ligarSetup() {
    const raiz = document.querySelector(".setup"); if (!raiz) return;
    raiz.querySelector("[data-proximo]")?.addEventListener("click", () => seguir());
    raiz.querySelector("[data-pular]")?.addEventListener("click", () => seguir(true));
    raiz.querySelector("[data-voltar]")?.addEventListener("click", () => { passo = Math.max(0, passo - 1); salvarRascunho(); VG.render(true); aoEntrar(); });
    raiz.querySelector("[data-concluir]")?.addEventListener("click", concluir);
    // dá para pular para qualquer passo já alcançado; indo para a frente, os passos do meio precisam continuar válidos
    raiz.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => {
      const alvo = +b.dataset.ir;
      for (let k = passo; k < alvo; k++) { const falta = podeSeguir(PASSOS[k][0]); if (falta) { if (k !== passo) { passo = k; salvarRascunho(); VG.render(true); aoEntrar(); } return aviso(falta); } }
      passo = alvo; salvarRascunho(); VG.render(true); aoEntrar();
    }));
    raiz.querySelectorAll("input[data-k]").forEach((i) => i.addEventListener("input", () => { r[i.dataset.k] = i.value; salvarRascunho(); }));
    raiz.querySelectorAll("input[data-bool]").forEach((i) => i.addEventListener("change", () => { r[i.dataset.bool] = i.checked; salvarRascunho(); VG.render(true); }));
    raiz.querySelectorAll("input[data-num]").forEach((i) => i.addEventListener("input", () => { r[i.dataset.num] = +i.value; document.getElementById("corte-txt").textContent = i.value; salvarRascunho(); }));
    raiz.querySelectorAll(".opcoes[data-grupo]").forEach((g) => g.querySelectorAll(".ficha").forEach((b) => b.addEventListener("click", () => {
      const k = g.dataset.grupo, v = b.dataset.v, multi = g.dataset.multi !== "false";
      if (k === "fontes") r.fontes[v] = r.fontes[v] === false;
      else if (k === "email") r.email = v;
      else if (k === "criterios-peso") {
        // 1º clique marca, 2º dá peso dobrado, 3º desmarca
        if (!r.criterios.includes(v)) { r.criterios.push(v); r.pesos[v] = 1; } else if ((r.pesos[v] || 1) === 1) r.pesos[v] = 2; else { r.criterios = r.criterios.filter((x) => x !== v); delete r.pesos[v]; }
      } else if (!multi) r[k] = v;
      else r[k] = r[k].includes(v) ? r[k].filter((x) => x !== v) : [...r[k], v];
      // tirou um setor: saem os cargos sugeridos só por ele (os escritos à mão ficam)
      if (k === "setores") { const sug = r.setores.flatMap((x) => SETORES[x] || []); r.cargos = r.cargos.filter((c) => !Object.values(SETORES).flat().includes(c) || sug.includes(c)); }
      if (k === "contratos" && !r.contratos.includes(r.contrato_preferido)) r.contrato_preferido = r.contratos[0] || "";
      salvarRascunho(); VG.render(true);
    })));
    raiz.querySelectorAll("form[data-outro]").forEach((f) => f.addEventListener("submit", (e) => {
      e.preventDefault(); const v = f.querySelector("input").value.trim(); if (!v) return;
      const k = f.dataset.outro;
      if (k === "criterios") { if (!r.criterios.includes(v)) r.criterios.push(v); r.pesos[v] = r.pesos[v] || 1; }
      else if (!r[k].includes(v)) r[k] = [...r[k], v];
      salvarRascunho(); VG.render(true);
      document.querySelector(`form[data-outro="${k}"] input`)?.focus();
    }));
    raiz.querySelector("#escolher-pasta")?.addEventListener("click", async () => {
      const { pasta } = await api("pasta/escolher", { metodo: "POST" });
      if (!pasta) return;
      try { const p = await api("pasta/usar", { metodo: "POST", corpo: { pasta } }); r.pasta = p.pasta; VG.estado.pasta = p.pasta; await VG.carregar(); salvarRascunho(); VG.render(true); } catch (e) { aviso(e.message); }
    });
    raiz.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", async () => {
      await api("console/comando", { metodo: "POST", corpo: { qual: b.dataset.cmd } });
      if (b.dataset.cmd === "instalar") toast("Instalando. Acompanhe no console abaixo.");
      if (b.dataset.cmd === "login") toast("O navegador vai abrir para você entrar.");
    }));
    raiz.querySelectorAll("[data-abrir]").forEach((b) => b.addEventListener("click", () => api("abrir", { metodo: "POST", corpo: { url: b.dataset.abrir } })));
    raiz.querySelector("[data-checar]")?.addEventListener("click", () => checar());
    raiz.querySelector("[data-testar]")?.addEventListener("click", testar);
    raiz.querySelector("[data-testar-gmail]")?.addEventListener("click", testar);
    const cons = raiz.querySelector("[data-console]"); if (cons) VG.terminal?.(cons, { altura: 260 });
    if (PASTOS()[0] === "material") VG.ligarDocumentos?.(document.getElementById("docs-lista"), document.getElementById("doc-arquivo"));
    raiz.querySelector(".setup-corpo input[data-k]")?.focus();
  }

  VG.telas.setup = tela;
  VG.titulos.setup = "Setup";
  VG.ligar.setup = ligarSetup;
  VG.setupEntrar = () => { r = null; rascunho(); aoEntrar(); };
})();

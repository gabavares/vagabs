/* Vagabs — reconferir a triagem com o perfil atual
   As vagas que esperam triagem foram avaliadas com o perfil da época da varredura. Quando a pessoa
   muda onde topa trabalhar, os contratos, o sigilo ou o nível, isto passa as regras de novo, sem
   chamar o Claude: o que não encaixa mais sai da triagem (vira "reprovada", com o motivo, e dá para
   trazer de volta pela fase da vaga). Refazer as notas é com o Claude, pela fila. */
"use strict";
const { locaisDe, encaixaLocal } = require("./coletor");
const { agoraUtc } = require("./dados");

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const CONTRATOS_CONHECIDOS = ["clt", "pj", "estagio", "temporario", "freela"];
const p2 = (n) => String(n).padStart(2, "0");
const hojeTxt = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

function motivosFora(v, ctx) {
  const m = [];
  if (!encaixaLocal(v, ctx.L)) m.push("Fora de onde você topa trabalhar");
  if (ctx.sigiloAtivo && ctx.bloqueio.some((b) => norm(v.empresa).includes(b))) m.push("Empresa bloqueada pelo sigilo");
  const c = norm(v.contrato);
  if (c && ctx.contratos.length && CONTRATOS_CONHECIDOS.includes(c) && !ctx.contratos.includes(c)) m.push(`Contrato ${v.contrato}, que você não marcou`);
  const t = norm(v.cargo);
  if (ctx.excluir.some((x) => x && new RegExp(`(^| )${x}( |$)`).test(t))) m.push("Cargo fora do nível que você busca");
  return m;
}

function reconferir(db) {
  const R = db.ler("preferencias") || {}, S = db.ler("sigilo") || {}, C = db.ler("config") || {};
  const ctx = {
    L: locaisDe(db),
    sigiloAtivo: !!S.ativo,
    bloqueio: (S.bloqueio || []).map(norm).filter(Boolean),
    alerta: (S.alerta || []).map(norm).filter(Boolean),
    contratos: (R.contratos || []).map(norm),
    excluir: (C.varredura?.excluir_titulo || []).map(norm),
  };
  const vagas = db.ler("vagas");
  const sairam = [];
  let alertas = 0, conferidas = 0;
  for (const v of vagas) {
    if (v.exemplo || !["nova", "depois"].includes(v.estado)) continue;
    conferidas++;
    const m = motivosFora(v, ctx);
    if (m.length) {
      v.estado = "reprovada";
      v.motivos_reprovacao = ["Fora do perfil atual", ...m];
      (v.etapas = v.etapas || []).push({ data: hojeTxt(), tipo: "reprovada", nota: `Reconferida com o perfil atual: ${m.join("; ")}`, auto: true });
      v.mod = agoraUtc();
      sairam.push({ id: v.id, empresa: v.empresa, cargo: v.cargo, motivos: m });
    } else if (ctx.sigiloAtivo && ctx.alerta.some((a) => norm(v.empresa).includes(a)) && !(v.alertas || []).length) {
      v.alertas = [`Sigilo: ${v.empresa} está na sua lista de alerta.`];
      v.mod = agoraUtc(); alertas++;
    }
  }
  if (sairam.length || alertas) db.substituir("vagas", vagas);
  return { conferidas, sairam, alertas };
}

module.exports = { reconferir };

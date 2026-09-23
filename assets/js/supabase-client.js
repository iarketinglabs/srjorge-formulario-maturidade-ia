// Chave publishable (segura para expor no cliente): a tabela aceita INSERT e
// UPDATE via RLS para o role anon, sem policy de select/delete — o id (UUID
// gerado no navegador, imprevisível) funciona como capability token do rascunho.
const SUPABASE_URL = "https://eesxufjzpmrjdejaojtd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_azmppB67Hwo4Py8OkG7pYQ_f1Zex_zh";

const SUPABASE_REST_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_PUBLISHABLE_KEY,
  "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  "Prefer": "return=minimal"
};

async function submitFormResponse(payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/srjorge_form_responses`, {
    method: "POST",
    headers: SUPABASE_REST_HEADERS,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase insert failed: ${res.status} ${text}`);
  }
}

async function insertDraft(id, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/srjorge_form_responses`, {
    method: "POST",
    headers: SUPABASE_REST_HEADERS,
    body: JSON.stringify(Object.assign({ id: id }, payload))
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase draft insert failed: ${res.status} ${text}`);
  }
}

// Atualização via RPC (função SECURITY DEFINER `update_srjorge_draft`), não
// via PATCH REST direto: a tabela não tem policy de SELECT para anon (para
// não expor respostas de terceiros), e o Postgres RLS exige visibilidade de
// SELECT para localizar a linha-alvo de um UPDATE — sem isso, um PATCH direto
// simplesmente não encontra nenhuma linha (retorna 2xx mas atualiza zero
// registos). A função roda com privilégios elevados só para este update
// pontual, sem nunca devolver dados de outras linhas ao cliente.
async function patchDraft(id, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_srjorge_draft`, {
    method: "POST",
    headers: SUPABASE_REST_HEADERS,
    body: JSON.stringify({
      p_id: id,
      p_answers: payload.answers,
      p_respondent_name: payload.respondent_name || null,
      p_respondent_role: payload.respondent_role || null,
      p_status: payload.status || null,
      p_submitted_at: payload.submitted_at || null
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase draft update failed: ${res.status} ${text}`);
  }
}

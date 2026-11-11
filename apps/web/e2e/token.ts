// Token fictício do e2e: a configuração sobe a API e o painel com ele, e os
// testes que conferem a API direto mandam o mesmo.
export const FINANCE_API_TOKEN = "token-ficticio-do-e2e";

export const COM_TOKEN = {
  headers: { Authorization: `Bearer ${FINANCE_API_TOKEN}` },
};

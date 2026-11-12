// Credenciais fictícias do e2e: a configuração sobe a API e o painel com elas,
// e os testes usam as mesmas. Nenhuma vale fora do e2e.
export const FINANCE_API_TOKEN = "token-ficticio-do-e2e";

export const COM_TOKEN = {
  headers: { Authorization: `Bearer ${FINANCE_API_TOKEN}` },
};

export const SENHA_DO_E2E = "senha-ficticia-do-e2e";
export const SEGREDO_DA_SESSAO_DO_E2E = "segredo-ficticio-do-e2e";
// Onde o projeto de entrada guarda a sessão que os outros projetos usam.
export const SESSAO_GRAVADA = "e2e/.estado/sessao.json";

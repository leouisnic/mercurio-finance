# Números confiáveis, leva 2

Estado: em andamento
Data: 2026-11-10. Arquivo: `docs/specs/2026-11-10-numeros-leva-2.md`.

Segunda leva dos achados da revisão independente registrada no `AGENTS.md`. A leva 1
(`2026-10-21-numeros-leva-1.md`) corrigiu R2, R5, R6, R8 e R9. Esta trata R1 (moeda) e
R4 (duplicidade entre sincronizações), mais a causa que a medição achou: a Pluggy altera
e recria transações, e o Mercúrio grava uma linha nova em vez de atualizar a antiga. R3
fica de fora, ver Escopo.

## Problema medido

Medido em 10/11 no banco local e na Pluggy, só com contagens, sem copiar dado real para
este arquivo.

- R1: compras em dólar no cartão gravadas com o valor em dólar como se fosse real. A
  Pluggy manda `currencyCode` e, em todas elas, `amountInAccountCurrency` com o valor em
  reais; `mapear_para_movimento` usa só `amount`. O gasto em reais fica menor que o real.
- Mesmo ID da Pluggy em duas linhas: compras do cartão que mudaram de data (de pendente
  para lançada) e uma que mudou de valor foram gravadas de novo, porque a chave única é
  `(fingerprint, identificador_externo)` e o fingerprint inclui data e valor. O gasto do
  ciclo conta as duas cópias.
- Uma aplicação com o tipo trocado depois pela Pluggy (de saída para entrada) ficou nas
  duas versões.
- Transação apagada pela Pluggy: a documentação avisa que, quando data, descrição ou
  valor mudam demais, ela apaga a transação e cria outra com outro ID. Há linhas no banco
  cujo ID a Pluggy não devolve mais, com uma sucessora de mesmo valor perto da data.
- R4 por reprodução fictícia da revisão: duas despesas iguais com IDs diferentes, em
  sincronizações separadas, somam as duas sem sinal de possível duplicidade, porque
  `processar_movimentos` só compara dentro do lote.
- R3: nenhum movimento sem identificador externo no banco; toda origem hoje é a Pluggy.

## Resultado esperado

- Compra em moeda estrangeira entra com o valor em reais que a instituição informou, e o
  valor e a moeda originais ficam guardados. Sem o valor em reais, a transação espera a
  próxima sincronização em vez de entrar com câmbio inventado.
- Transação que a Pluggy altera atualiza a mesma linha: uma transação da Pluggy é uma
  linha só. Categoria escolhida pelo dono, tags e decisão de fatura continuam.
- Transação que a Pluggy apaga sai das somas e fica guardada à parte, e volta se
  reaparecer com o mesmo ID.
- Despesa com o mesmo fingerprint de uma já gravada, com outro ID, fica sinalizada como
  possível duplicidade, as duas, também entre sincronizações. Continua no total, com o
  valor em revisão separado, como hoje.

## Decisões

- Pelo dono, em 10/11: linha apagada pela Pluggy é marcada e tirada das somas, nunca
  apagada de vez; mostrar "US$" na tela fica para a Movimentos redesenhada; a migração
  pode ser aplicada no banco local, com backup antes.
- Identidade da linha da Pluggy é o ID da Pluggy, com índice único parcial em
  `identificador_externo` para `proveniencia = 'pluggy'`. A nota de `extrato.py` sobre ID
  reaproveitado vale para extrato de banco; na Pluggy o ID é UUID, e a medição só achou
  repetição causada por alteração.
- "Tirar das somas" é mover a linha para `movimentos_removidos`, com as tags guardadas.
  Assim nenhuma consulta de soma precisa lembrar de um filtro novo.
- A remoção só olha o intervalo que a Pluggy devolveu para aquela conta (da data mais
  antiga devolvida em diante). Conta que veio sem transação nenhuma não remove nada:
  falha da Pluggy não pode esvaziar o histórico.
- Compra pendente no cartão continua contando como gasto desde a compra.

## Escopo

- Entra: conversão pelo valor informado (R1), atualização pela identidade da Pluggy,
  remoção marcada, sinal de possível duplicidade entre sincronizações (R4), migração que
  junta as cópias já gravadas.
- Fica de fora: R3 (reimportação de extrato sem ID) vai para a leva de importação
  compartilhada (`2026-11-06-acertos-e-importacao-compartilhada.md`), que é quando CSV e
  OFX voltam a entrar; hoje não afeta nenhum número. Mostrar a moeda original na tela vai
  para a Movimentos redesenhada. Webhooks da Pluggy ficam para quando houver servidor.
- R7 e R10 (validador e assinatura da revisão) seguem abertos, fora desta leva.

## Práticas consultadas

- banco-de-dados-e-modelagem: regra de integridade no banco (índice único parcial);
  mudança de esquema provada em transação no banco de teste antes do local.
- postgres-e-docker: migração do Alembic revisada à mão; backup antes do banco local.
- python-ruff-e-pytest: valores esperados à mão e regressão provada com o código anterior.
- seguranca-de-dados-e-agentes: medição só por contagem; nenhum dado real neste arquivo,
  nos testes ou no commit; backup em `local/`, fora do Git.
- nextjs-e-react, playwright, acessibilidade-e-contraste, identidade-visual,
  navegador-e-formularios: não se aplicam, a leva não muda tela.
- infraestrutura-e-nuvem, windows-e-powershell: não se aplicam, sem nuvem nem script novo.

## Fontes consultadas

- [Pluggy, Transaction](https://docs.pluggy.ai/docs/transactions): `currencyCode`
  obrigatório, `amountInAccountCurrency` em transação internacional, `status` PENDING ou
  POSTED, e o aviso de que o ID pode mudar com a transação apagada e recriada.
- [Pluggy, List transactions](https://docs.pluggy.ai/reference/transactions-list): exemplo
  em USD com `amountInAccountCurrency`.

## Detalhamento

1. `ingestion_worker.pluggy.mapear_para_movimento`: moeda diferente de BRL usa o módulo
   de `amountInAccountCurrency` como valor e guarda `moeda_original` e `valor_original`;
   sem esse campo, devolve nulo e a sincronização conta como "aguardando conversão".
2. Modelo: `movimentos` ganha `moeda_original` e `valor_original`, nulos para BRL; tabela
   `movimentos_removidos` com as colunas do movimento, as tags e quando saiu.
3. `inserir_movimentos` da Pluggy: inserção com conflito no índice parcial atualiza data,
   valor, descrição, tipo, fingerprint, categoria da Pluggy e moeda. Não toca categoria
   própria, origem da categoria, tags nem pagamento de fatura.
4. Depois de gravar, cada conta compara os IDs devolvidos com os do banco no intervalo
   devolvido; o que sumiu vai para `movimentos_removidos`. ID que volta é restaurado com
   categoria própria e tags.
5. Possível duplicidade entre sincronizações: fingerprint já gravado com outro ID marca
   as duas linhas.
6. Migração: cria colunas, tabela e índice; junta as linhas de mesmo ID da Pluggy na mais
   antiga (que guarda as decisões do dono), com os dados da mais nova, e leva as tags.

## Como provar

- Worker, à mão e fictício: USD 12,00 com `amountInAccountCurrency` 60,00 vira 60,00 em
  reais com original 12,00 USD; USD sem conversão não entra; BRL fica igual.
- Atualização: mesma transação em duas sincronizações com data e valor diferentes resulta
  em uma linha, com a categoria própria e as tags preservadas.
- Remoção: ID que some some das somas e aparece em `movimentos_removidos`; ID que volta é
  restaurado com categoria e tags; conta sem transação devolvida não remove nada; linha
  mais antiga que o intervalo devolvido fica.
- R4: despesa igual com outro ID em sincronização posterior marca as duas como possível
  duplicidade, e o total continua somando as duas.
- Migração no banco de teste com cópias semeadas: uma linha por ID, tags preservadas,
  índice criado; `alembic downgrade` volta.
- Banco local: backup, migração, sincronização; gasto do ciclo antes e depois explicado
  pelas cópias juntadas e pela conversão, conferido por contagem.

## Validações obrigatórias

Contrato preliminar, completado na entrega.

```json
{
  "versao": 2,
  "natureza": "produto",
  "mudanca": ["logica", "dado"],
  "aprovacoes": [],
  "locais": [
    {"id": "suite", "prova": "suite", "comando": [".venv/Scripts/python.exe", "scripts/validar.py", "--e2e"], "limite_s": 1800}
  ],
  "declaradas": {},
  "aceitacoes": [
    {"id": "numeros", "criterio": "Gasto do ciclo no banco local sem cópias e com as compras em dólar em reais"}
  ]
}
```

## Riscos

- Remoção errada apagaria histórico: por isso só no intervalo devolvido, nunca em conta
  sem retorno, e sempre reversível por `movimentos_removidos`.
- Índice único parcial falha na criação se sobrar cópia: a migração junta antes de criar.
- Tipo trocado pela Pluggy muda o sentido de uma linha já categorizada; a categoria
  própria fica e o dono revê na fila, se for o caso.

## Autorizações necessárias

Migração no banco local autorizada pelo dono em 10/11, com backup antes. Commit e push
continuam pedindo autorização.

## Ponto de retomada

- Implementado, migrado no banco local e validado. Falta a revisão do dono e o commit.

## Registro da execução

- 10/11. Medição no dado real por contagens, leitura da documentação da Pluggy, decisões
  do dono sobre remoção, moeda na tela e migração.
- 10/11. Implementado o Detalhamento. Testes novos no worker (moeda) e na sincronização
  (alteração, remoção e restauração, conta vazia, linha antes do intervalo, moeda,
  duplicidade entre origens). Mutação: desligar o upsert, a remoção, a marcação entre
  lotes e a conversão faz falhar o teste de cada um. O primeiro teste de duplicidade
  passava sem a correção, porque a Pluggy devolve o histórico inteiro e o lote já
  cruza Pluggy com Pluggy; foi trocado por outra origem cruzando com a Pluggy.
- 10/11. Migração provada no banco de teste com cópias fictícias: cinco linhas viram
  três, a mantida é a mais antiga com os dados da mais nova, tag e categoria do dono
  passam para ela, o índice é criado; `downgrade` e `upgrade` de novo funcionam e
  `alembic check` não acha diferença entre modelo e banco.
- 10/11. Banco local: backup em `local/backups/`, migração, sincronização. As linhas
  ficaram iguais ao número de transações que a Pluggy devolve, nenhum ID repetido, as
  compras em dólar com valor em reais e moeda original, duas linhas antigas em
  `movimentos_removidos`. A diferença do gasto de setembro a novembro fecha
  exatamente com a conversão somada menos as cópias juntadas.
- 10/11. `scripts/validar.py --e2e` aprovado: Ruff e ESLint limpos, build, 237 Pytest,
  100 Vitest e 35 Playwright.

## Lições

- Teste de duplicidade entre sincronizações precisa de outra origem: a Pluggy devolve o
  histórico inteiro, então duas linhas dela sempre chegam no mesmo lote.
- Exemplo de spec sai de dado fictício desde o rascunho: valor copiado do banco real
  para um exemplo escapa fácil.

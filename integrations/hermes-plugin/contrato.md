# Contrato de ferramentas MCP do Mercúrio

Este documento descreve a interface planejada, não implementada. Cada
ferramenta futura deve seguir o formato abaixo antes de ganhar código.

## Convenções

- Toda ferramenta que só lê dados pode ser chamada livremente pelo agente.
- Toda ferramenta que muda estado (pagar, transferir, emitir ou cancelar
  nota) devolve uma proposta de ação, não executa direto. A execução exige
  confirmação humana explícita em um passo separado.
- Nenhuma ferramenta devolve extrato bruto completo. O agente recebe
  agregados ou os itens que o Leonardo apontou.

## Ferramentas de leitura (planejadas)

| Ferramenta | Entrada | Saída |
|---|---|---|
| `resumo_financeiro` | período, titularidade opcional | saldo por titularidade, reserva do DAS |
| `buscar_movimentos` | filtros (período, titularidade, categoria) | lista de movimentos já classificados, com fingerprint |
| `duplicidades_pendentes` | nenhuma | grupos de movimentos com o mesmo fingerprint, para revisão humana |

## Ferramentas de ação (planejadas, exigem confirmação humana)

| Ferramenta | Entrada | Saída |
|---|---|---|
| `propor_pagamento` | destino, valor, referência | proposta de pagamento aguardando confirmação |
| `propor_transferencia_entre_titularidades` | origem, destino, valor | proposta marcada como retirada do titular, não despesa nem receita |
| `propor_emissao_nfse` | dados da nota | proposta de nota aguardando confirmação e emissão manual |
| `propor_cancelamento_nfse` | identificador da nota | proposta de cancelamento aguardando confirmação |

## Fora de escopo por enquanto

- Qualquer chamada direta ao Pluggy, Open Finance ou emissão oficial de
  NFS-e com certificado A1.
- Qualquer ferramenta que execute ação sem confirmação humana.

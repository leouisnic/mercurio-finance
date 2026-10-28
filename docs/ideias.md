# Ideias aprovadas e adiadas

Fila do que **foi aprovado e decidido não fazer agora**, neste projeto. Cada projeto administra
a sua: ideia de um projeto não é ideia do outro.

Não é memória e não descreve como as coisas funcionam. Isto aqui é fila de trabalho que ainda
não foi feito, e é diferente dos outros dois lugares onde algo pode ficar para depois:

| Lugar | O que guarda | Horizonte |
|---|---|---|
| `## Próximos passos` no `AGENTS.md` | o que vem agora, uma ou duas coisas | a próxima leva |
| `Ficou de fora` na spec de leva | registro do que **aquela** leva excluiu, e por quê | histórico, não muda |
| **este arquivo** | ideia aprovada que espera condição para voltar | médio e longo prazo |

Se `## Próximos passos` começar a crescer, ele virou fila disfarçada, e o que não é a próxima
coisa pertence aqui.

Ideia recusada não entra. Opção descartada numa pergunta não entra sozinha: ela vira candidata,
e só entra depois de aprovada.

**Cada ideia tem um gatilho, e é ele que impede a fila de virar cemitério.** O `doctor` acusa
gatilho de data vencido e fila parada além do limite de revisão, para decidir se ela vive ou
morre. Ideia sai desta fila por virar leva ou por morrer com motivo escrito, nunca por acumular
em silêncio.

Formato: `Estado:` aceita `adiada` ou `virou leva`. `Gatilho:` é data, evento ou número.

---

## Categorias próprias

Estado: virou leva (`docs/specs/2026-10-28-categorias-proprias.md`)

Adiada em: 2026-10-27

Gatilho: a identidade visual publicada.

Por quê: A Pluggy classifica com modelo próprio, não com a categoria do app do banco, e marca como transferência quase tudo que foi pago por Pix, inclusive alimentação, viagem e saúde. Medido no banco local, só leitura: a maior parte das linhas classificadas pelo dono no Mobills casa com movimentos já trazidos pela Pluggy, e os extratos do Nubank de janeiro a agosto já estão inteiros nela, então não há histórico a importar. A leva cria a categoria do Mercúrio (lista do dono, a partir das categorias que ele usa no Mobills), copia a categoria do Mobills para os movimentos casados no Postgres local, aprende regras por descrição e destinatário do Pix, usa a categoria da Pluggy só como reserva e transforma cada correção na lista em regra. Riscos: a categorização da Pluggy é recurso pago depois do teste; dado do Mobills nunca entra no repositório. Origem: rodada de opções de 2026-10-27.

## Tags e gráficos

Estado: adiada

Adiada em: 2026-10-28

Gatilho: a leva de categorias próprias publicada.

Por quê: A tela de Tags ficou só com a lista e o total. O dono quer: orçamento por tag (criar a tag antes, com teto, e acompanhar gasto contra o teto e o ritmo); evolução do gasto da tag no tempo; criar, renomear, apagar (os movimentos ficam, só perdem a tag) e arquivar tag; maiores gastos e divisão por categoria num card de análise; e o impacto da tag no orçamento, calculado sem IA: quanto ela tirou de cada ciclo em que caiu, quanto esses ciclos passaram do gasto típico e em quantos ciclos o rombo se recupera no ritmo de sobra. Junto, o padrão de detalhe dos gráficos na identidade do Mercúrio (no lugar da dica do navegador), valor curto com R$ em cima de cada barra com gasto, e as cores do gasto por dia: dia sem gasto em dourado, dentro da cota em índigo, acima da cota em vermelho. Tudo por mockup antes do código.

## Modo viagem

Estado: adiada

Adiada em: 2026-10-28

Gatilho: a leva Tags e gráficos publicada, porque o modo viagem é uma tag com período. A ativação pela localização espera também o bot do Telegram ou o painel publicado com autenticação.

Por quê: Ligar o modo viagem com uma tag faz todo movimento que chegar no período ganhar essa tag sozinho, e o Início mostra quanto a viagem já custou contra o teto. Para lembrar de ligar: a tag de viagem criada antes, com data de ida, faz o Início perguntar no dia "começou a viagem?". No Mobills existia e o dono não usava, por isso o lembrete importa mais que o botão. A localização tem que vir do celular do dono: a Pluggy não informa local da compra (conferido na documentação de transações: o `merchant` traz nome, razão social, CNPJ, CNAE e categoria, e exige plano Pro; não há cidade nem coordenada). Página web não lê localização em segundo plano. Caminhos que funcionam pelo celular: compartilhar a localização em tempo real com o bot do Telegram, que recebe as atualizações enquanto ela está ligada e pergunta se é viagem ao sair da cidade de sempre; ou uma automação do próprio celular (Atalhos no iPhone, ou equivalente no Android) que, ao sair de um lugar, chama o Mercúrio. Os dois exigem o Mercúrio alcançável do celular, com a autenticação do painel e o token da API (B03) prontos antes.

## Análise dos gastos

Estado: adiada

Adiada em: 2026-10-28

Gatilho: a leva Tags e gráficos publicada; decidir antes se fica dentro da Movimentos redesenhada ou vira página própria.

Por quê: O dono gostava da análise do Mobills: onde gasta mais, percentuais por categoria e uma leitura escrita do período. Com as categorias próprias publicadas, dá para calcular sem IA: participação de cada categoria no ciclo e no mês, variação contra a média dos últimos ciclos, maiores aumentos e quedas, estabelecimentos e pessoas que mais receberam, fixo contra variável, quanto sobrou da renda, e frases montadas a partir desses números ("Alimentação foi 31% do gasto, 18% acima da sua média"). Texto escrito por IA seria um passo depois, e mandaria dado financeiro para um serviço externo: decisão de privacidade do dono antes. Sobrepõe a Movimentos redesenhada (para onde foi por categoria, entrou, gastou, guardou e sobrou).

## Movimentos redesenhada

Estado: adiada

Adiada em: 2026-10-27

Gatilho: a leva Tags e gráficos publicada.

Por quê: Escolhido na rodada de opções: para onde foi por categoria, com a média dos últimos ciclos e uma meta sugerida pela média e editável (absorve a ideia de limite por categoria); ritmo do ciclo contra o anterior num cartão compacto; entradas e saídas por ciclo refeitas como entrou, gastou, guardou e sobrou, com o investido fora do gasto (absorve o resumo do ciclo fechado); e o fluxo do que entrou até cada destino, com o guardado à vista. Recusado: maiores destinos. Depois das categorias, o dono pediu também: filtros de ciclo e conta e os cards mais bem organizados. O padrão de detalhe dos gráficos foi para a leva Tags e gráficos. Referências: Monarch (fluxo de caixa e categorias) e caderno de educação financeira do Banco Central.

## Planejamento

Estado: adiada

Adiada em: 2026-10-27

Gatilho: a Movimentos redesenhada publicada.

Por quê: Escolhido na rodada de opções: matriz do ano no formato da planilha do dono (linha por conta, agrupada pelo ciclo de quem paga, mês a mês com pago, pendente, atrasado e previsto); comprometido nos próximos meses contra o que costuma entrar, mais direto; despesa que não é todo mês detectada no histórico e editável, que vira linha da matriz, entra no comprometido e reserva por ciclo no dinheiro livre; e cadastro fácil em todas as telas (botão Adicionar, edição na célula da matriz, Repetir na lista de movimentos: num Pix que vai se repetir, como a parcela de uma hospedagem, "Repetir todo mês" cria um compromisso com o número de parcelas, e a API de compromissos já existe). Absorve a caixinha com meta, as contas fixas do mês e as parcelas do cartão (`creditCardMetadata.installmentNumber` e `totalInstallments`, hoje ignorados pelo worker). Recusado: calendário do mês, porque o dono paga quase tudo nos dias 5 e 15. Leva também o reconhecimento de recorrência por valor e destinatário quando a descrição muda, o histórico de pagamento mês a mês e a conciliação de compromisso com o extrato. Referências: YNAB (despesa futura guardada por mês) e CFPB (conta ligada ao pagamento que a cobre).

## Investimentos

Estado: adiada

Adiada em: 2026-10-27

Gatilho: o Planejamento publicado.

Por quê: Página própria: aplicado e rendido, percentual do CDI, rendimento ao ano, comparação com a Selic (séries do SGS do Banco Central, a confirmar na documentação), calculadora "se eu deixar X por N meses" com IR regressivo e IOF (a confirmar na Receita) e comparador de ofertas com teto, como um CDB que paga um percentual do CDI até um valor máximo. Depois: carteira por produto pela API de investimentos da Pluggy, evolução do patrimônio separando aporte de rendimento, reserva de emergência em meses de custo, meta de aporte por ciclo, projeção do patrimônio, vencimentos de títulos e informe para o imposto de renda. Movimentos mostra só o guardado no fluxo, com link para cá.

## Projeção do ciclo e simulador "posso comprar?"

Estado: adiada

Adiada em: 2026-10-27

Gatilho: o Planejamento publicado.

Por quê: Quanto sobra no fim do ciclo no ritmo atual, e o simulador que recebe valor e parcelas e mostra o livre deste ciclo e dos próximos. Usa o comprometido dos próximos meses do Planejamento.

## Alertas no Início

Estado: adiada

Adiada em: 2026-10-27

Gatilho: a projeção do ciclo publicada.

Por quê: Tela Início: uma faixa curta com o que pede ação agora, como hoje negativo, conta fixa atrasada e fatura acima de 80% do limite. Os mesmos alertas alimentam o aviso no Telegram.

## Dinheiro livre quando estoura

Estado: adiada

Adiada em: 2026-10-28

Gatilho: a leva de categorias próprias publicada.

Por quê: A cota do dia é o livre do começo do ciclo dividido pelos dias dele, fixa no ciclo. Quando o livre fica negativo, o Início continua mostrando a cota, o que engana. Decidido: com o livre negativo, "Hoje dá para gastar" mostra R$ 0 e quanto falta para fechar o ciclo; cota e cofrinho somem até o livre voltar a positivo. Muda número na tela, então tem spec própria.

## Página Ajustes

Estado: adiada

Adiada em: 2026-10-27

Gatilho: as metas por categoria da Movimentos em construção, que precisam de um lugar para configurar.

Por quê: Reúne o que é cadastro: recorrências (saem do menu principal), compromissos, nomes das contas e dos pagadores, limites por categoria e notificações. Depois das categorias próprias, também editar e apagar categoria (apagar pergunta para onde vão os movimentos) e ver e desfazer as regras por destinatário. Fecha a navegação de quatro páginas (Início, Movimentos, Planejamento, Ajustes) decidida na spec do Início.

## Aviso no Telegram

Estado: adiada

Adiada em: 2026-10-27

Gatilho: token na API (B03) e autenticação do painel publicados.

Por quê: Os alertas do Início chegam no celular. Precisa da API protegida antes, porque o bot fala com ela de fora da máquina.

## Assinatura esquecida

Estado: adiada

Adiada em: 2026-10-27

Gatilho: 2027-01-27, três meses depois das primeiras contas fixas aprovadas.

Por quê: Tela Recorrências e alerta no Início: conta fixa pequena aprovada há meses, para o dono confirmar se ainda usa.

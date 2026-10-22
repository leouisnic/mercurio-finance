# Spec de mercurio-finance

Os parâmetros que não mudam a cada leva. Preenchido na abertura e revisado quando o projeto
muda de estágio, não a cada entrega.

"Não sei" é resposta válida em qualquer campo. Escreva "não sei" e leve o item para
**Riscos**. Campo em branco parece decidido e não é; "não sei" registrado vira pergunta que
alguém ainda vai responder.

## Identidade

O que o sistema faz, em duas ou três frases, para quem usa.

**Não objetivos.** O que ele explicitamente não faz. Vale mais que a lista de cima: é o que
impede o escopo de crescer sozinho a cada conversa.

## Estágio e destino

Protótipo, uso interno, à venda, produção. É isso que decide o que vale validar: projeto sem
deploy previsto não precisa de infraestrutura de produção, e projeto que vai ser vendido
precisa que o número esteja certo antes de ganhar tela nova.

Quem depende dele hoje, e o que acontece com essa pessoa se ele parar.

## Stack e ambientes

Linguagem, frameworks, banco, serviços externos. Como rodar em desenvolvimento. Onde roda em
produção, se já roda.

## Dados

- De onde vêm.
- Quem é o dono (você, um cliente, um terceiro).
- O que **nunca** entra no Git.
- O que **nunca** sai desta máquina.
- O que pode aparecer em captura, exemplo ou documentação pública, e o que precisa ser
  fictício.

## Limites de autorização

O que o agente faz sozinho, e o que exige um "sim" explícito antes.

O padrão do `AGENTS.md` global já cobre commit, push, deploy, instalação e exclusão. Aqui
entra só o que é específico deste projeto: acesso a banco real, escrita em sistema de
terceiro, migração, envio de mensagem, qualquer ação que alguém de fora perceba.

## Riscos do domínio

O que acontece se o número sair errado, se um dado vazar, se o sistema cair. Um por linha,
com a consequência concreta, não "risco de erro".

Inclui aqui o que ficou como "não sei" nos campos acima.

## Definição de pronto

O que precisa estar verde antes do commit, proporcional ao risco. Comando por comando, do
jeito que se digita.

Separar o que é obrigatório do que depende da leva (prova visual só quando a leva mexe em
tela, por exemplo).

## Revisão

Quem aprova. Implementador e aprovador precisam ser diferentes, ou a aprovação não mede
nada.

Como a aprovação se invalida: ela fica vinculada a hash, diff ou commit revisado. Registro
estático de "revisado: sim" não cumpre a função, só simula segurança.

## Onde mora o quê

| Arquivo | O que vive ali |
|---|---|
| `AGENTS.md` | regras de trabalho, estado atual, próximos passos. Teto de 200 linhas e 32 KiB |
| `CLAUDE.md` | só `@AGENTS.md` |
| `docs/spec.md` | este arquivo |
| `docs/specs/` | uma spec por leva, com o parecer e a medição daquela leva |
| `docs/` | documentação curada do produto |

Se este projeto tiver outro lugar (uma pasta de decisões, um documento de arquitetura),
acrescente a linha aqui. O que não estiver nesta tabela não deveria existir.

## Registro da concepção

As 58 dimensões gerais ficam para a spec `docs/specs/2026-09-28-concepcao-e-pastas.md`.
Esta rodada faz só a triagem dos módulos e as perguntas dos módulos selecionados.

### Triagem dos módulos

- [x] M01: aplica: painel Next.js em `apps/web` com três telas e server actions; abrir no celular está no roteiro.
- [x] M02: aplica: `finance-api` em FastAPI com 19 rotas consumidas pelo painel, e o worker da fila de sincronização.
- [x] M03: aplica: ingestão da Pluggy e de CSV, fingerprint de conciliação, ciclos, agregados, recorrência e casamento de pagamento de fatura; é o centro do produto.
- [x] M04: não se aplica: nenhum PDF, DOCX ou arquivo distribuído é gerado, conferido no código; a exportação em PDF do roteiro reabre esta triagem quando virar leva.
- [x] M05: aplica: não há login, mas há extrato real do dono e nomes de terceiros nas transações; a senha do painel é pré-requisito para ele sair desta máquina.
- [x] M06: aplica: a Pluggy é a fonte de todo o dado, com credencial própria; Telegram e o contrato MCP do Hermes estão planejados.
- [x] M07: não se aplica: o sistema roda só quando o dono abre e a sincronização é pelo botão; o bot do Telegram ou a publicação reabrem esta triagem.
- [x] M08: não se aplica: existe só o manifesto de PWA, que é web no navegador, sem app instalado nem loja.
- [x] M09: não se aplica: recorrência e pagamento de fatura são regras determinísticas, sem modelo no produto; o dono prevê IA no futuro, e a implementação do MCP do Hermes ou de qualquer modelo reabre esta triagem e exige nova aprovação dos módulos.
- [x] M10: não se aplica: `scripts/validar.py` e o seed são ferramenta interna de desenvolvimento e CI, não comando entregue a alguém.
- [x] M11: aplica: Docker Compose com Postgres e Redis publicados só em 127.0.0.1, e o pipeline de CI no GitHub Actions.
- [x] M12: aplica: o afetado é o próprio dono, mas com dinheiro real; número errado (moeda, falha mostrada como zero, gasto escondido) leva a decisão financeira errada, e a Open Finance tem regra de consentimento.
- [x] M13: aplica: Vértice e Mercúrio aparecem na tela e no README público; o logo existe em duas cópias que divergem e o favicon ainda é o padrão do Next.js.
- [x] M99: não se aplica: ciclo, recorrência, compromisso e a futura análise de dinheiro disponível são cálculo, cobertos por dados, com as regras em `docs/domain-rules.md`.

Módulos da concepção: web, backend, dados, identidade, integrações, infraestrutura, regulação, marca

Aprovação dos módulos: sha256:01e9663310bb8a2cb9e016135cb9a944629b63f3b3b90ca0376afaa1fbec7388

### Respostas dos módulos

- [x] W01: desktop e celular desde já: e2e também numa viewport de celular, e layout conferido em largura estreita em toda leva que tocar tela, decisão do dono contra esperar a publicação.
- [x] W02: básico verificável nas telas tocadas: contraste medido nos pares de cor usados e operação por teclado com foco visível, conferidos por checagem automática no e2e na leva que mexer na tela.
- [x] W03: não se aplica: hoje o painel é privado, sem página pública e com tela só em português; ao publicar, a regra passa a ser impedir indexação, porque é dado financeiro.
- [x] W04: sem orçamento até publicar: roda local para um usuário, com lista paginada; a publicação define a meta de carregamento e passa a medir.
- [x] W05: prova no fictício, uso no real: o e2e roda build de produção contra o banco fictício (portas 8100 e 3100) e o uso é o painel contra o banco real (8000 e 3000); nenhum teste muda dado no banco real.
- [x] B01: consumidor único, pego pelo e2e: o painel é o único consumidor, o contrato são os esquemas Pydantic, e rota ou campo muda junto com o painel na mesma leva, com o e2e contra a API real pegando a quebra.
- [x] B02: Pydantic na borda, limite ao publicar: toda entrada passa pelos esquemas, erro sai sem ecoar a entrada, e limite de taxa entra quando a API sair de 127.0.0.1.
- [x] B03: token na API já: a API passa a exigir token mesmo escutando só em 127.0.0.1, antes da senha do painel, com teste de acesso sem token em cada rota; decisão do dono contra esperar a autenticação do painel.
- [x] B04: idempotente e falha visível: sincronização e decisões continuam idempotentes, a falha chega a quem clicou, as chamadas à Pluggy têm timeout explícito, e quem repete é a pessoa, sem retry automático.
- [x] B05: log estruturado em arquivo: logs em JSON gravados em `local/logs/`, fora do Git, com rotação; nunca gravam credencial, token nem conteúdo de extrato (descrição, valor, nome de terceiro); métrica só ao publicar. Decisão do dono contra ficar só no terminal.
- [x] D01: Pluggy para fato, Mercúrio para conclusão: saldo e lançamento valem como a Pluggy relata; pagamento de fatura, recorrência e apelido são conclusão do dono, guardados separados do fato e reversíveis; uso só pessoal, nunca no Git.
- [x] D02: moeda original guardada, data civil: moeda e valor original ficam junto do valor na moeda da conta, sem câmbio inventado (R1, leva 2); a data é tratada como data civil, a conferir contra a Pluggy; Decimal com duas casas; regra fixada por teste com exemplo fictício, e mudança que altera o fingerprint exige reimportação planejada.
- [x] D03: contagem por sync e amostra por mudança: em cada sincronização, por conta, encontradas bate com inseridas mais já existentes; a cada mudança de regra de importação, uma amostra de período comparada com o app do banco.
- [x] D04: selo de idade honesto, sync manual: verde até 15 min, laranja até 4 h, vermelho acima, medindo só sincronização (corrigir o R8); o dono sincroniza quando quer.
- [x] D05: exportação em CSV: só o dono vê o dado real; a exportação em CSV é feita sob pedido, grava em `local/output/`, fora do Git, e nunca dentro do repositório; captura pública só fictícia; agente futuro recebe agregado, nunca extrato bruto. Decisão do dono contra não exportar; ainda não implementada.
- [x] I01: atores são o dono, a API, o worker e a Pluggy; o bot e o Hermes, futuros, terão credencial própria e o menor recorte de dado; a fronteira de confiança é esta máquina e passa a ser o token da API (B03).
- [x] I02: token no servidor, troca pelo .env: o token da API fica no `.env`, lido só pelo servidor do painel e nunca enviado ao navegador; trocar é mudar o `.env` e reiniciar, com o passo escrito; a sessão do painel, quando a senha chegar, usa cookie httpOnly com expiração e sem segundo fator enquanto o painel não sair desta máquina.
- [x] I03: não se aplica: dono único, todo recurso é dele; reabre se outra pessoa entrar no painel (I01).
- [x] I04: não se aplica: tratamento por pessoa natural para fins exclusivamente particulares e não econômicos, fora da LGPD pelo art. 4º, I (planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm, conferido em 2026-10-21); excluir é apagar o banco local; reabre se o produto for oferecido a outras pessoas ou gerar renda.
- [x] I05: cada controle vira teste na suíte: rota sem token devolve 401 com teste por rota, a suíte recusa banco de teste errado (já existe), e a checagem de conteúdo passa a ler o que vai de fato para o commit e a cobrir CSV (R7); roda em toda validação e no CI.
- [x] G01: validar campos na leitura, falhar alto: os campos da Pluggy que o Mercúrio usa são validados na chegada, e campo obrigatório ausente ou de tipo inesperado faz o sync falhar com erro visível, em vez de gravar número quieto; mapeamento coberto por resposta gravada fictícia.
- [x] G02: não sei: os limites do plano gratuito da Pluggy (cota, custo por chamada, manutenção) não foram medidos; descobrir na página de preços e no painel da Pluggy antes de qualquer sync automático; hoje são poucas chamadas manuais.
- [x] G03: timeout explícito, sem retry automático, e duplicidade evitada pela chave única com id externo e pelo casamento único de fatura persistido entre sincronizações (R2).
- [x] G04: a integração é só leitura; a prova é a contagem por sincronização (D03) e o saldo mostrado exatamente como a Pluggy relata; divergência com o app do banco é corrigida reimportando, por decisão do dono.
- [x] G05: não se aplica: hoje nada do produto roda sem um clique do dono, e o worker só processa o que ele enfileira; sync automático ou o bot reabrem esta resposta.
- [x] P01: dono único, tudo versionado: o dono é responsável por todo recurso; Compose e CI ficam versionados e revisados como código, e nada é criado à mão fora deles.
- [x] P02: separação atual, senha previsível só local: banco real e de teste separados com a trava do sufixo `_test`; a senha previsível do Postgres é aceita só porque a porta escuta em 127.0.0.1; credencial da Pluggy no `.env`, girada pelo painel da Pluggy com passo escrito.
- [x] P03: lockfiles e actions por hash: dependências travadas por `uv.lock` e `package-lock.json`; todas as actions do CI fixadas por hash, como o `setup-uv` (o `checkout` ainda está só por tag); imagens Docker por tag de versão enquanto forem só locais; só o dono publica.
- [x] P04: tudo em 127.0.0.1 até a senha: medido que `next dev` escuta em 0.0.0.0 por padrão, o que expõe o extrato real a qualquer aparelho da rede local sem senha; o painel passa a escutar só nesta máquina, como a API (127.0.0.1 é o padrão do uvicorn), o Postgres e o Redis; entra na leva 1; a rede local só abre quando a senha do painel existir.
- [x] P05: não se aplica: hoje roda nesta máquina, sem custo de nuvem nem recurso pago ocioso; reabre ao publicar.
- [x] H01: decisão financeira errada e vazamento: o pior erro é saldo ou gasto mostrado errado (moeda, falha mostrada como zero, gasto escondido) levando o dono a gastar o que não tem ou atrasar conta; o segundo é vazar o extrato, com a privacidade do dono e dos terceiros nomeados nas transações.
- [x] H02: nenhuma obrigação técnica direta: a Pluggy é a regulada pela Open Finance e a LGPD não se aplica (I04); o que sobra é operacional: o consentimento do item da Pluggy expira (`consentExpiresAt`), e o painel deve mostrar a data e avisar antes de parar de trazer dado.
- [x] H03: nunca número falso como certo: é inaceitável mostrar número como certo quando não é (zero na falha, moeda trocada, dado velho como novo); o lado seguro é mostrar "indisponível" com o motivo, nunca zero; amarra R1, R5, R8 e G01.
- [x] H04: toda conclusão é do dono, com evidência: pagamento de fatura e recorrência continuam revisáveis, cada decisão chega com valor, datas e contraparte, e nenhuma ação move dinheiro; o bot e o Hermes herdam a confirmação humana.
- [x] H05: estado no registro mais o log: cada registro guarda o estado e a data da última mudança, e cada decisão também vai para o log estruturado (B05) com id e estado, sem valor nem descrição; sem revisão periódica, porque o único ator é o dono.
- [x] V01: unificar em Mercúrio: o nome Vértice se aposenta, e produto, repositório, tela, logo e README passam a usar só Mercúrio; decisão do dono contra manter dois nomes; executa na leva de identidade visual, que inclui corrigir o README publicado.
- [x] V02: calma e confiável, ferramenta pessoal: séria e serena, para quem quer entender o próprio dinheiro; não pode parecer banco, anúncio de fintech nem app de investimento chamativo.
- [x] V03: redesenhar o símbolo: o dono quer uma imagem, não um logo montado em código; a marca terá duas camadas, a ilustração para tamanho grande e um ícone simplificado conferido em 16 px e em uma cor só, escolhidos em mockup antes do código na leva de identidade visual.
- [x] V04: refazer a identidade visual inteira: paleta nova na leva de identidade, com contraste medido por comando nos pares de fato usados e decisão sobre tema escuro tomada no mockup; até lá vale a paleta atual, tema só claro.
- [x] V05: Sora local, reserva system-ui: a Sora continua servida do próprio projeto, com licença OFL e sem download no build, mesmo na identidade refeita.
- [x] V06: um mestre, variantes por script: a ilustração e o ícone mestres moram só em `assets/brand/`; favicon, tamanhos e a versão de uma cor saem de um script do projeto, e um teste reprova arquivo de marca que não veio dele; o app e o README leem dali; o dono aprova no mockup.

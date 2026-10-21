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

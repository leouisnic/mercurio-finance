# Versionar o contexto do projeto, classificando o que vai a publico

Estado: nao iniciada

Data: 2026-09-22. Proposta pela supervisao do agent-workflow, sem execucao.

## Problema medido

Este projeto nao tem historico de leva nenhum: `docs/specs/` esta vazio, com 12 commits
registrados. Ele e' o unico repositorio publico dos quatro, e o mais invisivel ao painel
que acompanha o que falta em cada projeto.

O contexto esta' fora do Git:

```
AGENTS.md   321 linhas, 20.474 bytes   ignorado pelo .gitignore
CLAUDE.md    11 bytes                  ignorado pelo .gitignore
```

A regra passou a ser versionar o `AGENTS.md` junto com o codigo, porque ele muda quando o
codigo muda e merece o mesmo historico, `blame` e revisao em diff. Fora do Git ele tinha uma
copia por manifesto, que foi aposentada. **Hoje esse arquivo existe so' no disco de origem.**

Ha uma copia antiga fora do repositorio, feita antes de o backup sair. Ela nao e' mais
atualizada.

Medido tambem: `apps/web/CLAUDE.md` esta' **versionado e publico**, com uma linha,
`@AGENTS.md`. Ele escapou porque o `.gitignore` usa padrao ancorado, `/CLAUDE.md`, que so'
casa na raiz. Pela regra nova, `CLAUDE.md` e' ponte local recriavel pelo instalador e nao
entra no Git em lugar nenhum.

## Resultado esperado

- `AGENTS.md` versionado, com o conteudo que pode ser publico, e o resto realocado.
- Nenhum `CLAUDE.md` rastreado, em nenhum nivel de pasta.
- Uma linha do `.gitignore` que nao dependa de ancoragem para funcionar.
- Clone limpo em outro caminho trazendo o contexto, provando que o Git substituiu a copia.

## Escopo

**Entra:** leitura das 321 linhas do `AGENTS.md` classificando o que e' publico, interno ou
pessoal; realocacao do que nao deve ficar publico; ajuste do `.gitignore`; retirada de
`apps/web/CLAUDE.md` do indice, preservando o arquivo local.

**Fica de fora, de proposito:** codigo da aplicacao, reescrita de historico, e apagar a copia
do Drive, que so' sai depois do clone limpo comprovado.

## Como provar

1. Ler as 321 linhas e listar, antes de qualquer commit, o que sai do arquivo e para onde
   vai. O repositorio e' publico: publicar e' irreversivel.
2. `git ls-files | grep -i claude` sem resultado.
3. `git check-ignore -v CLAUDE.md` e `apps/web/CLAUDE.md` apontando a mesma regra.
4. Clone em caminho novo, conferindo que `AGENTS.md` chega e que `CLAUDE.md` nao chega.
5. `install.ps1 -Projeto` nesse clone recriando a ponte local.

## Riscos

- **Publicar e' irreversivel.** O arquivo descreve arquitetura e diz que ha contas reais
  conectadas via Open Finance. Isso e' informacao sobre o Leonardo, nao credencial, e a
  decisao de publicar ou realocar e' dele, linha a linha.
- Retirar `apps/web/CLAUDE.md` do indice nao apaga o que ja' esta' no historico publico. O
  conteudo e' uma linha de referencia, sem dado, entao reescrever historico por isso nao se
  justifica; fica registrado que ele permanece no passado do repositorio.
- Remover a regra de ignore sem classificar antes publicaria o arquivo inteiro de uma vez.

## Autorizacoes necessarias

Commit e push, como sempre. A classificacao do conteudo publico precisa de decisao do
Leonardo antes do primeiro commit que exponha o arquivo.

## Registro da execucao

Por preencher quando a leva for executada.

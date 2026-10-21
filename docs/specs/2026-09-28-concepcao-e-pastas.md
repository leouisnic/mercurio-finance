# Concepção, verificadores e pastas do Mercúrio

Estado: não iniciada

## Problema e resultado

A spec de projeto ainda conserva texto do modelo e o AGENTS.md não está
versionado. `prints/` exige classificação pelo uso real. A próxima sessão deve
fechar a concepção e registrar módulos condicionais sem presumir que todo
componente do monorepo tem o mesmo risco.

## Passos na sessão deste projeto

1. Ler `AGENTS.md`, `docs/spec.md`, a spec de versionamento do contexto,
   dependências, Git e consumidores de `prints/`. Preservar dados privados.
2. Completar as 58 dimensões gerais ainda sem resposta, uma pergunta por vez,
   a partir do que o código já comprova. Perguntar M01 a M04 individualmente,
   inclusive sobre capacidades menos óbvias; registrar evidência ou motivo
   para cada inclusão e exclusão. Responder só os IDs dos módulos selecionados.
3. Registrar aprovações separadas por hash, primeiro módulos, depois concepção
   geral. Definir verificadores por risco da próxima leva, sem impor ferramenta
   ausente do stack.
4. Classificar cada arquivo de `prints/` como entrada, saída, mídia final ou
   conteúdo de documentação. Propor migração para `local/input/`, `local/output/`,
   `assets/` ou `docs/media/` conforme consumidores e Git. Atualizar mapa da spec
   e referências só depois do aceite desta leva.

## Fora do escopo e prova

Esta spec não move `prints/` nem publica contexto privado. A sessão do projeto
deve provar que arquivos sensíveis ficam fora do Git, que consumidores dos
caminhos migrados funcionam e que o doctor reconhece os hashes.

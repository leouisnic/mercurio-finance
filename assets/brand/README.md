# Marca do Mercúrio

Os dois mestres da marca. Tudo o que o app e o README exibem sai deles pelo
`npm run marca`, em `apps/web`, que também grava `gerados.json` com o hash de cada
arquivo. Um teste (`apps/web/src/app/marca.test.ts`) reprova arquivo de marca que não
veio do script.

| Arquivo | O que é | Onde aparece |
|---|---|---|
| `ilustracao.png` | Perfil de Mercúrio com o elmo alado | Tamanho grande: barra lateral, README |
| `icone.png` | A asa do elmo, simplificada | Tamanho pequeno: aba, favicon, ícone do app |

Origem: imagens geradas no Google Gemini em outubro de 2026 e escolhidas em mockup
(spec `docs/specs/2026-10-27-identidade-visual.md`). Do original, o script de recorte só
centralizou o desenho e levou o fundo quase branco a branco; nada foi redesenhado.

As cores das variantes não moram aqui: vêm dos tokens de `apps/web/src/app/globals.css`.
Para trocar a marca, substitua o mestre e rode `npm run marca`.

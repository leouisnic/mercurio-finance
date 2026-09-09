# Telas do Vértice

As capturas desta pasta são geradas pelo Playwright contra a base de teste
semeada com dados fictícios. Nenhuma captura usa o banco local de
desenvolvimento.

Para atualizar as imagens no PowerShell:

```powershell
$env:GERAR_CAPTURAS = "1"
npm.cmd run test:e2e -- capturar-telas.spec.ts
Remove-Item Env:GERAR_CAPTURAS
```

Confira visualmente as imagens antes de versioná-las.

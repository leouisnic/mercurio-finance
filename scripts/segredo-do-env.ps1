# Devolve um segredo do .env e, se faltar, cria um na primeira vez. O start.ps1
# usa para o token da API e o segredo da sessão do painel, e para só ler o hash
# da senha (com -SomenteLer, porque a senha quem define é o dono). Trocar é
# apagar o valor da linha e abrir o Mercúrio de novo: ver docs/security.md.

param(
    [Parameter(Mandatory)] [string] $ArquivoEnv,
    [string] $Nome = "FINANCE_API_TOKEN",
    [switch] $SomenteLer
)

$prefixo = "$Nome="
$linhas = @()
if (Test-Path $ArquivoEnv) { $linhas = @([IO.File]::ReadAllLines($ArquivoEnv)) }

$existente = $linhas | Where-Object { $_.StartsWith($prefixo) -and $_.Length -gt $prefixo.Length } | Select-Object -First 1
if ($existente) { return $existente.Substring($prefixo.Length).Trim() }
if ($SomenteLer) { return "" }

# 32 bytes do gerador criptográfico do sistema, em base64 que cabe em URL.
$bytes = New-Object byte[] 32
$gerador = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$gerador.GetBytes($bytes)
$gerador.Dispose()
$segredo = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")

# Linha vazia (como a do .env.example) é preenchida; sem linha, entra no fim.
$vazia = [array]::IndexOf($linhas, $prefixo)
if ($vazia -ge 0) { $linhas[$vazia] = "$prefixo$segredo" } else { $linhas += "$prefixo$segredo" }
[IO.File]::WriteAllLines($ArquivoEnv, [string[]]$linhas, (New-Object System.Text.UTF8Encoding $false))
return $segredo

# Devolve o FINANCE_API_TOKEN do .env e cria um na primeira vez. O start.ps1
# passa o valor ao painel; a API lê o mesmo .env. Trocar é apagar o valor da
# linha (ou a linha) e abrir o Mercúrio de novo: ver docs/security.md.

param([Parameter(Mandatory)] [string] $ArquivoEnv)

$prefixo = "FINANCE_API_TOKEN="
$linhas = @()
if (Test-Path $ArquivoEnv) { $linhas = @([IO.File]::ReadAllLines($ArquivoEnv)) }

$existente = $linhas | Where-Object { $_.StartsWith($prefixo) -and $_.Length -gt $prefixo.Length } | Select-Object -First 1
if ($existente) { return $existente.Substring($prefixo.Length).Trim() }

# 32 bytes do gerador criptográfico do sistema, em base64 que cabe em URL.
$bytes = New-Object byte[] 32
$gerador = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$gerador.GetBytes($bytes)
$gerador.Dispose()
$token = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")

# Linha vazia (como a do .env.example) é preenchida; sem linha, entra no fim.
$vazia = [array]::IndexOf($linhas, $prefixo)
if ($vazia -ge 0) { $linhas[$vazia] = "$prefixo$token" } else { $linhas += "$prefixo$token" }
[IO.File]::WriteAllLines($ArquivoEnv, [string[]]$linhas, (New-Object System.Text.UTF8Encoding $false))
return $token

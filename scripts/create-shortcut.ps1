# Cria o atalho "Mercúrio" na área de trabalho e no menu Iniciar, apontando
# para scripts\start.ps1, com o ícone do painel.

$raiz = Split-Path -Parent $PSScriptRoot
$shell = New-Object -ComObject WScript.Shell
foreach ($pasta in [Environment]::GetFolderPath("Desktop"), [Environment]::GetFolderPath("Programs")) {
    $atalho = $shell.CreateShortcut((Join-Path $pasta "Mercúrio.lnk"))
    $atalho.TargetPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    # Sem janela: o Mercúrio vive no ícone ao lado do relógio.
    $atalho.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $raiz 'scripts\start.ps1')`""
    $atalho.WindowStyle = 7
    $atalho.WorkingDirectory = $raiz
    $atalho.IconLocation = Join-Path $raiz "apps\web\src\app\favicon.ico"
    $atalho.Description = "Abre o Mercúrio com o dado real"
    $atalho.Save()
    Write-Host "Atalho criado em $pasta"
}

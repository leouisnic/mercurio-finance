# Abre o Mercúrio com o dado real: Docker, Postgres, Redis, migrações, API,
# worker da fila e painel, e então o navegador. Roda sem janela, com um ícone
# ao lado do relógio; "Desligar" no menu do ícone derruba API, worker e
# painel. O Docker continua ligado.
#
# O painel roda compilado em .next-painel, separado do .next-e2e: o build do
# e2e leva a data fixa e os pagadores fictícios.

$ErrorActionPreference = "Continue"
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot
$web = Join-Path $raiz "apps\web"
$api = Join-Path $raiz "services\finance-api"
$logs = Join-Path $raiz "local\logs"
$enderecoDoPainel = "http://127.0.0.1:3001"
$enderecoDaApi = "http://127.0.0.1:8000"
New-Item -ItemType Directory -Force $logs | Out-Null

# O navegador abre pelo explorer para não nascer dentro do grupo de processos
# que morre junto com este.
function AbrirNavegador { Start-Process explorer.exe -ArgumentList $enderecoDoPainel }

function Responde($url) {
    try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { $false }
}

# Um clique a mais no atalho enquanto o primeiro ainda sobe só abre o navegador.
$unico = New-Object System.Threading.Mutex($false, "Local\Mercurio.Painel")
if (-not $unico.WaitOne(0)) {
    if (Responde $enderecoDoPainel) { AbrirNavegador }
    exit 0
}
if (Responde $enderecoDoPainel) { AbrirNavegador; exit 0 }

$icone = New-Object System.Windows.Forms.NotifyIcon
$icone.Icon = New-Object System.Drawing.Icon (Join-Path $web "src\app\favicon.ico")
$icone.Text = "Mercúrio: abrindo"
$icone.Visible = $true

function Passo($texto) {
    # O texto do ícone aceita no máximo 63 caracteres.
    $icone.Text = ("Mercúrio: $texto").Substring(0, [Math]::Min(63, ("Mercúrio: $texto").Length))
    [System.Windows.Forms.Application]::DoEvents()
}

function Falha($texto) {
    [System.Windows.Forms.MessageBox]::Show("$texto`n`nRegistros em $logs.", "Mercúrio", "OK", "Error") | Out-Null
    $icone.Dispose()
    exit 1
}

function Esperar($descricao, $segundos, [scriptblock]$pronto) {
    $limite = (Get-Date).AddSeconds($segundos)
    while (-not (& $pronto)) {
        if ((Get-Date) -gt $limite) { Falha "$descricao não ficou pronto em $segundos s." }
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Seconds 1
    }
}

# cmd /c porque o PowerShell 5.1 transforma o stderr de programa externo em erro.
function Executar($comando, $registro) {
    cmd /c "$comando >> `"$logs\$registro`" 2>&1"
    return $LASTEXITCODE -eq 0
}

$icone.ShowBalloonTip(3000, "Mercúrio", "Abrindo. O painel aparece no navegador quando estiver pronto.", "Info")

# Logo depois de desligar, a porta leva alguns segundos para soltar.
foreach ($porta in 8000, 3001) {
    $limite = (Get-Date).AddSeconds(15)
    while (Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue) {
        if ((Get-Date) -gt $limite) { Falha "A porta $porta está ocupada por outro programa. Feche-o e abra de novo." }
        Start-Sleep -Seconds 1
    }
}

Passo "ligando o Docker"
if (-not (Executar "docker info" "docker.log")) {
    Start-Process (Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe")
    Esperar "O Docker" 180 { Executar "docker info" "docker.log" }
}
Push-Location $raiz
$subiu = Executar "docker compose -f infra\docker-compose.yml up -d" "docker.log"
Pop-Location
if (-not $subiu) { Falha "O docker compose falhou." }
foreach ($conteiner in "mercurio-postgres-1", "mercurio-redis-1") {
    Esperar $conteiner 90 { (docker inspect -f "{{.State.Health.Status}}" $conteiner 2>$null) -eq "healthy" }
}

# Daqui em diante, todo processo filho entra num job que o Windows encerra
# quando este processo termina, por "Desligar" ou à força. O Docker ficou de
# fora de propósito.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class GrupoDoMercurio {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateJobObject(IntPtr atributos, string nome);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr job, int classe, IntPtr info, uint tamanho);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr processo);
    [StructLayout(LayoutKind.Sequential)]
    struct Basica {
        public long TempoPorProcesso; public long TempoPorJob; public uint Limites;
        public UIntPtr MinimoDeMemoria; public UIntPtr MaximoDeMemoria; public uint MaximoDeProcessos;
        public UIntPtr Afinidade; public uint Prioridade; public uint Escalonamento;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct Contadores { public ulong A, B, C, D, E, F; }
    [StructLayout(LayoutKind.Sequential)]
    struct Estendida {
        public Basica Basica; public Contadores Io;
        public UIntPtr A, B, C, D;
    }
    static IntPtr job;
    public static void PrenderAoProcessoAtual() {
        job = CreateJobObject(IntPtr.Zero, null);
        var info = new Estendida();
        info.Basica.Limites = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        int tamanho = Marshal.SizeOf(typeof(Estendida));
        IntPtr ponteiro = Marshal.AllocHGlobal(tamanho);
        Marshal.StructureToPtr(info, ponteiro, false);
        if (!SetInformationJobObject(job, 9, ponteiro, (uint)tamanho))
            throw new Exception("SetInformationJobObject " + Marshal.GetLastWin32Error());
        if (!AssignProcessToJobObject(job, System.Diagnostics.Process.GetCurrentProcess().Handle))
            throw new Exception("AssignProcessToJobObject " + Marshal.GetLastWin32Error());
    }
}
"@
[GrupoDoMercurio]::PrenderAoProcessoAtual()

Passo "aplicando migrações"
Push-Location $api
$migrou = Executar "uv run alembic upgrade head" "migracoes.log"
Pop-Location
if (-not $migrou) { Falha "A migração do banco falhou." }

$env:NEXT_DIST_DIR = ".next-painel"
$env:FINANCE_API_URL = $enderecoDaApi
Push-Location $web
$lock = Get-Item "package-lock.json"
$instalado = Get-Item "node_modules\.package-lock.json" -ErrorAction SilentlyContinue
if (-not $instalado -or $lock.LastWriteTime -gt $instalado.LastWriteTime) {
    Passo "instalando dependências do painel"
    if (-not (Executar "npm install" "painel-build.log")) { Pop-Location; Falha "O npm install falhou." }
}
$compilado = Get-Item ".next-painel\BUILD_ID" -ErrorAction SilentlyContinue
$fontes = @(Get-ChildItem "src", "public" -Recurse -File) + @(Get-Item "package-lock.json", "next.config.ts", ".env.local" -ErrorAction SilentlyContinue)
$maisNovo = $fontes | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $compilado -or $maisNovo.LastWriteTime -gt $compilado.LastWriteTime) {
    Passo "compilando o painel (cerca de 1 minuto)"
    if (-not (Executar "node node_modules\next\dist\bin\next build" "painel-build.log")) {
        Pop-Location
        Falha "A compilação do painel falhou."
    }
}
Pop-Location

function Subir($nome, $programa, $argumentos, $pasta) {
    Start-Process -FilePath (Get-Command $programa).Source -ArgumentList $argumentos -WorkingDirectory $pasta `
        -NoNewWindow -PassThru -RedirectStandardOutput "$logs\$nome.log" -RedirectStandardError "$logs\$nome.erro.log"
}

$processos = [ordered]@{}
Passo "subindo a API, o worker e o painel"
$processos["API"] = Subir "api" "uv" "run --package finance-api uvicorn finance_api.main:app --host 127.0.0.1 --port 8000" $raiz
# O worker executa tudo o que estiver na fila, no banco real; a fila é a
# mesma da demonstração.
$processos["Worker"] = Subir "worker" "uv" "run --package finance-api python -m finance_api.worker" $raiz
$processos["Painel"] = Subir "painel" "node" "node_modules\next\dist\bin\next start -H 127.0.0.1 --port 3001" $web

Esperar "A API" 90 { Responde "$enderecoDaApi/health" }
Esperar "O painel" 90 { Responde $enderecoDoPainel }
AbrirNavegador
$icone.Text = "Mercúrio: aberto em 127.0.0.1:3001"

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$menu.Items.Add("Abrir painel", $null, { AbrirNavegador }) | Out-Null
$menu.Items.Add("Ver registros", $null, { Start-Process explorer.exe -ArgumentList $logs }) | Out-Null
$menu.Items.Add("-") | Out-Null
$menu.Items.Add("Desligar", $null, {
    $icone.Visible = $false
    [System.Windows.Forms.Application]::Exit()
}) | Out-Null
$icone.ContextMenuStrip = $menu
$icone.add_MouseClick({ param($origem, $evento) if ($evento.Button -eq "Left") { AbrirNavegador } })

$avisados = @{}
$vigia = New-Object System.Windows.Forms.Timer
$vigia.Interval = 5000
$vigia.add_Tick({
    foreach ($nome in @($processos.Keys)) {
        if ($processos[$nome].HasExited -and -not $avisados[$nome]) {
            $avisados[$nome] = $true
            $icone.ShowBalloonTip(5000, "Mercúrio", "$nome parou. Veja em Ver registros.", "Warning")
        }
    }
})
$vigia.Start()

[System.Windows.Forms.Application]::Run()
$icone.Dispose()

param(
    [switch]$SkipMigrations
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
Set-Location $projectRoot

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Comando '$Name' não encontrado. Instale-o e tente novamente."
    }
}

Require-Command 'node'
Require-Command 'npm'
Require-Command 'docker'

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -lt 22) {
    throw "O projeto requer Node.js 22 ou superior. Versão encontrada: $(node --version)."
}

if (-not (Test-Path (Join-Path $projectRoot '.env'))) {
    Copy-Item (Join-Path $projectRoot '.env.example') (Join-Path $projectRoot '.env')
    Write-Host 'Arquivo .env criado a partir de .env.example.'
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Compose não está disponível. Inicie/instale o Docker Desktop e tente novamente.'
}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
    Write-Host 'Instalando dependências do projeto...'
    npm install
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências.' }
}

Write-Host 'Iniciando PostgreSQL pelo Docker Compose...'
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar o PostgreSQL.' }

Write-Host 'Aguardando o PostgreSQL ficar pronto...'
$databaseReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' *> $null
    if ($LASTEXITCODE -eq 0) {
        $databaseReady = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $databaseReady) {
    throw 'O PostgreSQL não ficou pronto em 60 segundos. Confira `docker compose logs postgres`.'
}

if (-not $SkipMigrations) {
    Write-Host 'Aplicando migrations pendentes...'
    npm run db:migrate -w @moviematch/api
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao aplicar migrations.' }
}

Write-Host ''
Write-Host 'Iniciando MovieMatch. Web: http://localhost:5173 | API: http://localhost:3333'
Write-Host 'Pressione Ctrl+C para encerrar os servidores. O PostgreSQL continuará ativo.'
npm run dev
if ($LASTEXITCODE -ne 0) { throw 'O processo de desenvolvimento terminou com erro.' }

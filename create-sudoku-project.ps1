# PowerShell script to generate the complete project structure for the Java Sudoku game.

$projectName = "sudoku-project"

# --- Create Root Directory ---
if (Test-Path $projectName) {
    Write-Host "Project directory '$projectName' already exists. Aborting." -ForegroundColor Yellow
    exit
}
New-Item -ItemType Directory -Name $projectName
Set-Location $projectName
Write-Host "Created root directory: $projectName" -ForegroundColor Green

# --- Server Structure (Maven) ---
Write-Host "Creating sudoku-server structure..."
$serverPath = "sudoku-server/src/main/java/vn/uth/sodoku/server"
New-Item -ItemType Directory -Path $serverPath -Force
New-Item -ItemType Directory -Path "$serverPath/model"

New-Item -ItemType File -Path "sudoku-server/pom.xml"
New-Item -ItemType File -Path "$serverPath/ServerMain.java"
New-Item -ItemType File -Path "$serverPath/ClientHandler.java"
New-Item -ItemType File -Path "$serverPath/Match.java"
New-Item -ItemType File -Path "$serverPath/HistoryStore.java"
# Empty file to mark the model directory
New-Item -ItemType File -Path "$serverPath/model/.gitkeep"

# --- Client Structure (Maven / Swing) ---
Write-Host "Creating sudoku-client structure..."
$clientPath = "sudoku-client/src/main/java/vn/uth/sodoku"
New-Item -ItemType Directory -Path $clientPath -Force
New-Item -ItemType Directory -Path "$clientPath/ui"

New-Item -ItemType File -Path "sudoku-client/pom.xml"
New-Item -ItemType File -Path "$clientPath/App.java"
New-Item -ItemType File -Path "$clientPath/GameBoardPanel.java"
New-Item -ItemType File -Path "$clientPath/PvPController.java"
New-Item -ItemType File -Path "$clientPath/ClientNet.java"
# Empty file to mark the ui directory
New-Item -ItemType File -Path "$clientPath/ui/.gitkeep"

# --- Documentation Structure ---
Write-Host "Creating docs structure..."
New-Item -ItemType Directory -Name "docs"
New-Item -ItemType File -Path "docs/protocol.md"
New-Item -ItemType File -Path "docs/design.md"

# --- Scripts Structure ---
Write-Host "Creating scripts structure..."
New-Item -ItemType Directory -Name "scripts"
New-Item -ItemType File -Path "scripts/run-server.bat"

# --- Root Files ---
Write-Host "Creating root files..."
New-Item -ItemType File -Name "README.md"

Write-Host "Project structure for '$projectName' created successfully!" -ForegroundColor Green

# Return to the parent directory
Set-Location ..



# 一键上传 interpretation（导读）
# 由根目录的 upload.bat 调用；也可以直接 powershell -File tools\upload.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$SiteUrl = "https://aureliano-0112.github.io/TalesOfArt/"
$Host.UI.RawUI.WindowTitle = "谈艺录 · 上传导读"

function Say($text, $color = "Gray") { Write-Host "  $text" -ForegroundColor $color }
function Bad($text) { Write-Host "  $text" -ForegroundColor Red }

Write-Host ""
Say "《谈艺录》· 上传 interpretation（导读）"
Say "------------------------------------------"
Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Bad "[!] 没有找到 git。请先安装：https://git-scm.com/download/win"
    exit 1
}
if (-not (Test-Path (Join-Path $root ".git"))) {
    Bad "[!] 当前目录还不是 git 仓库，请先按 README 里的说明初始化一次。"
    exit 1
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    Say "· 刷新篇目清单"
    & python "tools\build.py"
    if ($LASTEXITCODE -ne 0) { Bad "[!] 篇目清单刷新失败，请检查 tools\build.py。"; exit 1 }
} else {
    Say "· 没找到 python，跳过清单刷新（线上构建时会自动生成）"
}

Say "· 暂存 interpretation、data\manifest.json"
& git add interpretation data/manifest.json
if ($LASTEXITCODE -ne 0) { Bad "[!] git add 失败。"; exit 1 }

& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Say "没有检测到改动，无需上传。" "Yellow"
    Write-Host ""
    exit 0
}

Write-Host ""
Say "本次改动："
& git --no-pager diff --cached --stat
Write-Host ""

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
& git commit -m "更新导读 $stamp"
if ($LASTEXITCODE -ne 0) { Bad "[!] 提交失败，请查看上面的 git 报错。"; exit 1 }

Say "· 推送到 GitHub"
& git push -u origin HEAD
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Bad "[!] 推送失败。常见原因："
    Say "    1. 网络连不上 github.com —— 稍后重试"
    Say "    2. 需要登录 —— 在弹出的窗口里授权 GitHub 账号"
    Say "    3. 远端有本地没有的提交 —— 先执行 git pull --rebase 再试"
    exit 1
}

Write-Host ""
Say "完成。线上站点一两分钟后自动更新：" "Green"
Say $SiteUrl "Green"
Write-Host ""
exit 0
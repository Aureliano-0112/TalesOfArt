@echo off
chcp 65001 >nul
title 谈艺录 · 上传原文与导读
cd /d "%~dp0"

echo.
echo   《谈艺录》· 上传 content 与 interpretation
echo   ------------------------------------------
echo.

rem ---- git 是否可用 ----
where git >nul 2>nul
if errorlevel 1 goto :nogit

rem ---- 是否已经是仓库 ----
if not exist ".git" goto :norepo

rem ---- 有 python 就刷新篇目清单，没有就交给线上构建 ----
where python >nul 2>nul
if errorlevel 1 goto :stage
echo   · 刷新篇目清单
python tools\build.py
if errorlevel 1 goto :buildfail

:stage
echo   · 暂存 content、interpretation、data\manifest.json
git add content interpretation data/manifest.json

rem ---- 有没有改动 ----
git diff --cached --quiet
if errorlevel 1 goto :haschange
echo.
echo   没有检测到改动，无需上传。
echo.
pause
exit /b 0

:haschange
echo.
echo   本次改动：
git --no-pager diff --cached --stat
echo.

rem ---- 提交 ----
for /f %%i in ('powershell -NoProfile -Command Get-Date -Format yyyy-MM-dd_HHmm') do set "STAMP=%%i"
if "%STAMP%"=="" set "STAMP=手动更新"
git commit -m "更新原文与导读 %STAMP%"
if errorlevel 1 goto :commitfail

rem ---- 推送 ----
echo   · 推送到 GitHub
git push -u origin HEAD
if errorlevel 1 goto :pushfail

echo.
echo   完成。线上站点一两分钟后自动更新：
echo   https://aureliano-0112.github.io/TalesOfArt/
echo.
pause
exit /b 0

:nogit
echo   [!] 没有找到 git。请先安装：https://git-scm.com/download/win
echo.
pause
exit /b 1

:norepo
echo   [!] 当前目录还不是 git 仓库。
echo       请先在本目录执行一次：
echo         git init
echo         git remote add origin https://github.com/Aureliano-0112/TalesOfArt.git
echo.
pause
exit /b 1

:buildfail
echo   [!] 篇目清单刷新失败，请检查 tools\build.py。
echo.
pause
exit /b 1

:commitfail
echo   [!] 提交失败，请查看上面的 git 报错。
echo.
pause
exit /b 1

:pushfail
echo.
echo   [!] 推送失败。常见原因：
echo       1. 网络连不上 github.com —— 稍后重试；
echo       2. 需要登录 —— 在弹出的窗口里授权 GitHub 账号；
echo       3. 远端有本地没有的提交 —— 先执行 git pull --rebase 再试。
echo.
pause
exit /b 1
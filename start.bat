@echo off
chcp 65001 >nul
title 谈艺录 · 原文与导读 · 本地预览
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  python tools\serve.py
  goto :done
)

where py >nul 2>nul
if %errorlevel%==0 (
  py tools\serve.py
  goto :done
)

echo.
echo   [!] 没有找到 Python，无法启动本地预览。
echo.
echo   请任选其一：
echo     1. 安装 Python 3（https://www.python.org/downloads/），再双击本文件；
echo     2. 直接访问已经部署好的 GitHub Pages 站点。
echo.
pause

:done
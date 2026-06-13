cd D:\Documents

git clone https://github.com/Z-Siqi/Clash-for-Windows_Chinese.git CFW_Chinese_work
cd CFW_Chinese_work

git checkout -b codex/app-baseline-opt

robocopy D:\Documents\CFW_Opt\app .\app /MIR /XD output

git status
git add app
git commit -m "Add current optimized app baseline"
git push -u origin codex/app-baseline-opt

gh pr create `
  --repo Z-Siqi/Clash-for-Windows_Chinese `
  --base main `
  --head codex/app-baseline-opt `
  --title "Add current optimized app baseline" `
  --body "Adds the current app baseline from D:\Documents\CFW_Opt\app as the starting point for Codex-assisted refactoring."
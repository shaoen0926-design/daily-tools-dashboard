#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  print "找不到 Node.js。請先安裝 Node.js 22 以上版本，再開啟這個檔案。"
  read -k 1 "?按任意鍵關閉。"
  exit 1
fi
node server.mjs --open
if [[ $? -ne 0 ]]; then
  read -k 1 "?啟動失敗，按任意鍵關閉。"
fi

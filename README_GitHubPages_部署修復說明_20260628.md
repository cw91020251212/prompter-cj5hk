# GitHub Pages 版修復說明（2026-06-28）

你講嘅「本機直接開 index.html 正常，但放上 GitHub 後好多功能用唔到」通常係因為：

- GitHub Pages 係 **子路徑**（`https://<user>.github.io/<repo>/`），而你部署時未必連同 `src/` 一齊上傳；
- 又或者 PWA / Service Worker 仍然快取緊舊版，令你以為「新檔案上咗但功能冇變」。

今次 patch 做咗兩個關鍵保險，確保「就算你只部署 index.html」都仍然可以用：

1. **把需要嘅資料（關聯詞庫、粵拼字典、字頻表）直接內嵌入 index.html**
2. **把同音字核心（hk-homophones.js）直接內嵌入 index.html**
3. `sw.js` 改做最小快取清單，避免因為缺少 `src/*` 而長期 404/用舊 cache。

---

## 你要點部署（最簡單方式：只上傳兩個檔）

只要把以下兩個檔放到 GitHub Pages 根目錄（repo root / docs / dist 依你設定）：

- `index.html`
- `sw.js`

就算唔上傳 `src/`，以下功能都會照常工作：

- ✅「最近查過（最多 60）」記錄/展開/刪除
- ✅「關聯詞語（常用）」展開（離線內嵌版）
- ✅「粵語同音字」

> 仍然建議你一併上傳 `src/`：好處係之後想更新資料檔、或改回分檔都方便。

---

## 最常見：上咗 GitHub 仍然唔得（其實係 SW 快取緊舊版）

請用以下方法清 cache（做一次就得）：

### 方法 A（最快）：Chrome 清站點資料
1. 去到你個 GitHub Pages 網址
2. 撳網址列左邊「鎖」
3. Site settings / 網站設定
4. Clear data / 清除資料
5. 重新整理（最好 `Ctrl+Shift+R`）

### 方法 B：DevTools 手動解除 SW
1. 開 DevTools（F12）
2. Application → Service Workers
3. 勾選 **Unregister** / **Bypass for network**
4. Application → Storage → Clear site data
5. Reload

---

## 回退（如果你想即刻退回未修復版）

本次修復前的備份檔：
- `index.restore-20260628_before-github-pages-fix.html`

回退做法：
1. 把而家嘅 `index.html` 改名（例如：`index.bad.html`）
2. 將 `index.restore-20260628_before-github-pages-fix.html` 改名做 `index.html`
3. 如果你有用 PWA，記得按上面方法清一次 cache

---

## 快速自檢清單（你部署完後，用以下幾步驗證）

1. 打開 GitHub Pages
2. 進入「查單字」
3. 輸入：`我`
4. 應該會見到：
   - 速成/倉頡碼綠色格仔
   - 「最近查過（最多 60）」可以展開，見到「我」
   - 「關聯詞語（常用）」可以展開
   - 右下角可打開「粵語同音字」浮動按鈕

---

如你想我再幫你加一個「GitHub Pages 狀態自檢」按鈕（檢查：sw 版本 / cache / 是否載入內嵌資料），我都可以加埋，方便你之後自己判斷係唔係快取問題。

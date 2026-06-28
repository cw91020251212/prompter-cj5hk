# GitHub Pages 版部署／無喇叭修復說明（更新：2026-06-28）

你講嘅情況——**本機開到有喇叭同出聲，但放上 GitHub Pages 就「冇喇叭、冇聲」**——最常見原因其實唔係程式壞，而係：

- 你之前已經裝過 PWA / 開過網站一次，瀏覽器嘅 **Service Worker（sw.js）快取咗舊版**；
- 舊版 `sw.js` 係 **cache-first**，甚至連 `index.html` 都會一直用 cache，結果你就算上傳咗新 `index.html`，個網站都仲係顯示舊 UI（舊 UI 冇「提詞機首頁朗讀」嗰粒喇叭）。

今次 patch（**20260628-patch4**）已經修好：

- `sw.js` 同 `index.html` 會 **network-first（更新優先）**
- `sw.js` 唔會再被自己 cache 住，避免「永遠更新唔到」

---

## 最簡單部署方式（建議）

只要上傳以下兩個檔去 GitHub Pages 根目錄（repo root / docs / dist 依你設定）：

- `index.html`
- `sw.js`

（你可以只部署呢兩個；資料已經內嵌，唔依賴 `src/`。）

---

## 已經部署但 GitHub Pages 仍然冇喇叭／冇聲？（一次性清快取）

> **做一次就得**，之後更新就會正常。

### 方法 A：Chrome 清站點資料（最快）
1. 去到你個 GitHub Pages 網址
2. 撳網址列左邊「🔒」
3. Site settings / 網站設定
4. Clear data / 清除資料
5. 重新整理（最好 `Ctrl+Shift+R`）

### 方法 B：DevTools 解除 Service Worker
1. 開 DevTools（F12）
2. Application → Service Workers
3. **Unregister**
4. Application → Storage → **Clear site data**
5. Reload

---

## 快速自檢（驗證喇叭有冇出現）

1. 打開 GitHub Pages
2. 進入「📖 提詞機」
3. 頂部應該見到一粒「🔊（朗讀全文）」按鈕
4. 貼一段字，撳 🔊 應該會開始朗讀；再撳一次會停止

---

如果你想我再幫你加一個「版本/快取狀態顯示」細字（例如：顯示 SW cache 名稱、最後更新時間），之後你一眼就知係咪快取問題，我都可以加埋。

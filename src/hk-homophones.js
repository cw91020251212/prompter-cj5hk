// hk-homophones.js
// 香港粵語同音字核心（重寫版）
// 目標：
// - 只接受中文輸入（可多字）
// - 以「同音（同一個粵拼，連聲調）」分組（字典本身係 jyutping）
// - 穩定：可應付 PWA / 快取 / 字庫未載入 / 字庫更新

(() => {
  'use strict';

  const DICT_URL = './src/jyutping_dict.json';

  // 改呢個版本號就會強制刷新 localStorage 快取
  const DICT_VERSION = '20260627-rebuild-1';
  const LS_KEY = 'hk_jyutping_dict_cache_v1';

  let dict = null;
  let loadingPromise = null;

  function isHan(str) {
    const s = String(str || '');
    try {
      return /\p{Script=Han}/u.test(s);
    } catch (e) {
      return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(s);
    }
  }

  function uniq(arr) {
    const out = [];
    const seen = new Set();
    for (const x of (arr || [])) {
      if (!x) continue;
      if (seen.has(x)) continue;
      seen.add(x);
      out.push(x);
    }
    return out;
  }

  function ensureCharToPinyin(d) {
    if (!d) return d;
    if (d.char_to_pinyin && Object.keys(d.char_to_pinyin).length > 0) return d;

    const map = Object.create(null);
    const p2c = d.pinyin_to_chars || {};
    for (const py of Object.keys(p2c)) {
      const arr = p2c[py] || [];
      for (const ch of arr) {
        if (!ch) continue;
        (map[ch] ||= []).push(py);
      }
    }
    for (const ch of Object.keys(map)) map[ch] = uniq(map[ch]);
    d.char_to_pinyin = map;
    return d;
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== DICT_VERSION || !parsed.data) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function saveToLocalStorage(d) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ version: DICT_VERSION, data: d }));
    } catch (e) {}
  }

  async function fetchJson(url) {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function load() {
    if (dict) return dict;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      // 1) localStorage
      const cached = loadFromLocalStorage();
      if (cached) {
        dict = ensureCharToPinyin(cached);
        return dict;
      }

      // 2) fetch
      const data = await fetchJson(DICT_URL);
      dict = ensureCharToPinyin(data);
      saveToLocalStorage(dict);
      return dict;
    })();

    try {
      const d = await loadingPromise;
      try {
        console.log('[HKHomophones] 字典已載入', {
          pinyin_to_chars: Object.keys(d.pinyin_to_chars || {}).length,
          char_to_pinyin: Object.keys(d.char_to_pinyin || {}).length,
          version: DICT_VERSION
        });
      } catch (e) {}
      return d;
    } finally {
      // 注意：保留 loadingPromise，避免並發重入
    }
  }

  function getJyutpingsOfChar(ch) {
    if (!dict) return [];
    return uniq(dict.char_to_pinyin?.[ch] || []);
  }

  function getHomophones(py, excludeChar, limit = 180) {
    if (!dict) return [];
    const src = dict.pinyin_to_chars?.[py] || [];
    const out = [];
    const seen = new Set();

    for (const ch of src) {
      if (!ch) continue;
      if (excludeChar && ch === excludeChar) continue;
      if (seen.has(ch)) continue;
      seen.add(ch);
      out.push(ch);
      if (out.length >= limit) break;
    }
    return out;
  }

  function normalizePinyinQuery(q) {
    let s = String(q || '').trim().toLowerCase();
    // 支援 ngo5 / ngo6 呢啲寫法（字典 key 多數無聲調數字）
    s = s.replace(/([a-z]+)[1-6]$/i, '$1');
    return s;
  }

  // 英文粵拼 → 同音字（支援 prefix 搜尋）
  // 回傳同樣用 groups 結構，方便 UI 直接 render
  function searchByPinyin(input, { limitPerReading = 180, maxGroups = 20 } = {}) {
    const q = normalizePinyinQuery(input);
    if (!q || !dict) return [];

    const keys = Object.keys(dict.pinyin_to_chars || {});
    const matched = keys
      .filter(k => k === q || k.startsWith(q))
      .sort((a, b) => {
        // exact match first, then shorter key first
        if (a === q && b !== q) return -1;
        if (b === q && a !== q) return 1;
        return a.length - b.length || a.localeCompare(b);
      })
      .slice(0, maxGroups);

    return matched.map(py => ({
      sourceChar: py,
      pinyins: [{ pinyin: py, chars: getHomophones(py, null, limitPerReading) }],
      missing: false
    }));
  }

  // 主要查詢：中文（可多字）→ 每個字分組列出讀音 + 同音字
  // 回傳：[{ sourceChar, pinyins:[{ pinyin, chars:[] }, ...], missing:boolean }]
  function search(input, { limitPerReading = 180 } = {}) {
    const val = String(input || '').trim();
    if (!val || !dict) return [];

    const chars = Array.from(val).filter(ch => isHan(ch));
    if (!chars.length) return [];

    const groups = [];
    for (const srcChar of chars) {
      const pinyins = getJyutpingsOfChar(srcChar);
      const items = pinyins.map(py => ({
        pinyin: py,
        chars: getHomophones(py, srcChar, limitPerReading)
      }));
      groups.push({
        sourceChar: srcChar,
        pinyins: items,
        missing: pinyins.length === 0
      });
    }
    return groups;
  }

  // 導出
  window.HKHomophones = {
    load,
    // 中文→中文（同音字）
    search,
    // 粵拼→中文（同音字）
    searchByPinyin,
    isHan,
    _debug: () => ({ dictLoaded: !!dict, dict })
  };
})();

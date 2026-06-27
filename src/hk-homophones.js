// hk-homophones.js
// 香港粵語同音字核心（重寫版）
// 目標：
// - 只接受中文輸入（可多字）
// - 以「同音（同一個粵拼，連聲調）」分組
// - 穩定：可應付 PWA / 快取 / 字庫未載入 / 字庫更新
// - 改良：同音字候選按「常用度」排序（常用字排前）

(() => {
  'use strict';

  const DICT_URL = './src/jyutping_dict.json';
  const FREQ_URL = './src/char_freq_rank.json';

  // 改呢啲版本號就會強制刷新 localStorage 快取
  const DICT_VERSION = '20260627-rebuild-1';
  const FREQ_VERSION = '20260627-freq-1';

  const LS_KEY = 'hk_jyutping_dict_cache_v1';
  const LS_FREQ_KEY = 'hk_char_freq_rank_cache_v1';

  let dict = null;
  let freqRank = null;
  let loadingPromise = null;

  // —— 粵語口語常用字（補強：一般普通話字頻表未必包晒）——
  // 註：呢度只係排序用嘅優先清單；唔會影響你查到嘅字。
  const CANTO_COMMON_CHARS = [
    '我','你','佢','唔','喺','咩','嘅','哋','啲','咗','嗰','呢','咁','冇','嚟','係','就','都','仲','同','得','好','啦','呀','喎','嘢','點','做','未','會','要','無','有','去','返','入','出','睇','聽','講','食','飲','諗','想','知','咪','緊','喇','囉','啫','啱','過','再','先','喂'
  ];
  const CANTO_PRI = Object.create(null);
  for (let i = 0; i < CANTO_COMMON_CHARS.length; i++) {
    const ch = CANTO_COMMON_CHARS[i];
    if (ch && ch.length === 1 && CANTO_PRI[ch] == null) CANTO_PRI[ch] = i + 1;
  }

  // 常見繁→簡對照（借用字頻排名；覆蓋最常見一批先）
  const TRAD_TO_SIMPL = {
    '這':'这','個':'个','們':'们','來':'来','為':'为','後':'后','過':'过','會':'会','與':'与','還':'还','裡':'里',
    '應':'应','說':'说','時':'时','對':'对','發':'发','國':'国','學':'学','點':'点','嗎':'吗','話':'话',
    '見':'见','讓':'让','開':'开','關':'关','門':'门','書':'书','電':'电','聲':'声','體':'体',
    '愛':'爱','頭':'头','進':'进','樣':'样','誰':'谁'
  };

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

  function loadFreqFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_FREQ_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== FREQ_VERSION || !parsed.data) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function saveFreqToLocalStorage(d) {
    try {
      localStorage.setItem(LS_FREQ_KEY, JSON.stringify({ version: FREQ_VERSION, data: d }));
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

  function commonnessRank(ch) {
    if (!ch) return 1e9;

    // 0) 粵語口語常用字：強力置頂
    if (CANTO_PRI[ch] != null) return -100000 + CANTO_PRI[ch];

    // 1) 直接命中字頻表
    const r = freqRank && freqRank[ch];
    if (typeof r === 'number') return r;

    // 2) 常見繁→簡借用排名
    const sim = TRAD_TO_SIMPL[ch];
    if (sim && freqRank && typeof freqRank[sim] === 'number') return freqRank[sim] + 0.2;

    // 3) 未知：放到後面
    return 1e9;
  }

  function sortCharsByCommonness(list) {
    const arr = (list || []).slice();
    arr.sort((a, b) => {
      const ra = commonnessRank(a);
      const rb = commonnessRank(b);
      if (ra !== rb) return ra - rb;
      try { return a.localeCompare(b, 'zh-HK'); } catch (e) { return String(a).localeCompare(String(b)); }
    });
    return arr;
  }

  async function load() {
    if (dict) return dict;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      // 1) dict localStorage
      const cached = loadFromLocalStorage();
      if (cached) {
        dict = ensureCharToPinyin(cached);
      } else {
        const data = await fetchJson(DICT_URL);
        dict = ensureCharToPinyin(data);
        saveToLocalStorage(dict);
      }

      // 2) freq localStorage → fetch
      const cachedFreq = loadFreqFromLocalStorage();
      if (cachedFreq) {
        freqRank = cachedFreq;
      } else {
        try {
          const f = await fetchJson(FREQ_URL);
          freqRank = f || null;
          if (freqRank) saveFreqToLocalStorage(freqRank);
        } catch (e) {
          // 冇字頻表都唔阻住核心運作
          freqRank = null;
        }
      }

      return dict;
    })();

    try {
      const d = await loadingPromise;
      try {
        console.log('[HKHomophones] 字典已載入', {
          pinyin_to_chars: Object.keys(d.pinyin_to_chars || {}).length,
          char_to_pinyin: Object.keys(d.char_to_pinyin || {}).length,
          dictVersion: DICT_VERSION,
          freqLoaded: !!freqRank,
          freqCount: freqRank ? Object.keys(freqRank).length : 0,
          freqVersion: FREQ_VERSION
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

    const raw = [];
    const seen = new Set();
    for (const ch of src) {
      if (!ch) continue;
      if (excludeChar && ch === excludeChar) continue;
      if (seen.has(ch)) continue;
      seen.add(ch);
      raw.push(ch);
    }

    const ordered = sortCharsByCommonness(raw);
    return ordered.slice(0, Math.max(0, limit || 0));
  }

  function normalizePinyinQuery(q) {
    let s = String(q || '').trim().toLowerCase();
    // 支援 ngo5 / ngo6 呢啲寫法（字典 key 多數無聲調數字）
    s = s.replace(/([a-z]+)[1-6]$/i, '$1');
    return s;
  }

  // 英文粵拼 → 同音字（支援 prefix 搜尋）
  function searchByPinyin(input, { limitPerReading = 180, maxGroups = 20 } = {}) {
    const q = normalizePinyinQuery(input);
    if (!q || !dict) return [];

    const keys = Object.keys(dict.pinyin_to_chars || {});
    const matched = keys
      .filter(k => k === q || k.startsWith(q))
      .sort((a, b) => {
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

  window.HKHomophones = {
    load,
    search,
    searchByPinyin,
    isHan,
    _debug: () => ({ dictLoaded: !!dict, dict, freqLoaded: !!freqRank, freqRank })
  };
})();

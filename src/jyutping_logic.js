// 粵拼查詢邏輯 V3 - 修復中文字識別與除錯
let jyutpingData = null;
let jyutpingLoaded = false;

async function loadJyutpingDict() {
    if (jyutpingLoaded) return jyutpingData;
    try {
        const response = await fetch('src/jyutping_dict.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        jyutpingData = await response.json();
        jyutpingLoaded = true;
        console.log('[Jyutping] 字典已載入，共', Object.keys(jyutpingData.char_to_pinyin || {}).length, '個字');
        return jyutpingData;
    } catch (e) {
        console.error('[Jyutping] 無法載入粵拼字典:', e);
        return null;
    }
}

function isChinese(str) {
    // 更準確的中文字檢測（包括 CJK 統一表意文字）
    const cjkRegex = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
    return cjkRegex.test(str);
}

function searchJyutping(input) {
    if (!jyutpingData || !input) {
        console.log('[Jyutping] 無效輸入或字典未載入');
        return [];
    }
    
    const query = input.trim();
    console.log('[Jyutping] 查詢:', query, '| 是否中文:', isChinese(query));
    
    if (isChinese(query)) {
        // 中文字查詢
        const char = Array.from(query)[0]; // 取第一個字
        console.log('[Jyutping] 查詢中文字:', char);
        
        const pinyins = jyutpingData.char_to_pinyin[char];
        if (!pinyins) {
            console.log('[Jyutping] 字 "' + char + '" 未在資料庫中');
            return [];
        }
        
        console.log('[Jyutping] 字 "' + char + '" 的拼音:', pinyins);
        
        const results = [];
        for (const py of pinyins) {
            const chars = jyutpingData.pinyin_to_chars[py] || [];
            results.push({
                pinyin: py,
                chars: chars,
                sourceChar: char
            });
        }
        
        console.log('[Jyutping] 返回', results.length, '個結果');
        return results;
    } else {
        // 英文拼音查詢
        const pyQuery = query.toLowerCase();
        console.log('[Jyutping] 查詢英文拼音:', pyQuery);
        
        const results = [];
        for (const key in jyutpingData.pinyin_to_chars) {
            if (key.startsWith(pyQuery)) {
                results.push({
                    pinyin: key,
                    chars: jyutpingData.pinyin_to_chars[key]
                });
            }
        }
        
        // 排序
        results.sort((a, b) => {
            if (a.pinyin === pyQuery) return -1;
            if (b.pinyin === pyQuery) return 1;
            return a.pinyin.length - b.pinyin.length;
        });
        
        const limited = results.slice(0, 20);
        console.log('[Jyutping] 找到', results.length, '個拼音，返回', limited.length, '個');
        return limited;
    }
}

// 導出到全域
window.loadJyutpingDict = loadJyutpingDict;
window.searchJyutping = searchJyutping;

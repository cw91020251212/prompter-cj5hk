// 粵拼查詢邏輯 V2 - 支援中英文輸入
let jyutpingData = null;

async function loadJyutpingDict() {
    if (jyutpingData) return jyutpingData;
    try {
        const response = await fetch('src/jyutping_dict.json');
        jyutpingData = await response.json();
        return jyutpingData;
    } catch (e) {
        console.error('無法載入粵拼字典:', e);
        return null;
    }
}

function searchJyutping(input) {
    if (!jyutpingData || !input) return [];
    const query = input.trim();
    
    // 判斷是否為中文字 (簡單判斷是否包含非 ASCII 字元)
    const isChinese = /[^\x00-\xff]/.test(query);
    
    if (isChinese) {
        // 如果是中文字，取第一個字
        const char = Array.from(query)[0];
        const pinyins = jyutpingData.char_to_pinyin[char] || [];
        
        const results = [];
        for (const py of pinyins) {
            results.push({
                pinyin: py,
                chars: jyutpingData.pinyin_to_chars[py] || [],
                sourceChar: char // 標註來源字
            });
        }
        return results;
    } else {
        // 英文拼音輸入，支援前綴匹配
        const pyQuery = query.toLowerCase();
        const results = [];
        for (const key in jyutpingData.pinyin_to_chars) {
            if (key.startsWith(pyQuery)) {
                results.push({
                    pinyin: key,
                    chars: jyutpingData.pinyin_to_chars[key]
                });
            }
        }
        // 排序：精確匹配排在前面
        results.sort((a, b) => {
            if (a.pinyin === pyQuery) return -1;
            if (b.pinyin === pyQuery) return 1;
            return a.pinyin.length - b.pinyin.length;
        });
        return results.slice(0, 20); // 限制結果數量以保證效能
    }
}

// 導出到全域
window.loadJyutpingDict = loadJyutpingDict;
window.searchJyutping = searchJyutping;

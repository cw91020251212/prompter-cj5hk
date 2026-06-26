// 粵拼查詢邏輯
let jyutpingDict = null;

async function loadJyutpingDict() {
    if (jyutpingDict) return jyutpingDict;
    try {
        const response = await fetch('src/jyutping_dict.json');
        jyutpingDict = await response.json();
        return jyutpingDict;
    } catch (e) {
        console.error('無法載入粵拼字典:', e);
        return null;
    }
}

function searchJyutping(input) {
    if (!jyutpingDict || !input) return [];
    const query = input.toLowerCase().trim();
    // 支援模糊匹配（輸入前綴）
    const results = [];
    for (const key in jyutpingDict) {
        if (key.startsWith(query)) {
            results.push({
                pinyin: key,
                chars: jyutpingDict[key]
            });
        }
    }
    return results;
}

// 導出到全域以便 index.html 使用
window.loadJyutpingDict = loadJyutpingDict;
window.searchJyutping = searchJyutping;

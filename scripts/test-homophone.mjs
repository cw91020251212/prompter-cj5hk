// 簡單回歸測試：確保「輸入中文字 → 粵語同音字」正常（重寫版）
// 用法：pnpm test:homophone

import fs from 'node:fs';

function assert(cond, msg) {
  if (!cond) {
    console.error('❌', msg);
    process.exitCode = 1;
  }
}

const dictPath = new URL('../src/jyutping_dict.json', import.meta.url);
const raw = fs.readFileSync(dictPath, 'utf8');
const data = JSON.parse(raw);

assert(!!data.pinyin_to_chars, '字典缺少 pinyin_to_chars');
assert(!!data.char_to_pinyin, '字典缺少 char_to_pinyin');

const samples = ['我', '你', '佢', '唔', '咩', '喺', '哋', '𠻺'];
for (const ch of samples) {
  const pys = (data.char_to_pinyin?.[ch] || []);
  assert(pys.length > 0, `字典應該有「${ch}」嘅粵拼（而家係空）`);
}

// 英文粵拼→中文：基本 sanity check
assert((data.pinyin_to_chars?.['ngo'] || []).includes('我'), "粵拼 'ngo' 應該搵到 '我'");

if (process.exitCode) {
  process.exit(process.exitCode);
} else {
  console.log('✅ Homophone self-test passed');
  console.log('pinyin_to_chars keys:', Object.keys(data.pinyin_to_chars || {}).length);
  console.log('char_to_pinyin keys:', Object.keys(data.char_to_pinyin || {}).length);
}

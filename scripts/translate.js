const fs = require('fs');
const path = require('path');
// 核心修复：使用花括号解构出 translate 函数

const { translate } = require('@vitalets/google-translate-api');

const LOGS_DIR = './logs';

// 正则表达式：用于提取内容和定位替换位置
const ZH_PATTERN = /<!---zh-->([\s\S]*?)<!--zhend-->/;
const EN_PATTERN = /(<!---en-->)[\s\S]*?(<!--enend-->)/;

async function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. 提取中文块内容
    const zhMatch = content.match(ZH_PATTERN);
    if (!zhMatch || !zhMatch[1].trim()) {
        console.log(`[跳过] ${path.basename(filePath)}: 未找到中文内容。`);
        return;
    }

    const textToTranslate = zhMatch[1].trim();

    // 2. 检查是否存在英文目标块
    if (!EN_PATTERN.test(content)) {
        console.log(`[跳过] ${path.basename(filePath)}: 缺少 ---en-- 标记。`);
        return;
    }

    try {
        // 3. 执行翻译
        console.log(`[处理中] ${path.basename(filePath)}...`, textToTranslate.length);
        const res = await translate(textToTranslate, { to: 'en', format: 'html' });
        
        // 格式化翻译后的内容（保持首尾换行，观感更好）
        const translatedContent = `\n${res.text}\n`;

        // 4. 替换英文块：保留 ---en-- 和 --enend-- 标签，只换中间内容
        // $1 代表 ---en--，$2 代表 --enend--
        const newContent = content.replace(EN_PATTERN, `$1${translatedContent}$2`);

        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`[成功] ${path.basename(filePath)} 已更新翻译。`, translatedContent.length);

    } catch (err) {
        console.error(`[失败] ${path.basename(filePath)}: ${err.message}`);
    }
}

async function main() {
    if (!fs.existsSync(LOGS_DIR)) {
      console.log(`[目录不存在]`);
      return;
    }

    const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.md'));
    
    // 使用 for...of 确保翻译按顺序进行，避免触发 API 并发限制
    for (const file of files) {
        await processFile(path.join(LOGS_DIR, file));
        // 可选：如果文件很多，可以在这里加一个 short sleep
        // await new Promise(resolve => setTimeout(resolve, 500)); 
    }
}

main();

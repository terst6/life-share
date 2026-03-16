const path = require('path'); // 在文件最顶部
const crypto = require('crypto');
const fs = require('fs');

const { translate } = require('@vitalets/google-translate-api');
const LOGS_DIR = './logs';

// 正则表达式：用于提取内容和定位替换位置
const ZH_START = '<!---zh(';
const ZH_STARTEND = ')-->';
const ZH_END = '<!--zhend-->';
const EN_START = '<!---en-->';
const EN_END = '<!--enend-->';

// 计算 MD5 Hash 的工具函数
function getHash(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

async function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. 定位中文块起始和结束
    const zhStartIdx = content.indexOf(ZH_START);
    const zhStartCloseIdx = content.indexOf(ZH_STARTEND, zhStartIdx);
    const zhEndIdx = content.indexOf(ZH_END);
        
	// 计算英文块
	const newEnStartIdx = content.indexOf(EN_START);
	const newEnEndIdx = content.indexOf(EN_END);

    if (zhStartIdx === -1 || zhStartCloseIdx === -1 || zhEndIdx === -1) {
        console.log(`[跳过] ${filePath}: 未找到完整的中文标记块`);
        return;
    }

    if (newEnStartIdx === -1 || newEnEndIdx === -1) {
        console.log(`[跳过] ${filePath}: 未找到完整的英文标记块`);
        return;
    }

    // 提取旧的 Hash（从 之间）
    const oldHash = content.substring(zhStartIdx + ZH_START.length, zhStartCloseIdx);
    // 提取当前的中文内容
    const currentZhContent = content.substring(zhStartCloseIdx + ZH_STARTEND.length, zhEndIdx).trim();
    
    // 2. Hash 校验
    const currentHash = getHash(currentZhContent);
    if (currentHash === oldHash) {
        console.log(`[忽略] ${filePath}: 内容未变化，跳过翻译`);
        return;
    }

    console.log(`[发现更新] ${filePath}: 正在翻译...`);

    // 3. 执行翻译 (假设你已经解构了 translate)
    try {
		const res = await translate(currentZhContent, { to: 'en', format: 'text' });
		const translatedText = res.text;

		// 1. 先构造“中文标记更新了 hash”后的新中文块
		// 注意：我们要保留英文块之后、中文标记之前的所有内容（如果有的话）
		const newZhStartTag = ZH_START + currentHash// + ZH_STARTEND;
		
		// 2. 既然英文在最前面，我们直接用原 content 的索引来切分
		const finalContent = 
			content.substring(0, newEnStartIdx + EN_START.length) + // 英文起始标签
			"\n" + translatedText + "\n" +                          // 翻译内容
			content.substring(newEnEndIdx, zhStartIdx) +            // 英文结束标签 到 中文起始标签 之间的内容
			newZhStartTag +                                         // 更新了 Hash 的中文起始标签
			content.substring(zhStartCloseIdx);                     // 从旧中文起始标签结尾到文件末尾

		fs.writeFileSync(filePath, finalContent, 'utf8');
		console.log(`[成功] ${filePath}: 已更新`, content.length, finalContent.length, newZhStartTag);
    } catch (err) {
        console.error(`[错误] ${filePath} 翻译失败:`, err.message);
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

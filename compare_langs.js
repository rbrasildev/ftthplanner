
const fs = require('fs');

const content = fs.readFileSync('d:/ftthplanner/LanguageContext.tsx', 'utf8');

const enMatch = content.match(/en: \{([\s\S]*?)\},/);
const ptMatch = content.match(/pt: \{([\s\S]*?)\}/);

if (!enMatch || !ptMatch) {
    console.log("Could not find en or pt sections");
    process.exit(1);
}

function extractKeys(section) {
    const keys = [];
    const lines = section.split('\n');
    for (let line of lines) {
        const match = line.match(/'(.*?)':/);
        if (match) {
            keys.push(match[1]);
        }
    }
    return keys;
}

const enKeys = extractKeys(enMatch[1]);
const ptKeys = extractKeys(ptMatch[1]);

console.log("Keys in EN but not in PT:");
enKeys.forEach(k => {
    if (!ptKeys.includes(k)) {
        console.log(`- ${k}`);
    }
});

console.log("\nKeys in PT but not in EN:");
ptKeys.forEach(k => {
    if (!enKeys.includes(k)) {
        console.log(`- ${k}`);
    }
});

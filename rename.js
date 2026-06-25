const fs = require('fs');
const path = require('path');

const targetDir = 'c:\\Users\\soudf\\OneDrive\\Desktop\\soud movies\\SoudMusic';

function walkAndReplace(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === '.git' || file === 'node_modules' || file === 'dist' || file === 'build') continue;
        
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            walkAndReplace(fullPath);
        } else {
            const ext = path.extname(fullPath).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.exe', '.dmg', '.appimage', '.md5'].includes(ext)) {
                continue;
            }
            
            try {
                let content = fs.readFileSync(fullPath, 'utf8');
                if (content.toLowerCase().includes('soudmusic')) {
                    content = content.replace(/SoudMusic/g, 'SoudMusic');
                    content = content.replace(/soudmusic/g, 'soudmusic');
                    content = content.replace(/SOUDMUSIC/g, 'SOUDMUSIC');
                    fs.writeFileSync(fullPath, content, 'utf8');
                    console.log(`Updated: ${fullPath}`);
                }
            } catch (e) {
                console.error(`Skipped ${fullPath}: ${e.message}`);
            }
        }
    }
}

walkAndReplace(targetDir);
console.log("Done!");

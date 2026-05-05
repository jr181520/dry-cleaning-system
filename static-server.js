const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
    
    // 移除查询参数
    filePath = filePath.split('?')[0];
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 文件不存在，返回404
                fs.readFile(path.join(ROOT, 'index.html'), (err2, content2) => {
                    if (err2) {
                        res.writeHead(404);
                        res.end('404 Not Found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content2);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           前端静态文件服务器已启动                          ║
╠════════════════════════════════════════════════════════════╣
║  访问地址: http://localhost:${PORT}                          ║
║  根目录: ${ROOT}        ║
╠════════════════════════════════════════════════════════════╣
║  快捷页面:                                                  ║
║    • 后台管理: http://localhost:${PORT}/admin.html          ║
║    • C端首页: http://localhost:${PORT}/c-index.html         ║
║    • 管理员: http://localhost:${PORT}/admin.html            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

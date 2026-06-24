const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const inputFile = path.join(__dirname, 'frontend', 'public', 'SynapseWorker.exe');
const outputFile = path.join(__dirname, 'frontend', 'public', 'SynapseWorker.exe.gz');

if (!fs.existsSync(inputFile)) {
    console.error("Không tìm thấy file SynapseWorker.exe trong thư mục frontend/public!");
    console.error("Vui lòng copy file .exe của bạn vào đó trước.");
    process.exit(1);
}

console.log(`Đang nén file SynapseWorker.exe (Kích thước gốc: ${(fs.statSync(inputFile).size / 1024 / 1024).toFixed(2)} MB)...`);
console.log("Quá trình này có thể mất vài chục giây, vui lòng chờ...");

const readStream = fs.createReadStream(inputFile);
const writeStream = fs.createWriteStream(outputFile);
const gzip = zlib.createGzip({ level: 9 }); // Nén mức cao nhất

readStream.pipe(gzip).pipe(writeStream);

writeStream.on('finish', () => {
    const originalSize = fs.statSync(inputFile).size;
    const compressedSize = fs.statSync(outputFile).size;

    console.log("Nén hoàn tất!");
    console.log(`Kích thước sau khi nén: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (Giảm được ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%)`);
    console.log("\nBây giờ bạn có thể xóa file .exe gốc và git push file .gz lên GitHub!");
});

writeStream.on('error', (err) => {
    console.error("Lỗi trong quá trình nén:", err);
});

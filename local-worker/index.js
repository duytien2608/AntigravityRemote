require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, onSnapshot, query, where, updateDoc, doc, setDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: "AIzaSyD_3Fnb9VOiHlpu17xTmczd8fKC_UJZx7U",
  authDomain: "antigravityremote.firebaseapp.com",
  projectId: "antigravityremote",
  storageBucket: "antigravityremote.firebasestorage.app",
  messagingSenderId: "86927756991",
  appId: "1:86927756991:web:eacab4b4e122fc32b2400a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("-----------------------------------------");
console.log("Khởi động Antigravity Local Worker AI...");
console.log("-----------------------------------------");

const DANGEROUS_EXTS = ['.exe', '.bat', '.vbs', '.ps1', '.cmd', '.dll', '.sys', '.sh'];
const DANGEROUS_PATHS = ['C:\\Windows', 'System32', 'Program Files'];

function isSafeFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (DANGEROUS_EXTS.includes(ext)) return false;
    for (const dPath of DANGEROUS_PATHS) {
        if (filePath.includes(dPath)) return false;
    }
    return true;
}

function readProjectContext(dirPath) {
    const MAX_FILES = 20;
    const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.gemini', 'tmp'];
    const ALLOWED_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.md', '.py', '.txt'];
    
    let result = '';
    let count = 0;
    
    function walk(dir) {
        if (count >= MAX_FILES) return;
        if (!fs.existsSync(dir)) return;
        
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            if (count >= MAX_FILES) break;
            const fullPath = path.join(dir, item.name);
            
            if (item.isDirectory()) {
                if (!IGNORE_DIRS.includes(item.name)) {
                    walk(fullPath);
                }
            } else {
                const ext = path.extname(item.name).toLowerCase();
                if (ALLOWED_EXTS.includes(ext) || item.name.includes('.')) {
                    try {
                        const stat = fs.statSync(fullPath);
                        if (stat.size < 50 * 1024) { // Bỏ qua file > 50KB
                            const content = fs.readFileSync(fullPath, 'utf8');
                            result += `\n--- File: ${fullPath.replace(/\\/g, '/')} ---\n${content}\n`;
                            count++;
                        }
                    } catch(e) {}
                }
            }
        }
    }
    
    walk(dirPath);
    if (!result) return "Thư mục rỗng hoặc không có file code nào.";
    return result;
}

async function callGroqToGenerateCode(description, taskPath) {
    // Tự động nhận key cho file .exe
    const apiKey = process.env.GROQ_API_KEY || "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";
    
    console.log("Đang phân tích yêu cầu bằng AI (Groq)...");
    const systemInstruction = `Bạn là một lập trình viên siêu đẳng. Người dùng yêu cầu: ${description}.
Thư mục dự án là: ${taskPath}.
CẢNH BÁO BẢO MẬT: Không được phép tạo file mã độc (.exe, .bat, v.v.), không được sửa file hệ thống.
BẠN PHẢI TRẢ VỀ DUY NHẤT 1 MẢNG JSON. KHÔNG DÙNG MARKDOWN, KHÔNG CHÀO HỎI.
Cấu trúc mảng bắt buộc:
[
  {
    "filename": "tên file (ví dụ: index.html)",
    "content": "nội dung code đầy đủ"
  }
]`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: "system", content: systemInstruction }],
            temperature: 0.1
        })
    });

    if (!response.ok) {
        throw new Error("Groq API Error: " + await response.text());
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Lọc mảng JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("AI không trả về chuẩn JSON array.");
    
    return JSON.parse(jsonMatch[0]);
}

function getUserIdFromFilename() {
    const execPath = process.execPath;
    const baseName = path.basename(execPath, '.exe');
    // Expected format: SynapseWorker_USERID
    const parts = baseName.split('_');
    if (parts.length >= 2) {
        return parts[1];
    }
    return null; // Fallback
}

function installToStartup() {
    const startupPath = path.join(process.env.APPDATA, 'Microsoft\\Windows\\Start Menu\\Programs\\Startup\\SynapseWorker.exe');
    if (!fs.existsSync(startupPath)) {
        try {
            fs.copyFileSync(process.execPath, startupPath);
            console.log("=> Đã cài đặt tự động chạy ngầm cùng Windows thành công!");
        } catch (e) {
            console.log("=> Không thể tự động cài đặt vào Startup:", e.message);
        }
    }
}

let screenshotInterval = null;
let isTakingScreenshot = false;

function startScreenshotMonitor(userId) {
    if (screenshotInterval) clearInterval(screenshotInterval);
    const docRef = doc(db, 'system', `live_monitor_${userId}`);
    const tempPath = path.join(__dirname, 'temp_screen.jpg');
    const psScreenPath = path.join(__dirname, 'capture_screen.ps1');
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$Screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
$Bitmap = New-Object System.Drawing.Bitmap $Screen.Width, $Screen.Height
$Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
$Graphics.CopyFromScreen($Screen.Left, $Screen.Top, 0, 0, $Bitmap.Size)
$Thumb = $Bitmap.GetThumbnailImage(1280, 720, $null, [intptr]::Zero)
$Thumb.Save("${tempPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$Bitmap.Dispose()
$Thumb.Dispose()
$Graphics.Dispose()
`;
    fs.writeFileSync(psScreenPath, psScript);

    console.log("=> Đã bật Camera Giám sát IDE...");
    screenshotInterval = setInterval(async () => {
        if (isTakingScreenshot) return;
        isTakingScreenshot = true;
        try {
            const { execSync } = require('child_process');
            execSync(`powershell.exe -ExecutionPolicy Bypass -File "${psScreenPath}"`, { stdio: 'ignore' });
            
            if (fs.existsSync(tempPath)) {
                const base64Image = fs.readFileSync(tempPath, 'base64');
                const dataUrl = `data:image/jpeg;base64,${base64Image}`;
                await setDoc(docRef, {
                    screenshot: dataUrl,
                    updatedAt: new Date().toISOString()
                });
                fs.unlinkSync(tempPath);
            }
        } catch (err) {
            // Bỏ qua lỗi chụp ảnh
        }
        isTakingScreenshot = false;
    }, 5000);
}

async function startListening() {
    installToStartup();
    
    let userId = getUserIdFromFilename();
    if (!userId) {
        console.log("CẢNH BÁO: Không tìm thấy Mã Người Dùng trong tên file. Hệ thống sẽ chạy ở chế độ Local Debug.");
    }
    userId = process.env.USER_ID || userId;
    
    console.log("-----------------------------------------");
    console.log("Khởi động Antigravity Local Worker...");
    console.log("-----------------------------------------");
    
    if (userId) {
        console.log(`=> Đã tự động nhận diện Tài khoản: [${userId}]`);
        onSnapshot(doc(db, 'users', userId), (docSnap) => {
            if (docSnap.exists() && docSnap.data().isLocked) {
                console.log("\n[CẢNH BÁO ĐỎ] Tài khoản của bạn đã bị Quản Trị Viên khóa!");
                process.exit(1);
            }
        });
        
        // Khởi động Camera Giám Sát
        startScreenshotMonitor(userId);
    }
    
    console.log("Đang lắng nghe yêu cầu từ Web Dashboard...");
    
    const tasksRef = collection(db, 'tasks');
    const constraints = [where('status', 'in', ['pending', 'approved'])];
    if (userId) constraints.push(where('userId', '==', userId));
    
    const qTasks = query(tasksRef, ...constraints);
    
    onSnapshot(qTasks, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const data = change.doc.data();
            const docId = change.doc.id;

            if (change.type === 'added' || change.type === 'modified') {
                if (data.status === 'approved') {
                    console.log(`\n=> Web Dashboard yêu cầu bật Antigravity IDE: ${data.title}`);
                    try {
                        const targetDir = data.path;
                        if (!fs.existsSync(targetDir)) {
                            fs.mkdirSync(targetDir, { recursive: true });
                        }
                        
                        // Mã hóa description sang Base64 để truyền an toàn qua PowerShell
                        const descBase64 = Buffer.from(data.description).toString('base64');
                        const psScriptPath = path.join(__dirname, 'ghost_script.ps1');
                        
                        // Lấy tên thư mục để focus đúng cửa sổ IDE (tránh focus nhầm sang IDE đang code Synapse)
                        const folderName = path.basename(targetDir);
                        const windowTitlePrefix = `${folderName} - Antigravity`;

                        const psScriptContent = `
Add-Type -AssemblyName System.Windows.Forms
$desc = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${descBase64}'))
Set-Clipboard -Value $desc
Start-Process "C:\\Users\\Tienz\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe" -ArgumentList "${targetDir}"
Start-Sleep -Seconds 12

$wshell = New-Object -ComObject wscript.shell
$wshell.AppActivate("${windowTitlePrefix}")
Start-Sleep -Milliseconds 500
$wshell.AppActivate("${windowTitlePrefix}")
Start-Sleep -Milliseconds 500

# Nhấn Ctrl+L
[System.Windows.Forms.SendKeys]::SendWait("^l")
Start-Sleep -Milliseconds 300

# Nhấn Ctrl+V
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 300

# Nhấn Enter
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
`;
                        fs.writeFileSync(psScriptPath, psScriptContent);
                        console.log(`=> Đã tạo kịch bản PowerShell giả lập phím thành công.`);
                        
                        const { exec } = require('child_process');
                        console.log(`=> Đang mở IDE và truyền câu lệnh... Vui lòng không chạm vào bàn phím/chuột...`);
                        
                        exec(`powershell.exe -ExecutionPolicy Bypass -File "${psScriptPath}"`, async (error) => {
                            if (error) {
                                console.error("=> Lỗi chạy PowerShell:", error);
                            } else {
                                console.log(`=> Đã hoàn thành kịch bản thao tác IDE!`);
                                fs.unlinkSync(psScriptPath); // Dọn dẹp
                            }
                            
                            // Đánh dấu in-progress để chờ người dùng duyệt
                            await updateDoc(doc(db, 'tasks', docId), {
                                status: 'in-progress'
                            });
                        });
                    } catch (err) {
                        console.log(`=> Lỗi hệ thống:`, err.message);
                    }
                }
            }
        });
    });

    console.log("Đang lắng nghe System Requests (Duyệt thư mục & Đọc mã nguồn)...");
    const sysReqRef = collection(db, 'system_requests');
    const sysConstraints = [where('status', '==', 'pending')];

    const qSys = query(sysReqRef, ...sysConstraints);
    onSnapshot(qSys, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const docId = change.doc.id;

                if (data.action === 'BROWSE_DIR' && data.path) {
                    console.log(`\n=> Web yêu cầu đọc thư mục: ${data.path}`);
                    try {
                        let resultDirs = [];
                        if (fs.existsSync(data.path)) {
                            const items = fs.readdirSync(data.path, { withFileTypes: true });
                            resultDirs = items.map(item => item.isDirectory() ? `[DIR] ${item.name}` : item.name);
                        } else {
                            resultDirs = ["Thư mục không tồn tại!"];
                        }
                        
                        await updateDoc(doc(db, 'system_requests', docId), {
                            status: 'completed',
                            result: resultDirs
                        });
                        console.log(`=> Đã trả về kết quả thư mục.`);
                    } catch (err) {
                        console.log("Lỗi đọc thư mục:", err.message);
                        await updateDoc(doc(db, 'system_requests', docId), {
                            status: 'error',
                            result: err.message
                        });
                    }
                }
                else if (data.action === 'READ_FILES' && data.path) {
                    console.log(`\n=> Web yêu cầu đọc Context mã nguồn: ${data.path}`);
                    try {
                        const contextString = readProjectContext(data.path);
                        await updateDoc(doc(db, 'system_requests', docId), {
                            status: 'completed',
                            result: contextString
                        });
                        console.log(`=> Đã trả về Context mã nguồn thành công.`);
                    } catch (err) {
                        console.log("Lỗi đọc Context:", err.message);
                        await updateDoc(doc(db, 'system_requests', docId), {
                            status: 'error',
                            result: err.message
                        });
                    }
                }
                else if (data.action === 'IDE_KEYSTROKE' && data.path && data.keys) {
                    console.log(`\n=> Web yêu cầu gõ phím từ xa: ${data.keys}`);
                    try {
                        const folderName = path.basename(data.path);
                        const windowTitlePrefix = `${folderName} - Antigravity`;
                        const psScriptContent = `
Add-Type -AssemblyName System.Windows.Forms
$wshell = New-Object -ComObject wscript.shell
$wshell.AppActivate("${windowTitlePrefix}")
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("${data.keys}")
`;
                        const psScriptPath = path.join(__dirname, `ghost_key_${Date.now()}.ps1`);
                        fs.writeFileSync(psScriptPath, psScriptContent);
                        const { exec } = require('child_process');
                        exec(`powershell.exe -ExecutionPolicy Bypass -File "${psScriptPath}"`, async (error) => {
                            if (!error) fs.unlinkSync(psScriptPath);
                            
                            let reportResult = "Đã gửi phím thành công.";
                            if (data.keys === '^{ENTER}' && data.taskId) {
                                console.log("=> Đang đọc báo cáo synapse_result.txt...");
                                await new Promise(r => setTimeout(r, 3000));
                                const reportPath = path.join(data.path, 'synapse_result.txt');
                                if (fs.existsSync(reportPath)) {
                                    reportResult = fs.readFileSync(reportPath, 'utf8');
                                    await updateDoc(doc(db, 'tasks', data.taskId), {
                                        resultReport: reportResult,
                                        status: 'completed',
                                        completed_at: new Date().toISOString()
                                    });
                                    console.log("=> Đã thu hoạch xong Báo cáo!");
                                } else {
                                    reportResult = "Không tìm thấy file synapse_result.txt do IDE tạo ra.";
                                    await updateDoc(doc(db, 'tasks', data.taskId), {
                                        status: 'completed',
                                        completed_at: new Date().toISOString()
                                    });
                                }
                            }
                            
                            await updateDoc(doc(db, 'system_requests', docId), {
                                status: 'completed',
                                result: reportResult
                            });
                        });
                    } catch (err) {
                        console.log("Lỗi gõ phím:", err.message);
                        await updateDoc(doc(db, 'system_requests', docId), { status: 'error', result: err.message });
                    }
                }
                else if (data.action === 'RUN_COMMAND' && data.path && data.command) {
                    console.log(`\n=> Web yêu cầu chạy lệnh Terminal: ${data.command}`);
                    try {
                        const { exec } = require('child_process');
                        exec(data.command, { cwd: data.path }, async (error, stdout, stderr) => {
                            const output = stdout || stderr || (error ? error.message : "Done.");
                            console.log("=> Kết quả Terminal:", output.substring(0, 100).trim() + "...");
                            await updateDoc(doc(db, 'system_requests', docId), {
                                status: 'completed',
                                result: output
                            });
                        });
                    } catch (err) {
                        console.log("Lỗi Terminal:", err.message);
                        await updateDoc(doc(db, 'system_requests', docId), { status: 'error', result: err.message });
                    }
                }
            }
        });
    });
}

startListening();

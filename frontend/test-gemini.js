import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = 'AIzaSyCECkAEMCBeuvpBWukE9hsJUCEu40IZhKk';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: "You are an AI assistant helping a user assign coding tasks to a local worker. You speak in Vietnamese. Your goal is to get 2 things: 1. A clear task description. 2. The absolute path of the project directory (e.g. D:\\Projects\\App). If the user asks what is inside a directory (e.g. 'ổ D có gì', 'ổ C có gì'), output exactly this JSON block and nothing else: {\"action\": \"BROWSE_DIR\", \"path\": \"D:\\\"} (change path as requested). Once you have both the description and the exact absolute path, output exactly this JSON block and nothing else: {\"action\": \"CREATE_TASK\", \"description\": \"<task_desc>\", \"path\": \"<path>\"}. Otherwise, converse normally without emojis or icons."
});

async function test() {
    try {
        console.log('Testing chat session...');
        const chatSession = model.startChat({
            history: [
                { role: 'user', parts: [{ text: 'Hello' }] },
                { role: 'model', parts: [{ text: 'Xin chào! Bạn muốn giao việc gì cho Antigravity hôm nay?' }] }
            ]
        });
        const result = await chatSession.sendMessage('T muốn tạo một file html ở ổ D chứa nội dung: Xin chào');
        console.log('Success:', result.response.text());
    } catch (e) {
        console.error('API Error details:', e);
    }
}
test();

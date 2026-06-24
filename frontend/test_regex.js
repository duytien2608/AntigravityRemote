const text1 = '{"action": "CREATE_TASK", "description": "Làm file \\"index.js\\"", "path": "D:\\\\test"}';
const text2 = '{"action": "CREATE_TASK", "description": "Làm file \\"index.js\\"", "path": "D:\\test"}';

function testRegex(jsonMatch) {
    let actionObj = null;
    try {
        let jsonString = jsonMatch;
        jsonString = jsonString.replace(/\\([^"\\/bfnrt])/g, '\\\\$1');
        jsonString = jsonString.replace(/\\([tnrfb])/g, '\\\\$1');
        actionObj = JSON.parse(jsonString);
        console.log("Success 1:", actionObj);
    } catch (err) {
        console.log("Error 1:", err.message);
        try {
            actionObj = JSON.parse(jsonMatch.replace(/\\/g, '/'));
            console.log("Success 2:", actionObj);
        } catch(e) {
            console.log("Error 2:", e.message);
        }
    }
}

console.log("Testing text1 (Properly escaped):");
testRegex(text1);

console.log("\\nTesting text2 (Unescaped backslash):");
testRegex(text2);

const apiKey = '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';

async function test() {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const data = await response.json();
        const models = data.data.map(m => m.id);
        console.log('Available models:', models);
    } catch (e) {
        console.error('Error fetching models:', e);
    }
}
test();

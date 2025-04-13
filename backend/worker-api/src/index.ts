// backend/worker-api/src/index.ts (TypeScript 示例)

export interface Env {
    // 定义环境变量 (API Keys from Secrets)
    GEMINI_API_KEY: string;
    DEEPSEEK_API_KEY: string;
    // 未来模型的 Key (可选，先定义好)
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    GROK_API_KEY?: string;
}

// 定义模型配置接口
interface ModelConfig {
    apiEndpoint: string;
    apiKeyEnvVar: keyof Env; // 引用 Env 接口中的 Key 名称
    actualModelName: string; // API 请求中使用的模型名称
}

// 模型配置映射表
// 使用前端发送的 ID (如 'gemini-2.5') 作为 key
const modelRegistry: Record<string, ModelConfig> = {
    // --- Gemini (通过代理) ---
    'gemini-2.5': {
        apiEndpoint: 'https://gemini.231030.xyz/v1/chat/completions',
        apiKeyEnvVar: 'AIzaSyCG6NuXKy4Ohnourapu5BRQRoB5JFhDCOM',
        actualModelName: 'gemini-2.5-pro-exp-03-25',
    },
    'gemini-2.0': {
        apiEndpoint: 'https://gemini.231030.xyz/v1/chat/completions',
        apiKeyEnvVar: 'AIzaSyCG6NuXKy4Ohnourapu5BRQRoB5JFhDCOM',
        actualModelName: 'gemini-2.0-flash',
    },
    // --- DeepSeek ---
    'deepseek-r1': {
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiKeyEnvVar: 'sk-b75387d0b6d84e29ac84ba876709f1f5',
        actualModelName: 'deepseek-reasoner',
    },
    'deepseek-v3': {
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiKeyEnvVar: 'sk-b75387d0b6d84e29ac84ba876709f1f5',
        actualModelName: 'deepseek-chat',
    },
    // --- 未来模型占位 ---
    'chatgpt-4': { // 示例 ID
        apiEndpoint: 'https://api.openai.com/v1/chat/completions', // 待确认
        apiKeyEnvVar: 'OPENAI_API_KEY',
        actualModelName: 'gpt-4', // 待确认
    },
     'claude-3': { // 示例 ID
         apiEndpoint: 'ANTHROPIC_ENDPOINT_HERE', // 待确认
         apiKeyEnvVar: 'ANTHROPIC_API_KEY',
         actualModelName: 'claude-3-opus-20240229', // 待确认
     },
     'grok-1': { // 示例 ID
        apiEndpoint: 'GROK_ENDPOINT_HERE', // 待确认
        apiKeyEnvVar: 'GROK_API_KEY',
        actualModelName: 'grok-1', // 待确认
    },
};

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // 处理 CORS 预检请求
        if (request.method === 'OPTIONS') {
            return handleOptions(request);
        }
        // 只允许 POST
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
        }

        try {
            // 解析请求体，获取用户消息和选择的模型 ID
            const body = await request.json<{ message: string; modelId: string }>();
            const userMessage = body.message;
            const selectedModelId = body.modelId;

            // 从注册表中查找模型配置
            const config = modelRegistry[selectedModelId];

            if (!config) {
                return new Response(JSON.stringify({ error: 'Selected model not configured' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

            // 获取 API Key (检查是否存在)
            const apiKey = env[config.apiKeyEnvVar];
            if (!apiKey) {
                 console.error(`API Key for ${config.apiKeyEnvVar} not found in environment.`);
                 return new Response(JSON.stringify({ error: `API Key for model ${selectedModelId} is missing on the server.` }), {
                     status: 500, // 或者 400，表明服务器配置问题
                     headers: { 'Content-Type': 'application/json', ...corsHeaders },
                 });
             }

             // --- 调用目标 AI API ---
             // 因为 Gemini 代理和 DeepSeek 都兼容 OpenAI 格式，所以调用结构类似
             const apiUrl = config.apiEndpoint;
             const requestBody = {
                 model: config.actualModelName,
                 messages: [{ role: 'user', content: userMessage }],
                 // stream: false, // 如果需要流式响应，改为 true 并处理
                 // 其他参数如 temperature, max_tokens 等可按需添加
             };

             const apiResponse = await fetch(apiUrl, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${apiKey}`,
                     // Anthropic 可能需要不同的头信息，如 'x-api-key'，未来添加时需适配
                 },
                 body: JSON.stringify(requestBody),
             });

             if (!apiResponse.ok) {
                 const errorData = await apiResponse.text(); // 获取文本以防 JSON 解析失败
                 console.error(`API call to ${apiUrl} failed with status ${apiResponse.status}:`, errorData);
                 throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}. ${errorData.substring(0, 100)}`); // 包含部分错误信息
             }

             const data = await apiResponse.json();

             // 提取回复 (兼容 OpenAI 格式)
             const aiReply = data.choices?.[0]?.message?.content?.trim() ?? '抱歉，无法获取有效回复。';

             // 返回成功响应
             return new Response(JSON.stringify({ reply: aiReply }), {
                 headers: {
                     'Content-Type': 'application/json',
                     ...corsHeaders, // 添加 CORS 头
                 },
             });

        } catch (error: any) {
            console.error('Error processing request:', error);
            // 避免在生产环境中暴露过多错误细节给前端
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            return new Response(JSON.stringify({ error: `Server error: ${errorMessage}` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }, // 错误响应也要加 CORS
            });
        }
    },
};

// --- CORS 处理辅助函数 (与之前相同) ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // 生产环境建议改为你的前端域名: e.g., 'https://ai.yourdomain.com'
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', // 如果前端发送了 Authorization 头，需要允许
};

function handleOptions(request: Request) {
     if (request.headers.get('Origin') !== null &&
         request.headers.get('Access-Control-Request-Method') !== null &&
         request.headers.get('Access-Control-Request-Headers') !== null) {
         return new Response(null, { headers: corsHeaders });
     } else {
         return new Response(null, { headers: { 'Allow': 'POST, OPTIONS' } });
     }
 }
// frontend/src/App.tsx (更新版)
import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// 定义消息类型
interface Message {
    sender: 'user' | 'ai';
    text: string;
}

// 定义模型信息接口
interface AIModel {
    id: string; // 发送给后端的唯一标识符
    name: string; // 显示给用户的名称
    provider: string; // 用于分组
}

// 可用的 AI 模型列表
const availableModels: AIModel[] = [
    { id: 'gemini-2.5', name: 'Gemini 2.5 Pro', provider: 'Gemini' },
    { id: 'gemini-2.0', name: 'Gemini 2.0', provider: 'Gemini' },
    { id: 'deepseek-r1', name: 'Deepseek R1', provider: 'DeepSeek' },
    { id: 'deepseek-v3', name: 'Deepseek V3', provider: 'DeepSeek' },
    // --- 未来模型占位 ---
    // { id: 'chatgpt-4', name: 'ChatGPT 4', provider: 'OpenAI' },
    // { id: 'claude-3', name: 'Claude 3 Opus', provider: 'Anthropic' },
    // { id: 'grok-1', name: 'Grok 1', provider: 'Grok' },
];

// 后端 Worker 的 URL (建议使用相对路径，并配置 Pages 代理)
const WORKER_URL = '/api/chat'; // 假设 Cloudflare Pages 配置了 /api/* 代理到 Worker

function App() {
    const [inputValue, setInputValue] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    // 默认选择第一个模型
    const [selectedModelId, setSelectedModelId] = useState<string>(availableModels[0]?.id || '');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
    };

    const handleSendMessage = async () => {
        const trimmedInput = inputValue.trim();
        if (!trimmedInput || isLoading || !selectedModelId) return;

        setMessages(prev => [...prev, { sender: 'user', text: trimmedInput }]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmedInput,
                    modelId: selectedModelId, // 发送选择的模型 ID
                }),
            });

            // 更详细的错误处理
            if (!response.ok) {
                 let errorMsg = `API request failed with status ${response.status}`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg; // 优先使用后端返回的错误信息
                 } catch (e) { /* 忽略 JSON 解析错误 */ }
                 throw new Error(errorMsg);
             }


            const data = await response.json();

            if (data.reply) {
                setMessages(prev => [...prev, { sender: 'ai', text: data.reply }]);
            } else if (data.error) {
                 setMessages(prev => [...prev, { sender: 'ai', text: `错误: ${data.error}` }]);
            } else {
                setMessages(prev => [...prev, { sender: 'ai', text: '收到空回复。' }]);
            }

        } catch (error: any) {
            console.error('Error sending message:', error);
            const errorMessage = error instanceof Error ? error.message : '发生未知错误';
            setMessages(prev => [...prev, { sender: 'ai', text: `请求失败: ${errorMessage}` }]);
        } finally {
            setIsLoading(false);
        }
    };

     const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    // 按 Provider 分组模型 (用于下拉列表分组)
    const groupedModels = availableModels.reduce((acc, model) => {
        (acc[model.provider] = acc[model.provider] || []).push(model);
        return acc;
    }, {} as Record<string, AIModel[]>);


    return (
        <div className="chat-container">
            {/* AI 模型选择器 (使用 optgroup 分组) */}
            <div className="model-selector">
                <label htmlFor="model-select">选择 AI 模型: </label>
                <select
                    id="model-select"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    disabled={isLoading}
                >
                    {Object.entries(groupedModels).map(([provider, models]) => (
                        <optgroup label={provider} key={provider}>
                            {models.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.name}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                    {/* 未来模型的占位分组 (如果需要明确显示) */}
                    {/* <optgroup label="待开发">
                         <option disabled>ChatGPT</option>
                         <option disabled>Claude</option>
                         <option disabled>Grok</option>
                     </optgroup> */}
                </select>
            </div>

            {/* 消息显示区域 (与之前相同) */}
            <div className="messages-area">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender}`}>
                        {/* 简单的 Markdown 换行处理 */}
                        {msg.text.split('\n').map((line, i) => <p key={i} style={{ margin: 0 }}>{line || '\u00A0'}</p>)}
                    </div>
                ))}
                {isLoading && <div className="message ai"><p><i>思考中...</i></p></div>}
                <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 (与之前相同) */}
            <div className="input-area">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息..."
                    disabled={isLoading}
                />
                <button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim() || !selectedModelId}>
                    {isLoading ? '发送中...' : '发送'}
                </button>
            </div>
        </div>
    );
}

export default App;
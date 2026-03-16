/**
 * OpenAI API Service
 * @module services/api/openai
 */

import { API_KEY_STORAGE, OPENAI_CONFIG } from '../../core/constants.js';

/**
 * Gets the stored API key
 * @returns {string|null}
 */
export function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE);
}

/**
 * Saves the API key
 * @param {string} key - API key
 */
export function saveApiKey(key) {
    localStorage.setItem(API_KEY_STORAGE, key);
}

/**
 * Clears the API key
 */
export function clearApiKey() {
    localStorage.removeItem(API_KEY_STORAGE);
}

/**
 * Checks if API key is configured
 * @returns {boolean}
 */
export function hasApiKey() {
    return !!getApiKey();
}

/**
 * Makes a chat completion request to OpenAI
 * @param {Array} messages - Chat messages
 * @param {object} options - Additional options
 * @returns {Promise<object>} API response
 */
export async function chatCompletion(messages, options = {}) {
    const apiKey = getApiKey();
    
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: options.model || OPENAI_CONFIG.model,
            messages,
            max_tokens: options.maxTokens || OPENAI_CONFIG.maxTokens,
            temperature: options.temperature ?? OPENAI_CONFIG.temperature,
            ...options
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Makes a streaming chat completion request
 * @param {Array} messages - Chat messages
 * @param {Function} onChunk - Callback for each chunk
 * @param {object} options - Additional options
 * @returns {Promise<string>} Complete response
 */
export async function streamChatCompletion(messages, onChunk, options = {}) {
    const apiKey = getApiKey();
    
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: options.model || OPENAI_CONFIG.model,
            messages,
            max_tokens: options.maxTokens || OPENAI_CONFIG.maxTokens,
            temperature: options.temperature ?? OPENAI_CONFIG.temperature,
            stream: true,
            ...options
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices[0]?.delta?.content || '';
                    if (content) {
                        fullContent += content;
                        onChunk(content);
                    }
                } catch (e) {
                    // Ignore parse errors for incomplete JSON
                }
            }
        }
    }

    return fullContent;
}

/**
 * Makes a request with tool calling
 * @param {Array} messages - Chat messages
 * @param {Array} tools - Tool definitions
 * @param {object} options - Additional options
 * @returns {Promise<object>} API response with tool calls
 */
export async function chatWithTools(messages, tools, options = {}) {
    const apiKey = getApiKey();
    
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: options.model || 'gpt-5.4',
            messages,
            tools,
            tool_choice: options.toolChoice || 'auto',
            max_tokens: options.maxTokens || 2000,
            temperature: options.temperature ?? 0.7
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    return response.json();
}

// Export for legacy compatibility
if (typeof window !== 'undefined') {
    window.getApiKey = getApiKey;
    window.saveApiKey = saveApiKey;
    window.hasApiKey = hasApiKey;
}


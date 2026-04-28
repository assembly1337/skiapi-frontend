/**
 * AI Assistant Tool Definitions & Executors
 * Each tool maps to a real API call the assistant can invoke on behalf of the user.
 */
import { API } from '../../api';
import { extractList, renderQuota, safeArray } from '../../utils';

// ─── Tool Definitions (OpenAI function-calling schema) ───────────────────────
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_user_info',
      description: 'Get current user profile: balance, used quota, request count, group, role, username, display name.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_balance',
      description: 'Get current user remaining balance/quota and used quota in readable format.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_remaining_usage',
      description: 'Calculate how many tokens or requests the user can still make with their remaining balance for a specific model. Needs model name.',
      parameters: {
        type: 'object',
        properties: {
          model_name: { type: 'string', description: 'The model name to calculate usage for, e.g. gpt-4o, claude-sonnet-4-20250514' },
        },
        required: ['model_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pricing',
      description: 'Get model pricing list. Can filter by model name keyword or vendor name. Returns input/output price per million tokens.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Optional keyword to filter model names' },
          vendor: { type: 'string', description: 'Optional vendor name filter (OpenAI, Claude, Gemini, DeepSeek, etc.)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tokens',
      description: 'List user API tokens/keys with their status, quota, and usage.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_token',
      description: 'Create a new API token/key for the user. Requires local browser confirmation before execution. Raw keys are copied locally only and are never returned to the model.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Token name' },
          remain_quota: { type: 'number', description: 'Quota limit (default 500000 = $1). Set -1 or very high for unlimited.' },
          unlimited_quota: { type: 'boolean', description: 'Whether this token has unlimited quota' },
          models: { type: 'string', description: 'Comma-separated list of allowed models, empty = all models' },
          group: { type: 'string', description: 'Token group, empty = default' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_token',
      description: 'Delete an existing API token by its ID. Requires local browser confirmation before execution.',
      parameters: {
        type: 'object',
        properties: {
          token_id: { type: 'number', description: 'The token ID to delete' },
        },
        required: ['token_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_usage_logs',
      description: 'Get recent API usage logs for the user. Shows model, tokens used, quota consumed, time.',
      parameters: {
        type: 'object',
        properties: {
          page_size: { type: 'number', description: 'Number of logs to return (default 10, max 50)' },
          model_name: { type: 'string', description: 'Filter by model name' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_models',
      description: 'Get list of all available AI models on this platform, with vendor information.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Optional keyword to filter model names' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'redeem_code',
      description: 'Redeem a top-up code to add balance/quota to user account. Requires local browser confirmation before execution.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The redemption code' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_to_page',
      description: 'Navigate the user to a specific page in the console. Use this when user wants to go somewhere or when they need to perform an action that requires a specific page.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: ['dashboard', 'token', 'log', 'topup', 'pricing', 'playground', 'personal', 'channel', 'settings'],
            description: 'The page to navigate to',
          },
        },
        required: ['page'],
      },
    },
  },
];

// ─── Page route map ──────────────────────────────────────────────────────────
const PAGE_ROUTES = {
  dashboard: '/console',
  token: '/console/token',
  log: '/console/log',
  topup: '/console/topup',
  pricing: '/pricing',
  playground: '/console/playground',
  personal: '/console/personal',
  channel: '/console/channel',
  settings: '/console/setting',
};

// ─── Secret redaction / local confirmation helpers ──────────────────────────
const API_KEY_RE = /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{8,}\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi;
const SECRET_FIELD_RE = /^(key|api_key|apiKey|secret|client_secret|clientSecret|access_token|accessToken|refresh_token|refreshToken|password|code)$/i;
const JSON_SECRET_FIELD_RE = /("(?:key|api_key|apiKey|secret|client_secret|clientSecret|access_token|accessToken|refresh_token|refreshToken|password|code)"\s*:\s*")[^"]+(")/gi;
const LABELLED_SECRET_RE = /\b(api[_-]?key|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*["']?[^"'\s,;)}]+/gi;
const LABELLED_SECRET_WITH_CODE_RE = /\b(api[_-]?key|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|code)\s*[:=]\s*["']?[^"'\s,;)}]+/gi;

export function redactSecretsFromText(value, { includeCodeLabels = false } = {}) {
  if (typeof value !== 'string') return value;
  const labelled = includeCodeLabels ? LABELLED_SECRET_WITH_CODE_RE : LABELLED_SECRET_RE;
  return value
    .replace(API_KEY_RE, '[REDACTED_API_KEY]')
    .replace(BEARER_RE, 'Bearer [REDACTED_SECRET]')
    .replace(JSON_SECRET_FIELD_RE, '$1[REDACTED_SECRET]$2')
    .replace(labelled, (match, label) => `${label}: [REDACTED_SECRET]`);
}

function sanitizeToolArguments(args) {
  try {
    return JSON.stringify(redactSecretsDeep(JSON.parse(args)));
  } catch {
    return redactSecretsFromText(args, { includeCodeLabels: true });
  }
}

function redactSecretsDeep(value) {
  if (typeof value === 'string') return redactSecretsFromText(value, { includeCodeLabels: true });
  if (Array.isArray(value)) return value.map(redactSecretsDeep);
  if (!value || typeof value !== 'object') return value;

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith('_')) continue;
    if (SECRET_FIELD_RE.test(key)) {
      out[key] = item ? '[REDACTED_SECRET]' : item;
    } else if (key === 'arguments' && typeof item === 'string') {
      out[key] = sanitizeToolArguments(item);
    } else {
      out[key] = redactSecretsDeep(item);
    }
  }
  return out;
}

export function sanitizeToolResultForLLM(result) {
  return redactSecretsDeep(result || {});
}

export function sanitizeMessagesForLLM(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages.map(message => {
    if (!message || typeof message !== 'object') return message;
    if (message.role === 'user') {
      return { ...message, content: redactSecretsFromText(message.content) };
    }
    return redactSecretsDeep(message);
  });
}

function displayValue(value, fallback = '-') {
  const text = String(value ?? fallback).replace(/\s+/g, ' ').trim() || fallback;
  return redactSecretsFromText(text, { includeCodeLabels: true }).slice(0, 120);
}

export function getToolConfirmation(name, args = {}) {
  switch (name) {
    case 'create_token':
      return {
        title: '确认创建 API 密钥',
        message: [
          'AI 助手请求创建新的 API key。',
          `名称: ${displayValue(args.name, '(未命名)')}`,
          `额度: ${args.unlimited_quota ? 'unlimited' : displayValue(args.remain_quota ?? 500000)}`,
          `模型: ${args.models ? displayValue(args.models) : 'all'}`,
          `分组: ${args.group ? displayValue(args.group) : 'default'}`,
          '确认后才会调用后端；生成的 raw key 只会在本地复制/展示，不会发送给模型。',
        ].join('\n'),
      };
    case 'delete_token':
      return {
        title: '确认删除 API 密钥',
        message: [
          'AI 助手请求删除一个 API token。',
          `Token ID: ${displayValue(args.token_id)}`,
          '这是不可逆的修改操作。确认后才会调用后端。',
        ].join('\n'),
      };
    case 'redeem_code':
      return {
        title: '确认兑换充值码',
        message: [
          'AI 助手请求兑换充值码并修改账户余额。',
          `兑换码: 已提供${args.code ? ` (${String(args.code).length} chars)` : ''}`,
          '确认后才会调用后端；兑换码不会出现在返回给模型的 tool result 中。',
        ].join('\n'),
      };
    default:
      return null;
  }
}

function normalizeApiKey(key) {
  if (!key) return '';
  const text = String(key);
  return text.startsWith('sk-') ? text : `sk-${text}`;
}

function withLocalAction(result, action) {
  if (!action) return result;
  Object.defineProperty(result, '_action', {
    value: action,
    enumerable: false,
    configurable: true,
  });
  return result;
}

// ─── Tool Executors ──────────────────────────────────────────────────────────

async function get_user_info() {
  const res = await API.get('/api/user/self');
  if (!res.data.success) throw new Error(res.data.message || 'Failed');
  const u = res.data.data;
  return {
    username: u.username,
    display_name: u.display_name,
    role: u.role >= 100 ? 'root_admin' : u.role >= 10 ? 'admin' : 'user',
    group: u.group || 'default',
    balance: renderQuota(u.quota || 0),
    balance_raw: u.quota || 0,
    used_quota: renderQuota(u.used_quota || 0),
    used_quota_raw: u.used_quota || 0,
    request_count: u.request_count || 0,
    email: u.email || '',
  };
}

async function get_balance() {
  const res = await API.get('/api/user/self');
  if (!res.data.success) throw new Error(res.data.message || 'Failed');
  const u = res.data.data;
  return {
    balance: renderQuota(u.quota || 0),
    balance_raw: u.quota || 0,
    used: renderQuota(u.used_quota || 0),
    used_raw: u.used_quota || 0,
    request_count: u.request_count || 0,
  };
}

async function calculate_remaining_usage({ model_name }) {
  // Get user balance
  const userRes = await API.get('/api/user/self');
  if (!userRes.data.success) throw new Error('Cannot get user info');
  const balance = userRes.data.data.quota || 0;

  // Get pricing info
  const pricingRes = await API.get('/api/pricing');
  const models = safeArray(pricingRes.data?.data);
  const model = models.find(m => m.model_name?.toLowerCase() === model_name.toLowerCase());

  if (!model) {
    // Fuzzy match
    const fuzzy = models.filter(m => m.model_name?.toLowerCase().includes(model_name.toLowerCase()));
    if (fuzzy.length === 0) return { error: `Model "${model_name}" not found. Use get_available_models to see available models.` };
    if (fuzzy.length > 5) return { error: `Multiple matches found. Please be more specific. First 5: ${fuzzy.slice(0, 5).map(m => m.model_name).join(', ')}` };
    // Return calculation for all fuzzy matches
    return {
      balance: renderQuota(balance),
      matches: fuzzy.map(m => {
        const quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit') || '500000');
        const inputCostPerMToken = m.model_price > 0 ? (m.model_price * 2 / quotaPerUnit) : (m.model_ratio * 0.002);
        const outputCostPerMToken = inputCostPerMToken * m.completion_ratio;
        // Assume average 500 input + 500 output tokens per request
        const costPerRequest = (500 * inputCostPerMToken + 500 * outputCostPerMToken) / 1_000_000 * quotaPerUnit;
        const remainingRequests = costPerRequest > 0 ? Math.floor(balance / costPerRequest) : Infinity;
        return {
          model: m.model_name,
          input_price: `$${inputCostPerMToken.toFixed(4)}/M tokens`,
          output_price: `$${(inputCostPerMToken * m.completion_ratio).toFixed(4)}/M tokens`,
          estimated_requests_remaining: remainingRequests,
          note: 'Estimate based on ~500 input + 500 output tokens per request',
        };
      }),
    };
  }

  const quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit') || '500000');
  const inputCostPerMToken = model.model_price > 0 ? (model.model_price * 2 / quotaPerUnit) : (model.model_ratio * 0.002);
  const outputCostPerMToken = inputCostPerMToken * model.completion_ratio;
  const avgCostPerRequest = (500 * inputCostPerMToken + 500 * outputCostPerMToken) / 1_000_000 * quotaPerUnit;
  const remainingRequests = avgCostPerRequest > 0 ? Math.floor(balance / avgCostPerRequest) : Infinity;
  const remainingMTokens = inputCostPerMToken > 0 ? (balance / quotaPerUnit / inputCostPerMToken) : Infinity;

  return {
    model: model.model_name,
    balance: renderQuota(balance),
    input_price: `$${inputCostPerMToken.toFixed(4)}/M tokens`,
    output_price: `$${outputCostPerMToken.toFixed(4)}/M tokens`,
    estimated_remaining_requests: remainingRequests,
    estimated_remaining_input_mtokens: remainingMTokens.toFixed(1),
    billing_type: model.quota_type === 0 ? 'per_token' : 'per_request',
    note: 'Requests estimate assumes ~500 input + 500 output tokens each',
  };
}

async function get_pricing({ search, vendor } = {}) {
  const res = await API.get('/api/pricing');
  if (res.data.success === false) throw new Error('Failed to load pricing');
  const models = safeArray(res.data?.data);
  const vendors = safeArray(res.data?.vendors);
  const quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit') || '500000');

  let filtered = models;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(m => m.model_name?.toLowerCase().includes(q));
  }
  if (vendor) {
    const vq = vendor.toLowerCase();
    const matchedVendorIds = vendors.filter(v => v.name?.toLowerCase().includes(vq)).map(v => v.id);
    filtered = filtered.filter(m => matchedVendorIds.includes(m.vendor_id));
  }

  const result = filtered.slice(0, 20).map(m => {
    const v = vendors.find(vv => vv.id === m.vendor_id);
    const inputPrice = m.model_price > 0 ? (m.model_price * 2 / quotaPerUnit) : (m.model_ratio * 0.002);
    const outputPrice = inputPrice * m.completion_ratio;
    return {
      model: m.model_name,
      vendor: v?.name || 'Unknown',
      input_price_per_m: `$${inputPrice.toFixed(4)}`,
      output_price_per_m: `$${outputPrice.toFixed(4)}`,
      billing: m.quota_type === 0 ? 'per_token' : 'per_request',
    };
  });

  return { total: filtered.length, showing: result.length, models: result };
}

async function list_tokens() {
  const res = await API.get('/api/token/?p=0&page_size=50');
  if (!res.data.success) throw new Error(res.data.message || 'Failed');
  const { items } = extractList(res.data);
  return items.map(t => ({
    id: t.id,
    name: t.name,
    status: t.status === 1 ? 'active' : 'disabled',
    used_quota: renderQuota(t.used_quota || 0),
    remain_quota: t.unlimited_quota ? 'unlimited' : renderQuota(t.remain_quota || 0),
    group: t.group || 'default',
    created: t.created_time ? new Date(t.created_time * 1000).toLocaleDateString() : '',
    expired: t.expired_time === -1 ? 'never' : (t.expired_time ? new Date(t.expired_time * 1000).toLocaleDateString() : ''),
  }));
}

async function create_token({ name, remain_quota = 500000, unlimited_quota = false, models = '', group = '' }) {
  const body = { name, remain_quota, unlimited_quota, expired_time: -1 };
  if (models) body.models = models;
  if (group) body.group = group;
  const res = await API.post('/api/token/', body);
  if (!res.data.success) throw new Error(res.data.message || 'Failed to create token');
  // v0.12.6+: POST no longer returns the key. Look up the new token by name and fetch its key.
  let tokenId = null;
  let key = typeof res.data.data === 'string' ? normalizeApiKey(res.data.data) : '';
  if (res.data.data && typeof res.data.data === 'object') {
    tokenId = res.data.data.id || res.data.data.token_id || null;
    key = normalizeApiKey(res.data.data.key || '');
  }
  if (!key) {
    try {
      const listRes = await API.get('/api/token/?p=1&page_size=50');
      const { items } = extractList(listRes.data);
      const created = items
        .filter(t => t.name === name)
        .sort((a, b) => (b.created_time || b.id || 0) - (a.created_time || a.id || 0))[0];
      if (created) {
        tokenId = created.id || tokenId;
        const keyRes = await API.post(`/api/token/${created.id}/key`);
        if (keyRes.data?.success && keyRes.data.data?.key) {
          key = normalizeApiKey(keyRes.data.data.key);
        }
      }
    } catch { /* ignore */ }
  }
  const result = {
    success: true,
    token_id: tokenId,
    key_revealed_to_user: !!key,
    message: key
      ? 'Token created. Raw key copied/displayed locally and withheld from the assistant.'
      : 'Token created. Retrieve or copy the key from the token list.',
  };
  return withLocalAction(result, key ? { type: 'copy', value: key, label: 'Copy API Key' } : null);
}

async function delete_token({ token_id }) {
  const res = await API.delete(`/api/token/${token_id}`);
  if (!res.data.success) throw new Error(res.data.message || 'Failed to delete token');
  return { success: true, message: `Token #${token_id} deleted.` };
}

async function get_usage_logs({ page_size = 10, model_name } = {}) {
  const size = Math.min(page_size || 10, 50);
  let url = `/api/log/self?p=0&page_size=${size}`;
  if (model_name) url += `&model_name=${encodeURIComponent(model_name)}`;
  const res = await API.get(url);
  if (!res.data.success) throw new Error(res.data.message || 'Failed');
  const { items } = extractList(res.data);
  return items.map(l => ({
    time: l.created_at ? new Date(l.created_at * 1000).toLocaleString() : '',
    model: l.model_name || '-',
    input_tokens: l.prompt_tokens || 0,
    output_tokens: l.completion_tokens || 0,
    quota: renderQuota(l.quota || 0),
    duration: l.use_time ? `${l.use_time}ms` : '-',
    type: l.type === 2 ? 'usage' : l.type === 5 ? 'error' : l.type === 1 ? 'topup' : 'other',
  }));
}

async function get_available_models({ search } = {}) {
  const res = await API.get('/api/pricing');
  const models = safeArray(res.data?.data);
  const vendors = safeArray(res.data?.vendors);
  let filtered = models;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(m => m.model_name?.toLowerCase().includes(q));
  }
  const vendorGroups = {};
  filtered.forEach(m => {
    const v = vendors.find(vv => vv.id === m.vendor_id);
    const name = v?.name || 'Unknown';
    if (!vendorGroups[name]) vendorGroups[name] = [];
    vendorGroups[name].push(m.model_name);
  });
  return {
    total: filtered.length,
    by_vendor: Object.entries(vendorGroups).map(([vendor, models]) => ({
      vendor,
      count: models.length,
      models: models.slice(0, 15),
      more: models.length > 15 ? models.length - 15 : 0,
    })),
  };
}

async function redeem_code({ code }) {
  const res = await API.post('/api/user/topup', { key: code });
  if (!res.data.success) throw new Error(res.data.message || 'Redemption failed');
  // Refresh user data
  const selfRes = await API.get('/api/user/self');
  const newBalance = selfRes.data.success ? renderQuota(selfRes.data.data.quota || 0) : 'unknown';
  return {
    success: true,
    message: 'Code redeemed successfully!',
    new_balance: newBalance,
  };
}

function navigate_to_page({ page }) {
  const path = PAGE_ROUTES[page];
  if (!path) return { error: `Unknown page: ${page}` };
  // We'll use window event to navigate
  window.dispatchEvent(new CustomEvent('skiapi-navigate', { detail: { path } }));
  return { success: true, navigated_to: page, path };
}

// ─── Executor Map ────────────────────────────────────────────────────────────
const EXECUTORS = {
  get_user_info,
  get_balance,
  calculate_remaining_usage,
  get_pricing,
  list_tokens,
  create_token,
  delete_token,
  get_usage_logs,
  get_available_models,
  redeem_code,
  navigate_to_page,
};

/**
 * Execute a tool call.
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @returns {Promise<object>} Tool result
 */
export async function executeTool(name, args) {
  const fn = EXECUTORS[name];
  if (!fn) return { error: `Unknown tool: ${name}` };
  try {
    return await fn(args || {});
  } catch (err) {
    return sanitizeToolResultForLLM({ error: err.message || 'Tool execution failed' });
  }
}

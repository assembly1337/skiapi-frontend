// ─── Channel Types ──────────────────────────────────────────────────────────
export const CHANNEL_TYPES = [
  { value: 1, label: 'OpenAI', color: '#10a37f' },
  { value: 3, label: 'Azure OpenAI', color: '#0078d4' },
  { value: 14, label: 'Anthropic Claude', color: '#d97706' },
  { value: 33, label: 'AWS Claude', color: '#ff9900' },
  { value: 24, label: 'Google Gemini', color: '#4285f4' },
  { value: 41, label: 'Vertex AI', color: '#34a853' },
  { value: 43, label: 'DeepSeek', color: '#4d6bfe' },
  { value: 48, label: 'xAI', color: '#000000' },
  { value: 4, label: 'Ollama', color: '#ffffff' },
  { value: 20, label: 'OpenRouter', color: '#6366f1' },
  { value: 42, label: 'Mistral AI', color: '#f97316' },
  { value: 40, label: 'SiliconCloud', color: '#6d28d9' },
  { value: 44, label: 'MokaAI', color: '#7c3aed' },
  { value: 17, label: '阿里通义千问', color: '#6236ff' },
  { value: 26, label: '智谱 GLM', color: '#3054e4' },
  { value: 25, label: 'Moonshot', color: '#000000' },
  { value: 34, label: 'Cohere', color: '#39594d' },
  { value: 8, label: '自定义渠道', color: '#6b7280' },
  { value: 2, label: 'Midjourney Proxy', color: '#5865f2' },
  { value: 5, label: 'Midjourney Proxy Plus', color: '#5865f2' },
  { value: 36, label: 'Suno API', color: '#000000' },
  { value: 15, label: '百度文心千帆', color: '#2932e1' },
  { value: 46, label: '百度文心千帆V2', color: '#2932e1' },
  { value: 18, label: '讯飞星火', color: '#0057ff' },
  { value: 27, label: 'Perplexity', color: '#20808d' },
  { value: 11, label: 'Google PaLM2', color: '#4285f4' },
  { value: 47, label: 'Xinference', color: '#e11d48' },
  { value: 19, label: '360 智脑', color: '#00c850' },
  { value: 23, label: '腾讯混元', color: '#006eff' },
  { value: 31, label: '零一万物', color: '#000000' },
  { value: 35, label: 'MiniMax', color: '#467cff' },
  { value: 37, label: 'Dify', color: '#1677ff' },
  { value: 38, label: 'Jina', color: '#009688' },
  { value: 39, label: 'Cloudflare', color: '#f38020' },
  { value: 45, label: '字节火山方舟', color: '#3370ff' },
  { value: 49, label: 'Coze', color: '#4a54e1' },
  { value: 50, label: '可灵', color: '#ff6900' },
  { value: 51, label: '即梦', color: '#ff4081' },
  { value: 52, label: 'Vidu', color: '#7c3aed' },
  { value: 53, label: 'SubModel', color: '#64748b' },
  { value: 54, label: '豆包视频', color: '#fe2c55' },
  { value: 55, label: 'Sora', color: '#10a37f' },
  { value: 56, label: 'Replicate', color: '#000000' },
  { value: 57, label: 'Codex (OpenAI OAuth)', color: '#10a37f' },
];

export function getChannelType(value) {
  return CHANNEL_TYPES.find(t => t.value === value);
}
export function getChannelTypeName(value) {
  return getChannelType(value)?.label || `Type ${value}`;
}

// ─── Channel Status ─────────────────────────────────────────────────────────
export const CHANNEL_STATUS = {
  1: { label: '启用', color: 'success' },
  2: { label: '禁用', color: 'error' },
  3: { label: '测试中', color: 'warning' },
};

// ─── User Roles ─────────────────────────────────────────────────────────────
export const USER_ROLES = {
  1: { label: '普通用户', color: 'default' },
  10: { label: '管理员', color: 'primary' },
  100: { label: '超级管理员', color: 'secondary' },
};

// ─── User Status ────────────────────────────────────────────────────────────
export const USER_STATUS = {
  1: { label: '正常', color: 'success' },
  2: { label: '封禁', color: 'error' },
};

// ─── OAuth Providers ────────────────────────────────────────────────────────
export const OAUTH_PROVIDERS = [
  { key: 'github', label: 'GitHub', icon: 'GitHub' },
  { key: 'discord', label: 'Discord', icon: 'Discord' },
  { key: 'oidc', label: 'OIDC', icon: 'OpenInNew' },
  { key: 'telegram', label: 'Telegram', icon: 'Telegram' },
  { key: 'linuxdo', label: 'LinuxDO', icon: 'Forum' },
  { key: 'wechat', label: '微信', icon: 'Chat' },
];

// ─── Payment Methods ────────────────────────────────────────────────────────
export const PAYMENT_METHODS = {
  alipay: { label: '支付宝', color: '#1677ff' },
  wechat: { label: '微信支付', color: '#07c160' },
  stripe: { label: 'Stripe', color: '#635bff' },
  creem: { label: 'Creem', color: '#ff6900' },
  waffo: { label: 'Waffo', color: '#f97316' },
};

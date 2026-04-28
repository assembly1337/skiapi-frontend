import { Box } from '@mui/material';

const VENDOR_MAP = {
  OpenAI: 'OpenAI',
  Anthropic: 'Claude',
  'Anthropic Claude': 'Claude',
  Claude: 'Claude',
  Google: 'Gemini',
  'Google Gemini': 'Gemini',
  Gemini: 'Gemini',
  DeepSeek: 'DeepSeek',
  Meta: 'Meta',
  Mistral: 'Mistral',
  'Mistral AI': 'Mistral',
  Cohere: 'Cohere',
  Moonshot: 'Moonshot',
  Qwen: 'Qwen',
  '阿里通义千问': 'Qwen',
  阿里巴巴: 'Qwen',
  Perplexity: 'Perplexity',
  xAI: 'Grok',
  'xAI Grok': 'Grok',
  Grok: 'Grok',
  智谱: 'Zhipu',
  '智谱 GLM': 'Zhipu',
  Ollama: 'Ollama',
  百度: 'Baidu',
  百度文心千帆: 'Baidu',
  SiliconCloud: 'SiliconCloud',
};

const ICON_FIELD_MAP = {
  Claude: 'Claude',
  'Claude.Color': 'Claude',
  OpenAI: 'OpenAI',
  'OpenAI.Color': 'OpenAI',
  Gemini: 'Gemini',
  'Gemini.Color': 'Gemini',
  DeepSeek: 'DeepSeek',
  'DeepSeek.Color': 'DeepSeek',
  Qwen: 'Qwen',
  'Qwen.Color': 'Qwen',
  XAI: 'Grok',
  'XAI.Color': 'Grok',
  Grok: 'Grok',
  'Grok.Color': 'Grok',
  Meta: 'Meta',
  'Meta.Color': 'Meta',
  Ollama: 'Ollama',
  'Ollama.Color': 'Ollama',
  Anthropic: 'Claude',
  'Anthropic.Color': 'Claude',
  Mistral: 'Mistral',
  'Mistral.Color': 'Mistral',
  Cohere: 'Cohere',
  'Cohere.Color': 'Cohere',
  Moonshot: 'Moonshot',
  'Moonshot.Color': 'Moonshot',
  Zhipu: 'Zhipu',
  'Zhipu.Color': 'Zhipu',
  Perplexity: 'Perplexity',
  'Perplexity.Color': 'Perplexity',
  Baidu: 'Baidu',
  'Baidu.Color': 'Baidu',
  SiliconCloud: 'SiliconCloud',
  'SiliconCloud.Color': 'SiliconCloud',
};

const BRAND_META = {
  OpenAI: { label: 'OA', bg: '#10A37F', fg: '#FFFFFF' },
  Claude: { label: 'C', bg: '#D97757', fg: '#111827' },
  Gemini: { label: 'G', bg: '#4285F4', fg: '#FFFFFF' },
  DeepSeek: { label: 'DS', bg: '#4D6BFE', fg: '#FFFFFF' },
  Meta: { label: 'M', bg: '#0668E1', fg: '#FFFFFF' },
  Mistral: { label: 'MI', bg: '#FFAF00', fg: '#111827' },
  Cohere: { label: 'CO', bg: '#39594D', fg: '#FFFFFF' },
  Moonshot: { label: 'K', bg: '#111827', fg: '#FFFFFF' },
  Qwen: { label: 'Q', bg: '#615CED', fg: '#FFFFFF' },
  Zhipu: { label: 'Z', bg: '#2563EB', fg: '#FFFFFF' },
  Perplexity: { label: 'P', bg: '#20B8CD', fg: '#111827' },
  Grok: { label: 'X', bg: '#0F172A', fg: '#FFFFFF' },
  Ollama: { label: 'O', bg: '#F3F4F6', fg: '#111827' },
  Baidu: { label: 'BD', bg: '#2932E1', fg: '#FFFFFF' },
  SiliconCloud: { label: 'SC', bg: '#00A971', fg: '#FFFFFF' },
};

function getInitials(name) {
  if (typeof name !== 'string' || !name.trim()) return '?';
  const normalized = name.trim();
  const asciiParts = normalized.match(/[A-Za-z0-9]+/g);
  if (asciiParts?.length) {
    return asciiParts
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }
  return Array.from(normalized).slice(0, 2).join('');
}

/**
 * Renders a compact local vendor/provider mark.
 * Keeping this dependency-free avoids pulling @lobehub/icons/@lobehub-ui/mermaid into production.
 */
export default function VendorIcon({ name, icon, size = 32 }) {
  const key = (icon && ICON_FIELD_MAP[icon]) || VENDOR_MAP[name];
  const meta = BRAND_META[key] || { label: getInitials(name || icon), bg: 'action.hover', fg: 'text.secondary' };

  return (
    <Box
      aria-label={name || icon || 'vendor'}
      sx={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: meta.bg,
        color: meta.fg,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: 0,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
        userSelect: 'none',
      }}
    >
      {meta.label}
    </Box>
  );
}

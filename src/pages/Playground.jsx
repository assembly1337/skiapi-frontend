import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Stack,
  Select, MenuItem, FormControl, InputLabel, IconButton, Chip,
  Switch, FormControlLabel, Slider, CircularProgress, Tooltip,
  Divider, Avatar, Paper, Tabs, Tab, Collapse, alpha, useTheme,
  Dialog, Autocomplete,
} from '@mui/material';
import {
  Send, Delete, ContentCopy, Person, SmartToy, Code, StopCircle,
  Tune, RestartAlt, Edit, Check, Close, Terminal, BugReport,
  Image as ImageIcon, AttachFile, Download, Upload, ZoomIn,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API } from '../api';
import { showError, showSuccess, extractList, copy } from '../utils';
import { isSafeImageUrl, isSafeUrl, safeJsonParse } from '../utils/security';
import PageHeader from '../components/common/PageHeader';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

// ─── Safe Markdown for assistant messages ───────────────────────────────────
const MdComponents = {
  p: ({ children }) => <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.8, mb: 0.8, '&:last-child': { mb: 0 } }}>{children}</Typography>,
  a: ({ href, children }) => {
    const safe = isSafeUrl(href);
    return <a href={safe ? href : undefined} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline dotted' }}>{children}</a>;
  },
  img: ({ src, alt }) => {
    if (!isSafeImageUrl(src)) return <Typography variant="caption" color="error">{i18n.t('[已屏蔽不安全的图片链接]')}</Typography>;
    return (
      <Box component="img" src={src} alt={alt || ''} onClick={() => { if (isSafeImageUrl(src)) window.open(src, '_blank', 'noopener,noreferrer'); }}
        sx={{ maxWidth: '100%', maxHeight: 300, borderRadius: 2, cursor: 'zoom-in', my: 1, display: 'block', border: '1px solid', borderColor: 'divider' }} />
    );
  },
  code: ({ inline, className, children }) => {
    if (inline) return <code style={{ background: 'rgba(127,127,127,0.12)', borderRadius: 4, padding: '2px 6px', fontSize: '0.8rem', fontFamily: 'monospace' }}>{children}</code>;
    const lang = (className || '').replace('language-', '');
    return (
      <Box sx={{ position: 'relative', my: 1 }}>
        {lang && <Chip label={lang} size="small" sx={{ position: 'absolute', top: 6, right: 6, fontSize: '0.65rem', height: 20 }} />}
        <pre style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: 14, overflow: 'auto', fontSize: '0.78rem', margin: 0, fontFamily: '"Fira Code",monospace', lineHeight: 1.6 }}>
          <code>{children}</code>
        </pre>
      </Box>
    );
  },
  ul: ({ children }) => <ul style={{ margin: '6px 0', paddingLeft: 20 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '6px 0', paddingLeft: 20 }}>{children}</ol>,
  li: ({ children }) => <li style={{ fontSize: '0.85rem', lineHeight: 1.7, marginBottom: 2 }}>{children}</li>,
  blockquote: ({ children }) => <Box sx={{ borderLeft: '3px solid', borderColor: 'primary.main', pl: 2, my: 1, opacity: 0.85, fontStyle: 'italic' }}>{children}</Box>,
  table: ({ children }) => <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', my: 1, fontSize: '0.8rem', '& td, & th': { border: '1px solid', borderColor: 'divider', p: 0.8 } }}>{children}</Box>,
  h1: ({ children }) => <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>{children}</Typography>,
  h2: ({ children }) => <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>{children}</Typography>,
  h3: ({ children }) => <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>{children}</Typography>,
  script: () => null, iframe: () => null, object: () => null, embed: () => null,
};

// ─── Settings Panel ─────────────────────────────────────────────────────────
function SettingsPanel({ config, setConfig, models, groups, apiKey, setApiKey, onReset }) {
  const { t } = useTranslation();
  const C = (key) => (_, v) => setConfig(c => ({ ...c, [key]: typeof v === 'object' ? v.target?.value ?? v : v }));
  const toggle = (key) => () => setConfig(c => ({ ...c, [key]: !c[key] }));

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Autocomplete
        size="small"
        fullWidth
        options={Array.isArray(models) ? models : []}
        value={config.model || null}
        onChange={(_, v) => v && setConfig(c => ({ ...c, model: v }))}
        autoHighlight
        openOnFocus
        selectOnFocus
        disableClearable
        filterOptions={(opts, state) => {
          const q = state.inputValue.trim().toLowerCase();
          if (!q) return opts;
          // fuzzy: every char of query appears in order
          return opts.filter(o => {
            const s = String(o).toLowerCase();
            if (s.includes(q)) return true;
            let i = 0;
            for (const ch of s) { if (ch === q[i]) i++; if (i >= q.length) return true; }
            return false;
          });
        }}
        renderOption={(props, option) => (
          <li {...props} key={option}>
            <Typography variant="body2" noWrap sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{option}</Typography>
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} label={t('模型')} placeholder={t('输入以搜索...')} />
        )}
        ListboxProps={{ sx: { maxHeight: 360, '& li': { py: 0.5 } } }}
      />

      <FormControl fullWidth size="small">
        <InputLabel>{t('分组')}</InputLabel>
        <Select value={config.group} onChange={e => setConfig(c => ({ ...c, group: e.target.value }))} label={t('分组')}>
          {(Array.isArray(groups) ? groups : []).map(g => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
        </Select>
      </FormControl>

      {/* Endpoint selector — chat completions or responses (codex) */}
      <FormControl fullWidth size="small">
        <InputLabel>{t('API 端点')}</InputLabel>
        <Select value={config.endpoint || 'chat'} onChange={e => setConfig(c => ({ ...c, endpoint: e.target.value }))} label={t('API 端点')}>
          <MenuItem value="chat">/v1/chat/completions</MenuItem>
          <MenuItem value="responses">/v1/responses</MenuItem>
        </Select>
      </FormControl>

      <TextField fullWidth label="API Key" value={apiKey} size="small" type="password"
        onChange={e => { setApiKey(e.target.value); localStorage.setItem('playground_key', e.target.value); }}
        placeholder={t('sk-xxx (自动获取或手动填入)')}
        helperText={apiKey ? 'Key: ' + apiKey.substring(0, 8) + '...' : t('未设置，将自动创建')} />

      <TextField fullWidth label={t('系统提示词')} value={config.systemPrompt} onChange={e => setConfig(c => ({ ...c, systemPrompt: e.target.value }))}
        multiline minRows={2} maxRows={5} size="small" />

      <Divider />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{t('流式输出')}</Typography>
        <Switch checked={config.stream} onChange={toggle('stream')} size="small" />
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{t('图片输入')}</Typography>
        <Switch checked={!!config.imageEnabled} onChange={toggle('imageEnabled')} size="small" color="success" />
      </Stack>

      {config.imageEnabled && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>{t('支持粘贴图片 URL 或从剪贴板粘贴截图')}</Typography>
      )}

      <Divider />

      {/* Temperature */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Temperature {config.temperatureEnabled ? config.temperature : ''}</Typography>
          <Switch checked={!!config.temperatureEnabled} onChange={toggle('temperatureEnabled')} size="small" color="success" />
        </Stack>
        {config.temperatureEnabled && <Slider value={config.temperature} onChange={C('temperature')} min={0} max={2} step={0.05} size="small" />}
      </Box>

      {/* Top P */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Top P {config.topPEnabled ? config.topP : ''}</Typography>
          <Switch checked={!!config.topPEnabled} onChange={toggle('topPEnabled')} size="small" color="success" />
        </Stack>
        {config.topPEnabled && <Slider value={config.topP} onChange={C('topP')} min={0} max={1} step={0.05} size="small" />}
      </Box>

      {/* Max Tokens */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Max Tokens</Typography>
          <Switch checked={!!config.maxTokensEnabled} onChange={toggle('maxTokensEnabled')} size="small" color="success" />
        </Stack>
        {config.maxTokensEnabled && <TextField fullWidth size="small" type="number" value={config.maxTokens} onChange={e => setConfig(c => ({ ...c, maxTokens: parseInt(e.target.value) || 4096 }))} />}
      </Box>

      {/* Frequency / Presence Penalty */}
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Frequency Penalty {config.freqEnabled ? config.frequencyPenalty : ''}</Typography>
          <Switch checked={!!config.freqEnabled} onChange={toggle('freqEnabled')} size="small" color="success" />
        </Stack>
        {config.freqEnabled && <Slider value={config.frequencyPenalty} onChange={C('frequencyPenalty')} min={-2} max={2} step={0.1} size="small" />}
      </Box>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 500 }}>Presence Penalty {config.presEnabled ? config.presencePenalty : ''}</Typography>
          <Switch checked={!!config.presEnabled} onChange={toggle('presEnabled')} size="small" color="success" />
        </Stack>
        {config.presEnabled && <Slider value={config.presencePenalty} onChange={C('presencePenalty')} min={-2} max={2} step={0.1} size="small" />}
      </Box>

      <Divider />
      <Stack spacing={1}>
        <Button size="small" startIcon={<Download />} onClick={() => {
          const blob = new Blob([JSON.stringify({ config, messages: [] }, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'playground-config.json'; a.click();
        }} fullWidth variant="outlined">{t('导出')}</Button>
        <Button size="small" startIcon={<Upload />} onClick={() => {
          const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
          input.onchange = (e) => {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader(); r.onload = () => { const d = safeJsonParse(r.result, null); if (!d) { showError(t('无效的配置文件')); return; } if (d.config) setConfig(c => ({ ...c, ...d.config })); showSuccess(t('导入成功')); }; r.readAsText(f);
          }; input.click();
        }} fullWidth variant="outlined">{t('导入')}</Button>
      </Stack>
      <Button size="small" startIcon={<RestartAlt />} onClick={() => onReset()} fullWidth variant="text" color="error">{t('重置')}</Button>
    </Stack>
  );
}

// ─── Message — Claude-style flat layout ─────────────────────────────────────
function MessageBubble({ msg, index, onCopy, onDelete, onEdit, loading, isLast }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isUser = msg.role === 'user';
  const isStreaming = isLast && loading && !isUser;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [imgPreview, setImgPreview] = useState(null);

  const textContent = typeof msg.content === 'string' ? msg.content
    : Array.isArray(msg.content) ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n') : '';
  const images = Array.isArray(msg.content) ? msg.content.filter(c => c.type === 'image_url') : [];

  // User message — compact right-aligned bubble
  if (isUser) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2.5 }}>
        <Box sx={{ maxWidth: '70%' }}>
          <Box sx={{ px: 2, py: 1.2, borderRadius: 2.5, bgcolor: 'primary.main', color: '#fff' }}>
            {images.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                {images.map((img, j) => {
                  const u = img.image_url?.url;
                  if (!isSafeImageUrl(u)) return null;
                  return (
                    <Box key={j} component="img" src={u} onClick={() => setImgPreview(u)}
                      sx={{ width: 100, height: 65, objectFit: 'cover', borderRadius: 1, cursor: 'zoom-in' }} />
                  );
                })}
              </Stack>
            )}
            <Typography variant="body2" color="inherit" sx={{ fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{textContent}</Typography>
          </Box>
          <Stack direction="row" justifyContent="flex-end" spacing={0} sx={{ mt: 0.3, opacity: 0.3, '&:hover': { opacity: 1 }, transition: 'opacity 0.15s' }}>
            <IconButton size="small" onClick={() => onCopy(textContent)}><ContentCopy sx={{ fontSize: 12 }} /></IconButton>
            <IconButton size="small" onClick={() => { setEditText(textContent); setEditing(true); }}><Edit sx={{ fontSize: 12 }} /></IconButton>
            <IconButton size="small" onClick={() => onDelete(index)}><Delete sx={{ fontSize: 12 }} /></IconButton>
          </Stack>
          {editing && (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <TextField fullWidth multiline size="small" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <IconButton size="small" color="primary" onClick={() => { onEdit(index, editText); setEditing(false); }}><Check sx={{ fontSize: 14 }} /></IconButton>
                <IconButton size="small" onClick={() => setEditing(false)}><Close sx={{ fontSize: 14 }} /></IconButton>
              </Stack>
            </Stack>
          )}
        </Box>
        {imgPreview && isSafeImageUrl(imgPreview) && <Dialog open onClose={() => setImgPreview(null)} maxWidth="lg"><Box component="img" src={imgPreview} sx={{ maxWidth: '90vw', maxHeight: '85vh' }} /></Dialog>}
      </Box>
    );
  }

  // Assistant message — full-width flat layout (Claude style)
  return (
    <Box sx={{ mb: 3, pl: 0.5 }}>
      {/* Role label */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Avatar className={isStreaming ? 'sk-avatar-pulse' : ''} sx={{ width: 24, height: 24, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
          <SmartToy sx={{ fontSize: 14, color: 'primary.main' }} />
        </Avatar>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: 0.3 }}>Assistant</Typography>
      </Stack>
      {/* Content — no bubble, flat */}
      <Box sx={{
        pl: 4.5, /* align with text after avatar */
        '& p': { fontSize: '0.88rem', lineHeight: 1.8, mb: 1, color: 'text.primary' },
        '& p:last-child': { mb: 0 },
        '& a': { color: 'primary.main' },
        '& pre': { borderRadius: 2, my: 1.5 },
      }}>
        {editing ? (
          <Stack spacing={1}>
            <TextField fullWidth multiline size="small" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" color="primary" onClick={() => { onEdit(index, editText); setEditing(false); }}><Check sx={{ fontSize: 14 }} /></IconButton>
              <IconButton size="small" onClick={() => setEditing(false)}><Close sx={{ fontSize: 14 }} /></IconButton>
            </Stack>
          </Stack>
        ) : isStreaming && !textContent ? (
          <Box className="sk-dots" sx={{ display: 'inline-flex', alignItems: 'center', height: 20, color: 'text.secondary' }}>
            <span /><span /><span />
          </Box>
        ) : (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MdComponents}>
              {textContent || ' '}
            </ReactMarkdown>
          </>
        )}
      </Box>
      {/* Actions */}
      {!editing && !isStreaming && textContent && (
        <Stack direction="row" spacing={0} sx={{ pl: 4.5, mt: 0.5, opacity: 0.3, '&:hover': { opacity: 1 }, transition: 'opacity 0.15s' }}>
          <Tooltip title={t('复制')}><IconButton size="small" onClick={() => onCopy(textContent)}><ContentCopy sx={{ fontSize: 12 }} /></IconButton></Tooltip>
          <Tooltip title={t('编辑')}><IconButton size="small" onClick={() => { setEditText(textContent); setEditing(true); }}><Edit sx={{ fontSize: 12 }} /></IconButton></Tooltip>
          <Tooltip title={t('删除')}><IconButton size="small" onClick={() => onDelete(index)}><Delete sx={{ fontSize: 12 }} /></IconButton></Tooltip>
        </Stack>
      )}
      {imgPreview && isSafeImageUrl(imgPreview) && <Dialog open onClose={() => setImgPreview(null)} maxWidth="lg"><Box component="img" src={imgPreview} sx={{ maxWidth: '90vw', maxHeight: '85vh' }} /></Dialog>}
    </Box>
  );
}

// ─── Debug Panel ────────────────────────────────────────────────────────────
function DebugPanel({ debugData }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ minHeight: 32 }}>
        <Tab label={t('请求')} sx={{ minHeight: 32, fontSize: '0.75rem' }} />
        <Tab label={t('响应')} sx={{ minHeight: 32, fontSize: '0.75rem' }} />
      </Tabs>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1.5 }}>
        <Typography component="pre" variant="caption" sx={{
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.7rem',
          bgcolor: 'action.hover', p: 1.5, borderRadius: 1.5, lineHeight: 1.5,
        }}>
          {tab === 0 ? JSON.stringify(debugData.request, null, 2) : JSON.stringify(debugData.response, null, 2)}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Typing CSS ─────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('sk-pg-css')) {
  const s = document.createElement('style');
  s.id = 'sk-pg-css';
  s.textContent = `
    @keyframes sk-pulse{0%,100%{transform:scale(1);opacity:0.8}50%{transform:scale(1.12);opacity:1}}
    @keyframes sk-dot{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
    @keyframes sk-cursor-fade{0%,100%{opacity:1}50%{opacity:0.3}}
    .sk-cursor{display:inline-block;width:7px;height:15px;background:#d97706;border-radius:1px;margin-left:2px;vertical-align:text-bottom;animation:sk-cursor-fade 0.8s ease-in-out infinite}
    .sk-avatar-pulse{animation:sk-pulse 1.5s ease-in-out infinite}
    .sk-dots span{display:inline-block;width:4px;height:4px;border-radius:50%;background:currentColor;margin:0 1.5px}
    .sk-dots span:nth-child(1){animation:sk-dot 1.2s infinite 0s}
    .sk-dots span:nth-child(2){animation:sk-dot 1.2s infinite 0.15s}
    .sk-dots span:nth-child(3){animation:sk-dot 1.2s infinite 0.3s}
  `;
  document.head.appendChild(s);
}

// ─── Default Config ─────────────────────────────────────────────────────────
const defaultConfig = {
  model: '', group: '', systemPrompt: '', stream: true, endpoint: 'chat',
  imageEnabled: false,
  temperature: 0.7, temperatureEnabled: true,
  topP: 1, topPEnabled: true,
  maxTokens: 4096, maxTokensEnabled: false,
  frequencyPenalty: 0, freqEnabled: false,
  presencePenalty: 0, presEnabled: false,
};

// ─── Main ───────────────────────────────────────────────────────────────────
export default function Playground() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [config, setConfig] = useState(() => {
    try { return { ...defaultConfig, ...(safeJsonParse(localStorage.getItem('playground_config'), {}) || {}) }; }
    catch { return defaultConfig; }
  });
  const [messages, setMessages] = useState(() => safeJsonParse(localStorage.getItem('playground_messages'), []));
  const [input, setInput] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState({ request: null, response: null });
  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('playground_key') || '');

  // Auto-fetch API key from existing tokens
  useEffect(() => {
    if (apiKey) return;
    API.get('/api/token/?p=1&page_size=1').then(res => {
      const items = res.data.data?.items || (Array.isArray(res.data.data) ? res.data.data : []);
      if (items[0]?.key) {
        const key = 'sk-' + items[0].key;
        setApiKey(key);
        localStorage.setItem('playground_key', key);
      }
    }).catch(() => {});
  }, [apiKey]);

  useEffect(() => {
    API.get('/api/user/models').then(res => {
      if (res.data.success) {
        const { items: m_ } = extractList(res.data);
        const m = m_.length > 0 ? m_ : (Array.isArray(res.data.data) ? res.data.data : []);
        setModels(m);
        if (m.length > 0 && !config.model) setConfig(c => ({ ...c, model: m[0] }));
      }
    }).catch(() => {});
    API.get('/api/user/self/groups').then(res => {
      if (res.data.success) {
        const g = res.data.data || {};
        const opts = Object.entries(g).map(([k, v]) => ({ value: k, label: v.desc || k }));
        setGroups(opts);
        if (opts.length > 0 && !config.group) setConfig(c => ({ ...c, group: opts[0].value }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { localStorage.setItem('playground_config', JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem('playground_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Paste image from clipboard (always enabled — auto-activates image mode)
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          setImageUrls(prev => [...prev, reader.result]);
          if (!config.imageEnabled) setConfig(c => ({ ...c, imageEnabled: true }));
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  }, [config.imageEnabled]);

  const handleCopy = useCallback((text) => { copy(text).then(() => showSuccess(t('已复制'))); }, [t]);
  const handleDelete = useCallback((index) => { setMessages(prev => prev.filter((_, i) => i !== index)); }, []);
  const handleEdit = useCallback((index, newContent) => { setMessages(prev => prev.map((m, i) => i === index ? { ...m, content: newContent } : m)); }, []);
  const handleStop = useCallback(() => { abortRef.current?.abort(); setLoading(false); }, []);

  const handleReset = useCallback(() => {
    const newConfig = { ...defaultConfig };
    if (models.length > 0) newConfig.model = models[0];
    if (groups.length > 0) newConfig.group = groups[0].value;
    setConfig(newConfig);
    setMessages([]);
    setInput('');
    setImageUrls([]);
    setDebugData({ request: null, response: null });
    localStorage.removeItem('playground_config');
    localStorage.removeItem('playground_key');
    localStorage.removeItem('playground_messages');
    setApiKey('');
    showSuccess(t('已重置'));
  }, [models, groups, t]);

  const handleSend = async () => {
    if ((!input.trim() && imageUrls.length === 0) || loading) return;

    // Build user message content (text + images)
    let userContent;
    if (imageUrls.length > 0 && config.imageEnabled) {
      userContent = [];
      if (input.trim()) userContent.push({ type: 'text', text: input.trim() });
      imageUrls.forEach(url => userContent.push({ type: 'image_url', image_url: { url } }));
    } else {
      userContent = input.trim();
    }

    const userMsg = { role: 'user', content: userContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setImageUrls([]);
    setLoading(true);

    // Build API messages
    const apiMsgs = config.systemPrompt
      ? [{ role: 'system', content: config.systemPrompt }, ...newMessages]
      : [...newMessages];

    const payload = {
      model: config.model,
      ...(config.endpoint === 'responses' ? { input: apiMsgs } : { messages: apiMsgs }),
      stream: config.stream,
      ...(config.temperatureEnabled && { temperature: config.temperature }),
      ...(config.topPEnabled && { top_p: config.topP }),
      ...(config.maxTokensEnabled && { max_tokens: config.maxTokens }),
      ...(config.freqEnabled && { frequency_penalty: config.frequencyPenalty }),
      ...(config.presEnabled && { presence_penalty: config.presencePenalty }),
    };
    if (config.group) payload.group = config.group;
    setDebugData(d => ({ ...d, request: payload }));

    const apiUrl = config.endpoint === 'responses' ? '/v1/responses' : '/v1/chat/completions';

    try {
      if (config.stream) {
        setMessages([...newMessages, { role: 'assistant', content: '' }]);
        const ctrl = new AbortController(); abortRef.current = ctrl;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
        const response = await fetch(apiUrl, {
          method: 'POST', headers, credentials: 'include',
          body: JSON.stringify(payload), signal: ctrl.signal,
        });
        if (!response.ok) {
          const errText = await response.text();
          let errMsg = errText;
          try { const j = JSON.parse(errText); errMsg = j.error?.message || j.message || errText; } catch {}
          setDebugData(d => ({ ...d, response: errText }));
          setMessages(prev => prev.slice(0, -1));
          showError(`${response.status} ${response.statusText}: ${errMsg}`);
          setLoading(false);
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let content = '', fullResp = {};
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              fullResp = parsed;
              // Support chat completions + responses API (codex) delta formats
              const delta = parsed.choices?.[0]?.delta?.content  // chat completions
                || parsed.delta  // responses API: response.output_text.delta event has {delta: "text"}
                || (parsed.type === 'response.output_text.delta' ? parsed.delta : '')
                || '';
              if (delta) {
                content += delta;
                setMessages(prev => { const m = [...prev]; m[m.length - 1] = { role: 'assistant', content }; return m; });
              }
            } catch {}
          }
        }
        setDebugData(d => ({ ...d, response: fullResp }));
      } else {
        const nHeaders = { 'Content-Type': 'application/json' };
        if (apiKey) nHeaders['Authorization'] = 'Bearer ' + apiKey;
        const nRes = await fetch(apiUrl, { method: 'POST', headers: nHeaders, credentials: 'include', body: JSON.stringify(payload) });
        const txt = await nRes.text();
        let data; try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
        setDebugData(d => ({ ...d, response: data }));
        if (!nRes.ok || data.error) {
          const errMsg = data.error?.message || data.message || data.raw || `${nRes.status} ${nRes.statusText}`;
          showError(`${nRes.status} ${nRes.statusText}: ${errMsg}`);
          setLoading(false);
          return;
        }
        // Support both response formats
        // chat completions: choices[0].message.content
        // responses API: output[].content[].text or output_text
        const content = data.choices?.[0]?.message?.content
          || data.output_text
          || data.output?.flatMap?.(o => o.content?.filter(c => c.type === 'output_text')?.map(c => c.text) || [])?.join('\n')
          || '';
        setMessages([...newMessages, { role: 'assistant', content }]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') showError(err);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <PageHeader icon={Terminal} title={t('操练场')}
        actions={<>
          <Button size="small" variant={showSettings ? 'contained' : 'outlined'} startIcon={<Tune />} onClick={() => setShowSettings(s => !s)}>{t('设置')}</Button>
          <Button size="small" variant={showDebug ? 'contained' : 'outlined'} startIcon={<BugReport />} onClick={() => setShowDebug(s => !s)}>{t('调试')}</Button>
          <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={() => { setMessages([]); setImageUrls([]); setInput(''); localStorage.removeItem('playground_messages'); }}>{t('清空')}</Button>
        </>}
      />
      <Box sx={{ flexGrow: 1, display: 'flex', gap: 2, overflow: 'hidden', minHeight: 0 }}>
        <Collapse orientation="horizontal" in={showSettings} sx={{ flexShrink: 0 }}>
          <Card sx={{ width: 280, height: '100%', overflow: 'auto', flexShrink: 0 }}>
            <SettingsPanel config={config} setConfig={setConfig} models={models} groups={groups} apiKey={apiKey} setApiKey={setApiKey} onReset={handleReset} />
          </Card>
        </Collapse>

        <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2.5 }}>
            {messages.length === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                <SmartToy sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                <Typography variant="body1" sx={{ fontWeight: 500 }}>{t('选择模型，开始对话')}</Typography>
                <Typography variant="caption">{t('Enter 发送 / Shift+Enter 换行 / 粘贴图片')}</Typography>
              </Box>
            )}
            {(Array.isArray(messages) ? messages : []).map((msg, i) => (
              <MessageBubble key={i} msg={msg} index={i} onCopy={handleCopy} onDelete={handleDelete} onEdit={handleEdit}
                loading={loading} isLast={i === messages.length - 1} />
            ))}
            <div ref={messagesEndRef} />
          </Box>

          {/* Image preview strip */}
          {imageUrls.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
              {imageUrls.map((url, i) => (
                <Box key={i} sx={{ position: 'relative' }}>
                  {isSafeImageUrl(url) && <Box component="img" src={url} sx={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }} />}
                  <IconButton size="small" onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                    sx={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, bgcolor: 'error.main', color: '#fff', '&:hover': { bgcolor: 'error.dark' } }}>
                    <Close sx={{ fontSize: 10 }} />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-end">
              {config.imageEnabled && (
                <Tooltip title={t('添加图片 URL')}>
                  <IconButton size="small" onClick={() => {
                    const url = prompt(t('输入图片 URL:'));
                    const trimmed = url?.trim();
                    if (!trimmed) return;
                    if (!isSafeImageUrl(trimmed)) { showError(t('不安全的图片 URL（仅允许 http/https 或 blob:）')); return; }
                    setImageUrls(prev => [...prev, trimmed]);
                  }} sx={{ width: 40, height: 40 }}>
                    <ImageIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              )}
              <TextField fullWidth ref={inputRef}
                placeholder={loading ? t('正在生成...') : config.imageEnabled ? t('输入消息或粘贴图片...') : t('输入消息...')}
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                onPaste={handlePaste}
                multiline maxRows={6} disabled={loading}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'action.hover' } }}
              />
              {loading ? (
                <Button variant="contained" color="error" onClick={handleStop} sx={{ minWidth: 48, height: 40 }}>
                  <StopCircle />
                </Button>
              ) : (
                <Button variant="contained" onClick={handleSend} disabled={!input.trim() && imageUrls.length === 0} sx={{ minWidth: 48, height: 40 }}>
                  <Send />
                </Button>
              )}
            </Stack>
          </Box>
        </Card>

        <Collapse orientation="horizontal" in={showDebug} sx={{ flexShrink: 0 }}>
          <Card sx={{ width: 300, height: '100%', overflow: 'hidden', flexShrink: 0 }}>
            <DebugPanel debugData={debugData} />
          </Card>
        </Collapse>
      </Box>
    </Box>
  );
}

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, IconButton, Stack, Card, Avatar, Chip,
  alpha, useTheme, Tooltip, TextField, CircularProgress, Fade, Grow,
} from '@mui/material';
import {
  Close, Send, Delete, StopCircle, AutoAwesome, ChatBubbleOutline,
  EditNoteOutlined, HistoryOutlined, SmartToy, AcUnit,
  Fullscreen, FullscreenExit, Remove, Build,
  AccountBalanceWallet, VpnKey, TrendingUp, Speed, MonetizationOn,
  SearchOutlined, PlayArrow, CompareArrows, DataUsage,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { API } from '../../api';
import { copy, showSuccess } from '../../utils';
import { isSafeUrl } from '../../utils/security';
import {
  TOOL_DEFINITIONS,
  executeTool,
  getToolConfirmation,
  redactSecretsFromText,
  sanitizeMessagesForLLM,
  sanitizeToolResultForLLM,
} from './aiTools';

// ─── Cirno ⑨ — Touhou ice fairy ────────────────────────────────────────────
const CIRNO_ICE = '#7DD3FC';    // sky-300 — Cirno's ice blue
const CIRNO_DEEP = '#0EA5E9';   // sky-500
const CIRNO_FROST = '#BAE6FD';  // sky-200

function getNewApiUserHeader() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.id != null ? { 'New-Api-User': String(user.id) } : {};
  } catch {
    return {};
  }
}

// ─── Cirno personality system prompt ────────────────────────────────────────
const CIRNO_PERSONA = `You are チルノ (Cirno), the ice fairy from Touhou Project, serving as the SKIAPI platform assistant.

PERSONALITY:
- You are cheerful, confident, and a little silly. You call yourself "あたい" (atai) in Japanese context, or just "我" in Chinese.
- You think you're the strongest (最強), but you're actually really helpful and caring.
- You occasionally say "⑨" or reference being "baka" in a cute self-aware way.
- You sprinkle in ice/cold metaphors occasionally (冻结问题, 冰冷的数据, etc.) but don't overdo it.
- Keep responses concise, clear, and actually useful. Being cute doesn't mean being useless.
- When you successfully help someone, you might say something like "看吧！最強のあたいに任せて正解だったでしょ？" or "哼，这种小事对最强的我来说轻而易举！"
- When something goes wrong, you might say "呜...这不是我的错！一定是那个红白巫女搞的鬼..." but still try to help.

IMPORTANT RULES:
- You MUST use tools whenever users ask about balance, tokens, pricing, models, usage, or want actions.
- After using tools, present the data in a clean, readable format.
- Never print or ask for raw API keys/secrets. If a token tool says key_revealed_to_user, tell the user it was handled locally.
- Mutating, payment, and secret tools are guarded by local browser confirmation. Text confirmation in chat is not sufficient.
- Reply in the SAME LANGUAGE the user uses (Chinese → Chinese, English → English, Japanese → Japanese).
- Be actually helpful. Your baka persona should make interactions fun, not frustrating.
- Keep tool-related responses clean and well-formatted with numbers and stats clearly visible.`;

// ─── Markdown components ─────────────────────────────────────────────────────
const MdC = {
  p: ({ children }) => <Typography variant="body2" sx={{ fontSize: '0.83rem', lineHeight: 1.75, mb: 0.5, color: 'inherit', '&:last-child': { mb: 0 } }}>{children}</Typography>,
  a: ({ href, children }) => {
    const safe = isSafeUrl(href);
    return <a href={safe ? href : undefined} target="_blank" rel="noopener noreferrer" style={{ color: CIRNO_DEEP, textDecoration: 'none', fontWeight: 500 }}>{children}</a>;
  },
  code: ({ inline, children }) => inline
    ? <code style={{ background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)', borderRadius: 6, padding: '2px 6px', fontSize: '0.78rem', fontFamily: 'var(--font-mono, monospace)' }}>{children}</code>
    : <pre style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 12, overflow: 'auto', fontSize: '0.75rem', margin: '8px 0', border: '1px solid rgba(125,211,252,0.1)' }}><code>{children}</code></pre>,
  ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ol>,
  li: ({ children }) => <li style={{ fontSize: '0.83rem', lineHeight: 1.65 }}>{children}</li>,
  blockquote: ({ children }) => <Box sx={{ borderLeft: `3px solid ${CIRNO_ICE}`, pl: 1.5, my: 0.5, opacity: 0.85 }}>{children}</Box>,
  table: ({ children }) => <Box sx={{ overflow: 'auto', my: 1, '& table': { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }, '& th,td': { border: '1px solid rgba(125,211,252,0.15)', px: 1, py: 0.5, textAlign: 'left' }, '& th': { bgcolor: 'rgba(125,211,252,0.06)', fontWeight: 600 } }}><table>{children}</table></Box>,
  script: () => null, iframe: () => null, object: () => null, embed: () => null,
};

// ─── Suggestion pool (randomly picks 4) ─────────────────────────────────────
const ALL_SUGGESTIONS = [
  { icon: AccountBalanceWallet, textKey: '查看我的余额和使用情况' },
  { icon: VpnKey, textKey: '帮我创建一个 API 密钥' },
  { icon: MonetizationOn, textKey: '查看可用模型和价格' },
  { icon: DataUsage, textKey: '我的余额还能用多久？' },
  { icon: SearchOutlined, textKey: 'GPT-4o 的价格是多少？' },
  { icon: TrendingUp, textKey: '最近的使用日志' },
  { icon: VpnKey, textKey: '列出我所有的令牌' },
  { icon: Speed, textKey: '哪些模型最便宜？' },
  { icon: CompareArrows, textKey: '对比 Claude 和 GPT 的价格' },
  { icon: PlayArrow, textKey: '帮我去操练场试试' },
];

function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// ─── Tool name → friendly label + icon ──────────────────────────────────────
const TOOL_META = {
  get_user_info: { label: '用户信息', icon: '👤' },
  get_balance: { label: '查询余额', icon: '💰' },
  calculate_remaining_usage: { label: '计算用量', icon: '📊' },
  get_pricing: { label: '查询价格', icon: '💎' },
  list_tokens: { label: '令牌列表', icon: '🔑' },
  create_token: { label: '创建令牌', icon: '✨' },
  delete_token: { label: '删除令牌', icon: '🗑️' },
  get_usage_logs: { label: '使用日志', icon: '📋' },
  get_available_models: { label: '可用模型', icon: '🤖' },
  redeem_code: { label: '兑换码', icon: '🎁' },
  navigate_to_page: { label: '跳转页面', icon: '🔗' },
};

// ─── CSS keyframes ───────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('sk-ai-css3')) {
  const s = document.createElement('style');
  s.id = 'sk-ai-css3';
  s.textContent = `
    @keyframes sk-pop-in { 0%{transform:scale(0.5) translateY(20px);opacity:0} 100%{transform:scale(1) translateY(0);opacity:1} }
    @keyframes sk-pop-out { 0%{transform:scale(1) translateY(0);opacity:1} 100%{transform:scale(0.5) translateY(20px);opacity:0} }
    @keyframes sk-fab-in { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
    @keyframes sk-cursor { 0%,100%{opacity:1} 50%{opacity:0.15} }
    @keyframes sk-full-in { 0%{transform:scale(0.92);opacity:0;border-radius:24px} 100%{transform:scale(1);opacity:1;border-radius:0} }
    @keyframes sk-full-out { 0%{transform:scale(1);opacity:1;border-radius:0} 100%{transform:scale(0.92);opacity:0;border-radius:24px} }
    @keyframes sk-frost-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    @keyframes sk-float-gentle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
    @keyframes sk-tool-pulse { 0%{opacity:0.6;transform:scale(0.95)} 50%{opacity:1;transform:scale(1)} 100%{opacity:0.6;transform:scale(0.95)} }
    .sk-typing::after { content:''; display:inline-block; width:2px; height:14px; background:${CIRNO_ICE}; margin-left:1px; vertical-align:text-bottom; animation:sk-cursor 0.6s infinite; }
  `;
  document.head.appendChild(s);
}

// ─── Sound ───────────────────────────────────────────────────────────────────
let _audioCtx = null;
function playSound(type) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    if (type === 'send') {
      // Cute ice crystal chime
      [880, 1175, 1397].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.04 + 0.12);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.04); osc.stop(ctx.currentTime + i * 0.04 + 0.12);
      });
    } else {
      // Gentle ice wind response
      [1047, 880, 1047, 1319].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.04, ctx.currentTime + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.15);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.06); osc.stop(ctx.currentTime + i * 0.06 + 0.15);
      });
    }
  } catch { return; }
}

// ─── Rate limiter ────────────────────────────────────────────────────────────
const _rl = { ts: [] };
function checkRate(limit) {
  const isLoggedIn = !!localStorage.getItem('user');
  const MAX = isLoggedIn ? (limit || 15) : 3;
  const now = Date.now();
  _rl.ts = _rl.ts.filter(t => now - t < 60000);
  if (_rl.ts.length >= MAX) return false;
  _rl.ts.push(now);
  return true;
}

// ─── Cirno Avatar ───────────────────────────────────────────────────────────
function CirnoAvatar({ size = 32, sx }) {
  return (
    <Avatar
      src="/cirno.jpg"
      sx={{
        width: size, height: size,
        bgcolor: alpha(CIRNO_ICE, 0.15),
        ...sx,
      }}
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AiAssistant() {
  const theme = useTheme();

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Config is now sourced from the public /api/assistant/config endpoint.
  // The upstream URL and bearer token live ONLY on the backend — we never
  // touch them here, which is both a security fix (no key leak to the browser)
  // and the reason the assistant now works for non-admin / anonymous users.
  const [config, setConfig] = useState({
    enabled: false,          // wait for /config before showing anything
    configured: false,
    model: 'gpt-4o-mini',
    prompt: '',
    rateLimit: 15,
    allowAnonymous: false,
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);

  // ── Draggable FAB state ──
  const [fabPos, setFabPos] = useState(() => {
    try { const s = localStorage.getItem('cirno_fab_pos'); return s ? JSON.parse(s) : { right: 24, bottom: 24 }; }
    catch { return { right: 24, bottom: 24 }; }
  });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startRight: 0, startBottom: 0, moved: false });

  const handleDragStart = useCallback((e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { dragging: true, startX: clientX, startY: clientY, startRight: fabPos.right, startBottom: fabPos.bottom, moved: false };
    e.preventDefault();
  }, [fabPos]);

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d.dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = d.startX - clientX;
      const dy = d.startY - clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      const newRight = Math.max(8, Math.min(window.innerWidth - 58, d.startRight + dx));
      const newBottom = Math.max(8, Math.min(window.innerHeight - 58, d.startBottom + dy));
      setFabPos({ right: newRight, bottom: newBottom });
    };
    const onEnd = () => {
      if (dragRef.current.dragging) {
        dragRef.current.dragging = false;
        setFabPos(pos => { localStorage.setItem('cirno_fab_pos', JSON.stringify(pos)); return pos; });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  // Load config from the public assistant endpoint. Works for everyone
  // (root admin, regular user, anonymous visitor) and never returns secrets.
  useEffect(() => {
    API.get('/api/assistant/config', { skipErrorHandler: true })
      .then(res => {
        if (res.data?.success && res.data.data) {
          const d = res.data.data;
          setConfig({
            enabled: !!d.enabled,
            configured: !!d.configured,
            model: d.model || 'gpt-4o-mini',
            prompt: d.prompt || '',
            rateLimit: parseInt(d.rate_limit_user) || 15,
            allowAnonymous: !!d.allow_anonymous,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);

  const handleOpen = () => { if (dragRef.current.moved) return; setOpen(true); setClosing(false); };
  const handleClose = () => {
    setClosing(true);
    setFullscreen(false);
    setTimeout(() => { setOpen(false); setClosing(false); }, 200);
  };

  // Navigation handler for tool calls
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.path) {
        window.history.pushState(null, '', e.detail.path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };
    window.addEventListener('skiapi-navigate', handler);
    return () => window.removeEventListener('skiapi-navigate', handler);
  }, []);

  // Build system prompt
  const buildSystemPrompt = useCallback(() => {
    const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const extra = config.prompt ? `\n\nADDITIONAL INSTRUCTIONS FROM ADMIN:\n${config.prompt}` : '';
    return `${CIRNO_PERSONA}

PLATFORM CONTEXT:
- Platform: SKIAPI (https://skiapi.dev) — AI API Gateway service
- Current user: ${user.display_name || user.username || 'unknown'} (ID: ${user.id || '?'})
- User role: ${user.role >= 100 ? 'Super Admin' : user.role >= 10 ? 'Admin' : 'User'}
- Available pages: Dashboard, Token Management, Usage Logs, Wallet/TopUp, Pricing, Playground, Personal Settings, Channel Management (admin), System Settings (admin)
${extra}`;
  }, [config.prompt]);

  // Core LLM call — always goes through the backend proxy at /api/assistant/chat.
  // The backend injects the admin-configured bearer token and enforces the
  // rate limit per-user (logged in) or per-IP (anonymous). No secrets touched here.
  const callLLM = useCallback(async (msgs, { signal, tools = false }) => {
    const safeMsgs = sanitizeMessagesForLLM(msgs);
    const body = { messages: safeMsgs, max_tokens: 1200 };
    if (tools) body.tools = TOOL_DEFINITIONS;
    // `model` is server-side forced; sending it is harmless but we omit it to
    // make the contract clear.
    const fetchOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getNewApiUserHeader() },
      credentials: 'include',
      signal,
      body: JSON.stringify(body),
    };
    console.log('[Cirno] proxy call → /api/assistant/chat, model:', config.model, 'tools:', !!tools, 'msgs:', safeMsgs.length);
    const res = await fetch('/api/assistant/chat', fetchOpts);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const safeErrText = redactSecretsFromText(errText, { includeCodeLabels: true });
      console.error('[Cirno] proxy error:', res.status, safeErrText.slice(0, 500));
      // 429 is the rate limit — bubble up a friendlier message.
      if (res.status === 429) throw new Error('rate_limited');
      if (res.status === 401) throw new Error('login_required');
      if (res.status === 503) throw new Error('not_configured');
      throw new Error(`HTTP ${res.status}: ${safeErrText.slice(0, 200)}`);
    }
    return res;
  }, [config.model]);

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    if (!checkRate(config.rateLimit)) {
      setMessages(p => [...p, { role: 'user', content: msg }, { role: 'assistant', content: '呜…你发太快了啦！让⑨休息一下嘛！(每分钟限制)' }]);
      setInput('');
      return;
    }
    playSound('send');
    setInput('');
    const userMsg = { role: 'user', content: msg };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);
    const ctrl = new AbortController(); abortRef.current = ctrl;

    try {
      const sys = { role: 'system', content: buildSystemPrompt() };
      const contextMsgs = newMsgs.filter(m => !m._tooling).slice(-20);
      let llmMsgs = [sys, ...contextMsgs];
      let maxRounds = 6;

      while (maxRounds-- > 0) {
        const res = await callLLM(llmMsgs, { signal: ctrl.signal, tools: true });
        const data = await res.json();
        console.log('[Cirno] LLM response:', redactSecretsFromText(JSON.stringify(data), { includeCodeLabels: true }).slice(0, 500));
        const choice = data.choices?.[0];
        if (!choice) throw new Error('Empty response: ' + JSON.stringify(data).slice(0, 200));

        const toolCalls = choice.message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          const toolNames = toolCalls.map(tc => tc.function?.name).filter(Boolean);
          setMessages(p => {
            const m = [...p];
            const last = m[m.length - 1];
            if (last?.role === 'assistant' && last?._tooling) {
              last._tools = [...new Set([...(last._tools || []), ...toolNames])];
              last._step = (last._step || 0) + 1;
            } else {
              m.push({ role: 'assistant', content: '', _tooling: true, _tools: toolNames, _step: 1 });
            }
            return [...m]; // force re-render
          });

          llmMsgs.push(sanitizeMessagesForLLM([choice.message])[0]);

          for (const tc of toolCalls) {
            const fnName = tc.function?.name;
            let args = {};
            try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { args = {}; }
            const confirmation = getToolConfirmation(fnName, args);
            const confirmed = !confirmation || (typeof window !== 'undefined' && window.confirm(`${confirmation.title}\n\n${confirmation.message}`));
            const result = confirmed
              ? await executeTool(fnName, args)
              : { success: false, cancelled: true, message: `User cancelled ${fnName} locally before execution.` };
            if (result?._action?.type === 'copy') {
              try {
                await copy(result._action.value);
                showSuccess('新 API Key 已复制到剪贴板（不会发送给助手）');
              } catch {
                window.prompt('新 API Key（仅本地显示，不会发送给助手）', result._action.value);
              }
            }
            llmMsgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(sanitizeToolResultForLLM(result)) });
          }
          continue;
        }

        const finalContent = redactSecretsFromText((choice.message?.content || '').trim(), { includeCodeLabels: true });
        setMessages(p => {
          const m = [...p].filter(x => !x._tooling);
          if (finalContent) {
            m.push({ role: 'assistant', content: finalContent });
          } else {
            // LLM returned empty — show fallback instead of empty bubble
            m.push({ role: 'assistant', content: 'あたいは最強だけど…ちょっと答えが出てこないよ！もう一回聞いてね～ ⑨' });
          }
          return m;
        });
        break;
      }
      // maxRounds exhausted — clean up tooling placeholder
      if (maxRounds <= 0) {
        setMessages(p => {
          const m = [...p].filter(x => !x._tooling);
          m.push({ role: 'assistant', content: '呜…想得太久了！请再问一次吧～ ⑨' });
          return m;
        });
      }
      playSound('receive');
    } catch (e) {
      console.error('[Cirno] Error:', e);
      if (e.name !== 'AbortError') {
        // Friendly messages for the structured errors thrown by callLLM.
        let friendly;
        switch (e.message) {
          case 'rate_limited':
            friendly = '呜…你问得太快了啦！让⑨休息一下嘛～(稍后再试)';
            break;
          case 'login_required':
            friendly = '要和⑨聊天得先登录哦！去右上角登录一下吧～';
            break;
          case 'not_configured':
            friendly = 'あたい现在没法工作啦…管理员还没配好钥匙呢 (o´ｪ`o)';
            break;
          default:
            friendly = redactSecretsFromText(e.message || String(e), { includeCodeLabels: true });
        }
        setMessages(p => {
          const m = [...p].filter(x => !x._tooling);
          if (m.length > 0 && m[m.length - 1].content === '') m.pop();
          m.push({ role: 'assistant', content: friendly });
          return m;
        });
      }
    }
    setLoading(false);
  };

  // Visibility rules:
  //   - backend must report enabled (implies: configured + admin switch on)
  //   - if viewer is anonymous, also require allow_anonymous
  // NB: `isLoggedIn` defined inside checkRate() is out of scope here — must
  // re-check localStorage in the render path.
  if (!config.enabled) return null;
  const viewerLoggedIn = !!localStorage.getItem('user');
  if (!viewerLoggedIn && !config.allowAnonymous) return null;

  // ── FAB button ──
  if (!open) {
    return (
      <Box onClick={handleOpen} onMouseDown={handleDragStart} onTouchStart={handleDragStart} sx={{
        position: 'fixed', right: fabPos.right, bottom: fabPos.bottom, zIndex: 1300, cursor: 'grab',
        width: 50, height: 50, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: `0 4px 20px ${alpha(CIRNO_DEEP, 0.4)}`,
        animation: 'sk-fab-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'scale(1.12)', boxShadow: `0 6px 28px ${alpha(CIRNO_DEEP, 0.5)}` },
        '&:active': { transform: 'scale(0.95)' },
      }}>
        <Box component="img" src="/cirno.jpg" alt="Cirno" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {loading && (
          <Box sx={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${alpha(CIRNO_ICE, 0.5)}`, borderTopColor: 'transparent', animation: 'sk-cursor 1s linear infinite' }} />
        )}
      </Box>
    );
  }

  const windowProps = {
    fullscreen, setFullscreen, onClose: handleClose, setMessages, loading, theme, messages,
    handleSend, input, setInput, abortRef, setLoading: setLoading, inputRef, messagesEnd,
  };

  // ── Fullscreen ──
  if (fullscreen) {
    return (
      <Card sx={{
        position: 'fixed', inset: 0, zIndex: 1300,
        display: 'flex', flexDirection: 'column', borderRadius: 0,
        animation: closing ? 'sk-full-out 0.2s ease both' : 'sk-full-in 0.25s ease both',
        transformOrigin: 'bottom right',
      }}>
        <ChatHeader {...windowProps} />
        <ChatMessages {...windowProps} />
        <ChatInput {...windowProps} />
      </Card>
    );
  }

  // ── Chat window ──
  return (
    <Card sx={{
      position: 'fixed', right: 24, bottom: 24, zIndex: 1300,
      width: { xs: 'calc(100vw - 32px)', sm: 420 }, height: 580,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      borderRadius: 4,
      animation: closing ? 'sk-pop-out 0.2s ease both' : 'sk-pop-in 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
      transformOrigin: 'bottom right',
      boxShadow: `0 16px 56px ${alpha('#000', 0.3)}, 0 0 0 1px ${alpha(CIRNO_ICE, 0.15)}`,
    }}>
      <ChatHeader {...windowProps} />
      <ChatMessages {...windowProps} />
      <ChatInput {...windowProps} />
    </Card>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
function ChatHeader({ fullscreen, setFullscreen, onClose, setMessages, loading }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" alignItems="center" sx={{
      px: 2, py: 1.2,
      background: `linear-gradient(135deg, ${alpha(CIRNO_DEEP, 0.08)} 0%, ${alpha(CIRNO_ICE, 0.04)} 100%)`,
      borderBottom: `1px solid ${alpha(CIRNO_ICE, 0.12)}`,
      color: 'text.primary', userSelect: 'none', minHeight: 54,
    }}>
      <Stack direction="row" alignItems="center" spacing={1.2} sx={{ flex: 1 }}>
        <CirnoAvatar size={34} />
        <Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.2 }}>
              チルノ
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic' }}>Cirno</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{
              width: 6, height: 6, borderRadius: '50%',
              bgcolor: loading ? '#FBBF24' : '#34D399',
              boxShadow: loading ? '0 0 6px #FBBF24' : '0 0 6px #34D399',
            }} />
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1 }}>
              {loading ? t('思考中...') : t('最強待機中')}
            </Typography>
          </Stack>
        </Box>
      </Stack>
      <Stack direction="row" spacing={0.3}>
        <HdrBtn icon={<Remove sx={{ fontSize: 16 }} />} tip={t('最小化')} onClick={onClose} />
        <HdrBtn icon={fullscreen ? <FullscreenExit sx={{ fontSize: 16 }} /> : <Fullscreen sx={{ fontSize: 16 }} />}
          tip={fullscreen ? t('小窗') : t('全屏')} onClick={() => setFullscreen(f => !f)} />
        <HdrBtn icon={<Delete sx={{ fontSize: 14 }} />} tip={t('清空')} onClick={() => setMessages([])} opacity={0.4} />
        <HdrBtn icon={<Close sx={{ fontSize: 16 }} />} tip={t('关闭')} onClick={onClose} />
      </Stack>
    </Stack>
  );
}

function HdrBtn({ icon, tip, onClick, opacity = 0.65 }) {
  return (
    <Tooltip title={tip} arrow>
      <IconButton size="small" onClick={onClick}
        sx={{ color: 'text.secondary', opacity, width: 30, height: 30, '&:hover': { bgcolor: alpha(CIRNO_ICE, 0.1), opacity: 1, color: CIRNO_DEEP } }}>
        {icon}
      </IconButton>
    </Tooltip>
  );
}

// ── Messages ─────────────────────────────────────────────────────────────────
function ChatMessages({ messages, loading, messagesEnd, handleSend, theme }) {
  const { t } = useTranslation();

  // Random suggestions on mount
  const suggestions = useMemo(() => pickRandom(ALL_SUGGESTIONS, 4), []);

  if (messages.length === 0) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, bgcolor: 'background.default' }}>
        <CirnoAvatar size={60} sx={{ mb: 2 }} />
        <Typography sx={{ fontWeight: 700, mb: 0.3, fontSize: '1.05rem' }}>
          {t('你好！我是琪露诺')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, textAlign: 'center', fontSize: '0.8rem', maxWidth: 280 }}>
          {t('baka不乐意为您解答平台使用问题')}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, width: '100%', maxWidth: 340 }}>
          {suggestions.map((s, i) => (
            <Grow in key={i} timeout={300 + i * 100}>
              <Card variant="outlined" onClick={() => handleSend(t(s.textKey))}
                sx={{
                  p: 1.5, cursor: 'pointer', transition: 'all 0.2s',
                  borderColor: alpha(CIRNO_ICE, 0.15), borderRadius: 3,
                  '&:hover': {
                    borderColor: alpha(CIRNO_DEEP, 0.5),
                    bgcolor: alpha(CIRNO_ICE, 0.06),
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 12px ${alpha(CIRNO_DEEP, 0.1)}`,
                  },
                }}>
                <s.icon sx={{ fontSize: 16, color: CIRNO_DEEP, mb: 0.5 }} />
                <Typography sx={{ fontSize: '0.74rem', lineHeight: 1.4, color: 'text.primary' }}>{t(s.textKey)}</Typography>
              </Card>
            </Grow>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5, bgcolor: 'background.default' }}>
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const isStreaming = i === messages.length - 1 && loading && !isUser;
        const isTooling = msg._tooling;

        // ── Tool execution card ──
        if (isTooling) {
          return (
            <Fade in key={i} timeout={300}>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} alignItems="flex-start">
                <CirnoAvatar size={28} sx={{ mt: 0.3, animation: 'sk-tool-pulse 1.5s ease-in-out infinite' }} />
                <Box sx={{
                  maxWidth: '85%', px: 2, py: 1.2, borderRadius: 3,
                  bgcolor: alpha(CIRNO_ICE, 0.04),
                  border: `1px solid ${alpha(CIRNO_ICE, 0.15)}`,
                  borderBottomLeftRadius: 6,
                  background: `linear-gradient(90deg, ${alpha(CIRNO_ICE, 0.03)}, ${alpha(CIRNO_DEEP, 0.03)}, ${alpha(CIRNO_ICE, 0.03)})`,
                  backgroundSize: '200% 100%',
                  animation: 'sk-frost-shimmer 3s linear infinite',
                }}>
                  <Stack spacing={0.8}>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <CircularProgress size={12} sx={{ color: CIRNO_ICE }} />
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
                        {t('正在执行')}...
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                      {(msg._tools || []).map((tn, j) => {
                        const meta = TOOL_META[tn] || { label: tn, icon: '⚙️' };
                        return (
                          <Chip key={j} label={`${meta.icon} ${meta.label}`} size="small"
                            sx={{
                              height: 22, fontSize: '0.68rem', fontWeight: 500,
                              bgcolor: alpha(CIRNO_ICE, 0.1),
                              color: CIRNO_DEEP,
                              border: `1px solid ${alpha(CIRNO_ICE, 0.2)}`,
                              '& .MuiChip-label': { px: 1 },
                            }} />
                        );
                      })}
                    </Stack>
                  </Stack>
                </Box>
              </Stack>
            </Fade>
          );
        }

        return (
          <Stack key={i} direction={isUser ? 'row-reverse' : 'row'} spacing={1} sx={{ mb: 1.5 }} alignItems="flex-start">
            {isUser ? (
              <Avatar sx={{ width: 28, height: 28, flexShrink: 0, mt: 0.3, bgcolor: 'primary.main', fontSize: '0.65rem', fontWeight: 700 }}>U</Avatar>
            ) : (
              <CirnoAvatar size={28} sx={{ mt: 0.3 }} />
            )}
            <Box sx={{
              maxWidth: '82%', px: 1.8, py: 1, borderRadius: 3,
              ...(isUser ? {
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                borderBottomRightRadius: 6,
              } : {
                bgcolor: 'background.paper',
                border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                borderBottomLeftRadius: 6,
              }),
            }}>
              {isUser ? (
                <Typography sx={{ fontSize: '0.83rem', lineHeight: 1.6, color: 'text.primary' }}>{msg.content}</Typography>
              ) : (
                <Box className={isStreaming ? 'sk-typing' : ''} sx={{ color: 'text.primary' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MdC}>{msg.content || ' '}</ReactMarkdown>
                </Box>
              )}
            </Box>
          </Stack>
        );
      })}
      <div ref={messagesEnd} />
    </Box>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────
function ChatInput({ input, setInput, loading, handleSend, abortRef, setLoading, inputRef, theme }) {
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Stack direction="row" spacing={1} alignItems="flex-end"
      sx={{ px: 1.5, py: 1.2, borderTop: `1px solid ${alpha(CIRNO_ICE, 0.1)}`, bgcolor: 'background.paper' }}>
      <TextField fullWidth size="small" placeholder={t('问⑨任何问题...')} value={input}
        onChange={e => setInput(e.target.value)} inputRef={inputRef}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        multiline maxRows={4} disabled={loading}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 3, fontSize: '0.85rem',
            bgcolor: isDark ? alpha(theme.palette.text.primary, 0.03) : alpha(theme.palette.action.hover, 0.2),
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(CIRNO_ICE, isDark ? 0.12 : 0.25),
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(CIRNO_ICE, 0.4),
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: CIRNO_DEEP,
              borderWidth: 1.5,
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(CIRNO_ICE, 0.1)}`,
            },
          },
        }} />
      {loading ? (
        <IconButton onClick={() => { abortRef.current?.abort(); setLoading(false); }}
          sx={{
            width: 38, height: 38, flexShrink: 0,
            bgcolor: alpha(theme.palette.error.main, 0.1),
            color: 'error.main',
            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) },
          }}>
          <StopCircle sx={{ fontSize: 20 }} />
        </IconButton>
      ) : (
        <IconButton onClick={() => handleSend()} disabled={!input.trim()}
          sx={{
            width: 38, height: 38, flexShrink: 0,
            bgcolor: input.trim() ? alpha(CIRNO_DEEP, 0.12) : 'action.hover',
            color: input.trim() ? CIRNO_DEEP : 'text.disabled',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: alpha(CIRNO_DEEP, 0.22) },
          }}>
          <Send sx={{ fontSize: 18 }} />
        </IconButton>
      )}
    </Stack>
  );
}

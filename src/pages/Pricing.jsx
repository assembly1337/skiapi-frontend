import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, TextField, InputAdornment, Chip, Stack,
  Grid, ToggleButton, ToggleButtonGroup, alpha, useTheme, Skeleton, IconButton,
  Tooltip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, GlobalStyles,
} from '@mui/material';
import {
  Search, ViewModule, ViewList, StorefrontOutlined, ContentCopy,
  RestartAlt, DarkMode, LightMode, TrendingUp, Speed, Category,
  ArrowBack,
} from '@mui/icons-material';
import { API } from '../api';
import { showError, showSuccess, safeArray, copy, getCurrencyInfo } from '../utils';
import EmptyState from '../components/common/EmptyState';
import VendorIcon from '../components/common/VendorIcon';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../contexts/ThemeContext';

// "Opt-in" groups: models belonging to these groups are hidden by default.
// They only appear when the user explicitly selects the group in the sidebar.
// Safe to add/remove entries — no errors if the group doesn't exist in the data.
const OPT_IN_GROUPS = new Set(['Windsurf公益']);

// ─── Vendor color accents ───────────────────────────────────────────────────
const VENDOR_COLORS = {
  'OpenAI': '#10A37F', 'Anthropic': '#D4A574', 'Claude': '#D4A574',
  'Google': '#4285F4', 'Gemini': '#4285F4', 'xAI': '#1DA1F2', 'Grok': '#1DA1F2',
  'Meta': '#0668E1', 'DeepSeek': '#4D6BFE', '阿里巴巴': '#FF6A00', 'Qwen': '#FF6A00',
  'Mistral': '#F54E42', 'Cohere': '#39594D', 'Moonshot': '#5B5BD6',
  'Perplexity': '#20808D', 'SiliconCloud': '#6366F1', '百度': '#2932E1', '智谱': '#3B5998',
};

function useBillingColors() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return {
    usage:   { text: isDark ? '#60A5FA' : '#2563EB', bg: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(37,99,235,0.08)' },
    request: { text: isDark ? '#FBBF24' : '#B45309', bg: isDark ? 'rgba(251,191,36,0.12)' : 'rgba(180,83,9,0.08)' },
  };
}

const globalAnimations = (
  <GlobalStyles styles={{
    '@keyframes pricingFadeUp': {
      from: { opacity: 0, transform: 'translateY(12px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
  }} />
);

// ─── Sidebar Filter Section ────────────────────────────────────────────────
function FilterSection({ title, children }) {
  const theme = useTheme();
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="caption" sx={{
        fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary',
        textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1, display: 'block',
      }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {children}
      </Stack>
    </Box>
  );
}

function FilterChip({ label, count, ratio, selected, onClick, color }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const chipColor = color || theme.palette.primary.main;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5,
        px: 1.2, py: 0.45, borderRadius: 2, cursor: 'pointer',
        border: `1px solid ${selected ? alpha(chipColor, 0.5) : alpha(theme.palette.divider, 0.4)}`,
        backgroundColor: selected
          ? alpha(chipColor, isDark ? 0.15 : 0.08)
          : 'transparent',
        transition: 'all 0.15s ease',
        '&:hover': {
          borderColor: alpha(chipColor, 0.5),
          backgroundColor: alpha(chipColor, isDark ? 0.1 : 0.05),
        },
      }}
    >
      <Typography variant="caption" sx={{
        fontWeight: selected ? 700 : 500, fontSize: '0.72rem', lineHeight: 1,
        color: selected ? chipColor : 'text.primary',
      }}>
        {label}
      </Typography>
      {ratio != null && (
        <Typography variant="caption" sx={{
          fontWeight: 600, fontSize: '0.62rem', lineHeight: 1,
          color: selected ? chipColor : 'text.secondary', opacity: 0.8,
        }}>
          {ratio}x
        </Typography>
      )}
      {count != null && (
        <Box sx={{
          px: 0.5, py: 0.1, borderRadius: 0.8, minWidth: 16, textAlign: 'center',
          backgroundColor: selected ? alpha(chipColor, 0.15) : alpha(theme.palette.text.primary, 0.06),
        }}>
          <Typography variant="caption" sx={{
            fontWeight: 700, fontSize: '0.58rem', lineHeight: 1,
            color: selected ? chipColor : 'text.secondary',
          }}>
            {count}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Vendor Pill (hero area) ───────────────────────────────────────────────
function VendorPill({ vendor, count, selected, onClick, isDark }) {
  const theme = useTheme();
  const vc = VENDOR_COLORS[vendor.name] || theme.palette.primary.main;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        px: 1.5, py: 0.6, borderRadius: 2.5, cursor: 'pointer',
        border: `1.5px solid ${selected ? alpha(vc, 0.5) : alpha(theme.palette.divider, 0.4)}`,
        backgroundColor: selected
          ? alpha(vc, isDark ? 0.15 : 0.08)
          : alpha(theme.palette.background.paper, isDark ? 0.4 : 0.7),
        backdropFilter: 'blur(8px)',
        transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
        ...(selected && {
          boxShadow: `0 2px 8px ${alpha(vc, isDark ? 0.25 : 0.15)}`,
        }),
        '&:hover': {
          borderColor: alpha(vc, 0.5),
          backgroundColor: alpha(vc, isDark ? 0.18 : 0.1),
          transform: 'translateY(-1px)',
        },
        '&:active': { transform: 'scale(0.97)' },
      }}
    >
      <VendorIcon name={vendor.name} icon={vendor.icon} size={18} />
      <Typography variant="caption" sx={{
        fontWeight: selected ? 700 : 500,
        color: selected ? vc : 'text.primary',
        fontSize: '0.76rem', lineHeight: 1,
      }}>
        {vendor.name}
      </Typography>
      <Box sx={{
        px: 0.6, py: 0.15, borderRadius: 1,
        backgroundColor: selected ? alpha(vc, 0.15) : alpha(theme.palette.text.primary, 0.06),
      }}>
        <Typography variant="caption" sx={{
          fontWeight: 700, fontSize: '0.6rem', lineHeight: 1,
          color: selected ? vc : 'text.secondary',
        }}>
          {count}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  const theme = useTheme();
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5,
      borderRadius: 3, flex: 1, minWidth: 160,
      background: alpha(color, theme.palette.mode === 'dark' ? 0.08 : 0.05),
      border: `1px solid ${alpha(color, 0.12)}`,
    }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(color, 0.12),
      }}>
        <Icon sx={{ fontSize: 18, color }} />
      </Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, fontSize: '1.1rem' }}>{value}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>{label}</Typography>
      </Box>
    </Box>
  );
}

// ─── Model Card ────────────────────────────────────────────────────────────
function ModelCard({ model, vendor, index, displayMode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const vendorName = vendor?.name || t('未知');
  const vendorColor = VENDOR_COLORS[vendorName] || theme.palette.primary.main;
  const billing = useBillingColors();
  const currency = getCurrencyInfo();
  const quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit') || '500000');

  // Ratio values
  const inputRatio = model.model_ratio;
  const completionRatio = model.completion_ratio;
  const cacheRatio = model.cache_ratio;

  // Price calculation (USD per 1M tokens, or tokens per 1M tokens)
  const inputPriceUSD = model.model_price > 0
    ? (model.model_price * 2 / quotaPerUnit)
    : (model.model_ratio * 0.002);
  const outputPriceUSD = model.model_price > 0
    ? (model.model_price * 2 * model.completion_ratio / quotaPerUnit)
    : (model.model_ratio * model.completion_ratio * 0.002);
  // In TOKENS mode, convert USD to token cost: multiply by quotaPerUnit (500K tokens = $1)
  const inputPrice = currency.isTokens ? inputPriceUSD * quotaPerUnit : inputPriceUSD * currency.rate;
  const outputPrice = currency.isTokens ? outputPriceUSD * quotaPerUnit : outputPriceUSD * currency.rate;
  const fmtPrice = (v) => currency.isTokens
    ? `${Number(v.toFixed(2)).toLocaleString()} tokens`
    : `${currency.symbol}${v.toFixed(4)}`;

  const copyModel = (e) => {
    e.stopPropagation();
    copy(model.model_name);
    showSuccess(t('模型名称已复制'));
  };

  const fmtRatio = (v) => {
    if (v == null) return null;
    if (v >= 1 && v === Math.floor(v)) return `${v}x`;
    if (v >= 0.01) return `${parseFloat(v.toFixed(6))}x`;
    return `${v}x`;
  };

  return (
    <Card sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
      animation: `pricingFadeUp 0.3s ease-out both`,
      animationDelay: `${Math.min(index * 0.03, 0.4)}s`,
      background: isDark
        ? `linear-gradient(145deg, ${alpha(vendorColor, 0.04)} 0%, ${theme.palette.background.paper} 40%)`
        : theme.palette.background.paper,
      transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
      '&::before': {
        content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${vendorColor}, ${alpha(vendorColor, 0.2)})`,
        opacity: 0, transition: 'opacity 0.25s ease',
      },
      '&:hover': {
        transform: 'translateY(-4px)',
        borderColor: alpha(vendorColor, 0.4),
        boxShadow: `0 8px 30px ${alpha(vendorColor, isDark ? 0.15 : 0.1)}`,
        '&::before': { opacity: 1 },
      },
    }}>
      <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box sx={{
            p: 0.6, borderRadius: 2, flexShrink: 0,
            background: alpha(vendorColor, 0.1),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <VendorIcon name={vendorName} icon={vendor?.icon} size={26} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Tooltip title={model.model_name} placement="top-start">
              <Typography variant="subtitle2" sx={{
                fontWeight: 700, lineHeight: 1.3, fontSize: '0.8rem',
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {model.model_name || '-'}
              </Typography>
            </Tooltip>
            <Typography variant="caption" sx={{ color: vendorColor, fontWeight: 600, fontSize: '0.68rem', opacity: 0.8 }}>
              {vendorName}
            </Typography>
          </Box>
          <Tooltip title={t('复制模型名')}>
            <IconButton size="small" onClick={copyModel} sx={{
              opacity: 0, transition: 'all 0.2s',
              '.MuiCard-root:hover &': { opacity: 0.5 },
              '&:hover': { opacity: '1 !important', color: vendorColor, backgroundColor: alpha(vendorColor, 0.1) },
            }}>
              <ContentCopy sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Ratio / Price info */}
        <Box sx={{
          mb: 1.5, p: 1.2, borderRadius: 2,
          backgroundColor: isDark ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.common.black, 0.015),
          border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
          fontFamily: '"Geist Mono", "SF Mono", monospace',
        }}>
          {model.quota_type === 1 ? (
            /* Per-request billing: show fixed price per call */
            <Stack spacing={0.6}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                  {t('固定价格')}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: billing.request.text }}>
                  {model.model_price > 0
                    ? (currency.isTokens
                        ? `${(model.model_price * quotaPerUnit).toFixed(0)} tokens/${t('次')}`
                        : `${currency.symbol}${(model.model_price * currency.rate).toFixed(4)}/${t('次')}`)
                    : t('免费')}
                </Typography>
              </Stack>
            </Stack>
          ) : displayMode === 'ratio' ? (
            <Stack spacing={0.6}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                  {t('输入倍率')}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'success.main' }}>
                  {fmtRatio(inputRatio)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                  {t('补全倍率')}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'warning.main' }}>
                  {fmtRatio(completionRatio)}
                </Typography>
              </Stack>
              {cacheRatio != null && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                    {t('缓存读取倍率')}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'info.main' }}>
                    {fmtRatio(cacheRatio)}
                  </Typography>
                </Stack>
              )}
            </Stack>
          ) : (
            <Stack spacing={0.6}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                  {t('输入')} /1M
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'success.main' }}>
                  {fmtPrice(inputPrice)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                  {t('输出')} /1M
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'warning.main' }}>
                  {fmtPrice(outputPrice)}
                </Typography>
              </Stack>
            </Stack>
          )}
        </Box>

        {/* Tags */}
        <Stack direction="row" spacing={0.5} sx={{ mt: 'auto', flexWrap: 'wrap', gap: 0.5 }}>
          <Chip
            label={model.quota_type === 0 ? t('按量计费') : t('按次计费')}
            size="small"
            sx={{
              fontSize: '0.6rem', height: 20, fontWeight: 700,
              backgroundColor: model.quota_type === 0 ? billing.usage.bg : billing.request.bg,
              color: model.quota_type === 0 ? billing.usage.text : billing.request.text,
              border: 'none',
            }}
          />
          {model.billing_mode === 'tiered_expr' && (
            <Tooltip title={model.billing_expr || ''}>
              <Chip
                label={t('阶梯计费')}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ fontSize: '0.6rem', height: 20, fontWeight: 700 }}
              />
            </Tooltip>
          )}
          {(model.enable_groups || []).slice(0, 2).map((g, i) => (
            <Chip key={i} label={g} size="small" variant="outlined"
              sx={{ fontSize: '0.6rem', height: 20, opacity: 0.6 }} />
          ))}
          {(model.enable_groups || []).length > 2 && (
            <Chip label={`+${(model.enable_groups || []).length - 2}`} size="small" variant="outlined"
              sx={{ fontSize: '0.6rem', height: 20, opacity: 0.4 }} />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Pricing Page ──────────────────────────────────────────────────────────
export default function Pricing() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { mode, toggleTheme } = useThemeMode();
  const isDark = mode === 'dark';
  const billing = useBillingColors();
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('card');
  const [displayMode, setDisplayMode] = useState('ratio'); // 'ratio' | 'price'
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);

  useEffect(() => {
    API.get('/api/pricing').then(res => {
      if (res.data.success !== false) setRawData(res.data);
    }).catch(err => showError(err)).finally(() => setLoading(false));
  }, []);

  const models = useMemo(() => safeArray(rawData?.data).filter(m => m.model_name), [rawData]);
  const vendors = useMemo(() => safeArray(rawData?.vendors), [rawData]);
  const groupRatio = rawData?.group_ratio || {};

  const vendorMap = useMemo(() => {
    const m = {};
    vendors.forEach(v => { m[v.id] = v; });
    return m;
  }, [vendors]);

  // All models visible (opt-in groups like Windsurf公益 included in list)
  const visibleModels = models;

  // Core models: exclude opt-in group models (for vendor counts — those vendors don't serve opt-in models)
  const coreModels = useMemo(() => {
    return models.filter(m => {
      const groups = m.enable_groups || [];
      return !groups.some(g => OPT_IN_GROUPS.has(g));
    });
  }, [models]);

  const vendorCounts = useMemo(() => {
    const c = {};
    coreModels.forEach(m => {
      const v = vendorMap[m.vendor_id];
      const name = v?.name || t('未知');
      c[name] = (c[name] || 0) + 1;
    });
    return c;
  }, [coreModels, vendorMap]);

  // Group list with ratios from API (use all models so opt-in groups still appear in sidebar)
  const groupList = useMemo(() => {
    const c = {};
    models.forEach(m => (m.enable_groups || []).forEach(g => { c[g] = (c[g] || 0) + 1; }));
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [models]);

  // Tag list
  const tagList = useMemo(() => {
    const c = {};
    visibleModels.forEach(m => {
      if (m.tags) {
        m.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
          c[tag] = (c[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [visibleModels]);

  // Endpoint type list
  const endpointList = useMemo(() => {
    const c = {};
    visibleModels.forEach(m => {
      (m.supported_endpoint_types || []).forEach(ep => {
        c[ep] = (c[ep] || 0) + 1;
      });
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [visibleModels]);

  const typeCounts = useMemo(() => {
    const c = { 0: 0, 1: 0 };
    visibleModels.forEach(m => { c[m.quota_type] = (c[m.quota_type] || 0) + 1; });
    return c;
  }, [visibleModels]);

  const filtered = useMemo(() => {
    return visibleModels.filter(m => {
      if (search && !m.model_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedVendor) {
        const v = vendorMap[m.vendor_id];
        if ((v?.name || '未知') !== selectedVendor) return false;
      }
      if (selectedGroup && !(m.enable_groups || []).includes(selectedGroup)) return false;
      if (selectedType !== null && m.quota_type !== selectedType) return false;
      if (selectedTag) {
        const tags = (m.tags || '').split(',').map(t => t.trim());
        if (!tags.includes(selectedTag)) return false;
      }
      if (selectedEndpoint) {
        if (!(m.supported_endpoint_types || []).includes(selectedEndpoint)) return false;
      }
      return true;
    });
  }, [visibleModels, vendorMap, search, selectedVendor, selectedGroup, selectedType, selectedTag, selectedEndpoint]);

  const hasFilters = selectedVendor || selectedGroup || selectedType !== null || selectedTag || selectedEndpoint || search;
  const resetFilters = () => {
    setSelectedVendor(null); setSelectedGroup(null); setSelectedType(null);
    setSelectedTag(null); setSelectedEndpoint(null); setSearch('');
  };

  const quotaPerUnit = parseFloat(localStorage.getItem('quota_per_unit') || '500000');
  const tableCurrency = getCurrencyInfo();
  const calcPrice = (m, isOutput) => {
    const base = m.model_price > 0 ? (m.model_price * 2 / quotaPerUnit) : (m.model_ratio * 0.002);
    const usd = isOutput ? base * m.completion_ratio : base;
    const v = tableCurrency.isTokens ? usd * quotaPerUnit : usd * tableCurrency.rate;
    return tableCurrency.isTokens ? `${Number(v.toFixed(2)).toLocaleString()}` : v.toFixed(4);
  };
  const fmtRatio = (v) => {
    if (v == null) return '-';
    if (v >= 1 && v === Math.floor(v)) return `${v}x`;
    return `${parseFloat(v.toFixed(6))}x`;
  };

  const selectedVendorColor = selectedVendor ? (VENDOR_COLORS[selectedVendor] || theme.palette.primary.main) : theme.palette.primary.main;
  const vendorCount = Object.keys(vendorCounts).length;
  const hasSidebar = tagList.length > 0 || endpointList.length > 0 || groupList.length > 0;

  return (
    <>
      {globalAnimations}
      <Box sx={{ minHeight: '100vh', position: 'relative' }}>
        <Box sx={{ maxWidth: 1500, mx: 'auto', p: { xs: 2, md: 3 } }}>

          {/* ── Back + Theme Toggle ── */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box
              onClick={() => navigate('/console')}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.8, py: 0.8, borderRadius: '100px', cursor: 'pointer',
                backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.85 : 0.92),
                backdropFilter: 'blur(16px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  transform: 'translateX(-2px)',
                },
                '&:active': { transform: 'scale(0.96)' },
              }}
            >
              <ArrowBack sx={{ fontSize: 17, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.primary', fontSize: '0.75rem' }}>
                SKIAPI
              </Typography>
            </Box>
            <IconButton onClick={toggleTheme} sx={{
              width: 40, height: 40,
              backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.85 : 0.92),
              backdropFilter: 'blur(16px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
              '&:hover': { backgroundColor: alpha(isDark ? '#FBBF24' : '#6366F1', 0.1) },
            }}>
              {isDark ? <LightMode sx={{ fontSize: 19, color: '#FBBF24' }} /> : <DarkMode sx={{ fontSize: 19, color: '#6366F1' }} />}
            </IconButton>
          </Stack>

          {/* ── Hero Section ── */}
          <Box sx={{ pb: 3, mb: 2, animation: 'pricingFadeUp 0.4s ease-out' }}>
            <Typography sx={{
              fontSize: { xs: '1.8rem', md: '2.5rem' },
              fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', mb: 1,
            }}>
              {selectedVendor || t('模型定价')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 520, mb: 3 }}>
              {t('查看所有可用的AI模型供应商，包括众多知名供应商的模型。')}
            </Typography>

            {/* Vendor pills */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
              <Box
                onClick={() => setSelectedVendor(null)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.75,
                  px: 1.5, py: 0.6, borderRadius: 2.5, cursor: 'pointer',
                  border: `1.5px solid ${!selectedVendor ? alpha(theme.palette.primary.main, 0.5) : alpha(theme.palette.divider, 0.4)}`,
                  backgroundColor: !selectedVendor
                    ? alpha(theme.palette.primary.main, isDark ? 0.12 : 0.06)
                    : alpha(theme.palette.background.paper, isDark ? 0.4 : 0.7),
                  backdropFilter: 'blur(8px)',
                  ...(!selectedVendor && {
                    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, isDark ? 0.25 : 0.15)}`,
                  }),
                  '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.4), transform: 'translateY(-1px)' },
                  '&:active': { transform: 'scale(0.97)' },
                }}
              >
                <Typography variant="caption" sx={{
                  fontWeight: !selectedVendor ? 700 : 500, fontSize: '0.76rem', lineHeight: 1,
                  color: !selectedVendor ? theme.palette.primary.main : 'text.primary',
                }}>
                  {t('全部')}
                </Typography>
                <Box sx={{
                  px: 0.6, py: 0.15, borderRadius: 1,
                  backgroundColor: !selectedVendor
                    ? alpha(theme.palette.primary.main, 0.15)
                    : alpha(theme.palette.text.primary, 0.06),
                }}>
                  <Typography variant="caption" sx={{
                    fontWeight: 700, fontSize: '0.6rem', lineHeight: 1,
                    color: !selectedVendor ? theme.palette.primary.main : 'text.secondary',
                  }}>
                    {coreModels.length}
                  </Typography>
                </Box>
              </Box>
              {vendors.filter(v => vendorCounts[v.name] > 0).sort((a, b) => (vendorCounts[b.name] || 0) - (vendorCounts[a.name] || 0)).map(v => (
                <VendorPill
                  key={v.id}
                  vendor={v}
                  count={vendorCounts[v.name] || 0}
                  selected={selectedVendor === v.name}
                  onClick={() => setSelectedVendor(v.name === selectedVendor ? null : v.name)}
                  isDark={isDark}
                />
              ))}
            </Box>

            {/* Stats bar */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <StatCard icon={Category} label={t('可用模型')} value={filtered.length} color={selectedVendorColor} />
              <StatCard icon={TrendingUp} label={t('供应商')} value={vendorCount} color="#7C3AED" />
              <StatCard icon={Speed} label={t('按量计费')} value={typeCounts[0]} color="#3B82F6" />
            </Stack>
          </Box>

          {/* ── Main Content: Sidebar + Grid ── */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5}>

            {/* ── Sidebar Filters ── */}
            <Box sx={{
              width: { xs: '100%', md: 240 }, flexShrink: 0,
              display: { xs: 'none', md: 'block' },
            }}>
              <Box sx={{
                position: 'sticky', top: 16,
                p: 2, borderRadius: 3,
                backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.6 : 0.8),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
              }}>
                {/* Reset */}
                {hasFilters && (
                  <Box sx={{ mb: 2, textAlign: 'right' }}>
                    <Chip label={t('重置')} size="small" onClick={resetFilters} icon={<RestartAlt sx={{ fontSize: 14 }} />}
                      sx={{ fontSize: '0.68rem', cursor: 'pointer' }} />
                  </Box>
                )}

                {/* 可用令牌分组 */}
                {groupList.length > 0 && (
                  <FilterSection title={t('可用令牌分组')}>
                    <FilterChip
                      label={t('全部分组')}
                      count={visibleModels.length}
                      selected={!selectedGroup}
                      onClick={() => setSelectedGroup(null)}
                    />
                    {groupList.map(([name, count]) => (
                      <FilterChip
                        key={name}
                        label={name}
                        count={count}
                        ratio={groupRatio[name]}
                        selected={selectedGroup === name}
                        onClick={() => setSelectedGroup(selectedGroup === name ? null : name)}
                      />
                    ))}
                  </FilterSection>
                )}

                {/* 计费类型 */}
                <FilterSection title={t('计费类型')}>
                  <FilterChip
                    label={t('全部类型')}
                    count={visibleModels.length}
                    selected={selectedType === null}
                    onClick={() => setSelectedType(null)}
                  />
                  <FilterChip
                    label={t('按量计费')}
                    count={typeCounts[0]}
                    selected={selectedType === 0}
                    onClick={() => setSelectedType(selectedType === 0 ? null : 0)}
                    color={billing.usage.text}
                  />
                  <FilterChip
                    label={t('按次计费')}
                    count={typeCounts[1]}
                    selected={selectedType === 1}
                    onClick={() => setSelectedType(selectedType === 1 ? null : 1)}
                    color={billing.request.text}
                  />
                </FilterSection>

                {/* 标签 */}
                {tagList.length > 0 && (
                  <FilterSection title={t('标签')}>
                    <FilterChip
                      label={t('全部标签')}
                      count={models.length}
                      selected={!selectedTag}
                      onClick={() => setSelectedTag(null)}
                    />
                    {tagList.map(([name, count]) => (
                      <FilterChip
                        key={name}
                        label={name}
                        count={count}
                        selected={selectedTag === name}
                        onClick={() => setSelectedTag(selectedTag === name ? null : name)}
                      />
                    ))}
                  </FilterSection>
                )}

                {/* 端点类型 */}
                {endpointList.length > 0 && (
                  <FilterSection title={t('端点类型')}>
                    <FilterChip
                      label={t('全部端点')}
                      count={models.length}
                      selected={!selectedEndpoint}
                      onClick={() => setSelectedEndpoint(null)}
                    />
                    {endpointList.map(([name, count]) => (
                      <FilterChip
                        key={name}
                        label={name}
                        count={count}
                        selected={selectedEndpoint === name}
                        onClick={() => setSelectedEndpoint(selectedEndpoint === name ? null : name)}
                      />
                    ))}
                  </FilterSection>
                )}
              </Box>
            </Box>

            {/* ── Right Content ── */}
            <Box sx={{ flex: 1, minWidth: 0 }}>

              {/* ── Controls Bar ── */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap',
                p: 1.5, borderRadius: 3,
                backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.6 : 0.8),
                backdropFilter: 'blur(16px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
              }}>
                <TextField
                  placeholder={t('搜索模型...')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                  }}
                  sx={{
                    flex: 1, minWidth: 180, maxWidth: 320,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: alpha(theme.palette.background.default, isDark ? 0.5 : 0.6),
                      borderRadius: 2,
                    },
                  }}
                />

                {/* Mobile group chips */}
                <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'flex', md: 'none' }, flexWrap: 'wrap', gap: 0.5 }}>
                  {groupList.slice(0, 3).map(([name, count]) => (
                    <Chip key={name} size="small" variant={selectedGroup === name ? 'filled' : 'outlined'}
                      label={`${name} ${count}`}
                      onClick={() => setSelectedGroup(name === selectedGroup ? null : name)}
                      sx={{ cursor: 'pointer', fontWeight: selectedGroup === name ? 700 : 500, fontSize: '0.7rem' }}
                    />
                  ))}
                </Stack>

                <Box sx={{ flex: 1 }} />

                {/* Display mode toggle */}
                <ToggleButtonGroup value={displayMode} exclusive onChange={(_, v) => v && setDisplayMode(v)} size="small">
                  <ToggleButton value="ratio">
                    <Tooltip title={t('倍率')}><Typography sx={{ fontSize: '0.72rem', fontWeight: 600, px: 0.5 }}>
                      {t('倍率')}
                    </Typography></Tooltip>
                  </ToggleButton>
                  <ToggleButton value="price">
                    <Tooltip title={t('充值价格显示')}><Typography sx={{ fontSize: '0.72rem', fontWeight: 600, px: 0.5 }}>
                      {tableCurrency.isTokens ? 'Tokens' : tableCurrency.symbol}
                    </Typography></Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.25, opacity: 0.5 }} />

                {/* View mode toggle */}
                <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small">
                  <ToggleButton value="card"><Tooltip title={t('卡片视图')}><ViewModule sx={{ fontSize: 20 }} /></Tooltip></ToggleButton>
                  <ToggleButton value="table"><Tooltip title={t('表格视图')}><ViewList sx={{ fontSize: 20 }} /></Tooltip></ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* ── Loading ── */}
              {loading && (
                <Grid container spacing={2}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 3 }} key={i}>
                      <Card>
                        <CardContent sx={{ p: 2 }}>
                          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                            <Skeleton variant="rounded" width={38} height={38} sx={{ borderRadius: 2 }} />
                            <Box sx={{ flex: 1 }}>
                              <Skeleton width="70%" height={14} />
                              <Skeleton width="40%" height={12} sx={{ mt: 0.5 }} />
                            </Box>
                          </Stack>
                          <Skeleton variant="rounded" height={60} sx={{ mb: 1, borderRadius: 2 }} />
                          <Stack direction="row" spacing={0.5}>
                            <Skeleton variant="rounded" width={60} height={20} sx={{ borderRadius: 1.5 }} />
                            <Skeleton variant="rounded" width={48} height={20} sx={{ borderRadius: 1.5 }} />
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* ── Empty ── */}
              {!loading && filtered.length === 0 && (
                <EmptyState icon={StorefrontOutlined} title={t('暂无匹配模型')} description={t('尝试调整筛选条件或搜索关键词')} />
              )}

              {/* ── Card View ── */}
              {!loading && viewMode === 'card' && filtered.length > 0 && (
                <Grid container spacing={2}>
                  {filtered.map((m, i) => (
                    <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 3 }} key={m.model_name + i}>
                      <ModelCard model={m} vendor={vendorMap[m.vendor_id]} index={i} displayMode={displayMode} />
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* ── Table View ── */}
              {!loading && viewMode === 'table' && filtered.length > 0 && (
                <Card sx={{ animation: 'pricingFadeUp 0.3s ease-out' }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead><TableRow>
                        <TableCell>{t('模型')}</TableCell>
                        <TableCell>{t('供应商')}</TableCell>
                        {displayMode === 'ratio' ? (
                          <>
                            <TableCell align="right">{t('输入倍率')}</TableCell>
                            <TableCell align="right">{t('补全倍率')}</TableCell>
                            <TableCell align="right">{t('缓存读取倍率')}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell align="right">{t('输入')} /1M</TableCell>
                            <TableCell align="right">{t('输出')} /1M</TableCell>
                          </>
                        )}
                        <TableCell>{t('计费')}</TableCell>
                        <TableCell>{t('分组')}</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {filtered.map((m, i) => {
                          const v = vendorMap[m.vendor_id];
                          const vc = VENDOR_COLORS[v?.name] || theme.palette.primary.main;
                          return (
                            <TableRow key={i} hover>
                              <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <VendorIcon name={v?.name} icon={v?.icon} size={22} />
                                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>{m.model_name}</Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Chip label={v?.name || t('未知')} size="small" variant="outlined"
                                  sx={{ fontSize: '0.68rem', borderColor: alpha(vc, 0.3), color: vc }} />
                              </TableCell>
                              {m.quota_type === 1 ? (
                                /* Per-request: span across ratio/price columns, show fixed price */
                                displayMode === 'ratio' ? (
                                  <>
                                    <TableCell align="right" colSpan={3} sx={{ color: billing.request.text, fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                      {m.model_price > 0
                                        ? (tableCurrency.isTokens
                                            ? `${(m.model_price * quotaPerUnit).toFixed(0)} tokens/${t('次')}`
                                            : `${tableCurrency.symbol}${(m.model_price * tableCurrency.rate).toFixed(4)}/${t('次')}`)
                                        : t('免费')}
                                    </TableCell>
                                  </>
                                ) : (
                                  <>
                                    <TableCell align="right" colSpan={2} sx={{ color: billing.request.text, fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                      {m.model_price > 0
                                        ? (tableCurrency.isTokens
                                            ? `${(m.model_price * quotaPerUnit).toFixed(0)} tokens/${t('次')}`
                                            : `${tableCurrency.symbol}${(m.model_price * tableCurrency.rate).toFixed(4)}/${t('次')}`)
                                        : t('免费')}
                                    </TableCell>
                                  </>
                                )
                              ) : displayMode === 'ratio' ? (
                                <>
                                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                    {fmtRatio(m.model_ratio)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                    {fmtRatio(m.completion_ratio)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: 'info.main', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                    {fmtRatio(m.cache_ratio)}
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600, fontFamily: 'monospace' }}>
                                    {tableCurrency.isTokens ? '' : tableCurrency.symbol}{calcPrice(m, false)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600, fontFamily: 'monospace' }}>
                                    {tableCurrency.isTokens ? '' : tableCurrency.symbol}{calcPrice(m, true)}
                                  </TableCell>
                                </>
                              )}
                              <TableCell>
                                <Chip
                                  label={m.billing_mode === 'tiered_expr' ? t('阶梯') : (m.quota_type === 0 ? t('按量') : t('按次'))}
                                  size="small"
                                  title={m.billing_expr || undefined}
                                  sx={{
                                    fontSize: '0.68rem', border: 'none',
                                    backgroundColor: m.billing_mode === 'tiered_expr' ? alpha(theme.palette.secondary.main, 0.12) : m.quota_type === 0 ? billing.usage.bg : billing.request.bg,
                                    color: m.billing_mode === 'tiered_expr' ? theme.palette.secondary.main : m.quota_type === 0 ? billing.usage.text : billing.request.text,
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                                {(m.enable_groups || []).join(', ')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>
              )}

              {/* Footer */}
              <Box sx={{ textAlign: 'center', py: 4, mt: 3, opacity: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t('价格以 USD 每百万 token 计算')} · per million tokens
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>
    </>
  );
}

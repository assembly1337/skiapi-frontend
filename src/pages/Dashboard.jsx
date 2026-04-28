import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Skeleton, Stack, Chip, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  alpha, useTheme, ToggleButton, ToggleButtonGroup, IconButton, Tooltip,
  Button, Divider, LinearProgress, Menu, MenuItem, ListItemIcon, ListItemText,
  TextField, Popover, Fade,
} from '@mui/material';
import {
  TrendingUp, AccountBalanceWallet, Speed, Dashboard as DashIcon,
  ShowChart, DataUsage, Bolt, Token as TokenIcon,
  PieChartOutline, TimelineOutlined, BarChartOutlined, LeaderboardOutlined,
  InfoOutlined, Campaign, Refresh, VpnKey, ContentCopy,
  ArrowForward, Redeem, RocketLaunch, CheckCircle,
  Receipt, LocalFireDepartment, Memory, CalendarMonth, DateRange,
  ExpandMore,
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { renderQuota, timestamp2string, extractList, copy } from '../utils';
import EmptyState from '../components/common/EmptyState';

// ─── Colors ─────────────────────────────────────────────────────────────────
const C = { blue: '#1a73e8', orange: '#e8710a', green: '#1e8e3e', red: '#d93025', purple: '#9c27b0', cyan: '#00bcd4', yellow: '#f9ab00', pink: '#e91e63' };
const CHART_COLORS = [C.blue, C.purple, C.cyan, C.orange, C.green, C.red, C.pink, C.yellow, '#607d8b', '#795548'];

// ─── Greeting ───────────────────────────────────────────────────────────────
function getGreetingKey() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

// ─── Quick Action Card ──────────────────────────────────────────────────────
function QuickAction({ icon: Icon, color, title, value, desc, actionLabel, onAction }) {
  const theme = useTheme();
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%', '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(color, 0.1) }}>
            <Icon sx={{ fontSize: 18, color }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{title}</Typography>
        </Stack>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{value}</Typography>
        {desc && <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5 }}>{desc}</Typography>}
        {actionLabel && (
          <Button size="small" variant="outlined" endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
            onClick={onAction} sx={{ mt: 'auto', alignSelf: 'flex-start' }}>{actionLabel}</Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Metric Row ─────────────────────────────────────────────────────────────
function MetricRow({ icon: Icon, color, label, value, loading }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.8 }}>
      <Box sx={{ width: 32, height: 32, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(color, 0.12), flexShrink: 0 }}>
        <Icon sx={{ fontSize: 16, color }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>{label}</Typography>
        {loading ? <Skeleton width={80} height={24} /> :
          <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>}
      </Box>
    </Stack>
  );
}

// ─── Stat Section ───────────────────────────────────────────────────────────
function StatSection({ icon: Icon, title, children }) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, pb: '16px !important' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>{title}</Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [range, setRange] = useState('7');
  const [chartTab, setChartTab] = useState(0);
  // Ranking metric for "调用次数排行" chart — count | quota | token_used
  // skiapi.dev bills by tokens, so users want to rank by tokens, not request count
  const [rankMetric, setRankMetric] = useState('quota');
  const { user, isAdmin } = useAuth();
  const [customAnchor, setCustomAnchor] = useState(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [rangeLabel, setRangeLabel] = useState('7天');

  const RANGE_OPTIONS = [
    { value: '1', label: t('今日') },
    { value: '7', label: t('7天') },
    { value: '30', label: t('30天') },
    { value: '90', label: t('90天') },
    { value: '180', label: t('半年') },
    { value: '365', label: t('一年') },
    { value: 'custom', label: t('自定义') },
  ];

  const handleRangeChange = (val) => {
    if (val === 'custom') {
      return; // handled by popover
    }
    setRange(val);
    const opt = RANGE_OPTIONS.find(o => o.value === val);
    setRangeLabel(opt?.label || val);
    setCustomAnchor(null);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      const startTs = Math.floor(new Date(customStart).getTime() / 1000);
      const endTs = Math.floor(new Date(customEnd + 'T23:59:59').getTime() / 1000);
      setRange(`custom:${startTs}:${endTs}`);
      setRangeLabel(`${customStart.slice(5)} ~ ${customEnd.slice(5)}`);
      setCustomAnchor(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [statRes, logRes] = await Promise.all([
          isAdmin ? API.get('/api/log/stat') : API.get('/api/log/self/stat'),
          isAdmin ? API.get('/api/log/?p=1&page_size=8') : API.get('/api/log/self?p=1&page_size=8'),
        ]);
        if (statRes.data.success) setStats(statRes.data.data);
        if (logRes.data.success) {
          const { items } = extractList(logRes.data);
          setLogs(items.length > 0 ? items : (Array.isArray(logRes.data.data) ? logRes.data.data : []));
        }
      } catch {}
      setLoading(false);
    })();
  }, [isAdmin]);

  useEffect(() => {
    (async () => {
      setChartLoading(true);
      let start, end;
      if (range.startsWith('custom:')) {
        const parts = range.split(':');
        start = parseInt(parts[1]);
        end = parseInt(parts[2]);
      } else {
        end = Math.floor(Date.now() / 1000);
        start = end - parseInt(range) * 86400;
      }
      try {
        const ep = isAdmin ? '/api/data' : '/api/data/self';
        const res = await API.get(`${ep}?start_timestamp=${start}&end_timestamp=${end}`);
        if (res.data.success) setChartData(Array.isArray(res.data.data) ? res.data.data : []);
      } catch {}
      setChartLoading(false);
    })();
  }, [isAdmin, range]);

  const fmtQ = (v) => renderQuota(v);
  const fmtNum = (n) => {
    const v = Number(n) || 0;
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 10_000) return (v / 1_000).toFixed(1) + 'K';
    return v.toLocaleString();
  };

  // Chart data
  const pieData = useMemo(() => {
    const m = {};
    chartData.forEach(d => { const k = d.model_name || '?'; m[k] = (m[k] || 0) + (d.quota || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value], i) => ({ id: i, value, label, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [chartData]);

  const lineData = useMemo(() => {
    const m = {};
    chartData.forEach(d => {
      const day = new Date((d.created_at || 0) * 1000).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
      if (!m[day]) m[day] = { q: 0, c: 0 };
      m[day].q += d.quota || 0; m[day].c += d.count || 0;
    });
    const e = Object.entries(m);
    return { labels: e.map(x => x[0]), quota: e.map(x => x[1].q), count: e.map(x => x[1].c) };
  }, [chartData]);

  // Bar data for "调用次数分布" — always raw call count
  const barData = useMemo(() => {
    const m = {};
    chartData.forEach(d => { const k = d.model_name || '?'; m[k] = (m[k] || 0) + (d.count || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [chartData]);

  // Ranking data for "调用排行" — selectable metric. Important: skiapi.dev
  // bills by tokens, so request count alone misrepresents real usage cost.
  const rankData = useMemo(() => {
    const m = {};
    chartData.forEach(d => {
      const k = d.model_name || '?';
      const v = rankMetric === 'token_used' ? (d.token_used || 0)
              : rankMetric === 'quota' ? (d.quota || 0)
              : (d.count || 0);
      m[k] = (m[k] || 0) + v;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [chartData, rankMetric]);

  // Aggregate token total from chart data — used for the "统计 Tokens" metric
  // since the /api/log/stat endpoint does NOT return a token field.
  const totalTokensInRange = useMemo(
    () => chartData.reduce((sum, d) => sum + (d.token_used || 0), 0),
    [chartData],
  );

  const chartTabs = [t('消耗分布'), t('消耗趋势'), t('调用次数分布'), t('模型排行')];

  // Truncate long model names for axis labels: "claude-sonnet-4-5" → "claude-sonne…"
  const truncLabel = (s, n = 14) => {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  };

  // Shared chart styles — grid lines, axis colors, tooltip polish
  const axisColor = alpha(theme.palette.text.primary, 0.08);
  const tickColor = alpha(theme.palette.text.secondary, 0.8);
  const sharedChartSx = {
    '& .MuiChartsAxis-line': { stroke: axisColor },
    '& .MuiChartsAxis-tick': { stroke: axisColor },
    '& .MuiChartsAxis-tickLabel': { fill: tickColor, fontFamily: 'inherit' },
    '& .MuiChartsGrid-line': { stroke: axisColor, strokeDasharray: '3 3' },
    '& .MuiAreaElement-root': { fill: 'url(#dashAreaGradient)' },
    '& .MuiLineElement-root': { strokeWidth: 2.5, filter: `drop-shadow(0 2px 6px ${alpha(C.blue, 0.35)})` },
    '& .MuiMarkElement-root': { stroke: theme.palette.background.paper, strokeWidth: 2, scale: '0.8' },
  };

  const renderChart = () => {
    if (chartLoading) return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />;
    if (chartData.length === 0) return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Typography variant="body2" color="text.secondary">{t('暂无数据')}</Typography>
      </Box>
    );

    let chart;
    switch (chartTab) {
      case 0:
        chart = (
          <PieChart
            series={[{
              data: pieData, innerRadius: 60, outerRadius: 110, paddingAngle: 2, cornerRadius: 6,
              highlightScope: { fade: 'global', highlight: 'item' },
              faded: { innerRadius: 60, additionalRadius: -8, color: 'gray' },
              valueFormatter: (v) => fmtQ(v.value),
            }]}
            slotProps={{ legend: { direction: 'horizontal', position: { vertical: 'bottom', horizontal: 'center' } } }}
            height={300}
            skipAnimation
            sx={sharedChartSx}
          />
        );
        break;
      case 1:
        chart = (
          <Box sx={{ position: 'relative' }}>
            {/* SVG gradient definition for the area fill */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <linearGradient id="dashAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity="0.45" />
                  <stop offset="60%" stopColor={C.blue} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <LineChart
              xAxis={[{ data: lineData.labels, scaleType: 'point', tickLabelStyle: { fontSize: 10 } }]}
              yAxis={[{ tickLabelStyle: { fontSize: 10 }, valueFormatter: fmtQ }]}
              series={[{
                data: lineData.quota,
                label: t('消费额度'),
                color: C.blue,
                valueFormatter: (v) => v == null ? '-' : fmtQ(v),
                area: true,
                curve: 'monotoneX',
                showMark: true,
              }]}
              height={300}
              margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
              grid={{ horizontal: true }}
              slotProps={{ legend: { hidden: true } }}
              skipAnimation
              sx={sharedChartSx}
            />
          </Box>
        );
        break;
      case 2:
        chart = (
          <BarChart
            xAxis={[{
              scaleType: 'band',
              data: barData.map(d => truncLabel(d[0], 14)),
              tickLabelStyle: { fontSize: 10, angle: -35, textAnchor: 'end' },
              categoryGapRatio: 0.4,
              tickLabelInterval: () => true,
              height: 80,
            }]}
            yAxis={[{ tickLabelStyle: { fontSize: 10 } }]}
            series={[{
              data: barData.map(d => d[1]),
              label: t('调用次数'),
              color: C.blue,
              // Show the full (untruncated) model name in the tooltip
              valueFormatter: (v, ctx) => `${barData[ctx?.dataIndex]?.[0] || ''}: ${fmtNum(v)}`,
            }]}
            height={300}
            margin={{ left: 50, right: 20, top: 20, bottom: 10 }}
            grid={{ horizontal: true }}
            slotProps={{ legend: { hidden: true } }}
            borderRadius={6}
            skipAnimation
            sx={sharedChartSx}
          />
        );
        break;
      case 3: {
        // Bottom-to-top: highest first when reversed
        const rev = [...rankData].reverse();
        const labelMap = { count: t('调用次数'), quota: t('消费额度'), token_used: t('Token 数') };
        const fmt = rankMetric === 'quota' ? fmtQ : fmtNum;
        chart = (
          <BarChart
            yAxis={[{
              scaleType: 'band',
              data: rev.map(d => truncLabel(d[0], 16)),
              tickLabelStyle: { fontSize: 10 },
              categoryGapRatio: 0.4,
              tickLabelInterval: () => true,
              width: 130,
            }]}
            xAxis={[{ tickLabelStyle: { fontSize: 10 }, valueFormatter: fmt }]}
            series={[{
              data: rev.map(d => d[1]),
              label: labelMap[rankMetric],
              color: C.blue,
              valueFormatter: (v, ctx) => `${rev[ctx?.dataIndex]?.[0] || ''}: ${fmt(v)}`,
            }]}
            layout="horizontal"
            height={300}
            margin={{ left: 10, right: 20, top: 20, bottom: 40 }}
            grid={{ vertical: true }}
            slotProps={{ legend: { hidden: true } }}
            borderRadius={6}
            skipAnimation
            sx={sharedChartSx}
          />
        );
        break;
      }
      default: return null;
    }

    return (
      <Fade in key={chartTab} timeout={350}>
        <Box>{chart}</Box>
      </Fade>
    );
  };

  // API base URL for copy
  const apiBase = window.location.origin;

  return (
    <Box>
      {/* ── Greeting + Range Selector ── */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{t(getGreetingKey())}，{user?.display_name || user?.username}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.3 }}>{t('这是您的配额使用概览')}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup value={range.startsWith('custom:') ? 'custom' : range} exclusive
            onChange={(_, v) => v && (v === 'custom' ? null : handleRangeChange(v))} size="small"
            sx={{ '& .MuiToggleButton-root': { px: 1.5, fontSize: '0.75rem', textTransform: 'none' } }}>
            <ToggleButton value="1">{t('今日')}</ToggleButton>
            <ToggleButton value="7">{t('7天')}</ToggleButton>
            <ToggleButton value="30">{t('30天')}</ToggleButton>
            <ToggleButton value="90">{t('90天')}</ToggleButton>
            <ToggleButton value="365">{t('一年')}</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title={t('自定义日期范围')}>
            <IconButton size="small" onClick={(e) => setCustomAnchor(e.currentTarget)}
              sx={{ border: 1, borderColor: range.startsWith('custom:') ? 'primary.main' : 'divider',
                color: range.startsWith('custom:') ? 'primary.main' : 'text.secondary' }}>
              <DateRange fontSize="small" />
            </IconButton>
          </Tooltip>
          <Popover open={Boolean(customAnchor)} anchorEl={customAnchor} onClose={() => setCustomAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 280 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('自定义日期范围')}</Typography>
              <TextField type="date" label={t('开始日期')} size="small" value={customStart}
                onChange={(e) => setCustomStart(e.target.value)} InputLabelProps={{ shrink: true }}
                inputProps={{ max: customEnd || new Date().toISOString().split('T')[0] }} fullWidth />
              <TextField type="date" label={t('结束日期')} size="small" value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)} InputLabelProps={{ shrink: true }}
                inputProps={{ min: customStart, max: new Date().toISOString().split('T')[0] }} fullWidth />
              <Button variant="contained" size="small" onClick={handleCustomApply}
                disabled={!customStart || !customEnd}>{t('应用')}</Button>
            </Box>
          </Popover>
          {range.startsWith('custom:') && (
            <Chip label={rangeLabel} size="small" color="primary" variant="outlined"
              onDelete={() => handleRangeChange('7')} sx={{ fontSize: '0.7rem' }} />
          )}
          <Tooltip title={t('刷新')}><IconButton size="small" onClick={() => window.location.reload()} sx={{ border: 1, borderColor: 'divider' }}><Refresh fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Stack>

      {/* ── User Quick Overview (foxcode style) ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Balance card — large */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%', overflow: 'hidden' }}>
            <Box sx={{ height: 3, background: `linear-gradient(90deg, ${C.blue}, ${C.cyan})` }} />
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(C.blue, 0.1) }}>
                  <AccountBalanceWallet sx={{ fontSize: 18, color: C.blue }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('剩余配额')}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('当前可用额度余量')}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Card variant="outlined" sx={{ flex: 1, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <DataUsage sx={{ fontSize: 16, color: C.green }} />
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('按量额度')}</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{renderQuota(user?.quota || 0)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ flex: 1, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Receipt sx={{ fontSize: 16, color: C.orange }} />
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('已用额度')}</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{renderQuota(user?.used_quota || 0)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick actions */}
        <Grid size={{ xs: 6, md: 2.5 }}>
          <QuickAction icon={VpnKey} color={C.green} title={t('API 密钥')}
            value={`${user?.request_count || 0}`} desc={t('总请求次数')}
            actionLabel={t('管理密钥')} onAction={() => navigate('/console/token')} />
        </Grid>
        <Grid size={{ xs: 6, md: 2.5 }}>
          <QuickAction icon={Redeem} color={C.orange} title={t('充值中心')}
            value={renderQuota(user?.quota || 0)} desc={t('当前余额')}
            actionLabel={t('去充值')} onAction={() => navigate('/console/topup')} />
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center', '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5 }}>{t('API 地址')}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', wordBreak: 'break-all', mb: 1 }}>{apiBase}</Typography>
              <Button size="small" startIcon={<ContentCopy sx={{ fontSize: 14 }} />} variant="outlined"
                onClick={() => { copy(apiBase); import('../utils').then(u => u.showSuccess(t('已复制'))); }}>
                {t('复制')}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Stat Cards (4 cols, 2 metrics each) ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatSection icon={AccountBalanceWallet} title={t('账户数据')}>
            <MetricRow icon={AccountBalanceWallet} color={C.blue} label={t('当前余额')} value={renderQuota(user?.quota || 0)} loading={loading} />
            <MetricRow icon={LocalFireDepartment} color={C.red} label={t('历史消耗')} value={renderQuota(user?.used_quota || 0)} loading={loading} />
          </StatSection>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatSection icon={Bolt} title={t('使用统计')}>
            <MetricRow icon={TrendingUp} color={C.cyan} label={t('请求次数')} value={fmtNum(user?.request_count || 0)} loading={loading} />
            <MetricRow icon={ShowChart} color={C.purple} label={t('统计次数')} value={fmtNum(stats?.day_requests || 0)} loading={loading} />
          </StatSection>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatSection icon={DataUsage} title={t('资源消耗')}>
            <MetricRow icon={DataUsage} color={C.orange} label={t('统计额度')} value={renderQuota(stats?.quota || 0)} loading={loading} />
            <MetricRow icon={Memory} color={C.pink} label={t('统计Tokens')} value={fmtNum(totalTokensInRange)} loading={loading || chartLoading} />
          </StatSection>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatSection icon={Speed} title={t('性能指标')}>
            <MetricRow icon={Speed} color={C.green} label={t('平均RPM')} value={fmtNum(stats?.rpm || 0)} loading={loading} />
            <MetricRow icon={Bolt} color={C.red} label={t('平均TPM')} value={fmtNum(stats?.tpm || 0)} loading={loading} />
          </StatSection>
        </Grid>
      </Grid>

      {/* ── Charts + API Info ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PieChartOutline sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('模型数据分析')}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {chartTab === 3 && (
                    <ToggleButtonGroup value={rankMetric} exclusive size="small"
                      onChange={(_, v) => v && setRankMetric(v)}
                      sx={{ '& .MuiToggleButton-root': { px: 1.2, py: 0.3, fontSize: '0.7rem', textTransform: 'none' } }}>
                      <ToggleButton value="quota">{t('按额度')}</ToggleButton>
                      <ToggleButton value="token_used">{t('按 Token')}</ToggleButton>
                      <ToggleButton value="count">{t('按次数')}</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                  <Tabs value={chartTab} onChange={(_, v) => setChartTab(v)} variant="scrollable" scrollButtons="auto"
                    sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0.5, px: 1.5, fontSize: '0.75rem' } }}>
                    {chartTabs.map((tab, i) => <Tab key={i} label={tab} />)}
                  </Tabs>
                </Stack>
              </Stack>
              {renderChart()}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 3 }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Card sx={{ flex: 1 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Campaign sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('系统公告')}</Typography>
                </Stack>
                <Box sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
                  <Campaign sx={{ fontSize: 36, mb: 1, opacity: 0.2 }} />
                  <Typography variant="body2">{t('暂无公告')}</Typography>
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <InfoOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t('快速开始')}</Typography>
                </Stack>
                <Stack spacing={1}>
                  <Button size="small" variant="text" startIcon={<RocketLaunch sx={{ fontSize: 14 }} />}
                    onClick={() => navigate('/console/playground')} sx={{ justifyContent: 'flex-start' }}>{t('打开操练场')}</Button>
                  <Button size="small" variant="text" startIcon={<VpnKey sx={{ fontSize: 14 }} />}
                    onClick={() => navigate('/console/token')} sx={{ justifyContent: 'flex-start' }}>{t('创建 API 密钥')}</Button>
                  <Button size="small" variant="text" startIcon={<ShowChart sx={{ fontSize: 14 }} />}
                    onClick={() => navigate('/pricing')} sx={{ justifyContent: 'flex-start' }}>{t('查看模型广场')}</Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* ── Recent Requests ── */}
      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ShowChart sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('最近请求')}</Typography>
            </Stack>
            <Chip label={`${logs.length} ${t('条')}`} size="small" variant="outlined" />
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>{t('时间')}</TableCell><TableCell>{t('模型')}</TableCell><TableCell>Token</TableCell><TableCell align="right">{t('额度')}</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {loading ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
                )) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={4}>
                    <EmptyState icon={ShowChart} title={t('暂无请求记录')} sx={{ py: 3 }} />
                  </TableCell></TableRow>
                ) : logs.slice(0, 6).map((log, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{timestamp2string(log.created_at)}</TableCell>
                    <TableCell><Chip label={log.model_name || '-'} size="small" variant="outlined" /></TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.token_name || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{renderQuota(log.quota || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

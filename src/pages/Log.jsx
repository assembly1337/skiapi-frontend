import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Chip, Button, IconButton, Stack, Typography,
  Tooltip, alpha, useTheme, Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  BarChart, Delete, KeyboardArrowDown, KeyboardArrowRight,
  Speed, Token, MonetizationOn, MoreVert,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import { showError, showSuccess, timestamp2string, renderQuota } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import usePaginatedList from '../hooks/usePaginatedList';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LogFilters from '../components/log/LogFilters';
import LogDetailRow from '../components/log/LogDetailRow';

const typeColor = (type) => {
  if (type === 1) return 'success';
  if (type === 2) return 'primary';
  if (type === 3) return 'info';
  if (type === 4) return 'warning';
  if (type === 5) return 'error';
  if (type === 6) return 'secondary';
  return 'default';
};
const typeLabelKey = (type) => {
  if (type === 1) return '充值';
  if (type === 2) return '消费';
  if (type === 3) return '管理';
  if (type === 4) return '系统';
  if (type === 5) return '错误';
  if (type === 6) return '退款';
  return '其他';
};

const EMPTY_FILTERS = {
  type: 0, model_name: '', token_name: '', username: '', channel: '',
  group: '', request_id: '', start_timestamp: '', end_timestamp: '',
};

function truncate(str, maxLen = 60) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

function parseLogOther(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isSubscriptionBilling(log) {
  return parseLogOther(log.other).billing_source === 'subscription';
}

function getSubscriptionQuota(log) {
  const other = parseLogOther(log.other);
  return other.subscription_consumed ?? other.subscription_pre_consumed ?? log.quota ?? 0;
}

export default function Log() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  // Debounced mirror — updated 350ms after `filters` settles, so typing in
  // text fields doesn't spam /api/log/ on every keystroke. Select changes
  // (type, date presets) still go through the debounce for consistency but
  // feel instant at 350ms.
  const [debouncedFilters, setDebouncedFilters] = useState({ ...EMPTY_FILTERS });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [stats, setStats] = useState({ quota: 0, rpm: 0, tpm: 0 });
  const [moreAnchor, setMoreAnchor] = useState(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedFilters(filters), 350);
    return () => clearTimeout(handle);
  }, [filters]);

  const endpoint = isAdmin ? '/api/log/' : '/api/log/self';
  const statEndpoint = isAdmin ? '/api/log/stat' : '/api/log/self/stat';

  const extraParams = useMemo(() => {
    const params = {};
    for (const [k, v] of Object.entries(debouncedFilters)) {
      if (v !== '' && v !== 0 && v !== '0' && v != null) {
        params[k] = String(v);
      }
    }
    return Object.keys(params).length > 0 ? params : undefined;
  }, [debouncedFilters]);

  const { items: logs, loading, page, setPage, rowsPerPage, changeRowsPerPage, total, refresh } =
    usePaginatedList(endpoint, { extraParams });

  // Admin columns: expand, time, user, type, channel, group, model, token, input, output, quota, use_time, detail
  // Non-admin:     expand, time, type, model, token, input, output, quota, use_time, detail
  const colCount = isAdmin ? 13 : 10;

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
          params.append(k, v);
        }
      }
      const query = params.toString();
      const url = query ? `${statEndpoint}?${query}` : statEndpoint;
      const res = await API.get(url);
      if (res.data.success && res.data.data) {
        setStats({
          quota: res.data.data.quota || 0,
          rpm: res.data.data.rpm || 0,
          tpm: res.data.data.tpm || 0,
        });
      }
    } catch {
      // Stats fetch is non-critical
    }
  }, [statEndpoint, extraParams]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset to first page whenever applied filters change (debounced).
  useEffect(() => {
    setPage(0);
  }, [debouncedFilters, setPage]);

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
  };

  const handleDeleteHistory = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000);
      const res = await API.delete(`/api/log/?target_timestamp=${ts}`);
      if (res.data.success) { showSuccess(t('清除成功')); refresh(); fetchStats(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
    setConfirmOpen(false);
  };

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id);

  return (
    <Box>
      <PageHeader icon={BarChart} title={t('使用日志')} subtitle={`${t('共')} ${total} ${t('条日志')}`} />

      {/* Stats chips */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip
          icon={<MonetizationOn />}
          label={`${t('消耗额度')}: ${renderQuota(stats.quota)}`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<Speed />}
          label={`RPM: ${stats.rpm}`}
          color="success"
          variant="outlined"
          size="small"
        />
        <Chip
          icon={<Token />}
          label={`TPM: ${stats.tpm}`}
          color="warning"
          variant="outlined"
          size="small"
        />
      </Stack>

      <Card sx={{ mb: 2, p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'flex-start' }} justifyContent="space-between" spacing={1.5}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <LogFilters filters={filters} onChange={setFilters}
              onClear={handleClearFilters} isAdmin={isAdmin} />
          </Box>
          {isAdmin && (
            <Box sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', md: 'flex-start' } }}>
              <Tooltip title={t('更多')}>
                <IconButton size="small" onClick={(e) => setMoreAnchor(e.currentTarget)}
                  sx={{ color: 'text.secondary' }}>
                  <MoreVert fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                <MenuItem onClick={() => { setMoreAnchor(null); setConfirmOpen(true); }} sx={{ color: 'error.main' }}>
                  <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>{t('清除历史日志')}</ListItemText>
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Stack>
      </Card>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>{t('时间')}</TableCell>
                {isAdmin && <TableCell>{t('用户')}</TableCell>}
                <TableCell>{t('类型')}</TableCell>
                {isAdmin && <TableCell>{t('渠道')}</TableCell>}
                <TableCell>{t('分组')}</TableCell>
                <TableCell>{t('模型')}</TableCell>
                <TableCell>{t('令牌名称')}</TableCell>
                <TableCell align="right">{t('输入')}</TableCell>
                <TableCell align="right">{t('输出')}</TableCell>
                <TableCell align="right">{t('额度')}</TableCell>
                <TableCell align="right">{t('耗时')}</TableCell>
                <TableCell>{t('详情')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? <TableSkeleton rows={5} columns={colCount} /> :
                logs.length === 0 ? (
                  <TableRow><TableCell colSpan={colCount}>
                    <EmptyState icon={BarChart} title={t('暂无日志')} description={t('使用 API 后将在此显示日志记录')} />
                  </TableCell></TableRow>
                ) : logs.map((log, i) => (
                  <React.Fragment key={log.id || i}>
                    <TableRow hover onClick={() => toggleExpand(log.id)} sx={{
                      cursor: 'pointer',
                      '& > td': { borderBottom: expandedId === log.id ? 'none' : undefined },
                      ...(log.type === 5 && {
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                        '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.15) },
                      }),
                    }}>
                      <TableCell sx={{ width: 40 }}>
                        <IconButton size="small">
                          {expandedId === log.id ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowRight fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{timestamp2string(log.created_at)}</TableCell>
                      {isAdmin && <TableCell>{log.username || log.user_id}</TableCell>}
                      <TableCell><Chip label={t(typeLabelKey(log.type))} size="small" color={typeColor(log.type)} /></TableCell>
                      {isAdmin && (
                        <TableCell>
                          {log.channel ? (
                            <Tooltip title={log.channel_name || ''} arrow>
                              <Chip
                                label={log.channel_name ? `${log.channel_name} #${log.channel}` : `#${log.channel}`}
                                size="small"
                                variant="outlined"
                                sx={{ maxWidth: 140, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                              />
                            </Tooltip>
                          ) : '-'}
                        </TableCell>
                      )}
                      <TableCell sx={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.group || '-'}
                      </TableCell>
                      <TableCell><Chip label={log.model_name || '-'} size="small" variant="outlined" /></TableCell>
                      <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.token_name || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{log.prompt_tokens || 0}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{log.completion_tokens || 0}</TableCell>
                      <TableCell align="right">
                        {isSubscriptionBilling(log) ? (
                          <Tooltip title={`${t('订阅抵扣')}: ${renderQuota(getSubscriptionQuota(log))}; ${t('钱包扣费')}: ${renderQuota(0)}`} arrow>
                            <Chip size="small" color="secondary" variant="outlined" label={t('订阅抵扣')} />
                          </Tooltip>
                        ) : renderQuota(log.quota || 0)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {log.use_time ? (
                          <Tooltip title={log.first_response_time ? `TTFT: ${log.first_response_time}ms` : ''} arrow>
                            <Typography variant="body2" component="span" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {log.use_time}ms
                            </Typography>
                          </Tooltip>
                        ) : '-'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: log.type === 5 ? 'error.main' : 'text.secondary' }}>
                          {truncate(log.content)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <LogDetailRow log={log} open={expandedId === log.id} colSpan={colCount} />
                  </React.Fragment>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={changeRowsPerPage} rowsPerPageOptions={[10, 20, 50, 100]} />
      </Card>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDeleteHistory}
        title={t('清除历史日志')} message={t('确定清除所有历史日志？此操作不可撤销。')} confirmLabel={t('清除')} />
    </Box>
  );
}

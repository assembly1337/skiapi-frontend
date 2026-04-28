import React, { useState, useEffect } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, IconButton, Stack, Button, Tooltip,
  CircularProgress, DialogTitle, DialogContent, DialogActions, TextField,
  Grid, Switch, FormControlLabel, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Add, Edit, CardMembership } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import { showError, showSuccess, renderQuota } from '../utils';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import AnimatedDialog from '../components/common/AnimatedDialog';

// Real backend plan fields
const defaultForm = {
  title: '', subtitle: '', price_amount: 0, currency: 'USD',
  duration_unit: 'month', duration_value: 1, custom_seconds: 0,
  total_amount: 0, quota_reset_period: 'never', quota_reset_custom_seconds: 0,
  upgrade_group: '', enabled: true, sort_order: 0,
  stripe_price_id: '', creem_product_id: '', max_purchase_per_user: 0,
};

export default function Subscription() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/subscription/admin/plans');
      if (res.data.success) {
        // Backend returns [{plan: {...}}, {plan: {...}}] — unwrap
        const raw = Array.isArray(res.data.data) ? res.data.data : [];
        setPlans(raw.map(item => item.plan || item));
      }
    } catch (err) { showError(err); }
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openEdit = (plan) => {
    setEditPlan(plan);
    setForm(plan ? { ...defaultForm, ...plan } : { ...defaultForm });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { plan: form };
      const res = editPlan
        ? await API.put('/api/subscription/admin/plans/' + editPlan.id, body)
        : await API.post('/api/subscription/admin/plans', body);
      if (res.data.success) { showSuccess(editPlan ? t('更新成功') : t('创建成功')); setDialogOpen(false); fetchPlans(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
    setSaving(false);
  };

  const handleToggle = async (plan) => {
    try {
      const res = await API.patch(`/api/subscription/admin/plans/${plan.id}`, { enabled: !plan.enabled });
      if (res.data.success) { showSuccess(t('状态已更新')); fetchPlans(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target?.value ?? e }));
  const setNum = (k) => (e) => setForm(f => ({ ...f, [k]: parseFloat(e.target.value) || 0 }));

  const fmtDuration = (p) => {
    if (p.duration_unit === 'custom') return `${p.custom_seconds}${t('秒')}`;
    const units = { day: t('天'), week: t('周'), month: t('月'), year: t('年') };
    return `${p.duration_value}${units[p.duration_unit] || p.duration_unit}`;
  };

  return (
    <Box>
      <PageHeader icon={CardMembership} title={t('订阅管理')} subtitle={`${t('共')} ${plans.length} ${t('个计划')}`}
        actions={<>
          <SearchBar value="" onChange={() => {}} onRefresh={fetchPlans} placeholder={t('刷新...')} />
          <Button variant="contained" startIcon={<Add />} onClick={() => openEdit(null)}>{t('添加计划')}</Button>
        </>}
      />
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>ID</TableCell>
              <TableCell>{t('名称')}</TableCell>
              <TableCell>{t('价格')}</TableCell>
              <TableCell>{t('币种')}</TableCell>
              <TableCell>{t('时长')}</TableCell>
              <TableCell>{t('额度')}</TableCell>
              <TableCell>{t('升级分组')}</TableCell>
              <TableCell>{t('状态')}</TableCell>
              <TableCell align="right">{t('操作')}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {loading ? <TableSkeleton rows={3} columns={9} /> :
                plans.length === 0 ? (
                  <TableRow><TableCell colSpan={9}>
                    <EmptyState icon={CardMembership} title={t('暂无订阅计划')} description={t('添加订阅计划以提供付费服务')}
                      actionLabel={t('添加计划')} onAction={() => openEdit(null)} />
                  </TableCell></TableRow>
                ) : plans.map(p => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.id}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{p.title}{p.subtitle && <Chip label={p.subtitle} size="small" variant="outlined" sx={{ ml: 1 }} />}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{p.price_amount}</TableCell>
                    <TableCell>{p.currency}</TableCell>
                    <TableCell>{fmtDuration(p)}</TableCell>
                    <TableCell>{renderQuota(p.total_amount || 0)}</TableCell>
                    <TableCell>{p.upgrade_group ? <Chip label={p.upgrade_group} size="small" variant="outlined" /> : '-'}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch size="small" checked={!!p.enabled} onChange={() => handleToggle(p)} />
                        <Chip label={p.enabled ? t('启用') : t('禁用')} size="small"
                          color={p.enabled ? 'success' : 'error'} />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('编辑')}><IconButton size="small" onClick={() => openEdit(p)}><Edit fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <AnimatedDialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md">
        <DialogTitle>{editPlan ? t('编辑') : t('添加')}{t('订阅计划')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 8 }}><TextField fullWidth label={t('计划名称')} value={form.title} onChange={set('title')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('副标题')} value={form.subtitle || ''} onChange={set('subtitle')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('价格')} type="number" value={form.price_amount} onChange={setNum('price_amount')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('币种')}</InputLabel>
                <Select value={form.currency || 'USD'} onChange={set('currency')} label={t('币种')}>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="CNY">CNY</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('时长单位')}</InputLabel>
                <Select value={form.duration_unit || 'month'} onChange={set('duration_unit')} label={t('时长单位')}>
                  <MenuItem value="day">{t('天')}</MenuItem>
                  <MenuItem value="week">{t('周')}</MenuItem>
                  <MenuItem value="month">{t('月')}</MenuItem>
                  <MenuItem value="year">{t('年')}</MenuItem>
                  <MenuItem value="custom">{t('自定义(秒)')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth label={form.duration_unit === 'custom' ? t('自定义秒数') : t('时长数值')} type="number"
                value={form.duration_unit === 'custom' ? form.custom_seconds : form.duration_value}
                onChange={e => setForm(f => ({ ...f, [form.duration_unit === 'custom' ? 'custom_seconds' : 'duration_value']: parseInt(e.target.value) || 0 }))} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('总额度')} type="number" value={form.total_amount} onChange={setNum('total_amount')} helperText={t('用户获得的额度')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('升级分组')} value={form.upgrade_group || ''} onChange={set('upgrade_group')} helperText={t('购买后升级到的分组')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('额度重置周期')}</InputLabel>
                <Select value={form.quota_reset_period || 'never'} onChange={set('quota_reset_period')} label={t('额度重置周期')}>
                  <MenuItem value="never">{t('不重置')}</MenuItem>
                  <MenuItem value="daily">{t('每天')}</MenuItem>
                  <MenuItem value="weekly">{t('每周')}</MenuItem>
                  <MenuItem value="monthly">{t('每月')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('排序权重')} type="number" value={form.sort_order} onChange={setNum('sort_order')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('每用户最大购买数')} type="number" value={form.max_purchase_per_user} onChange={setNum('max_purchase_per_user')} helperText={t('0 = 不限制')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label="Stripe Price ID" value={form.stripe_price_id || ''} onChange={set('stripe_price_id')} /></Grid>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={form.enabled !== false} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />} label={t('启用')} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>{t('取消')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('保存')}
          </Button>
        </DialogActions>
      </AnimatedDialog>
    </Box>
  );
}

import React, { useState, useMemo } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Chip, IconButton, Stack, Button, Tooltip,
  CircularProgress, DialogTitle, DialogContent, DialogActions, TextField,
  Grid, Checkbox, Typography, alpha, useTheme, TableSortLabel,
  Menu, MenuItem, Divider,
} from '@mui/material';
import {
  Add, Edit, Delete, Inventory2, ContentCopy, MoreVert,
  Download, FileDownload, Layers, Visibility, VisibilityOff,
} from '@mui/icons-material';
import { API } from '../api';
import { showError, showSuccess, copy } from '../utils';
import usePaginatedList from '../hooks/usePaginatedList';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import AnimatedDialog from '../components/common/AnimatedDialog';
import { useTranslation } from 'react-i18next';

const defaultForm = {
  model_name: '',
  description: '',
  icon: '',
  tags: '',
  vendor_id: 0,
  endpoints: '',
  status: 1,
  sync_official: 1,
  name_rule: 0,
};

const nameRuleKey = (rule) => {
  if (rule === 1) return '前缀匹配';
  if (rule === 2) return '包含匹配';
  if (rule === 3) return '后缀匹配';
  return '精确匹配';
};

export default function Model() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { items: models, loading, page, setPage, rowsPerPage, changeRowsPerPage, total, search, setSearch, refresh } =
    usePaginatedList('/api/models/', { searchEndpoint: '/api/models/search' });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editModel, setEditModel] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // single id OR 'batch'
  const [selected, setSelected] = useState(() => new Set());
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState('asc');
  const [moreAnchor, setMoreAnchor] = useState(null);

  const openEdit = (m) => {
    setEditModel(m);
    setForm(m ? { ...m } : { ...defaultForm });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = editModel ? await API.put('/api/models/', form) : await API.post('/api/models/', form);
      if (res.data.success) { showSuccess(editModel ? t('更新成功') : t('创建成功')); setDialogOpen(false); refresh(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      if (deleteTarget === 'batch') {
        // Backend has no batch endpoint — fan out individual deletes
        const ids = Array.from(selected);
        const results = await Promise.allSettled(ids.map(id => API.delete(`/api/models/${id}`)));
        const failed = results.filter(r => r.status === 'rejected' || !r.value?.data?.success).length;
        if (failed === 0) showSuccess(`${t('已删除')} ${ids.length}`);
        else showError(`${ids.length - failed}/${ids.length} ${t('成功')}`);
        setSelected(new Set());
      } else {
        const res = await API.delete(`/api/models/${deleteTarget}`);
        if (res.data.success) { showSuccess(t('删除成功')); }
        else showError(res.data.message);
      }
      refresh();
    } catch (err) { showError(err); }
    setConfirmOpen(false);
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target?.value ?? e }));
  const setInt = (k) => (e) => setForm(f => ({ ...f, [k]: parseInt(e.target.value, 10) || 0 }));

  // ── Sorting (client-side, on the current page) ─────────────────────────
  const sorted = useMemo(() => {
    const copy = [...models];
    copy.sort((a, b) => {
      const av = a[orderBy] ?? '';
      const bv = b[orderBy] ?? '';
      if (av < bv) return order === 'asc' ? -1 : 1;
      if (av > bv) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [models, orderBy, order]);

  const handleSort = (key) => {
    if (orderBy === key) setOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setOrderBy(key); setOrder('asc'); }
  };

  // ── Selection ──────────────────────────────────────────────────────────
  const allOnPageSelected = sorted.length > 0 && sorted.every(m => selected.has(m.id));
  const someOnPageSelected = sorted.some(m => selected.has(m.id)) && !allOnPageSelected;

  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) sorted.forEach(m => next.delete(m.id));
    else sorted.forEach(m => next.add(m.id));
    setSelected(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  // ── Batch actions ──────────────────────────────────────────────────────
  const selectedModels = models.filter(m => selected.has(m.id));

  const batchCopyNames = () => {
    const text = selectedModels.map(m => m.model_name).join('\n');
    copy(text);
    showSuccess(`${t('已复制')} ${selectedModels.length} ${t('个模型名称')}`);
  };

  const batchCopyJSON = () => {
    copy(JSON.stringify(selectedModels, null, 2));
    showSuccess(`${t('已复制 JSON')} (${selectedModels.length})`);
  };

  const exportAllCSV = () => {
    const rows = [['id', 'model_name', 'status', 'name_rule', 'tags', 'vendor_id', 'description']];
    models.forEach(m => rows.push([
      m.id,
      m.model_name,
      m.status ?? '',
      m.name_rule ?? '',
      m.tags || '',
      m.vendor_id ?? '',
      (m.description || '').replace(/\n/g, ' '),
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `models-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setMoreAnchor(null);
  };

  const askBatchDelete = () => { setDeleteTarget('batch'); setConfirmOpen(true); };

  // ── Quick stats from current page ──────────────────────────────────────
  const stats = useMemo(() => {
    const providers = new Set();
    models.forEach(m => {
      const name = m.model_name || '';
      const prefix = name.split(/[-/]/)[0];
      if (prefix) providers.add(prefix);
    });
    return {
      active: models.filter(m => m.status !== 0).length,
      providers: providers.size,
    };
  }, [models]);

  return (
    <Box>
      <PageHeader icon={Inventory2} title={t('模型管理')} subtitle={`${total} ${t('个模型')} · ${stats.providers} ${t('提供商')} · ${stats.active} ${t('启用')}`}
        actions={
          <>
            <SearchBar value={search} onChange={setSearch} onSearch={refresh} onRefresh={refresh} placeholder={t('搜索模型...')} />
            <Tooltip title={t('更多')}>
              <IconButton onClick={(e) => setMoreAnchor(e.currentTarget)}><MoreVert /></IconButton>
            </Tooltip>
            <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
              <MenuItem onClick={exportAllCSV}><FileDownload fontSize="small" sx={{ mr: 1 }} />{t('导出 CSV')}</MenuItem>
              <MenuItem onClick={() => { copy(models.map(m => m.model_name).join('\n')); showSuccess(t('已复制所有模型名')); setMoreAnchor(null); }}>
                <ContentCopy fontSize="small" sx={{ mr: 1 }} />{t('复制全部名称')}
              </MenuItem>
            </Menu>
            <Button variant="contained" startIcon={<Add />} onClick={() => openEdit(null)}>{t('添加模型')}</Button>
          </>
        }
      />

      {/* Batch action bar — appears when something is selected */}
      {selected.size > 0 && (
        <Card sx={{ mb: 1.5, p: 1.25, bgcolor: alpha(theme.palette.primary.main, 0.08), borderLeft: `3px solid ${theme.palette.primary.main}` }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Layers fontSize="small" color="primary" />
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
              {t('已选择')} {selected.size} {t('项')}
            </Typography>
            <Button size="small" startIcon={<ContentCopy />} onClick={batchCopyNames}>{t('复制名称')}</Button>
            <Button size="small" startIcon={<Download />} onClick={batchCopyJSON}>{t('复制 JSON')}</Button>
            <Button size="small" color="error" startIcon={<Delete />} onClick={askBatchDelete}>{t('批量删除')}</Button>
            <Button size="small" onClick={() => setSelected(new Set())}>{t('取消选择')}</Button>
          </Stack>
        </Card>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell padding="checkbox">
                <Checkbox size="small" checked={allOnPageSelected} indeterminate={someOnPageSelected} onChange={togglePage} />
              </TableCell>
              <TableCell sortDirection={orderBy === 'id' ? order : false}>
                <TableSortLabel active={orderBy === 'id'} direction={orderBy === 'id' ? order : 'asc'} onClick={() => handleSort('id')}>ID</TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'model_name' ? order : false}>
                <TableSortLabel active={orderBy === 'model_name'} direction={orderBy === 'model_name' ? order : 'asc'} onClick={() => handleSort('model_name')}>{t('模型名称')}</TableSortLabel>
              </TableCell>
              <TableCell>{t('状态')}</TableCell>
              <TableCell>{t('匹配规则')}</TableCell>
              <TableCell>{t('标签')}</TableCell>
              <TableCell>{t('描述')}</TableCell>
              <TableCell align="right">{t('操作')}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {loading ? <TableSkeleton rows={5} columns={6} /> :
                sorted.length === 0 ? (
                  <TableRow><TableCell colSpan={8}>
                    <EmptyState icon={Inventory2} title={t('暂无模型')} description={t('添加模型以配置可用的 AI 模型')}
                      actionLabel={t('添加模型')} onAction={() => openEdit(null)} />
                  </TableCell></TableRow>
                ) : sorted.map(m => {
                  const isSel = selected.has(m.id);
                  return (
                    <TableRow key={m.id} hover selected={isSel}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={isSel} onChange={() => toggleOne(m.id)} />
                      </TableCell>
                      <TableCell>{m.id}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip label={m.model_name} size="small" variant="outlined" />
                          <Tooltip title={t('复制名称')}>
                            <IconButton size="small" onClick={() => { copy(m.model_name); showSuccess(t('已复制')); }} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                              <ContentCopy sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={m.status === 0 ? t('禁用') : t('启用')}
                          size="small"
                          color={m.status === 0 ? 'default' : 'success'}
                          variant={m.status === 0 ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                      <TableCell>{t(nameRuleKey(m.name_rule))}</TableCell>
                      <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.tags || '-'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}>{m.description || '-'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title={t('编辑')}><IconButton size="small" onClick={() => openEdit(m)}><Edit fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title={t('删除')}><IconButton size="small" color="error" onClick={() => { setDeleteTarget(m.id); setConfirmOpen(true); }}><Delete fontSize="small" /></IconButton></Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={changeRowsPerPage} rowsPerPageOptions={[10, 20, 50, 100]} />
      </Card>

      <AnimatedDialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{editModel ? t('编辑模型') : t('添加模型')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={12}><TextField fullWidth label={t('模型名称')} value={form.model_name} onChange={set('model_name')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label={t('状态')} value={form.status ?? 1} onChange={setInt('status')}>
                <MenuItem value={1}>{t('启用')}</MenuItem>
                <MenuItem value={0}>{t('禁用')}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label={t('匹配规则')} value={form.name_rule ?? 0} onChange={setInt('name_rule')}>
                <MenuItem value={0}>{t('精确匹配')}</MenuItem>
                <MenuItem value={1}>{t('前缀匹配')}</MenuItem>
                <MenuItem value={2}>{t('包含匹配')}</MenuItem>
                <MenuItem value={3}>{t('后缀匹配')}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('图标')} value={form.icon || ''} onChange={set('icon')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('标签')} value={form.tags || ''} onChange={set('tags')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Vendor ID" type="number" value={form.vendor_id || 0} onChange={setInt('vendor_id')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Sync Official" value={form.sync_official ?? 1} onChange={setInt('sync_official')}>
                <MenuItem value={1}>{t('启用')}</MenuItem>
                <MenuItem value={0}>{t('禁用')}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={12}><TextField fullWidth label={t('端点配置 JSON')} value={form.endpoints || ''} onChange={set('endpoints')} multiline rows={2} /></Grid>
            <Grid size={12}><TextField fullWidth label={t('描述')} value={form.description || ''} onChange={set('description')} multiline rows={2} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>{t('取消')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('保存')}
          </Button>
        </DialogActions>
      </AnimatedDialog>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete}
        title={deleteTarget === 'batch' ? `${t('批量删除模型')} (${selected.size})` : t('删除模型')}
        message={deleteTarget === 'batch'
          ? `${t('确定要删除选中的')} ${selected.size} ${t('个模型？此操作不可撤销。')}`
          : t('确定要删除此模型？此操作不可撤销。')}
        confirmLabel={t('删除')} />
    </Box>
  );
}

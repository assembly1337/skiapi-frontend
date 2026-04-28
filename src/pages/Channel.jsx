import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Chip, IconButton, Stack, Button, Tooltip,
  Checkbox, Switch, Tabs, Tab, TableSortLabel,
} from '@mui/material';
import {
  Add, Edit, Delete, PlayArrow, Layers,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import { showError, showSuccess } from '../utils';
import { CHANNEL_TYPES, CHANNEL_STATUS } from '../constants';
import usePaginatedList from '../hooks/usePaginatedList';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ChannelDialog from '../components/channel/ChannelDialog';
import ChannelTestDialog from '../components/channel/ChannelTestDialog';

export default function Channel() {
  const { t } = useTranslation();
  const [idSortDir, setIdSortDir] = useState('desc'); // 'asc' | 'desc' | null (backend default)
  const extraParams = useMemo(
    () => (idSortDir ? { id_sort: 'true' } : undefined),
    [idSortDir]
  );
  const {
    items: channels, loading, page, setPage, rowsPerPage, changeRowsPerPage,
    total, search, setSearch, refresh,
  } = usePaginatedList('/api/channel/', { searchEndpoint: '/api/channel/search', pageSize: 100, extraParams });

  const sortedChannelsByDir = useMemo(() => {
    if (!idSortDir) return channels;
    const arr = [...channels].sort((a, b) => a.id - b.id);
    return idSortDir === 'desc' ? arr.reverse() : arr;
  }, [channels, idSortDir]);

  const handleIdSort = () => {
    setIdSortDir(prev => {
      if (prev === null) return 'asc';
      if (prev === 'asc') return 'desc';
      return null;
    });
  };

  const [typeFilter, setTypeFilter] = useState(0); // 0 = all
  const [allTypeCounts, setAllTypeCounts] = useState(null);

  // NewAPI returns global type_counts with the paginated channel response.
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/channel/?p=1&page_size=1');
        if (res.data.success) {
          const counts = {};
          Object.entries(res.data.data?.type_counts || {}).forEach(([type, count]) => {
            const typeValue = Number(type);
            const ct = CHANNEL_TYPES.find(c => c.value === typeValue);
            const label = ct?.label || `Type ${typeValue}`;
            counts[typeValue] = { label, color: ct?.color, count: Number(count) || 0 };
          });
          if (Object.keys(counts).length) setAllTypeCounts(counts);
        }
      } catch {
        setAllTypeCounts(null);
      }
    })();
  }, []);

  // Build type tabs from all channels (not just current page)
  const typeTabs = useMemo(() => {
    const source = allTypeCounts || {};
    // Fallback: if allTypeCounts not loaded yet, compute from current page
    if (!allTypeCounts) {
      channels.forEach(ch => {
        const ct = CHANNEL_TYPES.find(c => c.value === ch.type);
        const label = ct?.label || `Type ${ch.type}`;
        if (!source[ch.type]) source[ch.type] = { label, color: ct?.color, count: 0 };
        source[ch.type].count++;
      });
    }
    return Object.entries(source)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([type, info]) => ({ type: Number(type), ...info }));
  }, [channels, allTypeCounts]);

  const filteredChannels = useMemo(() => {
    if (typeFilter === 0) return sortedChannelsByDir;
    return sortedChannelsByDir.filter(ch => ch.type === typeFilter);
  }, [sortedChannelsByDir, typeFilter]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editChannel, setEditChannel] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selected, setSelected] = useState([]);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testChannel, setTestChannel] = useState(null);

  const handleTest = (id) => {
    const ch = channels.find(c => c.id === id);
    if (ch) { setTestChannel(ch); setTestDialogOpen(true); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await API.delete(`/api/channel/${deleteTarget}`);
      if (res.data.success) { showSuccess(t('删除成功')); refresh(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
    setConfirmOpen(false);
    setDeleteTarget(null);
  };

  const handleStatusToggle = async (channel) => {
    const newStatus = channel.status === 1 ? 2 : 1;
    try {
      const res = await API.put('/api/channel/', { id: channel.id, status: newStatus });
      if (res.data.success) { showSuccess(t('状态已更新')); refresh(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
  };

  const openEdit = (ch) => { setEditChannel(ch); setDialogOpen(true); };
  const openDelete = (id) => { setDeleteTarget(id); setConfirmOpen(true); };

  // Batch operations
  const handleBatchTest = async () => {
    const ids = selected.length > 0 ? selected : channels.map(c => c.id);
    for (const id of ids) { handleTest(id); }
  };

  const handleBatchDelete = async () => {
    for (const id of selected) {
      try { await API.delete(`/api/channel/${id}`); } catch (err) { showError(err); }
    }
    showSuccess(`${t('已删除')} ${selected.length} ${t('个渠道')}`);
    setSelected([]);
    refresh();
  };

  const toggleSelect = (id) => {
    setSelected(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id]);
  };
  const toggleSelectAll = () => {
    setSelected(s => s.length === filteredChannels.length ? [] : filteredChannels.map(c => c.id));
  };

  const getTypeChip = (type) => {
    const ct = CHANNEL_TYPES.find(c => c.value === type);
    return <Chip label={ct?.label || `Type ${type}`} size="small" variant="outlined"
      sx={{ borderColor: ct?.color, color: ct?.color, fontWeight: 500 }} />;
  };

  return (
    <Box>
      <PageHeader
        icon={Layers} title={t('渠道管理')} subtitle={`${t('共')} ${total} ${t('个渠道')}`}
        actions={
          <>
            <SearchBar value={search} onChange={setSearch} onSearch={refresh} onRefresh={refresh} placeholder={t('搜索渠道...')} />
            {selected.length > 0 && (
              <>
                <Chip label={`${t('已选')} ${selected.length}`} color="primary" size="small" onDelete={() => setSelected([])} />
                <Button size="small" variant="outlined" color="error" onClick={handleBatchDelete}>
                  {t('批量删除')}
                </Button>
              </>
            )}
            <Button variant="outlined" startIcon={<PlayArrow />} onClick={handleBatchTest} size="small">
              {t('测试全部')}
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => openEdit(null)} size="small">
              {t('添加渠道')}
            </Button>
          </>
        }
      />

      {/* Type filter tabs */}
      {typeTabs.length > 1 && (
        <Tabs value={typeFilter} onChange={(_, v) => setTypeFilter(v)} variant="scrollable" scrollButtons="auto"
          sx={{ mb: 2, '& .MuiTab-root': { minHeight: 36, py: 0.5, textTransform: 'none', fontSize: '0.8rem', fontWeight: 500 } }}>
          <Tab value={0} label={
            <Stack direction="row" spacing={0.8} alignItems="center">
              <span>{t('全部')}</span>
              <Chip label={channels.length} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
            </Stack>
          } />
          {typeTabs.map(tt => (
            <Tab key={tt.type} value={tt.type} label={
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tt.color || 'text.secondary', flexShrink: 0 }} />
                <span>{tt.label}</span>
                <Chip label={tt.count} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Stack>
            } />
          ))}
        </Tabs>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={selected.length === filteredChannels.length && filteredChannels.length > 0}
                    indeterminate={selected.length > 0 && selected.length < filteredChannels.length}
                    onChange={toggleSelectAll} />
                </TableCell>
                <TableCell sortDirection={idSortDir || false}>
                  <TableSortLabel
                    active
                    direction={idSortDir || 'asc'}
                    onClick={handleIdSort}
                    sx={{
                      '& .MuiTableSortLabel-icon': {
                        opacity: idSortDir ? 1 : 0.35,
                      },
                    }}
                  >
                    ID
                  </TableSortLabel>
                </TableCell>
                <TableCell>{t('名称')}</TableCell>
                <TableCell>{t('类型')}</TableCell>
                <TableCell>{t('状态')}</TableCell>
                <TableCell>{t('分组')}</TableCell>
                <TableCell>{t('标签')}</TableCell>
                <TableCell>{t('优先级')}</TableCell>
                <TableCell>{t('权重')}</TableCell>
                <TableCell>{t('余额')}</TableCell>
                <TableCell align="right">{t('操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? <TableSkeleton rows={5} columns={11} /> :
                filteredChannels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11}>
                      <EmptyState icon={Layers} title={typeFilter ? t('该类型暂无渠道') : t('暂无渠道')} description={t('添加渠道以连接 AI 模型提供商')}
                        actionLabel={t('添加渠道')} onAction={() => openEdit(null)} />
                    </TableCell>
                  </TableRow>
                ) : filteredChannels.map(ch => (
                  <TableRow key={ch.id} hover selected={selected.includes(ch.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.includes(ch.id)} onChange={() => toggleSelect(ch.id)} />
                    </TableCell>
                    <TableCell>{ch.id}</TableCell>
                    <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {ch.name}
                    </TableCell>
                    <TableCell>{getTypeChip(ch.type)}</TableCell>
                    <TableCell>
                      <Switch size="small" checked={ch.status === 1} onChange={() => handleStatusToggle(ch)} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{ch.group || ch.groups}</TableCell>
                    <TableCell>{ch.tag && <Chip label={ch.tag} size="small" variant="outlined" />}</TableCell>
                    <TableCell>{ch.priority}</TableCell>
                    <TableCell>{ch.weight}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{ch.balance != null ? `$${Number(ch.balance).toFixed(2)}` : '-'}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title={t('测试')}>
                          <IconButton size="small" onClick={() => handleTest(ch.id)}>
                            <PlayArrow fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('编辑')}>
                          <IconButton size="small" onClick={() => openEdit(ch)}><Edit fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title={t('删除')}>
                          <IconButton size="small" color="error" onClick={() => openDelete(ch.id)}><Delete fontSize="small" /></IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={changeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]} />
      </Card>

      <ChannelDialog open={dialogOpen} onClose={() => setDialogOpen(false)} channel={editChannel} onSaved={refresh} />

      <ChannelTestDialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} channel={testChannel} />

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete}
        title={t('删除渠道')} message={t('确定要删除此渠道？此操作不可撤销。')} confirmLabel={t('删除')} />
    </Box>
  );
}

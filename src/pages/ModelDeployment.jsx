import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Chip, IconButton, Tooltip,
  Alert,
} from '@mui/material';
import { Delete, RocketLaunch } from '@mui/icons-material';
import { API } from '../api';
import { showError, showSuccess, timestamp2string } from '../utils';
import usePaginatedList from '../hooks/usePaginatedList';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useTranslation } from 'react-i18next';

export default function ModelDeployment() {
  const { t } = useTranslation();
  const [deploymentSettings, setDeploymentSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const canLoadDeployments = deploymentSettings?.can_connect === true;
  const { items: deployments, loading, page, setPage, rowsPerPage, changeRowsPerPage, total, search, setSearch, refresh } =
    usePaginatedList('/api/deployments/', { searchEndpoint: '/api/deployments/search', autoFetch: canLoadDeployments });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    API.get('/api/deployments/settings').then(res => {
      if (!cancelled && res.data?.success) setDeploymentSettings(res.data.data);
    }).catch(err => {
      if (!cancelled) showError(err);
    }).finally(() => {
      if (!cancelled) setSettingsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async () => {
    try {
      const res = await API.delete(`/api/deployments/${deleteTarget}`);
      if (res.data.success) { showSuccess(t('删除成功')); refresh(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
    setConfirmOpen(false);
  };

  const getName = (deployment) => deployment.deployment_name || deployment.name || deployment.container_name || deployment.id || '-';
  const getModel = (deployment) => deployment.model_name || deployment.model || deployment.model_version || '-';

  return (
    <Box>
      <PageHeader icon={RocketLaunch} title={t('模型部署')} subtitle={t('共 {{total}} 个部署', { total })}
        actions={
          <SearchBar value={search} onChange={setSearch} onSearch={refresh} onRefresh={refresh} placeholder={t('搜索部署...')} />
        }
      />
      <Card>
        {!settingsLoading && !canLoadDeployments ? (
          <Box sx={{ p: 2.5 }}>
            <Alert severity="info">
              {t('模型部署未启用或缺少 io.net API Key，请先在系统设置中配置 model_deployment.ionet。')}
            </Alert>
          </Box>
        ) : (
          <>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>ID</TableCell>
              <TableCell>{t('名称')}</TableCell>
              <TableCell>{t('模型')}</TableCell>
              <TableCell>{t('状态')}</TableCell>
              <TableCell>{t('创建时间')}</TableCell>
              <TableCell align="right">{t('操作')}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(settingsLoading || loading) ? <TableSkeleton rows={5} columns={6} /> :
                deployments.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>
                    <EmptyState icon={RocketLaunch} title={t('暂无部署')} description={t('创建模型部署以使用自定义模型服务')} />
                  </TableCell></TableRow>
                ) : deployments.map(d => (
                  <TableRow key={d.id} hover>
                    <TableCell>{d.id}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{getName(d)}</TableCell>
                    <TableCell><Chip label={getModel(d)} size="small" variant="outlined" /></TableCell>
                    <TableCell><Chip label={d.status || '-'} size="small" color={d.status === 'running' ? 'success' : 'default'} /></TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{timestamp2string(d.created_at)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('删除')}>
                        <IconButton size="small" color="error" onClick={() => { setDeleteTarget(d.id); setConfirmOpen(true); }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={changeRowsPerPage} rowsPerPageOptions={[10, 20, 50]} />
          </>
        )}
      </Card>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete}
        title={t('删除部署')} message={t('确定要删除此部署？此操作不可撤销。')} confirmLabel={t('删除')} />
    </Box>
  );
}

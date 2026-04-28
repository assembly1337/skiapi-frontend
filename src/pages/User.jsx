import React, { useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Chip, IconButton, Stack, Button, Tooltip,
  CircularProgress, DialogTitle, DialogContent, DialogActions, TextField,
  Grid, Select, MenuItem, FormControl, InputLabel, Menu, ListItemIcon, ListItemText,
} from '@mui/material';
import { Add, Edit, Delete, People, MoreHoriz, Block, CheckCircle, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import { showError, showSuccess, renderQuota } from '../utils';
import { USER_ROLES } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import usePaginatedList from '../hooks/usePaginatedList';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import AnimatedDialog from '../components/common/AnimatedDialog';

export default function User() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { items: users, loading, page, setPage, rowsPerPage, changeRowsPerPage, total, search, setSearch, refresh } =
    usePaginatedList('/api/user/', { searchEndpoint: '/api/user/search' });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', display_name: '', password: '', group: 'default', quota: 0, role: 1 });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuTarget, setMenuTarget] = useState(null);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [disableTarget, setDisableTarget] = useState(null);

  const handleDelete = async () => {
    try {
      const res = await API.delete(`/api/user/${deleteTarget}`);
      if (res.data.success) { showSuccess(t('删除成功')); refresh(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
    setConfirmOpen(false);
  };

  // Single unified action endpoint — POST /api/user/manage {id, action, value}
  // Supported actions from upstream: delete, disable, enable, promote, demote
  const handleManage = async (id, action) => {
    try {
      const res = await API.post('/api/user/manage', { id, action });
      if (res.data.success) { showSuccess(t('操作成功')); refresh(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
  };

  const openMenu = (e, u) => { setMenuAnchor(e.currentTarget); setMenuTarget(u); };
  const closeMenu = () => { setMenuAnchor(null); setMenuTarget(null); };

  const handleDisableClick = () => {
    setDisableTarget(menuTarget);
    setDisableConfirmOpen(true);
    closeMenu();
  };

  const handleConfirmDisable = async () => {
    if (disableTarget) {
      await handleManage(disableTarget.id, 'disable');
    }
    setDisableConfirmOpen(false);
    setDisableTarget(null);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm(u ? { ...u, password: '' } : { username: '', display_name: '', password: '', group: 'default', quota: 0, role: 1 });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = editUser ? await API.put('/api/user/', form) : await API.post('/api/user/', form);
      if (res.data.success) { showSuccess(editUser ? t('更新成功') : t('创建成功')); setDialogOpen(false); refresh(); }
      else showError(res.data.message);
    } catch (err) { showError(err); }
    setSaving(false);
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target?.value ?? e }));

  const isSelf = (u) => currentUser && u.id === currentUser.id;
  const canManage = (u) => !isSelf(u) && (currentUser?.role || 0) > (u.role || 0);

  return (
    <Box>
      <PageHeader icon={People} title={t('用户管理')} subtitle={`${t('共')} ${total} ${t('个用户')}`}
        actions={
          <>
            <SearchBar value={search} onChange={setSearch} onSearch={refresh} onRefresh={refresh} placeholder={t('搜索用户...')} />
            <Button variant="contained" color="primary" startIcon={<Add />} onClick={() => openEdit(null)}>{t('添加用户')}</Button>
          </>
        }
      />
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>ID</TableCell><TableCell>{t('用户名')}</TableCell><TableCell>{t('显示名称')}</TableCell>
              <TableCell>{t('分组')}</TableCell><TableCell>{t('角色')}</TableCell><TableCell>{t('状态')}</TableCell>
              <TableCell>{t('余额')}</TableCell><TableCell>{t('已用')}</TableCell><TableCell>{t('请求次数')}</TableCell>
              <TableCell align="right">{t('操作')}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {loading ? <TableSkeleton rows={5} columns={10} /> :
                users.length === 0 ? (
                  <TableRow><TableCell colSpan={10}>
                    <EmptyState icon={People} title={t('暂无用户')} description={t('添加用户或等待用户注册')} actionLabel={t('添加用户')} onAction={() => openEdit(null)} />
                  </TableCell></TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontFamily: 'var(--font-mono)', color: 'text.secondary' }}>{u.id}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{u.username}</TableCell>
                    <TableCell>{u.display_name || '—'}</TableCell>
                    <TableCell><Chip label={u.group || 'default'} size="small" variant="outlined" /></TableCell>
                    <TableCell>
                      <Chip label={t(USER_ROLES[u.role]?.label || String(u.role))} size="small"
                        color={USER_ROLES[u.role]?.color || 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip label={u.status === 1 ? t('正常') : t('封禁')} size="small"
                        color={u.status === 1 ? 'success' : 'error'} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'var(--font-mono)' }}>{renderQuota(u.quota || 0)}</TableCell>
                    <TableCell sx={{ fontFamily: 'var(--font-mono)' }}>{renderQuota(u.used_quota || 0)}</TableCell>
                    <TableCell sx={{ fontFamily: 'var(--font-mono)' }}>{u.request_count || 0}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title={t('编辑')}><IconButton size="small" onClick={() => openEdit(u)}><Edit fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title={t('更多操作')}>
                          <span>
                            <IconButton size="small" onClick={(e) => openMenu(e, u)} disabled={!canManage(u)}>
                              <MoreHoriz fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={changeRowsPerPage} rowsPerPageOptions={[10, 20, 50, 100]} />
      </Card>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {menuTarget?.status === 1 ? (
          <MenuItem onClick={handleDisableClick}>
            <ListItemIcon><Block fontSize="small" color="error" /></ListItemIcon>
            <ListItemText primary={t('停用账号')} primaryTypographyProps={{ fontSize: '0.8125rem' }} />
          </MenuItem>
        ) : (
          <MenuItem onClick={() => { handleManage(menuTarget.id, 'enable'); closeMenu(); }}>
            <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary={t('启用账号')} primaryTypographyProps={{ fontSize: '0.8125rem' }} />
          </MenuItem>
        )}
        {(currentUser?.role || 0) >= 100 && menuTarget && menuTarget.role < 10 && (
          <MenuItem onClick={() => { handleManage(menuTarget.id, 'promote'); closeMenu(); }}>
            <ListItemIcon><ArrowUpward fontSize="small" /></ListItemIcon>
            <ListItemText primary={t('提升为管理员')} primaryTypographyProps={{ fontSize: '0.8125rem' }} />
          </MenuItem>
        )}
        {(currentUser?.role || 0) >= 100 && menuTarget && menuTarget.role === 10 && (
          <MenuItem onClick={() => { handleManage(menuTarget.id, 'demote'); closeMenu(); }}>
            <ListItemIcon><ArrowDownward fontSize="small" /></ListItemIcon>
            <ListItemText primary={t('降为普通用户')} primaryTypographyProps={{ fontSize: '0.8125rem' }} />
          </MenuItem>
        )}
        <MenuItem onClick={() => { setDeleteTarget(menuTarget.id); setConfirmOpen(true); closeMenu(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary={t('删除用户')} primaryTypographyProps={{ fontSize: '0.8125rem' }} />
        </MenuItem>
      </Menu>

      <AnimatedDialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{editUser ? t('编辑用户') : t('添加用户')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('用户名')} value={form.username} onChange={set('username')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('显示名称')} value={form.display_name || ''} onChange={set('display_name')} /></Grid>
            <Grid size={12}><TextField fullWidth label={t('密码')} type="password" value={form.password} onChange={set('password')} placeholder={editUser ? t('留空不修改') : ''} /></Grid>
            {editUser && (
              <>
                <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('分组')} value={form.group || 'default'} onChange={set('group')} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('额度')} type="number" value={form.quota} onChange={set('quota')} /></Grid>
              </>
            )}
            <Grid size={{ xs: 12, sm: editUser ? 4 : 12 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('角色')}</InputLabel>
                <Select value={form.role} onChange={set('role')} label={t('角色')}>
                  <MenuItem value={1}>{t('普通用户')}</MenuItem>
                  <MenuItem value={10}>{t('管理员')}</MenuItem>
                  <MenuItem value={100}>{t('超级管理员')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>{t('取消')}</Button>
          <Button variant="contained" color="primary" onClick={handleSave} disabled={saving}>{saving ? <CircularProgress size={20} /> : t('保存')}</Button>
        </DialogActions>
      </AnimatedDialog>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete}
        title={t('删除用户')} message={t('确定要删除此用户？此操作不可撤销。')} confirmLabel={t('删除')} />

      <ConfirmDialog open={disableConfirmOpen} onClose={() => setDisableConfirmOpen(false)} onConfirm={handleConfirmDisable}
        title={t('停用账号')} message={t('确定要停用此账号？用户将无法登录和调用 API。')} confirmLabel={t('停用')} />
    </Box>
  );
}

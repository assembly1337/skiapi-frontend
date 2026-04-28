import React, { useState, useEffect } from 'react';
import {
  DialogTitle, DialogContent, DialogActions, Button, TextField, Grid,
  Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel,
  Tabs, Tab, Box, Typography, Stack, Chip, CircularProgress, Tooltip,
  IconButton, Divider, Alert,
} from '@mui/material';
import { AutoFixHigh, ContentCopy, Delete, Add } from '@mui/icons-material';
import AnimatedDialog from '../common/AnimatedDialog';
import { API } from '../../api';
import { showError, showSuccess, copy } from '../../utils';
import { CHANNEL_TYPES } from '../../constants';
import { useTranslation } from 'react-i18next';

const defaultChannel = {
  name: '', type: 1, key: '', base_url: '', models: '', model_mapping: '',
  group: 'default', status: 1, weight: 1, tag: '', priority: 0,
  other: '', proxy: '', test_model: '', only_chat: false, auto_ban: 1,
};

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

export default function ChannelDialog({ open, onClose, channel, onSaved }) {
  const { t } = useTranslation();
  const isEdit = !!channel;
  const [form, setForm] = useState(defaultChannel);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [keys, setKeys] = useState(['']);

  useEffect(() => {
    if (open) {
      if (channel) {
        setForm({ ...defaultChannel, ...channel });
        setKeys(channel.key ? channel.key.split('\n').filter(Boolean) : ['']);
      } else {
        setForm({ ...defaultChannel });
        setKeys(['']);
      }
      setTab(0);
    }
  }, [open, channel]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target?.value ?? e }));

  // Fetch upstream models
  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      const res = isEdit && channel?.id
        ? await API.get(`/api/channel/fetch_models/${channel.id}`)
        : await API.post('/api/channel/fetch_models', {
          type: form.type,
          key: keys.join('\n'),
          base_url: form.base_url || '',
        });
      if (res.data.success && res.data.data) {
        const fetched = Array.isArray(res.data.data) ? res.data.data.join(',') : String(res.data.data);
        setForm(f => ({ ...f, models: fetched }));
        showSuccess(t('成功获取模型'));
      } else {
        showError(res.data.message || t('获取模型失败'));
      }
    } catch (err) { showError(err); }
    setFetchingModels(false);
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, key: keys.filter(Boolean).join('\n') };
      let res;
      if (isEdit) {
        res = await API.put('/api/channel/', payload);
      } else {
        res = await API.post('/api/channel/', { mode: keys.length > 1 ? 'multi_to_single' : 'single', channel: payload });
      }
      if (res.data.success) {
        showSuccess(isEdit ? t('更新成功') : t('创建成功'));
        onSaved?.();
        onClose();
      } else showError(res.data.message);
    } catch (err) { showError(err); }
    setSaving(false);
  };

  return (
    <AnimatedDialog open={open} onClose={onClose} maxWidth="md">
      <DialogTitle sx={{ pb: 0 }}>{isEdit ? t('编辑渠道') : t('添加渠道')}</DialogTitle>
      <Box sx={{ px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          <Tab label={t('基本信息')} />
          <Tab label={t('模型配置')} />
          <Tab label={t('密钥管理')} />
          <Tab label={t('高级设置')} />
        </Tabs>
      </Box>
      <DialogContent sx={{ minHeight: 380 }}>
        {/* Tab 0: Basic */}
        <TabPanel value={tab} index={0}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label={t('渠道名称')} value={form.name} onChange={set('name')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('渠道类型')}</InputLabel>
                <Select value={form.type} onChange={set('type')} label={t('渠道类型')}>
                  {CHANNEL_TYPES.map(ct => (
                    <MenuItem key={ct.value} value={ct.value}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ct.color }} />
                        <span>{ct.label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label={t('代理地址 (Base URL)')} value={form.base_url || ''} onChange={set('base_url')} placeholder={t('留空使用默认地址')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth label={t('分组')} value={form.group || 'default'} onChange={set('group')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth label={t('标签')} value={form.tag || ''} onChange={set('tag')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth label={t('优先级')} type="number" value={form.priority} onChange={set('priority')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth label={t('权重')} type="number" value={form.weight} onChange={set('weight')} />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 1: Models */}
        <TabPanel value={tab} index={1}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">{t('模型列表')}</Typography>
              <Button size="small" startIcon={fetchingModels ? <CircularProgress size={14} /> : <AutoFixHigh />}
                onClick={handleFetchModels} disabled={fetchingModels} variant="outlined">{t('从上游获取模型')}</Button>
            </Stack>
            <TextField fullWidth value={form.models || ''} onChange={set('models')} multiline rows={4}
              placeholder={t('支持的模型列表，逗号分隔')} helperText={t('每行一个或逗号分隔')} />
            {form.models && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {form.models.split(',').filter(Boolean).map((m, i) => (
                  <Chip key={i} label={m.trim()} size="small" variant="outlined" onDelete={() => {
                    const arr = form.models.split(',').filter((_, j) => j !== i);
                    setForm(f => ({ ...f, models: arr.join(',') }));
                  }} />
                ))}
              </Box>
            )}
            <Divider />
            <TextField fullWidth label={t('模型映射 (JSON)')} value={form.model_mapping || ''} onChange={set('model_mapping')}
              multiline rows={3} placeholder='{"原模型名": "映射模型名"}' />
          </Stack>
        </TabPanel>

        {/* Tab 2: Keys */}
        <TabPanel value={tab} index={2}>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">{t('密钥列表')} ({keys.filter(Boolean).length})</Typography>
              <Button size="small" startIcon={<Add />} onClick={() => setKeys(k => [...k, ''])}>{t('添加密钥')}</Button>
            </Stack>
            {keys.map((key, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField fullWidth size="small" value={key} placeholder={`${t('密钥')} ${i + 1}`}
                  onChange={e => setKeys(ks => ks.map((k, j) => j === i ? e.target.value : k))}
                  type="password" />
                <Tooltip title={t('复制')}>
                  <IconButton size="small" onClick={() => { copy(key); showSuccess(t('已复制')); }}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
                {keys.length > 1 && (
                  <Tooltip title={t('删除')}>
                    <IconButton size="small" color="error" onClick={() => setKeys(ks => ks.filter((_, j) => j !== i))}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            ))}
            <Alert severity="info" sx={{ mt: 1 }}>{t('支持多个密钥，系统将随机选择使用')}</Alert>
          </Stack>
        </TabPanel>

        {/* Tab 3: Advanced */}
        <TabPanel value={tab} index={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label={t('代理')} value={form.proxy || ''} onChange={set('proxy')} placeholder={t('HTTP代理地址')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label={t('测试模型')} value={form.test_model || ''} onChange={set('test_model')} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label={t('其他参数 (JSON)')} value={form.other || ''} onChange={set('other')} multiline rows={2} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label={t('状态码映射 (JSON)')} value={form.status_code_mapping || ''} onChange={set('status_code_mapping')}
                multiline rows={2} placeholder='{"400": "500"}' />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={<Switch checked={form.auto_ban === 1} onChange={e => setForm(f => ({ ...f, auto_ban: e.target.checked ? 1 : 0 }))} />}
                label={t('自动禁用（失败时自动禁用渠道）')}
              />
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('取消')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : t('保存')}
        </Button>
      </DialogActions>
    </AnimatedDialog>
  );
}

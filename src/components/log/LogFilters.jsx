import React from 'react';
import {
  Stack, TextField, MenuItem, Button, ButtonGroup, Chip,
} from '@mui/material';
import { FilterList, Clear } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const LOG_TYPES = [
  { value: 0, labelKey: '全部' },
  { value: 1, labelKey: '充值' },
  { value: 2, labelKey: '消费' },
  { value: 3, labelKey: '管理' },
  { value: 4, labelKey: '系统' },
  { value: 5, labelKey: '错误' },
  { value: 6, labelKey: '退款' },
];

const DATE_PRESETS = [
  { labelKey: '今天', days: 0 },
  { labelKey: '7天', days: 7 },
  { labelKey: '30天', days: 30 },
];

export default function LogFilters({ filters, onChange, onClear, isAdmin }) {
  const { t } = useTranslation();

  const set = (key) => (e) => onChange({ ...filters, [key]: e.target?.value ?? e });

  const applyPreset = (days) => {
    const now = dayjs();
    const start = days === 0 ? now.startOf('day') : now.subtract(days, 'day').startOf('day');
    onChange({
      ...filters,
      start_timestamp: String(start.unix()),
      end_timestamp: String(now.unix()),
    });
  };

  const activeCount = Object.values(filters).filter(v => v !== '' && v !== '0' && v !== 0).length;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <FilterList sx={{ fontSize: 18, color: 'text.secondary' }} />

        <TextField select size="small" value={filters.type || 0} onChange={set('type')}
          sx={{ minWidth: 100 }} label={t('类型')}>
          {LOG_TYPES.map(lt => (
            <MenuItem key={lt.value} value={lt.value}>{t(lt.labelKey)}</MenuItem>
          ))}
        </TextField>

        <ButtonGroup size="small" variant="outlined">
          {DATE_PRESETS.map(dp => (
            <Button key={dp.days} onClick={() => applyPreset(dp.days)}>{t(dp.labelKey)}</Button>
          ))}
        </ButtonGroup>

        <TextField size="small" placeholder={t('模型名称')} value={filters.model_name || ''}
          onChange={set('model_name')} sx={{ width: 140 }} />

        <TextField size="small" placeholder={t('令牌名称')} value={filters.token_name || ''}
          onChange={set('token_name')} sx={{ width: 140 }} />

        {isAdmin && (
          <>
            <TextField size="small" placeholder={t('用户名')} value={filters.username || ''}
              onChange={set('username')} sx={{ width: 120 }} />
            <TextField size="small" placeholder={t('渠道 ID')} value={filters.channel || ''}
              onChange={set('channel')} sx={{ width: 100 }} type="number" />
          </>
        )}

        <TextField size="small" placeholder={t('分组')} value={filters.group || ''}
          onChange={set('group')} sx={{ width: 100 }} />

        <TextField size="small" placeholder={t('请求 ID')} value={filters.request_id || ''}
          onChange={set('request_id')} sx={{ width: 180 }} />

        {activeCount > 0 && (
          <Chip icon={<Clear />} label={t('清除筛选')} size="small" variant="outlined"
            onClick={onClear} onDelete={onClear} />
        )}
      </Stack>
    </Stack>
  );
}

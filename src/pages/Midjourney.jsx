import React from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, Chip,
} from '@mui/material';
import { Palette } from '@mui/icons-material';
import { timestamp2string } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import usePaginatedList from '../hooks/usePaginatedList';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import { useTranslation } from 'react-i18next';

export default function Midjourney() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const endpoint = isAdmin ? '/api/mj/' : '/api/mj/self';

  const { items: data, loading, page, setPage, rowsPerPage, changeRowsPerPage, total, refresh } =
    usePaginatedList(endpoint);

  return (
    <Box>
      <PageHeader icon={Palette} title={t('绘图日志')} subtitle={t('共 {{total}} 条记录', { total })}
        actions={
          <SearchBar value="" onChange={() => {}} onRefresh={refresh} placeholder={t('刷新...')} />
        }
      />
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('时间')}</TableCell>
                <TableCell>{t('任务ID')}</TableCell>
                <TableCell>{t('类型')}</TableCell>
                <TableCell>{t('状态')}</TableCell>
                <TableCell>{t('进度')}</TableCell>
                <TableCell>{t('描述')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? <TableSkeleton rows={5} columns={6} /> :
                data.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>
                    <EmptyState icon={Palette} title={t('暂无绘图日志')} description={t('使用 Midjourney 绘图后将在此显示记录')} />
                  </TableCell></TableRow>
                ) : data.map((item, i) => (
                  <TableRow key={item.id || i} hover>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{timestamp2string(item.submit_time / 1000)}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{item.mj_id || '-'}</TableCell>
                    <TableCell><Chip label={item.action || '-'} size="small" variant="outlined" /></TableCell>
                    <TableCell><Chip label={item.status || '-'} size="small" color={item.status === 'SUCCESS' ? 'success' : 'default'} /></TableCell>
                    <TableCell>{item.progress || '-'}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{item.description || '-'}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={changeRowsPerPage} rowsPerPageOptions={[10, 20, 50]} />
      </Card>
    </Box>
  );
}

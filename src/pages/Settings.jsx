import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, TextField, Button,
  Switch, FormControlLabel, Grid, Stack, Divider, CircularProgress,
  Alert, Chip, Select, MenuItem, FormControl, InputLabel, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Save, Refresh } from '@mui/icons-material';
import { API } from '../api';
import { showError, showSuccess, toBoolean, safeArray } from '../utils';
import { useTranslation } from 'react-i18next';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ mt: 2 }}>{children}</Box> : null;
}

function SC({ title, children }) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>{title}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function JsonField({ label, value, onChange, rows = 4, helperText }) {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);
    try { if (v.trim()) JSON.parse(v); setError(''); } catch { setError(t('JSON 格式错误')); }
  };
  return (
    <TextField fullWidth label={label} value={value} onChange={handleChange}
      multiline rows={rows} error={!!error} helperText={error || helperText}
      sx={{ fontFamily: 'monospace', '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }} />
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/option/');
      if (res.data.success) {
        const opts = {};
        safeArray(res.data.data).forEach(item => {
          if (['true', 'false'].includes(item.value)) opts[item.key] = item.value === 'true';
          else opts[item.key] = item.value;
        });
        setOptions(opts);
      }
    } catch (err) { showError(err); }
    setLoading(false);
  };

  useEffect(() => { fetchOptions(); }, []);

  const updateOption = async (key, value) => {
    setSaving(true);
    try {
      const res = await API.put('/api/option/', { key, value: String(value) });
      if (res.data.success) {
        showSuccess(t('保存成功'));
        setOptions(prev => ({ ...prev, [key]: value }));
      } else showError(res.data.message);
    } catch (err) { showError(err); }
    setSaving(false);
  };

  const updateMultiple = async (pairs) => {
    setSaving(true);
    try {
      for (const { key, value } of pairs) {
        await API.put('/api/option/', { key, value: String(value) });
      }
      showSuccess(t('保存成功'));
      const newOpts = { ...options };
      pairs.forEach(({ key, value }) => { newOpts[key] = value; });
      setOptions(newOpts);
    } catch (err) { showError(err); }
    setSaving(false);
  };

  const opt = (key, fallback = '') => options[key] ?? fallback;
  const setOpt = (key) => (e) => setOptions(prev => ({ ...prev, [key]: e.target?.value ?? e }));
  const setBoolOpt = (key) => (e) => {
    const val = e.target.checked;
    setOptions(prev => ({ ...prev, [key]: val }));
    updateOption(key, val);
  };
  const setRawOpt = (key) => (val) => setOptions(prev => ({ ...prev, [key]: val }));

  const SaveBtn = ({ keys }) => (
    <Button variant="contained" sx={{ mt: 2 }} disabled={saving} startIcon={<Save />}
      onClick={() => updateMultiple(keys.map(k => ({ key: k, value: opt(k) })))}>{t('保存')}</Button>
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  const TABS = [
    t('运营设置'), t('仪表盘设置'), t('聊天设置'), t('绘图设置'), t('支付设置'),
    t('分组与模型定价'), t('速率限制'), t('模型相关'), t('模型部署'), t('性能设置'),
    t('系统设置'), t('其他设置'),
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>{t('系统设置')}</Typography>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchOptions} disabled={loading}>{t('刷新')}</Button>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        {TABS.map((tab, i) => <Tab key={i} label={tab} />)}
      </Tabs>

      {/* ============ Tab 0: 运营设置 ============ */}
      <TabPanel value={tab} index={0}>
        <SC title={t('通用设置')}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('充值链接')} value={opt('TopUpLink')} onChange={setOpt('TopUpLink')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('文档链接')} value={opt('general_setting.docs_link')} onChange={setOpt('general_setting.docs_link')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('单位额度')} type="number" value={opt('QuotaPerUnit', 500000)} onChange={setOpt('QuotaPerUnit')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('USD汇率')} type="number" value={opt('USDExchangeRate', 7)} onChange={setOpt('USDExchangeRate')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('重试次数')} type="number" value={opt('RetryTimes', 0)} onChange={setOpt('RetryTimes')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('货币单位')}</InputLabel>
                <Select value={opt('general_setting.quota_display_type', 'USD')} onChange={setOpt('general_setting.quota_display_type')} label={t('货币单位')}>
                  <MenuItem value="USD">USD ($)</MenuItem>
                  <MenuItem value="CNY">CNY (¥)</MenuItem>
                  <MenuItem value="TOKENS">{t('原始值 (Tokens)')}</MenuItem>
                  <MenuItem value="CUSTOM">{t('自定义')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {opt('general_setting.quota_display_type') === 'CUSTOM' && (
              <>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField fullWidth label={t('自定义货币符号')} value={opt('general_setting.custom_currency_symbol', '¤')} onChange={setOpt('general_setting.custom_currency_symbol')} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField fullWidth label={t('自定义汇率 (相对USD)')} type="number" value={opt('general_setting.custom_currency_exchange_rate', 1)} onChange={setOpt('general_setting.custom_currency_exchange_rate')} />
                </Grid>
              </>
            )}
            <Grid size={12}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <FormControlLabel control={<Switch checked={!!opt('DisplayTokenStatEnabled')} onChange={setBoolOpt('DisplayTokenStatEnabled')} />} label={t('显示Token统计')} />
                <FormControlLabel control={<Switch checked={!!opt('DefaultCollapseSidebar')} onChange={setBoolOpt('DefaultCollapseSidebar')} />} label={t('默认折叠侧边栏')} />
                <FormControlLabel control={<Switch checked={!!opt('DemoSiteEnabled')} onChange={setBoolOpt('DemoSiteEnabled')} />} label={t('演示站点模式')} />
                <FormControlLabel control={<Switch checked={!!opt('SelfUseModeEnabled')} onChange={setBoolOpt('SelfUseModeEnabled')} />} label={t('自用模式')} />
              </Stack>
            </Grid>
          </Grid>
          <SaveBtn keys={['TopUpLink', 'general_setting.docs_link', 'QuotaPerUnit', 'USDExchangeRate', 'RetryTimes', 'general_setting.quota_display_type', 'general_setting.custom_currency_symbol', 'general_setting.custom_currency_exchange_rate']} />
        </SC>

        <SC title={t('额度设置')}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('新用户额度')} type="number" value={opt('QuotaForNewUser', 0)} onChange={setOpt('QuotaForNewUser')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('预扣额度')} type="number" value={opt('PreConsumedQuota', 0)} onChange={setOpt('PreConsumedQuota')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('邀请人奖励')} type="number" value={opt('QuotaForInviter', 0)} onChange={setOpt('QuotaForInviter')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('被邀请人奖励')} type="number" value={opt('QuotaForInvitee', 0)} onChange={setOpt('QuotaForInvitee')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth label={t('单用户最大令牌数')} type="number" value={opt('token_setting.max_user_tokens', 0)} onChange={setOpt('token_setting.max_user_tokens')}
                helperText={t('0 表示不限制')} />
            </Grid>
          </Grid>
          <SaveBtn keys={['QuotaForNewUser', 'PreConsumedQuota', 'QuotaForInviter', 'QuotaForInvitee', 'token_setting.max_user_tokens']} />
        </SC>

        <SC title={t('敏感词管理')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <FormControlLabel control={<Switch checked={!!opt('CheckSensitiveEnabled')} onChange={setBoolOpt('CheckSensitiveEnabled')} />} label={t('启用敏感词检测')} />
                <FormControlLabel control={<Switch checked={!!opt('CheckSensitiveOnPromptEnabled')} onChange={setBoolOpt('CheckSensitiveOnPromptEnabled')} />} label={t('检测请求 prompt')} />
                <FormControlLabel control={<Switch checked={!!opt('StopOnSensitiveEnabled')} onChange={setBoolOpt('StopOnSensitiveEnabled')} />} label={t('命中后立即停止')} />
              </Stack>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label={t('敏感词列表')} multiline rows={6}
                value={opt('SensitiveWords', '')} onChange={setOpt('SensitiveWords')}
                helperText={t('每行一个，或用逗号分隔。命中后将根据上方策略处理请求。')}
                sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }} />
            </Grid>
          </Grid>
          <SaveBtn keys={['SensitiveWords']} />
        </SC>

        <SC title={t('自动处理策略')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField fullWidth multiline rows={3} label={t('自动禁用关键词')}
                value={opt('AutomaticDisableKeywords', '')} onChange={setRawOpt('AutomaticDisableKeywords')}
                helperText={t('每行一个关键词或用逗号分隔。示例: invalid_api_key, insufficient_quota')}
                sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label={t('自动禁用状态码')}
                value={opt('AutomaticDisableStatusCodes', '')} onChange={setRawOpt('AutomaticDisableStatusCodes')}
                helperText={t('范围格式，逗号分隔。示例: 401  或  401-403  或  401,500-503')}
                sx={{ '& input': { fontFamily: 'monospace' } }} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label={t('自动重试状态码')}
                value={opt('AutomaticRetryStatusCodes', '')} onChange={setRawOpt('AutomaticRetryStatusCodes')}
                helperText={t('范围格式，逗号分隔。示例: 502-504  或  500,502-504')}
                sx={{ '& input': { fontFamily: 'monospace' } }} />
            </Grid>
          </Grid>
          <SaveBtn keys={['AutomaticDisableKeywords', 'AutomaticDisableStatusCodes', 'AutomaticRetryStatusCodes']} />
        </SC>

        <SC title={t('渠道亲和力 (Channel Affinity)')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <FormControlLabel control={<Switch checked={!!opt('channel_affinity_setting.enabled')} onChange={setBoolOpt('channel_affinity_setting.enabled')} />} label={t('启用渠道亲和力')} />
                <FormControlLabel control={<Switch checked={!!opt('channel_affinity_setting.switch_on_success')} onChange={setBoolOpt('channel_affinity_setting.switch_on_success')} />} label={t('成功时切换记录')} />
              </Stack>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('最大缓存条目')} type="number" value={opt('channel_affinity_setting.max_entries', 1000)} onChange={setOpt('channel_affinity_setting.max_entries')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('默认 TTL (秒)')} type="number" value={opt('channel_affinity_setting.default_ttl_seconds', 600)} onChange={setOpt('channel_affinity_setting.default_ttl_seconds')} /></Grid>
            <Grid size={12}>
              <JsonField label={t('亲和力规则 (JSON)')} value={opt('channel_affinity_setting.rules', '[]')} onChange={setRawOpt('channel_affinity_setting.rules')} rows={5}
                helperText={t('为不同的模型/路径定义渠道粘性规则')} />
            </Grid>
          </Grid>
          <SaveBtn keys={['channel_affinity_setting.max_entries', 'channel_affinity_setting.default_ttl_seconds', 'channel_affinity_setting.rules']} />
        </SC>

        <SC title={t('监控设置')}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('渠道禁用阈值')} type="number" value={opt('ChannelDisableThreshold', 0)} onChange={setOpt('ChannelDisableThreshold')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('额度提醒阈值')} type="number" value={opt('QuotaRemindThreshold', 0)} onChange={setOpt('QuotaRemindThreshold')} /></Grid>
            <Grid size={12}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <FormControlLabel control={<Switch checked={!!opt('AutomaticDisableChannelEnabled')} onChange={setBoolOpt('AutomaticDisableChannelEnabled')} />} label={t('自动禁用失败渠道')} />
                <FormControlLabel control={<Switch checked={!!opt('AutomaticEnableChannelEnabled')} onChange={setBoolOpt('AutomaticEnableChannelEnabled')} />} label={t('自动启用恢复渠道')} />
                <FormControlLabel control={<Switch checked={!!opt('LogConsumeEnabled')} onChange={setBoolOpt('LogConsumeEnabled')} />} label={t('记录消费日志')} />
                <FormControlLabel control={<Switch checked={!!opt('CheckSensitiveEnabled')} onChange={setBoolOpt('CheckSensitiveEnabled')} />} label={t('敏感词检测')} />
              </Stack>
            </Grid>
          </Grid>
          <SaveBtn keys={['ChannelDisableThreshold', 'QuotaRemindThreshold']} />
        </SC>

        <SC title={t('签到设置')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('checkin_setting.enabled')} onChange={setBoolOpt('checkin_setting.enabled')} />} label={t('启用签到')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('最小额度')} type="number" value={opt('checkin_setting.min_quota', 1000)} onChange={setOpt('checkin_setting.min_quota')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('最大额度')} type="number" value={opt('checkin_setting.max_quota', 10000)} onChange={setOpt('checkin_setting.max_quota')} /></Grid>
          </Grid>
          <SaveBtn keys={['checkin_setting.min_quota', 'checkin_setting.max_quota']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 1: 仪表盘设置 ============ */}
      <TabPanel value={tab} index={1}>
        <SC title={t('数据看板')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('DataExportEnabled')} onChange={setBoolOpt('DataExportEnabled')} />} label={t('启用数据看板')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('数据刷新间隔(小时)')} type="number" value={opt('DataExportInterval', 24)} onChange={setOpt('DataExportInterval')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('默认时间')} value={opt('DataExportDefaultTime', '00:00')} onChange={setOpt('DataExportDefaultTime')} /></Grid>
          </Grid>
          <SaveBtn keys={['DataExportInterval', 'DataExportDefaultTime']} />
        </SC>

        <SC title={t('控制台设置')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('console_setting.enabled')} onChange={setBoolOpt('console_setting.enabled')} />} label={t('启用控制台')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('会话过期时间(秒)')} type="number" value={opt('console_setting.expire_seconds', 3600)} onChange={setOpt('console_setting.expire_seconds')} /></Grid>
          </Grid>
          <SaveBtn keys={['console_setting.expire_seconds']} />
        </SC>

        <SC title={t('公告管理')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('AnnouncementsEnabled')} onChange={setBoolOpt('AnnouncementsEnabled')} />} label={t('启用公告')} />
            </Grid>
            <Grid size={12}>
              <JsonField label={t('公告列表 (JSON)')} value={opt('Announcements', '[]')} onChange={setRawOpt('Announcements')} rows={6}
                helperText={t('格式: [{"title":"标题","content":"内容","type":"info","enabled":true}]')} />
            </Grid>
          </Grid>
          <SaveBtn keys={['Announcements']} />
        </SC>

        <SC title={t('API 信息')}>
          <JsonField label={t('API 信息列表 (JSON)')} value={opt('APIInfo', '[]')} onChange={setRawOpt('APIInfo')} rows={5}
            helperText={t('格式: [{"name":"名称","endpoint":"地址","description":"描述"}]')} />
          <SaveBtn keys={['APIInfo']} />
        </SC>

        <SC title={t('FAQ 管理')}>
          <JsonField label={t('FAQ 列表 (JSON)')} value={opt('FAQs', '[]')} onChange={setRawOpt('FAQs')} rows={5}
            helperText={t('格式: [{"question":"问题","answer":"回答","category":"分类"}]')} />
          <SaveBtn keys={['FAQs']} />
        </SC>

        <SC title={t('Uptime Kuma 监控')}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('分类名称')} value={opt('uptimeKumaConfig.categoryName', '')} onChange={setOpt('uptimeKumaConfig.categoryName')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="URL" value={opt('uptimeKumaConfig.url', '')} onChange={setOpt('uptimeKumaConfig.url')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Slug" value={opt('uptimeKumaConfig.slug', '')} onChange={setOpt('uptimeKumaConfig.slug')} /></Grid>
          </Grid>
          <SaveBtn keys={['uptimeKumaConfig.categoryName', 'uptimeKumaConfig.url', 'uptimeKumaConfig.slug']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 2: 聊天设置 ============ */}
      <TabPanel value={tab} index={2}>
        <SC title={t('聊天链接配置')}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('配置第三方聊天客户端的链接，支持模板变量')}: {'{key}'}, {'{address}'}, {'{model}'}
          </Alert>
          <JsonField label={t('聊天配置 (JSON)')} value={opt('Chats', '[]')} onChange={setRawOpt('Chats')} rows={12}
            helperText='格式: [{"ChatGPT Next Web":"https://...?key={key}"}] 或更复杂结构' />
          <SaveBtn keys={['Chats']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 3: 绘图设置 ============ */}
      <TabPanel value={tab} index={3}>
        <SC title={t('绘图功能')}>
          <Stack spacing={1}>
            <FormControlLabel control={<Switch checked={!!opt('DrawingEnabled')} onChange={setBoolOpt('DrawingEnabled')} />} label={t('启用绘图功能')} />
            <FormControlLabel control={<Switch checked={!!opt('MjNotifyEnabled')} onChange={setBoolOpt('MjNotifyEnabled')} />} label={t('Midjourney 通知')} />
            <FormControlLabel control={<Switch checked={!!opt('MjAccountFilterEnabled')} onChange={setBoolOpt('MjAccountFilterEnabled')} />} label={t('Midjourney 账号过滤')} />
            <FormControlLabel control={<Switch checked={!!opt('MjForwardUrlEnabled')} onChange={setBoolOpt('MjForwardUrlEnabled')} />} label={t('Midjourney URL 转发')} />
            <FormControlLabel control={<Switch checked={!!opt('MjModeClearEnabled')} onChange={setBoolOpt('MjModeClearEnabled')} />} label={t('Midjourney 模式清除')} />
            <FormControlLabel control={<Switch checked={!!opt('MjActionCheckSuccessEnabled')} onChange={setBoolOpt('MjActionCheckSuccessEnabled')} />} label={t('Midjourney 动作检查')} />
          </Stack>
        </SC>
      </TabPanel>

      {/* ============ Tab 4: 支付设置 ============ */}
      <TabPanel value={tab} index={4}>
        <SC title={t('易支付 (Epay)')}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('支付地址')} value={opt('PayAddress')} onChange={setOpt('PayAddress')} placeholder="https://pay.example.com" /></Grid>
            <Grid size={{ xs: 12, sm: 3 }}><TextField fullWidth label={t('商户ID')} value={opt('EpayId')} onChange={setOpt('EpayId')} /></Grid>
            <Grid size={{ xs: 12, sm: 3 }}><TextField fullWidth label={t('商户密钥')} type="password" value={opt('EpayKey')} onChange={setOpt('EpayKey')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('单价')} type="number" value={opt('Price', 7.3)} onChange={setOpt('Price')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('最低充值')} type="number" value={opt('MinTopUp', 1)} onChange={setOpt('MinTopUp')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('支付方式 (JSON)')} value={opt('PayMethods', '[]')} onChange={setRawOpt('PayMethods')} rows={3} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('充值档位 金额选项 (JSON)')} value={opt('payment_setting.amount_options', '[10,20,50,100,200,500]')} onChange={setRawOpt('payment_setting.amount_options')} rows={3}
                helperText={t('例如: [10, 20, 50, 100, 200, 500]')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('分组比例 (JSON)')} value={opt('TopupGroupRatio', '{"default":1}')} onChange={setRawOpt('TopupGroupRatio')} rows={3}
                helperText={t('例如: {"default":1, "vip":0.9}')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('充值档位 金额折扣 (JSON)')} value={opt('payment_setting.amount_discount', '{}')} onChange={setRawOpt('payment_setting.amount_discount')} rows={3}
                helperText={t('例如: {"100": 0.95, "500": 0.85} (100元9.5折)')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label={t('自定义回调地址')} value={opt('CustomCallbackAddress')} onChange={setOpt('CustomCallbackAddress')}
                helperText={t('留空使用默认 ServerAddress')} />
            </Grid>
          </Grid>
          <SaveBtn keys={['PayAddress', 'CustomCallbackAddress', 'EpayId', 'EpayKey', 'Price', 'MinTopUp', 'PayMethods', 'payment_setting.amount_options', 'TopupGroupRatio', 'payment_setting.amount_discount']} />
        </SC>

        <SC title="Stripe">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="API Secret" type="password" value={opt('StripeApiSecret')} onChange={setOpt('StripeApiSecret')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Webhook Secret" type="password" value={opt('StripeWebhookSecret')} onChange={setOpt('StripeWebhookSecret')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Price ID" value={opt('StripePriceId')} onChange={setOpt('StripePriceId')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('单价(分)')} type="number" value={opt('StripeUnitPrice')} onChange={setOpt('StripeUnitPrice')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('最低充值')} type="number" value={opt('StripeMinTopUp')} onChange={setOpt('StripeMinTopUp')} /></Grid>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('StripePromotionCodesEnabled')} onChange={setBoolOpt('StripePromotionCodesEnabled')} />} label={t('启用促销码')} />
            </Grid>
          </Grid>
          <SaveBtn keys={['StripeApiSecret', 'StripeWebhookSecret', 'StripePriceId', 'StripeUnitPrice', 'StripeMinTopUp', 'StripePromotionCodesEnabled']} />
        </SC>

        <SC title="Creem">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="API Key" type="password" value={opt('CreemApiKey')} onChange={setOpt('CreemApiKey')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Webhook Secret" type="password" value={opt('CreemWebhookSecret')} onChange={setOpt('CreemWebhookSecret')} /></Grid>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('CreemTestMode')} onChange={setBoolOpt('CreemTestMode')} />} label={t('测试模式')} />
            </Grid>
            <Grid size={12}>
              <JsonField label={t('产品配置 (JSON)')} value={opt('CreemProducts', '[]')} onChange={setRawOpt('CreemProducts')} rows={4}
                helperText={t('格式: [{"productId":"xxx","name":"名称","price":10,"currency":"USD","quota":100000}]')} />
            </Grid>
          </Grid>
          <SaveBtn keys={['CreemApiKey', 'CreemWebhookSecret', 'CreemTestMode', 'CreemProducts']} />
        </SC>

        <SC title="Waffo">
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('WaffoEnabled')} onChange={setBoolOpt('WaffoEnabled')} />} label={t('启用 Waffo')} />
              <FormControlLabel control={<Switch checked={!!opt('WaffoSandbox')} onChange={setBoolOpt('WaffoSandbox')} />} label={t('沙箱模式')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('商户ID')} value={opt('WaffoMerchantId', opt('WaffoId'))} onChange={setOpt('WaffoMerchantId')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="API Key" type="password" value={opt('WaffoApiKey', opt('WaffoKey'))} onChange={setOpt('WaffoApiKey')} /></Grid>
            <Grid size={{ xs: 6, sm: 2 }}><TextField fullWidth label={t('单价')} type="number" value={opt('WaffoUnitPrice', 1)} onChange={setOpt('WaffoUnitPrice')} /></Grid>
            <Grid size={{ xs: 6, sm: 2 }}><TextField fullWidth label={t('最低充值')} type="number" value={opt('WaffoMinTopUp', 1)} onChange={setOpt('WaffoMinTopUp')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('货币')} value={opt('WaffoCurrency', 'USD')} onChange={setOpt('WaffoCurrency')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('通知 URL')} value={opt('WaffoNotifyUrl')} onChange={setOpt('WaffoNotifyUrl')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('返回 URL')} value={opt('WaffoReturnUrl')} onChange={setOpt('WaffoReturnUrl')} /></Grid>
            <Grid size={12}><TextField fullWidth label={t('RSA 私钥')} multiline rows={3} value={opt('WaffoPrivateKey')} onChange={setOpt('WaffoPrivateKey')} /></Grid>
            <Grid size={12}><TextField fullWidth label={t('Waffo 公钥证书')} multiline rows={3} value={opt('WaffoPublicCert')} onChange={setOpt('WaffoPublicCert')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Sandbox API Key" type="password" value={opt('WaffoSandboxApiKey')} onChange={setOpt('WaffoSandboxApiKey')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('Sandbox 私钥')} multiline rows={2} value={opt('WaffoSandboxPrivateKey')} onChange={setOpt('WaffoSandboxPrivateKey')} /></Grid>
            <Grid size={12}><TextField fullWidth label={t('Sandbox 公钥证书')} multiline rows={2} value={opt('WaffoSandboxPublicCert')} onChange={setOpt('WaffoSandboxPublicCert')} /></Grid>
            <Grid size={12}>
              <JsonField label={t('支付方式 (JSON)')} value={opt('WaffoPayMethods', '[]')} onChange={setRawOpt('WaffoPayMethods')} rows={3} />
            </Grid>
          </Grid>
          <SaveBtn keys={['WaffoEnabled', 'WaffoSandbox', 'WaffoMerchantId', 'WaffoApiKey', 'WaffoUnitPrice', 'WaffoMinTopUp', 'WaffoCurrency', 'WaffoNotifyUrl', 'WaffoReturnUrl', 'WaffoPrivateKey', 'WaffoPublicCert', 'WaffoSandboxApiKey', 'WaffoSandboxPrivateKey', 'WaffoSandboxPublicCert', 'WaffoPayMethods']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 5: 分组与模型定价 ============ */}
      <TabPanel value={tab} index={5}>
        <SC title={t('分组设置')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('DefaultUseAutoGroup')} onChange={setBoolOpt('DefaultUseAutoGroup')} />} label={t('默认使用自动分组')} />
              <FormControlLabel control={<Switch checked={!!opt('ExposeRatioEnabled')} onChange={setBoolOpt('ExposeRatioEnabled')} />} label={t('公开倍率 API')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('分组倍率 (JSON)')} value={opt('GroupRatio', '{}')} onChange={setRawOpt('GroupRatio')} rows={5}
                helperText='格式: {"default":1,"vip":0.8}' />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('用户可用分组 (JSON)')} value={opt('UserUsableGroups', '[]')} onChange={setRawOpt('UserUsableGroups')} rows={5}
                helperText='格式: ["default","vip"]' />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('分组间倍率 (JSON)')} value={opt('GroupGroupRatio', '{}')} onChange={setRawOpt('GroupGroupRatio')} rows={4} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('自动分组配置 (JSON)')} value={opt('AutoGroups', '[]')} onChange={setRawOpt('AutoGroups')} rows={4} />
            </Grid>
          </Grid>
          <SaveBtn keys={['GroupRatio', 'UserUsableGroups', 'GroupGroupRatio', 'AutoGroups']} />
        </SC>

        <SC title={t('模型定价')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <JsonField label={t('模型固定价格 (JSON)')} value={opt('ModelPrice', '{}')} onChange={setRawOpt('ModelPrice')} rows={6}
                helperText='格式: {"gpt-4":0.03,"claude-3-opus":0.015} — 每次调用固定扣费' />
            </Grid>
            <Grid size={12}>
              <JsonField label={t('模型倍率 (JSON)')} value={opt('ModelRatio', '{}')} onChange={setRawOpt('ModelRatio')} rows={6}
                helperText='格式: {"gpt-4":15,"gpt-3.5-turbo":0.75} — 按 token 计费的倍率' />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('补全倍率 (JSON)')} value={opt('CompletionRatio', '{}')} onChange={setRawOpt('CompletionRatio')} rows={4}
                helperText='自定义模型补全 token 倍率' />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('缓存倍率 (JSON)')} value={opt('CacheRatio', '{}')} onChange={setRawOpt('CacheRatio')} rows={4}
                helperText='Prompt 缓存计费倍率' />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('缓存创建倍率 (JSON)')} value={opt('CreateCacheRatio', '{}')} onChange={setRawOpt('CreateCacheRatio')} rows={3} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('图片倍率 (JSON)')} value={opt('ImageRatio', '{}')} onChange={setRawOpt('ImageRatio')} rows={3} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('音频输入倍率 (JSON)')} value={opt('AudioRatio', '{}')} onChange={setRawOpt('AudioRatio')} rows={3} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('音频输出倍率 (JSON)')} value={opt('AudioCompletionRatio', '{}')} onChange={setRawOpt('AudioCompletionRatio')} rows={3} />
            </Grid>
          </Grid>
          <SaveBtn keys={['ModelPrice', 'ModelRatio', 'CompletionRatio', 'CacheRatio', 'CreateCacheRatio', 'ImageRatio', 'AudioRatio', 'AudioCompletionRatio']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 6: 速率限制 ============ */}
      <TabPanel value={tab} index={6}>
        <SC title={t('请求速率限制')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('ModelRequestRateLimitEnabled')} onChange={setBoolOpt('ModelRequestRateLimitEnabled')} />} label={t('启用速率限制')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('限制周期(分钟)')} type="number" value={opt('ModelRequestRateLimitDurationMinutes', 1)} onChange={setOpt('ModelRequestRateLimitDurationMinutes')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('最大请求数')} type="number" value={opt('ModelRequestRateLimitCount', 0)} onChange={setOpt('ModelRequestRateLimitCount')} helperText={t('0 = 不限制')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('最大成功请求数')} type="number" value={opt('ModelRequestRateLimitSuccessCount', 0)} onChange={setOpt('ModelRequestRateLimitSuccessCount')} helperText={t('0 = 不限制')} /></Grid>
            <Grid size={12}>
              <JsonField label={t('分组速率限制 (JSON)')} value={opt('ModelRequestRateLimitGroup', '{}')} onChange={setRawOpt('ModelRequestRateLimitGroup')} rows={5}
                helperText='格式: {"default":[200,100],"vip":[0,1000]} — [最大请求数, 最大成功数]' />
            </Grid>
          </Grid>
          <SaveBtn keys={['ModelRequestRateLimitDurationMinutes', 'ModelRequestRateLimitCount', 'ModelRequestRateLimitSuccessCount', 'ModelRequestRateLimitGroup']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 7: 模型相关 ============ */}
      <TabPanel value={tab} index={7}>
        <SC title={t('全局模型设置')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Stack spacing={1}>
                <FormControlLabel control={<Switch checked={!!opt('global.pass_through_request_enabled')} onChange={setBoolOpt('global.pass_through_request_enabled')} />} label={t('透传请求 (跳过所有处理直接转发)')} />
                <FormControlLabel control={<Switch checked={!!opt('general_setting.ping_interval_enabled')} onChange={setBoolOpt('general_setting.ping_interval_enabled')} />} label={t('连接保活 Ping')} />
              </Stack>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('Ping 间隔(秒)')} type="number" value={opt('general_setting.ping_interval_seconds', 30)} onChange={setOpt('general_setting.ping_interval_seconds')} /></Grid>
            <Grid size={12}>
              <JsonField label={t('思考模型黑名单 (JSON)')} value={opt('global.thinking_model_blacklist', '[]')} onChange={setRawOpt('global.thinking_model_blacklist')} rows={3}
                helperText='排除 -thinking 后缀处理的模型列表' />
            </Grid>
            <Grid size={12}>
              <JsonField label={t('ChatCompletions 转 Responses 策略 (JSON)')} value={opt('global.chat_completions_to_responses_policy', '{}')} onChange={setRawOpt('global.chat_completions_to_responses_policy')} rows={5}
                helperText='格式: {"enabled":true,"all_channels":false,"channel_ids":[1],"model_patterns":["^gpt-4o.*$"]}' />
            </Grid>
          </Grid>
          <SaveBtn keys={['general_setting.ping_interval_seconds', 'global.thinking_model_blacklist', 'global.chat_completions_to_responses_policy']} />
        </SC>

        <SC title={t('Claude 模型设置')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('claude.thinking_adapter_enabled')} onChange={setBoolOpt('claude.thinking_adapter_enabled')} />} label={t('启用 thinking 适配器')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('Thinking 预算比例')} type="number" value={opt('claude.thinking_adapter_budget_tokens_percentage', 0.8)} onChange={setOpt('claude.thinking_adapter_budget_tokens_percentage')} helperText={t('最小 0.1')} /></Grid>
            <Grid size={12}>
              <JsonField label={t('自定义请求头 (JSON)')} value={opt('claude.model_headers_settings', '{}')} onChange={setRawOpt('claude.model_headers_settings')} rows={5}
                helperText='格式: {"claude-3-7-sonnet":{"anthropic-beta":["output-128k"]}}' />
            </Grid>
            <Grid size={12}>
              <JsonField label={t('默认 max_tokens (JSON)')} value={opt('claude.default_max_tokens', '{}')} onChange={setRawOpt('claude.default_max_tokens')} rows={3}
                helperText='格式: {"claude-3-opus":4096}' />
            </Grid>
          </Grid>
          <SaveBtn keys={['claude.thinking_adapter_budget_tokens_percentage', 'claude.model_headers_settings', 'claude.default_max_tokens']} />
        </SC>

        <SC title={t('Gemini 模型设置')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Stack spacing={1}>
                <FormControlLabel control={<Switch checked={!!opt('gemini.thinking_adapter_enabled')} onChange={setBoolOpt('gemini.thinking_adapter_enabled')} />} label={t('启用 thinking 适配器')} />
                <FormControlLabel control={<Switch checked={!!opt('gemini.function_call_thought_signature_enabled')} onChange={setBoolOpt('gemini.function_call_thought_signature_enabled')} />} label="FunctionCall thoughtSignature" />
                <FormControlLabel control={<Switch checked={!!opt('gemini.remove_function_response_id_enabled')} onChange={setBoolOpt('gemini.remove_function_response_id_enabled')} />} label={t('移除 functionResponse.id (Vertex 兼容)')} />
              </Stack>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('Thinking 预算比例')} type="number" value={opt('gemini.thinking_adapter_budget_tokens_percentage', 0.8)} onChange={setOpt('gemini.thinking_adapter_budget_tokens_percentage')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('安全设置 (JSON)')} value={opt('gemini.safety_settings', '{}')} onChange={setRawOpt('gemini.safety_settings')} rows={4} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JsonField label={t('API 版本覆盖 (JSON)')} value={opt('gemini.version_settings', '{}')} onChange={setRawOpt('gemini.version_settings')} rows={4} />
            </Grid>
            <Grid size={12}>
              <JsonField label={t('支持图片生成的模型 (JSON)')} value={opt('gemini.supported_imagine_models', '[]')} onChange={setRawOpt('gemini.supported_imagine_models')} rows={2} />
            </Grid>
          </Grid>
          <SaveBtn keys={['gemini.thinking_adapter_budget_tokens_percentage', 'gemini.safety_settings', 'gemini.version_settings', 'gemini.supported_imagine_models']} />
        </SC>

        <SC title={t('Grok 模型设置')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('grok.violation_deduction_enabled')} onChange={setBoolOpt('grok.violation_deduction_enabled')} />} label={t('违规额外扣费')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('违规扣费金额')} type="number" value={opt('grok.violation_deduction_amount', 0)} onChange={setOpt('grok.violation_deduction_amount')} helperText={t('乘以系统分组倍率')} /></Grid>
          </Grid>
          <SaveBtn keys={['grok.violation_deduction_amount']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 8: 模型部署 ============ */}
      <TabPanel value={tab} index={8}>
        <SC title={t('模型部署配置')}>
          <Alert severity="info" sx={{ mb: 2 }}>{t('模型部署允许你将模型请求路由到指定的服务提供商。通过渠道管理页面配置部署规则。')}</Alert>
          <JsonField label={t('IoNet 配置 (JSON)')} value={opt('model_deployment.ionet', '{}')} onChange={setRawOpt('model_deployment.ionet')} rows={6}
            helperText={t('IoNet 服务提供商的部署配置')} />
          <SaveBtn keys={['model_deployment.ionet']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 9: 性能设置 ============ */}
      <TabPanel value={tab} index={9}>
        <SC title={t('磁盘缓存')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('performance_setting.disk_cache_enabled')} onChange={setBoolOpt('performance_setting.disk_cache_enabled')} />} label={t('启用磁盘缓存 (替代内存缓存)')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('缓存阈值(MB)')} type="number" value={opt('performance_setting.disk_cache_threshold_mb', 10)} onChange={setOpt('performance_setting.disk_cache_threshold_mb')} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label={t('最大缓存(MB)')} type="number" value={opt('performance_setting.disk_cache_max_size_mb', 100)} onChange={setOpt('performance_setting.disk_cache_max_size_mb')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('缓存路径')} value={opt('performance_setting.disk_cache_path', '')} onChange={setOpt('performance_setting.disk_cache_path')} placeholder={t('留空使用默认')} /></Grid>
          </Grid>
          <SaveBtn keys={['performance_setting.disk_cache_threshold_mb', 'performance_setting.disk_cache_max_size_mb', 'performance_setting.disk_cache_path']} />
        </SC>

        <SC title={t('系统资源监控')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel control={<Switch checked={!!opt('performance_setting.monitor_enabled')} onChange={setBoolOpt('performance_setting.monitor_enabled')} />} label={t('启用资源监控 (超限自动拒绝请求)')} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('CPU 阈值(%)')} type="number" value={opt('performance_setting.monitor_cpu_threshold', 90)} onChange={setOpt('performance_setting.monitor_cpu_threshold')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('内存阈值(%)')} type="number" value={opt('performance_setting.monitor_memory_threshold', 90)} onChange={setOpt('performance_setting.monitor_memory_threshold')} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth label={t('磁盘阈值(%)')} type="number" value={opt('performance_setting.monitor_disk_threshold', 90)} onChange={setOpt('performance_setting.monitor_disk_threshold')} /></Grid>
          </Grid>
          <SaveBtn keys={['performance_setting.monitor_cpu_threshold', 'performance_setting.monitor_memory_threshold', 'performance_setting.monitor_disk_threshold']} />
        </SC>

        <SC title={t('流式响应缓冲')}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth label={t('流缓存队列长度')} type="number" value={opt('StreamCacheQueueLength', 0)} onChange={setOpt('StreamCacheQueueLength')}
                helperText={t('流式响应转发缓冲区大小，0 表示同步转发')} />
            </Grid>
          </Grid>
          <SaveBtn keys={['StreamCacheQueueLength']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 10: 系统设置 ============ */}
      <TabPanel value={tab} index={10}>
        <SC title={t('服务器地址')}>
          <TextField fullWidth label={t('服务器地址')} value={opt('ServerAddress')} onChange={setOpt('ServerAddress')} placeholder="https://yourdomain.com" />
          <SaveBtn keys={['ServerAddress']} />
        </SC>

        <SC title={t('登录注册配置')}>
          <Grid container spacing={1}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={0.5}>
                <FormControlLabel control={<Switch checked={!!opt('PasswordLoginEnabled')} onChange={setBoolOpt('PasswordLoginEnabled')} />} label={t('允许密码登录')} />
                <FormControlLabel control={<Switch checked={!!opt('PasswordRegisterEnabled')} onChange={setBoolOpt('PasswordRegisterEnabled')} />} label={t('允许密码注册')} />
                <FormControlLabel control={<Switch checked={!!opt('EmailVerificationEnabled')} onChange={setBoolOpt('EmailVerificationEnabled')} />} label={t('注册邮箱验证')} />
                <FormControlLabel control={<Switch checked={!!opt('RegisterEnabled')} onChange={setBoolOpt('RegisterEnabled')} />} label={t('允许新用户注册')} />
                <FormControlLabel control={<Switch checked={!!opt('TurnstileCheckEnabled')} onChange={setBoolOpt('TurnstileCheckEnabled')} />} label={t('Turnstile 验证')} />
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={0.5}>
                <FormControlLabel control={<Switch checked={!!opt('GitHubOAuthEnabled')} onChange={setBoolOpt('GitHubOAuthEnabled')} />} label="GitHub OAuth" />
                <FormControlLabel control={<Switch checked={!!opt('discord.enabled')} onChange={setBoolOpt('discord.enabled')} />} label="Discord OAuth" />
                <FormControlLabel control={<Switch checked={!!opt('LinuxDOOAuthEnabled')} onChange={setBoolOpt('LinuxDOOAuthEnabled')} />} label="Linux DO OAuth" />
                <FormControlLabel control={<Switch checked={!!opt('WeChatAuthEnabled')} onChange={setBoolOpt('WeChatAuthEnabled')} />} label={t('微信登录')} />
                <FormControlLabel control={<Switch checked={!!opt('TelegramOAuthEnabled')} onChange={setBoolOpt('TelegramOAuthEnabled')} />} label={t('Telegram 登录')} />
                <FormControlLabel control={<Switch checked={!!opt('oidc.enabled')} onChange={setBoolOpt('oidc.enabled')} />} label={t('OIDC 登录')} />
              </Stack>
            </Grid>
          </Grid>
        </SC>

        <SC title={t('SMTP 配置')}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('SMTP 服务器')} value={opt('SMTPServer')} onChange={setOpt('SMTPServer')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('SMTP 端口')} value={opt('SMTPPort')} onChange={setOpt('SMTPPort')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('SMTP 账户')} value={opt('SMTPAccount')} onChange={setOpt('SMTPAccount')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('发送者邮箱')} value={opt('SMTPFrom')} onChange={setOpt('SMTPFrom')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label={t('SMTP 密码')} type="password" value={opt('SMTPToken')} onChange={setOpt('SMTPToken')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel control={<Switch checked={!!opt('SMTPSSLEnabled')} onChange={setBoolOpt('SMTPSSLEnabled')} />} label={t('启用 SSL')} />
            </Grid>
          </Grid>
          <SaveBtn keys={['SMTPServer', 'SMTPPort', 'SMTPAccount', 'SMTPFrom', 'SMTPToken']} />
        </SC>

        <SC title={t('邮箱注册限制')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <FormControlLabel control={<Switch checked={!!opt('EmailDomainRestrictionEnabled')} onChange={setBoolOpt('EmailDomainRestrictionEnabled')} />} label={t('限制邮箱域名')} />
                <FormControlLabel control={<Switch checked={!!opt('EmailAliasRestrictionEnabled')} onChange={setBoolOpt('EmailAliasRestrictionEnabled')} />} label={t('禁止邮箱别名 (+号)')} />
              </Stack>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline rows={4} label={t('邮箱域名白名单')}
                value={opt('EmailDomainWhitelist', '')} onChange={setOpt('EmailDomainWhitelist')}
                helperText={t('每行一个域名，如 gmail.com')}
                sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.85rem' } }} />
            </Grid>
          </Grid>
          <SaveBtn keys={['EmailDomainWhitelist']} />
        </SC>

        <SC title="GitHub OAuth">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Client ID" value={opt('GitHubClientId')} onChange={setOpt('GitHubClientId')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Client Secret" type="password" value={opt('GitHubClientSecret')} onChange={setOpt('GitHubClientSecret')} /></Grid>
          </Grid>
          <SaveBtn keys={['GitHubClientId', 'GitHubClientSecret']} />
        </SC>

        <SC title="LinuxDO OAuth">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 5 }}><TextField fullWidth label="Client ID" value={opt('LinuxDOClientId')} onChange={setOpt('LinuxDOClientId')} /></Grid>
            <Grid size={{ xs: 12, sm: 5 }}><TextField fullWidth label="Client Secret" type="password" value={opt('LinuxDOClientSecret')} onChange={setOpt('LinuxDOClientSecret')} /></Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField fullWidth label={t('最低信任等级')} type="number" value={opt('LinuxDOMinimumTrustLevel', 0)} onChange={setOpt('LinuxDOMinimumTrustLevel')}
                helperText="0-4" />
            </Grid>
          </Grid>
          <SaveBtn keys={['LinuxDOClientId', 'LinuxDOClientSecret', 'LinuxDOMinimumTrustLevel']} />
        </SC>

        <SC title="Discord OAuth">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Client ID" value={opt('discord.client_id')} onChange={setOpt('discord.client_id')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Client Secret" type="password" value={opt('discord.client_secret')} onChange={setOpt('discord.client_secret')} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Guild ID" value={opt('discord.guild_id')} onChange={setOpt('discord.guild_id')} /></Grid>
          </Grid>
          <SaveBtn keys={['discord.client_id', 'discord.client_secret', 'discord.guild_id']} />
        </SC>

        <SC title={t('OIDC 配置')}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Client ID" value={opt('oidc.client_id')} onChange={setOpt('oidc.client_id')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Client Secret" type="password" value={opt('oidc.client_secret')} onChange={setOpt('oidc.client_secret')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Discovery URL" value={opt('oidc.discovery_url')} onChange={setOpt('oidc.discovery_url')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('显示名称')} value={opt('oidc.provider_name')} onChange={setOpt('oidc.provider_name')} /></Grid>
            <Grid size={12}>
              <Typography variant="caption" color="text.secondary">{t('高级 (留空则从 Discovery URL 自动获取)')}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Well-Known URL" value={opt('oidc.well_known')} onChange={setOpt('oidc.well_known')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Authorization Endpoint" value={opt('oidc.authorization_endpoint')} onChange={setOpt('oidc.authorization_endpoint')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Token Endpoint" value={opt('oidc.token_endpoint')} onChange={setOpt('oidc.token_endpoint')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="UserInfo Endpoint" value={opt('oidc.user_info_endpoint')} onChange={setOpt('oidc.user_info_endpoint')} /></Grid>
          </Grid>
          <SaveBtn keys={['oidc.client_id', 'oidc.client_secret', 'oidc.discovery_url', 'oidc.provider_name', 'oidc.well_known', 'oidc.authorization_endpoint', 'oidc.token_endpoint', 'oidc.user_info_endpoint']} />
        </SC>

        <SC title={t('Turnstile 配置')}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Site Key" value={opt('TurnstileSiteKey')} onChange={setOpt('TurnstileSiteKey')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Secret Key" type="password" value={opt('TurnstileSecretKey')} onChange={setOpt('TurnstileSecretKey')} /></Grid>
          </Grid>
          <SaveBtn keys={['TurnstileSiteKey', 'TurnstileSecretKey']} />
        </SC>
      </TabPanel>

      {/* ============ Tab 11: 其他设置 ============ */}
      <TabPanel value={tab} index={11}>
        <SC title={t('AI 助手配置')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2">{t('启用 AI 助手')}</Typography>
                <Switch checked={toBoolean(opt('AiAssistantEnabled'))} onChange={setBoolOpt('AiAssistantEnabled')} />
              </Stack>
              <Typography variant="caption" color="text.secondary">{t('启用后，网站右下角会显示 AI 助手浮动图标，用户可与 AI 对话获取帮助')}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="API Base URL" value={opt('AiAssistantBaseUrl')} onChange={setOpt('AiAssistantBaseUrl')} placeholder="https://skiapi.dev" helperText={t('必填。填本站地址或外部兼容 OpenAI 的服务地址')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('专用 API Token')} value={opt('AiAssistantAuth')} onChange={setOpt('AiAssistantAuth')} placeholder="sk-xxx" type="password" helperText={t('必填。仅保存于服务端，不会下发到浏览器')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('助手使用模型')} value={opt('AiAssistantModel')} onChange={setOpt('AiAssistantModel')} placeholder="gpt-4o-mini" helperText={t('建议用低成本模型控制费用')} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('登录用户限流 (次/分钟)')} type="number" value={opt('AiAssistantRateLimit')} onChange={setOpt('AiAssistantRateLimit')} placeholder="15" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2">{t('允许未登录用户使用')}</Typography>
                <Switch checked={toBoolean(opt('AiAssistantAllowAnonymous'))} onChange={setBoolOpt('AiAssistantAllowAnonymous')} />
              </Stack>
              <Typography variant="caption" color="text.secondary">{t('开启后，匿名访客也能使用助手（按 IP 限流）')}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label={t('匿名用户限流 (次/分钟)')} type="number" value={opt('AiAssistantAnonRateLimit')} onChange={setOpt('AiAssistantAnonRateLimit')} placeholder="3" helperText={t('匿名访客按 IP 限流，默认 3 次/分钟')} /></Grid>
            <Grid size={12}><TextField fullWidth label={t('系统提示词')} multiline rows={4} value={opt('AiAssistantPrompt')} onChange={setOpt('AiAssistantPrompt')}
              placeholder={t('你是本站的 AI 客服助手。请用简洁友好的中文回答用户关于平台使用的问题。')}
              helperText={t('定义助手角色、能力范围和回答风格')} /></Grid>
            <Grid size={12}>
              <Button variant="outlined" size="small" onClick={() => {
                setOpt('AiAssistantPrompt')({ target: { value: '你是本站的 AI 客服助手，名叫「小雪」。本站是一个高性能 AI API 中转服务平台，支持 OpenAI、Claude、Gemini、DeepSeek、Grok 等 50+ 主流大模型。\n\n你的职责：\n1. 解答用户关于平台使用的问题（注册、充值、创建密钥、模型选择、价格查询等）\n2. 提供 API 接入指导（base_url 替换、SDK 配置、常见错误排查）\n3. 推荐适合用户需求的模型（性价比、速度、能力对比）\n\n回答规则：\n- 用简洁友好的中文回答，必要时使用 Markdown 格式\n- 不确定的信息引导用户查看模型广场或联系管理员\n- 不要编造价格或技术细节' } });
                showSuccess(t('已填入默认提示词'));
              }}>{t('填入推荐提示词')}</Button>
            </Grid>
          </Grid>
          <SaveBtn keys={['AiAssistantEnabled', 'AiAssistantBaseUrl', 'AiAssistantModel', 'AiAssistantAuth', 'AiAssistantPrompt', 'AiAssistantRateLimit', 'AiAssistantAllowAnonymous', 'AiAssistantAnonRateLimit']} />
        </SC>
        <SC title={t('页面内容')}>
          <Grid container spacing={2}>
            <Grid size={12}><TextField fullWidth label={t('公告')} multiline rows={3} value={opt('Notice')} onChange={setOpt('Notice')} /></Grid>
            <Grid size={12}><TextField fullWidth label={t('页脚')} multiline rows={2} value={opt('Footer')} onChange={setOpt('Footer')} /></Grid>
            <Grid size={12}><TextField fullWidth label={t('关于页面')} multiline rows={3} value={opt('About')} onChange={setOpt('About')} /></Grid>
            <Grid size={12}><TextField fullWidth label={t('首页内容')} multiline rows={3} value={opt('HomePageContent')} onChange={setOpt('HomePageContent')} /></Grid>
          </Grid>
          <SaveBtn keys={['Notice', 'Footer', 'About', 'HomePageContent']} />
        </SC>
      </TabPanel>
    </Box>
  );
}

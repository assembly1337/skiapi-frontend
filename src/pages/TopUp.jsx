import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Alert, alpha, useTheme, IconButton, Tooltip,
  Divider,
} from '@mui/material';
import {
  AccountBalanceWallet, Redeem, ContentCopy, Share, History,
  CardGiftcard, TrendingUp, DataUsage, ArrowUpward, Payment, CreditCard,
} from '@mui/icons-material';
import { API } from '../api';
import { showError, showSuccess, renderQuota, renderNumber, getQuotaDisplayType, timestamp2string, safeArray, copy } from '../utils';
import { isSafeUrl } from '../utils/security';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import TableSkeleton from '../components/common/TableSkeleton';
import { useTranslation } from 'react-i18next';

function openExternalUrl(url) {
  if (!isSafeUrl(url)) return false;
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (win) win.opener = null;
  return true;
}

function parseCreemProducts(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseWaffoPayMethods(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function InfoCard({ icon, title, value, subtitle, gradient }) {
  const IconComponent = icon;
  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Box sx={{ height: 3, background: gradient }} />
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: gradient, opacity: 0.85,
          }}>
            <IconComponent sx={{ fontSize: 22, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.7rem', letterSpacing: 0.3 }}>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
            {subtitle && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{subtitle}</Typography>}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SectionCard({ icon, title, children, color, action }) {
  const theme = useTheme();
  const IconComponent = icon;
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha(color || theme.palette.primary.main, 0.1) }}>
              <IconComponent sx={{ fontSize: 20, color: color || theme.palette.primary.main }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
          </Stack>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

export default function TopUp() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user, updateUser } = useAuth();
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [topups, setTopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [affiliateLink, setAffiliateLink] = useState('');

  // Online top-up state
  const [topupInfo, setTopupInfo] = useState(null);
  const [topUpCount, setTopUpCount] = useState(0);
  const [selectedPay, setSelectedPay] = useState('');
  const [paying, setPaying] = useState(false);
  // Pre-calculated fiat payment amount returned by /api/user/amount.
  // We don't trust client-side math because the backend factors in group ratio,
  // discount tiers, and token→USD conversion — all of which can change.
  const [payAmount, setPayAmount] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const quotaDisplayType = getQuotaDisplayType();
  const isTokens = quotaDisplayType === 'TOKENS';

  // Format an amount_option for display. In TOKENS mode the raw value is a
  // token count (e.g. 200000000 → "200M"); in USD mode it's a dollar figure.
  const formatAmount = (v) => isTokens ? renderNumber(v) : `$${v}`;

  // Look up the discount multiplier (0 < d <= 1) for the current tier.
  // Backend returns a map[string]float64 keyed by amount string, so check both.
  const getDiscount = (amount) => {
    const d = topupInfo?.discount;
    if (!d || !amount) return null;
    const hit = d[amount] ?? d[String(amount)];
    if (hit && hit > 0 && hit < 1) return hit;
    return null;
  };
  const currentDiscount = getDiscount(topUpCount);
  const creemProducts = parseCreemProducts(topupInfo?.creem_products);
  const waffoPayMethods = parseWaffoPayMethods(topupInfo?.waffo_pay_methods);
  const hasWaffoChoices = topupInfo?.enable_waffo_topup && waffoPayMethods.length > 0;

  useEffect(() => {
    API.get('/api/user/topup/self').then(res => {
      if (res.data.success) setTopups(safeArray(res.data.data));
    }).catch(() => {});
    // Fetch available online top-up methods + amount options
    API.get('/api/user/topup/info').then(res => {
      if (res.data.success) {
        setTopupInfo(res.data.data);
        const opts = res.data.data?.amount_options;
        if (Array.isArray(opts) && opts.length) setTopUpCount(opts[0]);
      }
    }).catch(() => {});
    // Generate affiliate link
    if (user?.aff_code) {
      setAffiliateLink(`${window.location.origin}/register?aff=${user.aff_code}`);
    }
    setLoading(false);
  }, [user]);

  // Debounced pre-calculation of the actual fiat payment amount.
  // Fires /api/user/amount whenever topUpCount or the chosen pay method changes.
  // Stripe has its own endpoint because its min/fees can differ.
  useEffect(() => {
    if (!topupInfo || !topUpCount || topUpCount <= 0) { setPayAmount(null); return; }
    const isStripe = selectedPay === 'stripe';
    const isWaffo = selectedPay === 'waffo' || selectedPay.startsWith('waffo:');
    const endpoint = isStripe ? '/api/user/stripe/amount' : isWaffo ? '/api/user/waffo/amount' : '/api/user/amount';
    const handle = setTimeout(async () => {
      setCalcLoading(true);
      try {
        const res = await API.post(endpoint, {
          amount: parseInt(topUpCount),
          payment_method: isStripe ? 'stripe' : (selectedPay || 'alipay'),
        });
        if (res.data?.message === 'success') {
          // Backend returns the final price as res.data.data (string or number).
          const val = Number(res.data.data);
          if (!Number.isNaN(val)) setPayAmount(val);
          else setPayAmount(null);
        } else {
          setPayAmount(null);
        }
      } catch {
        setPayAmount(null);
      } finally {
        setCalcLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [topUpCount, selectedPay, topupInfo]);

  const handleOnlinePay = async (method) => {
    if (!topupInfo) return;
    const isStripe = method === 'stripe';
    const waffoMatch = /^waffo(?::(\d+))?$/.exec(method);
    const isWaffo = Boolean(waffoMatch);
    const waffoPayMethodIndex = waffoMatch?.[1] != null ? Number(waffoMatch[1]) : null;
    if (isStripe && !topupInfo.enable_stripe_topup) return showError(t('管理员未开启Stripe充值！'));
    if (isWaffo && !topupInfo.enable_waffo_topup) return showError(t('管理员未开启Waffo充值！'));
    if (!isStripe && !isWaffo && !topupInfo.enable_online_topup) return showError(t('管理员未开启在线充值！'));
    const min = isStripe ? (topupInfo.stripe_min_topup || 1) : isWaffo ? (topupInfo.waffo_min_topup || 1) : (topupInfo.min_topup || 1);
    if (!topUpCount || topUpCount < min) return showError(t('充值数量不能小于') + min);

    setSelectedPay(method);
    setPaying(true);
    try {
      if (isStripe || isWaffo) {
        const payload = isStripe
          ? { amount: parseInt(topUpCount), payment_method: method }
          : {
              amount: parseInt(topUpCount),
              ...(waffoPayMethodIndex != null ? { pay_method_index: waffoPayMethodIndex } : {}),
            };
        const res = await API.post(isStripe ? '/api/user/stripe/pay' : '/api/user/waffo/pay', payload);
        const payUrl = res.data?.data?.pay_link || res.data?.data?.payment_url;
        if (res.data?.message === 'success' && payUrl) {
          if (!openExternalUrl(payUrl)) showError(t('支付链接不安全'));
        } else {
          showError(res.data?.data || res.data?.message || t('支付失败'));
        }
      } else {
        const res = await API.post('/api/user/pay', { amount: parseInt(topUpCount), payment_method: method });
        if (res.data?.message === 'success') {
          // epay: POST form submission
          const params = res.data.data;
          const url = res.data.url;
          if (!isSafeUrl(url)) {
            showError(t('支付链接不安全'));
            return;
          }
          const form = document.createElement('form');
          form.action = url; form.method = 'POST'; form.target = '_blank';
          form.rel = 'noopener noreferrer';
          for (const k in params) {
            const inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = k; inp.value = params[k];
            form.appendChild(inp);
          }
          document.body.appendChild(form);
          form.submit();
          document.body.removeChild(form);
        } else {
          showError(res.data?.data || res.data?.message || t('支付失败'));
        }
      }
    } catch (err) {
      showError(err);
    } finally {
      setPaying(false);
    }
  };

  const handleCreemPay = async (product) => {
    if (!topupInfo?.enable_creem_topup) return showError(t('管理员未开启Creem充值！'));
    const productId = product.productId || product.product_id;
    if (!productId) return showError(t('产品配置错误'));
    setSelectedPay(`creem:${productId}`);
    setPaying(true);
    try {
      const res = await API.post('/api/user/creem/pay', { product_id: productId, payment_method: 'creem' });
      const payUrl = res.data?.data?.checkout_url;
      if (res.data?.message === 'success' && payUrl) {
        if (!openExternalUrl(payUrl)) showError(t('支付链接不安全'));
      } else {
        showError(res.data?.data || res.data?.message || t('支付失败'));
      }
    } catch (err) {
      showError(err);
    } finally {
      setPaying(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode) return showError(t('请输入兑换码'));
    setRedeeming(true);
    try {
      const res = await API.post('/api/user/topup', { key: redeemCode });
      if (res.data.success) {
        showSuccess(t('兑换成功'));
        setRedeemCode('');
        const selfRes = await API.get('/api/user/self');
        if (selfRes.data.success) updateUser(selfRes.data.data);
      } else showError(res.data.message);
    } catch (err) { showError(err); }
    setRedeeming(false);
  };

  const copyAffLink = () => {
    if (affiliateLink) {
      copy(affiliateLink);
      showSuccess(t('邀请链接已复制'));
    }
  };

  return (
    <Box>
      <PageHeader icon={AccountBalanceWallet} title={t('钱包管理')} />

      {/* ── Balance Cards ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <InfoCard icon={AccountBalanceWallet} title={t('当前余额')} value={renderQuota(user?.quota || 0)}
            gradient={`linear-gradient(135deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.5)})`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <InfoCard icon={DataUsage} title={t('已用额度')} value={renderQuota(user?.used_quota || 0)}
            gradient="linear-gradient(135deg, #e8710a, #ffb74d)" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <InfoCard icon={TrendingUp} title={t('请求次数')} value={String(user?.request_count || 0)}
            gradient="linear-gradient(135deg, #1e8e3e, #66bb6a)" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <InfoCard icon={CardGiftcard} title={t('邀请额度')} value={renderQuota(user?.aff_quota || 0)}
            subtitle={user?.aff_count ? `${t('已邀请')} ${user.aff_count} ${t('人')}` : undefined}
            gradient="linear-gradient(135deg, #9c27b0, #ba68c8)" />
        </Grid>
      </Grid>

      {/* ── Online Recharge ── */}
      {topupInfo && (topupInfo.enable_online_topup || topupInfo.enable_stripe_topup || topupInfo.enable_waffo_topup || topupInfo.enable_creem_topup) && (
        <Box sx={{ mb: 3 }}>
          <SectionCard icon={Payment} title={t('在线充值')} color={theme.palette.success.main}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  {t('充值数量')}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                  {(topupInfo.amount_options || []).map(opt => {
                    const d = getDiscount(opt);
                    return (
                      <Chip
                        key={opt}
                        label={d ? `${formatAmount(opt)} · ${(d * 10).toFixed(1)}${t('折')}` : formatAmount(opt)}
                        clickable
                        color={topUpCount === opt ? 'primary' : 'default'}
                        variant={topUpCount === opt ? 'filled' : 'outlined'}
                        onClick={() => setTopUpCount(opt)}
                      />
                    );
                  })}
                </Stack>
                <TextField
                  type="number"
                  fullWidth
                  size="small"
                  label={isTokens ? t('充值数量 (tokens)') : t('充值金额')}
                  value={topUpCount}
                  onChange={e => setTopUpCount(Number(e.target.value) || 0)}
                  inputProps={{ min: topupInfo.min_topup || 1 }}
                  helperText={`${t('最低充值')}: ${formatAmount(topupInfo.min_topup || 1)}`}
                />
                {/* Real payment amount preview — pulled from backend so token→fiat conversion and discount are always accurate. */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('实付金额')}:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {calcLoading ? <CircularProgress size={14} /> : (payAmount != null ? `¥${payAmount.toFixed(2)}` : '—')}
                  </Typography>
                  {currentDiscount && (
                    <Chip
                      size="small"
                      color="warning"
                      label={`${(currentDiscount * 10).toFixed(1)}${t('折')}`}
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                  {isTokens && topUpCount > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      ({renderNumber(topUpCount)} tokens)
                    </Typography>
                  )}
                </Stack>
              </Box>
              <Divider />
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  {t('选择支付方式')}
                </Typography>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  {(topupInfo.pay_methods || [])
                    .filter(m => {
                      if (m.type === 'waffo') return topupInfo.enable_waffo_topup && !hasWaffoChoices;
                      if (m.type === 'stripe') return false;
                      return topupInfo.enable_online_topup;
                    })
                    .map(m => (
                    <Button
                      key={m.type}
                      variant="outlined"
                      startIcon={<Payment />}
                      disabled={paying && selectedPay === m.type}
                      onClick={() => handleOnlinePay(m.type)}
                      sx={{ borderRadius: 3, minWidth: 120 }}
                    >
                      {paying && selectedPay === m.type ? <CircularProgress size={16} /> : m.name}
                    </Button>
                  ))}
                  {topupInfo.enable_stripe_topup && (
                    <Button
                      variant="outlined"
                      startIcon={<CreditCard />}
                      disabled={paying && selectedPay === 'stripe'}
                      onClick={() => handleOnlinePay('stripe')}
                      sx={{ borderRadius: 3, minWidth: 120 }}
                    >
                      {paying && selectedPay === 'stripe' ? <CircularProgress size={16} /> : 'Stripe'}
                    </Button>
                  )}
                  {hasWaffoChoices && waffoPayMethods.map((method, index) => {
                    const key = `waffo:${index}`;
                    return (
                      <Button
                        key={`${method.payMethodType || method.name || 'waffo'}:${index}`}
                        variant="outlined"
                        startIcon={<CreditCard />}
                        disabled={paying && selectedPay === key}
                        onClick={() => handleOnlinePay(key)}
                        sx={{ borderRadius: 3, minWidth: 120 }}
                      >
                        {paying && selectedPay === key ? <CircularProgress size={16} /> : (method.name || 'Waffo')}
                      </Button>
                    );
                  })}
                  {topupInfo.enable_creem_topup && creemProducts.map(product => {
                    const productId = product.productId || product.product_id;
                    return (
                      <Button
                        key={productId || product.name}
                        variant="outlined"
                        startIcon={<CreditCard />}
                        disabled={paying && selectedPay === `creem:${productId}`}
                        onClick={() => handleCreemPay(product)}
                        sx={{ borderRadius: 3, minWidth: 120 }}
                      >
                        {paying && selectedPay === `creem:${productId}` ? <CircularProgress size={16} /> : (product.name || 'Creem')}
                      </Button>
                    );
                  })}
                </Stack>
              </Box>
            </Stack>
          </SectionCard>
        </Box>
      )}

      {topupInfo && !topupInfo.enable_online_topup && !topupInfo.enable_stripe_topup && !topupInfo.enable_waffo_topup && !topupInfo.enable_creem_topup && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          {t('管理员未开启在线充值功能，请联系管理员开启或使用兑换码充值。')}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        {/* ── Redeem Code ── */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard icon={Redeem} title={t('兑换码充值')} color={theme.palette.primary.main}>
            <Stack direction="row" spacing={2}>
              <TextField fullWidth label={t('兑换码')} value={redeemCode} onChange={e => setRedeemCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRedeem()} placeholder={t('输入兑换码')}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} />
              <Button variant="contained" startIcon={redeeming ? <CircularProgress size={18} /> : <Redeem />}
                onClick={handleRedeem} disabled={redeeming} sx={{ minWidth: 120, borderRadius: 3 }}>{t('兑换')}</Button>
            </Stack>
          </SectionCard>
        </Grid>

        {/* ── Affiliate/Referral ── */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard icon={Share} title={t('邀请推广')} color="#9c27b0">
            {affiliateLink ? (
              <Stack spacing={1.5}>
                <TextField fullWidth size="small" value={affiliateLink} InputProps={{ readOnly: true,
                  endAdornment: (
                    <Tooltip title={t('复制链接')}>
                      <IconButton size="small" onClick={copyAffLink}><ContentCopy fontSize="small" /></IconButton>
                    </Tooltip>
                  ),
                }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('分享此链接邀请新用户注册，获得额度奖励')}</Typography>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('暂无邀请链接')}</Typography>
            )}
          </SectionCard>
        </Grid>

        {/* ── Transaction History ── */}
        <Grid size={12}>
          <SectionCard icon={History} title={t('充值记录')} color={theme.palette.info.main}>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>{t('时间')}</TableCell>
                  <TableCell>{t('金额')}</TableCell>
                  <TableCell>{t('额度')}</TableCell>
                  <TableCell>{t('状态')}</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {loading ? <TableSkeleton rows={3} columns={4} /> :
                    topups.length === 0 ? (
                      <TableRow><TableCell colSpan={4}>
                        <EmptyState icon={History} title={t('暂无充值记录')} description={t('使用兑换码或在线充值后将在此显示')} sx={{ py: 3 }} />
                      </TableCell></TableRow>
                    ) : topups.map((topup, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{timestamp2string(topup.created_at)}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{topup.amount ? `¥${topup.amount}` : '-'}</TableCell>
                        <TableCell>{renderQuota(topup.quota || 0)}</TableCell>
                        <TableCell>
                          <Chip label={topup.status === 'success' ? t('成功') : topup.status || '-'} size="small"
                            color={topup.status === 'success' ? 'success' : 'default'} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}

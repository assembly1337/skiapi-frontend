import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { API, updateAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { showSuccess } from '../utils';
import { useTranslation } from 'react-i18next';

export default function OAuthCallback() {
  const { t } = useTranslation();
  const { provider } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(() => params.get('code') ? '' : t('缺少授权码'));

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    if (!code) return;
    const providerPath = encodeURIComponent(provider || '');
    const query = new URLSearchParams({ code, state: state || '' });
    API.get(`/api/oauth/${providerPath}?${query.toString()}`)
      .then(res => {
        if (res.data.success) {
          login(res.data.data);
          updateAPI();
          showSuccess(t('登录成功'));
          navigate('/console');
        } else {
          setError(res.data.message || t('登录失败'));
        }
      })
      .catch(err => setError(err.message || t('登录失败')));
  }, [login, navigate, params, provider, t]);

  if (error) return <Box sx={{ p: 4, textAlign: 'center' }}><Alert severity="error">{error}</Alert></Box>;
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
      <Typography sx={{ ml: 2 }}>{t('正在登录...')}</Typography>
    </Box>
  );
}

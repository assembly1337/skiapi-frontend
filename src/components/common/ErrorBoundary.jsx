import { Component } from 'react';
import { Box, Typography, Button, alpha } from '@mui/material';
import { Refresh, BugReport, Launch } from '@mui/icons-material';
import i18n from '../../i18n';

/**
 * Top-level error boundary — catches React render errors and shows a
 * recovery UI instead of crashing the whole app to a white screen.
 *
 * Because this sits above ThemeProvider / i18n in the tree, it uses
 * a self-contained dark palette that matches the app's "Editorial Terminal"
 * design tokens without depending on the theme context.
 */

const palette = {
  bg: '#0F0F0F',
  surface: '#1A1A1A',
  border: '#2A2A2A',
  text: '#E3E3E3',
  muted: '#A0A0A0',
  accent: '#A78BFA',
  accentDim: '#7C3AED',
};

function formatErrorMessage(error) {
  if (!error) return 'Unknown error';
  const msg = error.message || '';
  if (!msg) {
    try { return JSON.stringify(error); } catch { return String(error); }
  }
  return msg;
}

const LEGACY_URL = '/legacy/';
const LEGACY_AUTO_REDIRECT_SECONDS = 10;

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null, countdown: LEGACY_AUTO_REDIRECT_SECONDS };
  _timer = null;

  static getDerivedStateFromError(error) {
    return { hasError: true, error, countdown: LEGACY_AUTO_REDIRECT_SECONDS };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    // Start auto-fallback countdown to /legacy/ if the error persists
    this.startCountdown();
  }

  componentWillUnmount() {
    if (this._timer) clearInterval(this._timer);
  }

  startCountdown = () => {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      this.setState(prev => {
        if (prev.countdown <= 1) {
          clearInterval(this._timer);
          this.handleLegacy();
          return { countdown: 0 };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  handleReset = () => {
    if (this._timer) clearInterval(this._timer);
    this.setState({ hasError: false, error: null, countdown: LEGACY_AUTO_REDIRECT_SECONDS });
  };

  handleReload = () => {
    if (this._timer) clearInterval(this._timer);
    window.location.reload();
  };

  handleLegacy = () => {
    if (this._timer) clearInterval(this._timer);
    window.location.href = LEGACY_URL;
  };

  handleCancelCountdown = () => {
    if (this._timer) clearInterval(this._timer);
    this.setState({ countdown: 0 });
  };

  render() {
    if (this.state.hasError) {
      const msg = formatErrorMessage(this.state.error);
      const { countdown } = this.state;
      return (
        <Box sx={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2.5, p: 4,
          bgcolor: palette.bg, color: palette.text,
        }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${alpha(palette.accent, 0.15)}, ${alpha(palette.accentDim, 0.08)})`,
            border: `1px solid ${alpha(palette.accent, 0.2)}`,
          }}>
            <BugReport sx={{ fontSize: 32, color: palette.accent }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, color: palette.text }}>
            {i18n.t('页面出错了')}
          </Typography>
          <Typography variant="body2" sx={{ color: palette.muted, maxWidth: 460, textAlign: 'center' }}>
            {i18n.t('发生了意外错误。你可以尝试重试，或直接跳转到经典 UI 继续使用。')}
          </Typography>
          {countdown > 0 && (
            <Typography variant="caption" sx={{ color: palette.accent, textAlign: 'center' }}>
              {i18n.t('将在 {{countdown}} 秒后自动跳转到经典 UI (/legacy/)', { countdown })}
              <Button size="small" onClick={this.handleCancelCountdown}
                sx={{ ml: 1, minWidth: 0, color: palette.muted, '&:hover': { color: palette.text, bgcolor: 'transparent' } }}>
                {i18n.t('取消')}
              </Button>
            </Typography>
          )}

          <Box sx={{
            maxWidth: 500, width: '100%', mt: 1,
            p: 2, borderRadius: 2,
            bgcolor: palette.surface, border: `1px solid ${palette.border}`,
            fontFamily: '"Geist Mono", "JetBrains Mono", monospace',
            fontSize: '0.8rem', color: palette.muted,
            lineHeight: 1.6, wordBreak: 'break-word',
            maxHeight: 120, overflow: 'auto',
          }}>
            {msg}
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={this.handleReset}
              sx={{
                color: palette.muted, borderColor: palette.border,
                '&:hover': { borderColor: palette.accent, color: palette.accent, bgcolor: alpha(palette.accent, 0.08) },
              }}>
              {i18n.t('重试')}
            </Button>
            <Button variant="outlined" startIcon={<Refresh />} onClick={this.handleReload}
              sx={{
                color: palette.muted, borderColor: palette.border,
                '&:hover': { borderColor: palette.accent, color: palette.accent, bgcolor: alpha(palette.accent, 0.08) },
              }}>
              {i18n.t('重新载入')}
            </Button>
            <Button variant="contained" startIcon={<Launch />} onClick={this.handleLegacy}
              sx={{
                bgcolor: palette.accentDim, color: '#fff',
                '&:hover': { bgcolor: palette.accent },
              }}>
              {i18n.t('打开经典 UI')}
            </Button>
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}

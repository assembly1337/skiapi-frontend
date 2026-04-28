/* eslint-disable react-refresh/only-export-components */
import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { PrivateRoute, AdminRoute, RootRoute, AuthRedirect } from '../components/auth/Guards';
import Loading from '../components/common/Loading';

// Retry wrapper: if a chunk fails to load (stale deploy), reload the page once
function lr(importFn) {
  return lazy(() =>
    importFn().catch(() => {
      if (!sessionStorage.getItem('chunk_retry')) {
        sessionStorage.setItem('chunk_retry', '1');
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem('chunk_retry');
      return importFn();
    })
  );
}

const Home = lr(() => import('../pages/Home'));
const Login = lr(() => import('../pages/Login'));
const Register = lr(() => import('../pages/Register'));
const PasswordReset = lr(() => import('../pages/PasswordReset'));
const PasswordResetConfirm = lr(() => import('../pages/PasswordResetConfirm'));
const Dashboard = lr(() => import('../pages/Dashboard'));
const Channel = lr(() => import('../pages/Channel'));
const Token = lr(() => import('../pages/Token'));
const User = lr(() => import('../pages/User'));
const Log = lr(() => import('../pages/Log'));
const Midjourney = lr(() => import('../pages/Midjourney'));
const Task = lr(() => import('../pages/Task'));
const Redemption = lr(() => import('../pages/Redemption'));
const TopUp = lr(() => import('../pages/TopUp'));
const SettingsPage = lr(() => import('../pages/Settings'));
const PersonalSetting = lr(() => import('../pages/PersonalSetting'));
const Subscription = lr(() => import('../pages/Subscription'));
const ModelPage = lr(() => import('../pages/Model'));
const ModelDeployment = lr(() => import('../pages/ModelDeployment'));
const Playground = lr(() => import('../pages/Playground'));
const ChatPage = lr(() => import('../pages/Chat'));
const Chat2Link = lr(() => import('../pages/Chat2Link'));
const Pricing = lr(() => import('../pages/Pricing'));
const About = lr(() => import('../pages/About'));
const Setup = lr(() => import('../pages/Setup'));
const Forbidden = lr(() => import('../pages/Forbidden'));
const NotFound = lr(() => import('../pages/NotFound'));
const UserAgreement = lr(() => import('../pages/UserAgreement'));
const PrivacyPolicy = lr(() => import('../pages/PrivacyPolicy'));
const OAuthCallback = lr(() => import('../pages/OAuthCallback'));

function S({ children }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  { path: '/', element: <S><Home /></S> },
  { path: '/setup', element: <S><Setup /></S> },
  { path: '/login', element: <S><AuthRedirect><Login /></AuthRedirect></S> },
  { path: '/register', element: <S><AuthRedirect><Register /></AuthRedirect></S> },
  { path: '/reset', element: <S><PasswordReset /></S> },
  { path: '/user/reset', element: <S><PasswordResetConfirm /></S> },
  { path: '/pricing', element: <S><Pricing /></S> },
  { path: '/about', element: <S><About /></S> },
  { path: '/user-agreement', element: <S><UserAgreement /></S> },
  { path: '/privacy-policy', element: <S><PrivacyPolicy /></S> },
  { path: '/forbidden', element: <S><Forbidden /></S> },
  { path: '/oauth/:provider', element: <S><OAuthCallback /></S> },
  {
    path: '/console',
    element: <PrivateRoute><AppLayout /></PrivateRoute>,
    children: [
      { index: true, element: <S><Dashboard /></S> },
      { path: 'channel', element: <AdminRoute><S><Channel /></S></AdminRoute> },
      { path: 'token', element: <S><Token /></S> },
      { path: 'user', element: <AdminRoute><S><User /></S></AdminRoute> },
      { path: 'log', element: <S><Log /></S> },
      { path: 'midjourney', element: <S><Midjourney /></S> },
      { path: 'task', element: <S><Task /></S> },
      { path: 'redemption', element: <AdminRoute><S><Redemption /></S></AdminRoute> },
      { path: 'topup', element: <S><TopUp /></S> },
      { path: 'setting', element: <RootRoute><S><SettingsPage /></S></RootRoute> },
      { path: 'personal', element: <S><PersonalSetting /></S> },
      { path: 'subscription', element: <AdminRoute><S><Subscription /></S></AdminRoute> },
      { path: 'models', element: <AdminRoute><S><ModelPage /></S></AdminRoute> },
      { path: 'deployment', element: <AdminRoute><S><ModelDeployment /></S></AdminRoute> },
      { path: 'playground', element: <S><Playground /></S> },
      { path: 'chat/:id?', element: <S><ChatPage /></S> },
    ],
  },
  { path: '/chat2link', element: <PrivateRoute><S><Chat2Link /></S></PrivateRoute> },
  { path: '*', element: <S><NotFound /></S> },
]);

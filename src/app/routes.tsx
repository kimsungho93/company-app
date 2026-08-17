import { createBrowserRouter, Navigate } from 'react-router'
import { AuthLayout, RedirectIfAuthenticated, RequireAdmin, RequireAuth } from '@/features/auth'
import { AdminUsersPage } from '@/pages/AdminUsersPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { AppLayout } from './layouts/AppLayout'

export const router = createBrowserRouter([
  {
    // 가드가 바깥, 레이아웃이 안쪽이다. 반대로 두면 인증되지 않은 사용자에게
    // 헤더가 한 번 그려졌다 사라진다.
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          {
            element: <RequireAdmin />,
            children: [{ path: 'admin/users', element: <AdminUsersPage /> }],
          },
        ],
      },
    ],
  },
  {
    // AuthLayout 이 WaferCanvas 를 소유한다. /login ↔ /signup 을 오가도
    // 캔버스가 재마운트되지 않는다.
    element: <RedirectIfAuthenticated />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignupPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

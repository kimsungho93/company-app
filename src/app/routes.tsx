import { createBrowserRouter, Navigate } from 'react-router'
import { AuthLayout, RedirectIfAuthenticated, RequireAuth } from '@/features/auth'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'

export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [{ index: true, element: <HomePage /> }],
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

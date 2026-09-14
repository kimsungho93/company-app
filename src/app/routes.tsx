import { createBrowserRouter, Navigate } from 'react-router'
import { AuthLayout, RedirectIfAuthenticated, RequireAdmin, RequireAuth } from '@/features/auth'
import { AdminUsersPage } from '@/pages/AdminUsersPage'
import { HomePage } from '@/pages/HomePage'
import { LeavePage } from '@/pages/LeavePage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { WordChainRoomPage } from '@/pages/WordChainRoomPage'
import { WordChainRoomsPage } from '@/pages/WordChainRoomsPage'
import { AppLayout } from './layouts/AppLayout'

export const router = createBrowserRouter([
  {

    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'leave', element: <LeavePage /> },
          { path: 'games/word-chain', element: <WordChainRoomsPage /> },
          { path: 'games/word-chain/:roomId', element: <WordChainRoomPage /> },
          {
            element: <RequireAdmin />,
            children: [{ path: 'admin/users', element: <AdminUsersPage /> }],
          },
        ],
      },
    ],
  },
  {

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

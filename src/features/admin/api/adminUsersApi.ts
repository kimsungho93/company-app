import { baseApi } from '@/shared/api'
import type { UserStatus } from '@/features/auth'
import type { AdminUser } from './types'

// 낙관적 갱신을 쓰지 않는다. 목록이 짧고 사람이 하나씩 누르는 화면이라
// 롤백 코드를 두는 것보다 재조회 한 번이 싸다.
//
// 태그는 하나만 둔다. 상태별로 캐시가 나뉘어도 전부 무효화되어
// 탭을 옮겼을 때 최신이 보장된다.
export const adminUsersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminUsers: build.query<AdminUser[], UserStatus>({
      query: (status) => `/admin/users?status=${status}`,
      providesTags: ['AdminUsers'],
    }),

    approveUser: build.mutation<void, number>({
      query: (id) => ({ url: `/admin/users/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['AdminUsers'],
    }),

    rejectUser: build.mutation<void, number>({
      query: (id) => ({ url: `/admin/users/${id}/reject`, method: 'POST' }),
      invalidatesTags: ['AdminUsers'],
    }),
  }),
})

export const { useAdminUsersQuery, useApproveUserMutation, useRejectUserMutation } = adminUsersApi

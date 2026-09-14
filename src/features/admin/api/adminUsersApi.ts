import { baseApi } from '@/shared/api'
import type { UserStatus } from '@/features/auth'
import type { AdminUser } from './types'

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

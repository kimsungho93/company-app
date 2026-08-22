import { baseApi } from '@/shared/api'
import type { DateWindow, Holiday, HolidayDraft, LeaveDraft, LeaveEntry } from '../model/types'

export const leaveApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    leaves: build.query<LeaveEntry[], DateWindow>({
      query: ({ from, to }) => `/leaves?from=${from}&to=${to}`,
      providesTags: ['Leaves'],
    }),

    createLeave: build.mutation<LeaveEntry, LeaveDraft>({
      query: (body) => ({ url: '/leaves', method: 'POST', body }),
      invalidatesTags: ['Leaves'],
    }),

    deleteLeave: build.mutation<void, number>({
      query: (id) => ({ url: `/leaves/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Leaves'],
    }),

    holidays: build.query<Holiday[], DateWindow>({
      query: ({ from, to }) => `/holidays?from=${from}&to=${to}`,
      providesTags: ['Holidays'],
    }),

    createHoliday: build.mutation<Holiday, HolidayDraft>({
      query: (body) => ({ url: '/holidays', method: 'POST', body }),
      invalidatesTags: ['Holidays'],
    }),

    deleteHoliday: build.mutation<void, number>({
      query: (id) => ({ url: `/holidays/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Holidays'],
    }),
  }),
})

export const {
  useLeavesQuery,
  useCreateLeaveMutation,
  useDeleteLeaveMutation,
  useHolidaysQuery,
  useCreateHolidayMutation,
  useDeleteHolidayMutation,
} = leaveApi

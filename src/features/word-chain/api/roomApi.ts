import { baseApi } from '@/shared/api'
import type { CreateRoomDraft, JoinRoomDraft, RoomSummary } from './types'

export const roomApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    rooms: build.query<RoomSummary[], void>({
      query: () => '/rooms',
      providesTags: ['Rooms'],
    }),

    createRoom: build.mutation<RoomSummary, CreateRoomDraft>({
      query: (body) => ({ url: '/rooms', method: 'POST', body }),
      invalidatesTags: ['Rooms'],
    }),

    joinRoom: build.mutation<RoomSummary, JoinRoomDraft>({
      query: ({ id, password }) => ({
        url: `/rooms/${id}/join`,
        method: 'POST',
        body: { password },
      }),
      invalidatesTags: ['Rooms'],
    }),
  }),
})

export const { useRoomsQuery, useCreateRoomMutation, useJoinRoomMutation } = roomApi

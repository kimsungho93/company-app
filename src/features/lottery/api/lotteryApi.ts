import { baseApi } from '@/shared/api'
import type { CreateLotteryRoomRequest, LotteryRoomSnapshot, LotteryRoomSummary, LotterySettings } from './types'

const roomPath = (id: string) => `/lottery/rooms/${encodeURIComponent(id)}`

export const lotteryApi = baseApi.enhanceEndpoints({ addTagTypes: ['LotteryRooms'] }).injectEndpoints({
  endpoints: (build) => ({
    lotteryRooms: build.query<LotteryRoomSummary[], void>({
      query: () => '/lottery/rooms',
      providesTags: ['LotteryRooms'],
    }),
    createLotteryRoom: build.mutation<LotteryRoomSnapshot, CreateLotteryRoomRequest>({
      query: (body) => ({ url: '/lottery/rooms', method: 'POST', body }),
      invalidatesTags: ['LotteryRooms'],
    }),
    lotteryRoom: build.query<LotteryRoomSnapshot, string>({
      query: roomPath,
    }),
    joinLotteryRoom: build.mutation<LotteryRoomSnapshot, string>({
      query: (id) => ({ url: `${roomPath(id)}/join`, method: 'POST' }),
      invalidatesTags: ['LotteryRooms'],
    }),
    saveLotterySettings: build.mutation<LotteryRoomSnapshot, { id: string; settings: LotterySettings }>({
      query: ({ id, settings }) => ({ url: `${roomPath(id)}/settings`, method: 'PUT', body: settings }),
      invalidatesTags: ['LotteryRooms'],
    }),
    startLottery: build.mutation<LotteryRoomSnapshot, string>({
      query: (id) => ({ url: `${roomPath(id)}/start`, method: 'POST' }),
      invalidatesTags: ['LotteryRooms'],
    }),
    resetLottery: build.mutation<LotteryRoomSnapshot, string>({
      query: (id) => ({ url: `${roomPath(id)}/reset`, method: 'POST' }),
      invalidatesTags: ['LotteryRooms'],
    }),
    leaveLotteryRoom: build.mutation<void, string>({
      query: (id) => ({ url: `${roomPath(id)}/leave`, method: 'POST' }),
      invalidatesTags: ['LotteryRooms'],
    }),
  }),
})

export const {
  useLotteryRoomsQuery,
  useCreateLotteryRoomMutation,
  useLazyLotteryRoomQuery,
  useJoinLotteryRoomMutation,
  useSaveLotterySettingsMutation,
  useStartLotteryMutation,
  useResetLotteryMutation,
  useLeaveLotteryRoomMutation,
} = lotteryApi

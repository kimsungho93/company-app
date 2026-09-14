import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { baseApi } from '@/shared/api'
import { lotteryApi } from './lotteryApi'

const createStore = () => configureStore({
  reducer: { [baseApi.reducerPath]: baseApi.reducer },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
})

describe('lottery REST contract', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts room settings and keeps leave as a bodyless 204 command', async () => {
    const requests: Request[] = []
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requests.push(request)
      return request.url.endsWith('/leave')
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ id: 'room one' }), { headers: { 'Content-Type': 'application/json' } })
    }))
    const store = createStore()
    const settings = { participants: ['선도우', '육이슬'], winnerCount: 1 }
    await store.dispatch(lotteryApi.endpoints.createLotteryRoom.initiate({ title: '새 추첨', ...settings })).unwrap()
    await store.dispatch(lotteryApi.endpoints.joinLotteryRoom.initiate('room one')).unwrap()
    await store.dispatch(lotteryApi.endpoints.saveLotterySettings.initiate({ id: 'room one', settings })).unwrap()
    await store.dispatch(lotteryApi.endpoints.startLottery.initiate('room one')).unwrap()
    await store.dispatch(lotteryApi.endpoints.resetLottery.initiate('room one')).unwrap()
    await store.dispatch(lotteryApi.endpoints.leaveLotteryRoom.initiate('room one')).unwrap()
    expect(requests.map((request) => [new URL(request.url).pathname, request.method])).toEqual([
      ['/api/lottery/rooms', 'POST'],
      ['/api/lottery/rooms/room%20one/join', 'POST'],
      ['/api/lottery/rooms/room%20one/settings', 'PUT'],
      ['/api/lottery/rooms/room%20one/start', 'POST'],
      ['/api/lottery/rooms/room%20one/reset', 'POST'],
      ['/api/lottery/rooms/room%20one/leave', 'POST'],
    ])
    expect(await requests[0].json()).toEqual({ title: '새 추첨', ...settings })
    expect(await requests[2].json()).toEqual(settings)
    expect(await requests[5].text()).toBe('')
    store.dispatch(baseApi.util.resetApiState())
  })

  it('reads room lists and member snapshots from their distinct endpoints', async () => {
    const requests: Request[] = []
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requests.push(request)
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    }))
    const store = createStore()
    const list = store.dispatch(lotteryApi.endpoints.lotteryRooms.initiate())
    const room = store.dispatch(lotteryApi.endpoints.lotteryRoom.initiate('room-one'))
    await Promise.all([list.unwrap(), room.unwrap()])
    expect(requests.map((request) => [new URL(request.url).pathname, request.method])).toEqual([
      ['/api/lottery/rooms', 'GET'], ['/api/lottery/rooms/room-one', 'GET'],
    ])
    list.unsubscribe()
    room.unsubscribe()
    store.dispatch(baseApi.util.resetApiState())
  })
})

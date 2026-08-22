import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './baseQuery'

// 빈 껍데기로 두고 각 feature 가 injectEndpoints 로 주입한다.
// 여기에 엔드포인트를 직접 적으면 shared 가 도메인을 알게 되어 의존 방향이 뒤집힌다.
//
// 태그 이름만 예외다. RTK Query 는 createApi 시점에 tagTypes 를 알아야 하고,
// 이름은 문자열일 뿐이라 도메인 코드가 딸려 오지 않는다.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Me', 'AdminUsers', 'Leaves', 'Holidays', 'Rooms'],
  endpoints: () => ({}),
})

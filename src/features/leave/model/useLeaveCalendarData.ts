import { useMemo } from 'react'
import { toErrorInfo } from '@/shared/api'
import {
  useCreateHolidayMutation,
  useCreateLeaveMutation,
  useDeleteHolidayMutation,
  useDeleteLeaveMutation,
  useHolidaysQuery,
  useLeavesQuery,
} from '../api/leaveApi'
import { eachDate } from './dateRange'
import { leavesByDate } from './leaves'
import type { Holiday } from './types'

export const useLeaveCalendarData = (window: { from: string; to: string }) => {
  const { data: leaves = [], isFetching, error: listError } = useLeavesQuery(window)
  const {
    data: holidays = [],
    isFetching: holidaysFetching,
    error: holidayListError,
  } = useHolidaysQuery(window)

  const [createLeave, createLeaveState] = useCreateLeaveMutation()
  const [deleteLeave, deleteLeaveState] = useDeleteLeaveMutation()
  const [createHoliday, createHolidayState] = useCreateHolidayMutation()
  const [deleteHoliday, deleteHolidayState] = useDeleteHolidayMutation()

  const byDate = useMemo(() => leavesByDate(leaves), [leaves])
  const holidayByDate = useMemo(() => {
    const map = new Map<string, Holiday>()
    for (const holiday of holidays) {
      for (const iso of eachDate(holiday.startDate, holiday.endDate)) map.set(iso, holiday)
    }
    return map
  }, [holidays])

  const busy =
    createLeaveState.isLoading ||
    deleteLeaveState.isLoading ||
    createHolidayState.isLoading ||
    deleteHolidayState.isLoading

  const errorOf = (error: unknown) => (error ? toErrorInfo(error).message : null)

  const resetErrors = () => {
    createLeaveState.reset()
    deleteLeaveState.reset()
    createHolidayState.reset()
    deleteHolidayState.reset()
  }

  return {
    byDate,
    holidayByDate,
    busy,
    resetErrors,
    isFetching: isFetching || holidaysFetching,
    listError: errorOf(listError ?? holidayListError),
    leaveError: errorOf(createLeaveState.error ?? deleteLeaveState.error),
    holidayError: errorOf(createHolidayState.error ?? deleteHolidayState.error),
    createLeave,
    deleteLeave,
    createHoliday,
    deleteHoliday,
  }
}

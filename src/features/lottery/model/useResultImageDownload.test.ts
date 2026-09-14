import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LotteryResultImageInput } from '../lib/createResultImage'
import { useResultImageDownload } from './useResultImageDownload'

const createImage = vi.hoisted(() => vi.fn())
vi.mock('../lib/createResultImage', () => ({ createResultImage: createImage }))

const input: LotteryResultImageInput = {
  title: '점심:추첨/결과', participants: ['선도우', '육이슬'],
  winners: [{ name: '육이슬', drawnAt: '2026-09-14T00:00:00Z' }], winnerCount: 2, finished: false,
}

describe('result image download', () => {
  let downloads: { filename: string; url: string }[]
  const createUrl = vi.fn(() => 'blob:lottery-result')
  const revokeUrl = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    downloads = []
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ filename: this.download, url: this.href })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('downloads a PNG with a safe filename and releases the temporary link and URL', async () => {
    const blob = new Blob(['png'], { type: 'image/png' })
    createImage.mockResolvedValue(blob)
    const { result } = renderHook(() => useResultImageDownload('room:1'))
    await act(async () => { await result.current.saveImage(input) })
    expect(createUrl).toHaveBeenCalledWith(blob)
    expect(downloads).toEqual([{ filename: '점심추첨결과-당첨 결과.png', url: 'blob:lottery-result' }])
    expect(document.querySelector('a[download]')).toBeNull()
    expect(result.current.status).toBe('requested')
    expect(revokeUrl).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(revokeUrl).toHaveBeenCalledWith('blob:lottery-result')
    expect(result.current.status).toBe('idle')
  })

  it('captures the clicked results once while new winners arrive and ignores duplicate clicks', async () => {
    let resolve!: (blob: Blob) => void
    createImage.mockImplementation(() => new Promise<Blob>((done) => { resolve = done }))
    const { result } = renderHook(() => useResultImageDownload('room:1'))
    const changing = { ...input, participants: [...input.participants], winners: input.winners.map((winner) => ({ ...winner })) }
    let pending!: Promise<void>
    act(() => { pending = result.current.saveImage(changing) })
    expect(result.current.status).toBe('creating')
    changing.winners.push({ name: '선도우', drawnAt: '2026-09-14T00:00:04Z' })
    await act(async () => { await result.current.saveImage(changing) })
    expect(createImage).toHaveBeenCalledOnce()
    expect(createImage.mock.calls[0][0].winners).toEqual(input.winners)
    await act(async () => { resolve(new Blob(['png'])); await pending })
    expect(downloads).toHaveLength(1)
  })

  it('allows retry after image creation fails without creating a download', async () => {
    createImage.mockRejectedValueOnce(new Error('Canvas unavailable')).mockResolvedValueOnce(new Blob(['png']))
    const { result } = renderHook(() => useResultImageDownload('room:1'))
    await act(async () => { await result.current.saveImage(input) })
    expect(result.current.status).toBe('failed')
    expect(downloads).toHaveLength(0)
    await act(async () => { await result.current.saveImage(input) })
    expect(result.current.status).toBe('requested')
    expect(downloads).toHaveLength(1)
  })

  it.each(['reset', 'leave'])('does not download an old image after %s during rendering', async (action) => {
    let resolve!: (blob: Blob) => void
    createImage.mockImplementation(() => new Promise<Blob>((done) => { resolve = done }))
    const { result, rerender, unmount } = renderHook(({ scope }) => useResultImageDownload(scope), { initialProps: { scope: 'room:1:false' } })
    let pending!: Promise<void>
    act(() => { pending = result.current.saveImage(input) })
    if (action === 'reset') rerender({ scope: 'room:1:true' })
    else unmount()
    await act(async () => { resolve(new Blob(['png'])); await pending })
    expect(downloads).toHaveLength(0)
    expect(createUrl).not.toHaveBeenCalled()
    if (action === 'reset') expect(result.current.status).toBe('idle')
  })

  it('does not create an image before any winner has been announced', async () => {
    const { result } = renderHook(() => useResultImageDownload('room:1'))
    await act(async () => { await result.current.saveImage({ ...input, winners: [] }) })
    expect(createImage).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })
})

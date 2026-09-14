import { useEffect, useRef, useState } from 'react'
import { createResultImage } from '../lib/createResultImage'
import type { LotteryResultImageInput } from '../lib/createResultImage'

type DownloadStatus = 'idle' | 'creating' | 'requested' | 'failed'

const downloadImage = (blob: Blob, title: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const filename = title.replace(/[<>:"/\\|?*]/g, '').replace(/\p{Cc}/gu, '').trim()
  link.href = url
  link.download = `${filename || '사람 뽑기'}-당첨 결과.png`
  link.hidden = true
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

export const useResultImageDownload = (scope: string) => {
  const [status, setStatus] = useState<DownloadStatus>('idle')
  const generation = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    generation.current += 1
    busy.current = false
    setStatus('idle')
    return () => { generation.current += 1 }
  }, [scope])

  useEffect(() => {
    if (status !== 'requested') return
    const timeout = window.setTimeout(() => setStatus('idle'), 3000)
    return () => window.clearTimeout(timeout)
  }, [status])

  const saveImage = async (input: LotteryResultImageInput) => {
    if (busy.current || input.winners.length === 0) return
    const currentGeneration = generation.current
    const snapshot = { ...input, participants: [...input.participants], winners: input.winners.map((winner) => ({ ...winner })) }
    busy.current = true
    setStatus('creating')
    try {
      const blob = await createResultImage(snapshot)
      if (currentGeneration !== generation.current) return
      downloadImage(blob, snapshot.title)
      setStatus('requested')
    } catch {
      if (currentGeneration === generation.current) setStatus('failed')
    } finally {
      if (currentGeneration === generation.current) busy.current = false
    }
  }

  return { saveImage, status }
}

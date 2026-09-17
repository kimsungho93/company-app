import { describe, expect, it } from 'vitest'
import { createCampusFramePacing } from './campusFramePacing'

describe('campus GPU frame pacing', () => {
  it('leaves input processing time when GPU rendering is slow', () => {
    const pacing = createCampusFramePacing()
    pacing.submitted(10)
    pacing.completed(210)
    expect(pacing.interval).toBeGreaterThan(200)
    pacing.submitted(300)
    pacing.completed(5300)
    expect(pacing.interval).toBeLessThanOrEqual(1000)
  })

  it('discards a pending frame timing sample across a long pause', () => {
    const pacing = createCampusFramePacing()
    pacing.submitted(100)
    pacing.reset()
    pacing.completed(60_100)
    expect(pacing.interval).toBeCloseTo(1000 / 30)
    pacing.submitted(60_120)
    pacing.completed(60_130)
    expect(pacing.interval).toBeCloseTo(1000 / 30)
  })

  it('resets earlier slow samples when playback resumes', () => {
    const pacing = createCampusFramePacing()
    pacing.submitted(0)
    pacing.completed(2000)
    pacing.reset()
    pacing.submitted(62_000)
    pacing.completed(62_010)
    expect(pacing.interval).toBeCloseTo(1000 / 30)
  })
})

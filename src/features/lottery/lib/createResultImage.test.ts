import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ballColor } from '../ui/machine/ballColors'
import { createResultImage, type LotteryResultImageInput } from './createResultImage'

type RenderedText = {
  text: string
  x: number
  y: number
  width: number
  size: number
  align: CanvasTextAlign
  color: string | CanvasGradient | CanvasPattern
}

const input: LotteryResultImageInput = {
  title: '오늘의 추첨',
  participants: ['선도우', '육이슬', '김성호'],
  winners: [
    { name: '김성호', drawnAt: '2026-09-14T00:00:00Z' },
    { name: '선도우', drawnAt: '2026-09-14T00:00:04Z' },
  ],
  winnerCount: 2,
  finished: true,
}

describe('createResultImage', () => {
  let rendered: RenderedText[]
  let colors: string[]
  let context: CanvasRenderingContext2D
  let fonts: { load: ReturnType<typeof vi.fn>; ready: Promise<void> }
  let originalFonts: PropertyDescriptor | undefined
  let png: Blob

  beforeEach(() => {
    rendered = []
    colors = []
    png = new Blob(['png-result'], { type: 'image/png' })
    let isBall = false
    const fontSize = () => Number(context.font.match(/(\d+)px/)?.[1] ?? 10)
    const textWidth = (text: string) =>
      Array.from(text).reduce(
        (width, character) =>
          width + ((character.codePointAt(0) ?? 0) > 127 ? 1 : 0.6) * fontSize(),
        0,
      )
    context = {
      font: '',
      fillStyle: '',
      textAlign: 'left',
      textBaseline: 'top',
      beginPath: vi.fn(() => {
        isBall = false
      }),
      roundRect: vi.fn(),
      ellipse: vi.fn(),
      arc: vi.fn(() => {
        isBall = true
      }),
      fill: vi.fn(() => {
        if (isBall && typeof context.fillStyle === 'string') colors.push(context.fillStyle)
      }),
      fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      measureText: vi.fn((text: string) => ({ width: textWidth(text) })),
      fillText: vi.fn((text: string, x: number, y: number) => {
        rendered.push({
          text,
          x,
          y,
          width: textWidth(text),
          size: fontSize(),
          align: context.textAlign,
          color: context.fillStyle,
        })
      }),
    } as unknown as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(png))
    originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
    fonts = { load: vi.fn().mockResolvedValue([]), ready: Promise.resolve() }
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
    else Reflect.deleteProperty(document, 'fonts')
  })

  it('exports a PNG with the presented order and each participant’s existing color', async () => {
    expect(await createResultImage(input)).toBe(png)
    const canvas = vi.mocked(HTMLCanvasElement.prototype.getContext).mock
      .contexts[0] as HTMLCanvasElement
    expect(canvas.width).toBe(1200)
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/png',
    )
    expect(
      rendered
        .filter(({ size, color }) => size === 34 && color === '#191f28')
        .map(({ text }) => text),
    ).toEqual(['김성호', '선도우'])
    expect(colors).toEqual([ballColor(2), ballColor(0)])
    expect(rendered.some(({ text }) => text === '사람 뽑기 · 오늘의 당첨자')).toBe(true)
    expect(rendered.some(({ text }) => text === '2 / 2명 발표 · 추첨 대상 3명')).toBe(true)
  })

  it('keeps all fifty long names and a sixty-character title without truncation or canvas overflow', async () => {
    const title = '가'.repeat(60)
    const participants = Array.from(
      { length: 50 },
      (_, index) => `${String(index + 1).padStart(2, '0')}${'김'.repeat(28)}`,
    )
    const winners = [...participants]
      .reverse()
      .map((name) => ({ name, drawnAt: '2026-09-14T00:00:00Z' }))
    await createResultImage({ title, participants, winners, winnerCount: 50, finished: true })
    const canvas = vi.mocked(HTMLCanvasElement.prototype.getContext).mock
      .contexts[0] as HTMLCanvasElement

    expect(
      rendered
        .filter(({ size }) => size === 46)
        .map(({ text }) => text)
        .join(''),
    ).toBe(title)
    expect(
      rendered
        .filter(({ size }) => size === 34)
        .map(({ text }) => text)
        .join(''),
    ).toBe(winners.map(({ name }) => name).join(''))
    expect(rendered.filter(({ text }) => /^\d+번째$/.test(text)).map(({ text }) => text)).toEqual(
      Array.from({ length: 50 }, (_, index) => `${index + 1}번째`),
    )
    expect(colors).toEqual(Array.from({ length: 50 }, (_, index) => ballColor(49 - index)))
    expect(canvas.height).toBeGreaterThan(5000)
    expect(canvas.height).toBeLessThan(10000)
    for (const text of rendered) {
      const left = text.align === 'center' ? text.x - text.width / 2 : text.x
      expect(left).toBeGreaterThanOrEqual(72)
      expect(left + text.width).toBeLessThanOrEqual(canvas.width - 72)
      expect(text.y).toBeGreaterThanOrEqual(72)
      expect(text.y + text.size).toBeLessThanOrEqual(canvas.height - 72)
    }
  })

  it('identifies partial results and includes only the supplied, already presented winners', async () => {
    await createResultImage({ ...input, winners: input.winners.slice(0, 1), finished: false })
    expect(rendered.some(({ text }) => text === '사람 뽑기 · 중간 결과')).toBe(true)
    expect(rendered.some(({ text }) => text === '1 / 2명 발표 · 추첨 대상 3명')).toBe(true)
    expect(rendered.filter(({ size }) => size === 40).map(({ text }) => text)).toEqual(['김성호'])
  })

  it('waits for the Korean font before measuring or drawing the export', async () => {
    let releaseFont: (() => void) | undefined
    fonts.load.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseFont = resolve
      }),
    )
    const exportImage = createResultImage(input)
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled()
    expect(fonts.load).toHaveBeenCalledWith(
      expect.stringContaining('Wanted Sans Variable'),
      expect.stringContaining('김성호'),
    )
    releaseFont?.()
    await expect(exportImage).resolves.toBe(png)
  })

  it('rejects an empty result before creating an image', async () => {
    await expect(createResultImage({ ...input, winners: [] })).rejects.toThrow(
      '저장할 당첨 결과가 없습니다.',
    )
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled()
  })

  it('reports an unavailable canvas context', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    await expect(createResultImage(input)).rejects.toThrow('결과 이미지를 만들 수 없습니다.')
  })

  it('rejects when PNG encoding produces no file', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null))
    await expect(createResultImage(input)).rejects.toThrow('결과 이미지를 저장할 수 없습니다.')
  })

  it('rejects a thrown encoder error so the caller can offer a retry', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(() => {
      throw new Error('Encoding failed')
    })
    await expect(createResultImage(input)).rejects.toThrow('Encoding failed')
  })
})

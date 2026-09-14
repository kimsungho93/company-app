import type { LotteryWinner } from '../api/types'
import { ballColor } from '../ui/machine/ballColors'

export type LotteryResultImageInput = {
  title: string
  participants: string[]
  winners: LotteryWinner[]
  winnerCount: number
  finished: boolean
}

const WIDTH = 1200
const PADDING = 72
const GAP = 24
const CONTENT_WIDTH = WIDTH - PADDING * 2
const FONT_FAMILY = '"Wanted Sans Variable", "Malgun Gothic", sans-serif'

const setFont = (context: CanvasRenderingContext2D, size: number, weight = 700) => {
  context.font = `${weight} ${size}px ${FONT_FAMILY}`
}

const wrapText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  return text.split(/\r?\n/).flatMap((paragraph) => {
    const lines: string[] = []
    let line = ''
    for (const character of Array.from(paragraph)) {
      if (line && context.measureText(line + character).width > maxWidth) {
        lines.push(line)
        line = character
      } else {
        line += character
      }
    }
    lines.push(line)
    return lines
  })
}

const fillRoundedRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string) => {
  context.fillStyle = color
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.fill()
}

export const createResultImage = async (input: LotteryResultImageInput): Promise<Blob> => {
  if (!input.winners.length) throw new Error('저장할 당첨 결과가 없습니다.')

  const title = input.title
  const finished = input.finished
  const winnerCount = input.winnerCount
  const participantCount = input.participants.length
  const entries = input.winners.map((winner) => ({
    name: winner.name,
    color: ballColor(Math.max(0, input.participants.indexOf(winner.name))),
  }))

  if (document.fonts) {
    const text = `${title}${entries.map(({ name }) => name).join('')}사람 뽑기 오늘의 당첨자 중간 결과 발표 추첨 대상`
    await document.fonts.load(`700 34px ${FONT_FAMILY}`, text)
    await document.fonts.ready
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('결과 이미지를 만들 수 없습니다.')

  setFont(context, 46)
  const titleLines = wrapText(context, title, CONTENT_WIDTH)
  const titleTop = PADDING + 54
  const titleLineHeight = 60
  const summaryTop = titleTop + titleLines.length * titleLineHeight + 18
  const gridTop = summaryTop + 76
  const columns = Math.min(3, entries.length)
  const cardWidth = (CONTENT_WIDTH - GAP * (columns - 1)) / columns
  const labelWidth = Math.min(cardWidth - 36, 420)
  const nameSize = entries.length === 1 ? 40 : 34
  const nameLineHeight = nameSize + 12
  const ballDiameter = Math.min(248, cardWidth - 80)

  setFont(context, nameSize)
  const cards = entries.map((entry) => {
    const lines = wrapText(context, entry.name, labelWidth - 36)
    const fittedLabelWidth = Math.min(labelWidth, Math.max(68, ...lines.map((line) => context.measureText(line).width + 36)))
    const labelHeight = Math.max(68, lines.length * nameLineHeight + 24)
    const visualHeight = Math.max(ballDiameter, labelHeight + 32)
    return { ...entry, lines, labelWidth: fittedLabelWidth, labelHeight, visualHeight, height: visualHeight + 104 }
  })
  const rows = Array.from({ length: Math.ceil(cards.length / columns) }, (_, index) => {
    const items = cards.slice(index * columns, (index + 1) * columns)
    return { items, height: Math.max(...items.map(({ height }) => height)) }
  })

  canvas.width = WIDTH
  canvas.height = gridTop + rows.reduce((height, row) => height + row.height, 0) + GAP * (rows.length - 1) + PADDING
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, WIDTH, canvas.height)
  context.textBaseline = 'top'
  context.textAlign = 'left'
  setFont(context, 26)
  context.fillStyle = '#2463df'
  context.fillText(`사람 뽑기 · ${finished ? '오늘의 당첨자' : '중간 결과'}`, PADDING, PADDING)
  setFont(context, 46)
  context.fillStyle = '#191f28'
  titleLines.forEach((line, index) => context.fillText(line, PADDING, titleTop + index * titleLineHeight))
  setFont(context, 25, 600)
  context.fillStyle = '#5b6472'
  context.fillText(`${entries.length} / ${winnerCount}명 발표 · 추첨 대상 ${participantCount}명`, PADDING, summaryTop)

  let rowTop = gridTop
  rows.forEach((row, rowIndex) => {
    row.items.forEach((card, columnIndex) => {
      const cardLeft = PADDING + columnIndex * (cardWidth + GAP)
      const centerX = cardLeft + cardWidth / 2
      const centerY = rowTop + 72 + card.visualHeight / 2
      const radius = ballDiameter / 2

      fillRoundedRect(context, cardLeft, rowTop, cardWidth, row.height, 28, '#f4f6f9')
      context.textAlign = 'center'
      setFont(context, 23, 600)
      context.fillStyle = '#5b6472'
      context.fillText(`${rowIndex * columns + columnIndex + 1}번째`, centerX, rowTop + 26)

      context.beginPath()
      context.ellipse(centerX, centerY + radius + 10, radius * 0.8, 10, 0, 0, Math.PI * 2)
      context.fillStyle = '#dfe4ec'
      context.fill()
      context.beginPath()
      context.arc(centerX, centerY, radius, 0, Math.PI * 2)
      context.fillStyle = card.color
      context.fill()

      const shading = context.createRadialGradient(centerX - radius * 0.35, centerY - radius * 0.4, 0, centerX, centerY, radius)
      shading.addColorStop(0, 'rgba(255,255,255,0.22)')
      shading.addColorStop(0.55, 'rgba(255,255,255,0)')
      shading.addColorStop(1, 'rgba(0,0,0,0.13)')
      context.fillStyle = shading
      context.fill()

      const labelTop = centerY - card.labelHeight / 2
      fillRoundedRect(context, centerX - card.labelWidth / 2, labelTop + 3, card.labelWidth, card.labelHeight, 18, 'rgba(25,31,40,0.08)')
      fillRoundedRect(context, centerX - card.labelWidth / 2, labelTop, card.labelWidth, card.labelHeight, 18, '#ffffff')
      setFont(context, nameSize)
      context.fillStyle = '#191f28'
      const nameTop = centerY - card.lines.length * nameLineHeight / 2 + 4
      card.lines.forEach((line, index) => context.fillText(line, centerX, nameTop + index * nameLineHeight))
    })
    rowTop += row.height + GAP
  })

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('결과 이미지를 저장할 수 없습니다.'))
    }, 'image/png')
  })
}

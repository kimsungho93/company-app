import { useEffect, useRef } from 'react'
import styles from './WaferCanvas.module.scss'

interface Die {
  x: number
  y: number
  /** 중심 좌표 — 커서 거리 계산에 쓴다 */
  mx: number
  my: number
  /** 글자에 속하는 다이인가 */
  lit: boolean
  shot: number
  sx: number
  sy: number
  /** 노광 직후 1, 매 프레임 감쇠. 백색 각인 → 시안 정착에 쓴다 */
  heat: number
  exposed: boolean
  /** 이번 프레임의 커서 근접도 0~1. 루프 안에서 재계산하지 않으려고 들고 있는다 */
  near: number
}

interface Shot {
  x0: number
  y0: number
  x1: number
  y1: number
  /** 이 샷에 포함된 글자 다이 수. 0이면 조용히 지나간다 */
  ibs: number
}

export interface WaferCanvasProps {
  /** 웨이퍼에 노광할 문자 */
  text: string
  /** 폰트 로딩이 끝났는지. false 면 샘플링을 미룬다 */
  fontReady: boolean
  /** 모션 축소 설정. true 면 인트로 없이 완성 상태로 그린다 */
  reducedMotion: boolean
  /** 인트로를 건너뛰고 즉시 완성 상태로 (이미 본 세션) */
  skipIntro?: boolean
  /** 노광이 끝났을 때 한 번 호출 */
  onComplete?: () => void
}

/**
 * 웨이퍼 지름을 몇 개의 다이로 나눌지.
 *
 * 셀 크기를 고정하면 화면이 커질수록 다이 수가 제곱으로 늘어난다.
 * 그래서 지름을 일정 개수로 나눠 부하와 글자 품질을 고정한다.
 *
 * 다만 모바일처럼 웨이퍼가 작을 때 70개를 그대로 쓰면 다이가 서브픽셀이 되어
 * 뭉개지고 커버리지 샘플링도 같은 픽셀을 반복해서 읽는다.
 * 셀이 MIN_CELL_PX 아래로 내려가면 개수를 줄인다.
 */
const MAX_DIES_ACROSS = 70
const MIN_DIES_ACROSS = 40
const MIN_CELL_PX = 3.5
/** 다이가 셀에서 차지하는 비율. 나머지는 스크라이브 레인(자를 자리) */
const DIE_RATIO = 0.74
/** 한 샷의 한 변이 몇 다이인지를 정하는 기준 — 전체 샷 수를 60~70개로 유지한다 */
const SHOTS_ACROSS = 8

// Wanted Sans 가변 축은 400~1000. 900 은 격자에서 지나치게 두꺼워진다.
const FONT_WEIGHT = 500
const COVERAGE_THRESHOLD = 0.35

const START_MS = 260
const SCAN_MS = 2100

export const WaferCanvas = ({
  text,
  fontReady,
  reducedMotion,
  skipIntro = false,
  onComplete,
}: WaferCanvasProps) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const completedRef = useRef(false)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas || !fontReady) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const instant = reducedMotion || skipIntro
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pointer = { x: -9999, y: -9999 }
    // 터치 기기에서는 크로스헤어·배선이 손가락 밑에 가려 보이지도 않고,
    // 탭한 자리에 그대로 눌어붙는다. 정밀 포인터에서만 켠다.
    const finePointer = window.matchMedia('(pointer: fine)').matches

    let dies: Die[] = []
    let shots: Shot[] = []
    let cx = 0
    let cy = 0
    let rad = 0
    let cell = 0
    let die = 0
    let w = 0
    let h = 0
    let start = 0
    let raf = 0

    /** 다이 한 칸이 글자에 얼마나 덮이는지 (0~1).
     *  중심 한 점만 검사하면 S 의 얇은 사선이 격자 사이로 빠져 끊긴다. */
    const coverage = (mask: Uint8ClampedArray, px: number, py: number) => {
      let hit = 0
      let n = 0
      for (let sy = 1; sy <= 3; sy++) {
        for (let sx = 1; sx <= 3; sx++) {
          const qx = (px + (die * sx) / 4) | 0
          const qy = (py + (die * sy) / 4) | 0
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue
          n++
          if (mask[(qy * w + qx) * 4 + 3] > 100) hit++
        }
      }
      return n ? hit / n : 0
    }

    const build = () => {
      const rect = host.getBoundingClientRect()
      const nextW = Math.round(rect.width)
      const nextH = Math.round(rect.height)
      // 레이아웃이 잡히기 전에는 0에 가까운 값이 나온다. 그대로 빌드하면
      // 글자가 캔버스 밖에 그려져 점등되는 다이가 하나도 없다.
      // 건너뛰면 ResizeObserver 가 제대로 된 크기로 다시 불러준다.
      if (nextW < 40 || nextH < 40) return

      w = nextW
      h = nextH
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      cx = w / 2
      cy = h / 2
      rad = Math.max(60, Math.min(w / 2 - 18, h / 2 - 18))
      const across = Math.round(
        Math.min(MAX_DIES_ACROSS, Math.max(MIN_DIES_ACROSS, (rad * 2) / MIN_CELL_PX)),
      )
      cell = (rad * 2) / across
      die = cell * DIE_RATIO

      // 글자 마스크
      const off = document.createElement('canvas')
      off.width = w
      off.height = h
      const octx = off.getContext('2d')
      if (!octx) return
      const size = Math.round(rad * 0.82)
      octx.fillStyle = '#000'
      octx.font = `${FONT_WEIGHT} ${size}px "Wanted Sans Variable", system-ui, sans-serif`
      octx.textAlign = 'center'
      octx.textBaseline = 'middle'
      octx.letterSpacing = `${Math.round(size * 0.05)}px`
      octx.fillText(text, cx, cy)
      const mask = octx.getImageData(0, 0, w, h).data

      const cols = across
      const shotSpan = Math.max(3, Math.round(cols / SHOTS_ACROSS))
      const x0 = cx - (cols * cell) / 2
      const y0 = cy - (cols * cell) / 2

      dies = []
      let maxSx = 0
      for (let r = 0; r < cols; r++) {
        for (let c = 0; c < cols; c++) {
          const px = x0 + c * cell
          const py = y0 + r * cell
          const mx = px + die / 2
          const my = py + die / 2
          if (Math.hypot(mx - cx, my - cy) > rad - die) continue
          // 웨이퍼 노치 — 아래쪽을 평평하게 깎는다
          if (my > cy + rad * 0.88 && Math.abs(mx - cx) < rad * 0.17) continue
          const sx = Math.floor(c / shotSpan)
          const sy = Math.floor(r / shotSpan)
          if (sx > maxSx) maxSx = sx
          dies.push({
            x: px,
            y: py,
            mx,
            my,
            lit: coverage(mask, px, py) >= COVERAGE_THRESHOLD,
            shot: 0,
            sx,
            sy,
            heat: 0,
            exposed: false,
            near: 0,
          })
        }
      }

      const perRow = maxSx + 1
      shots = []
      for (const d of dies) {
        d.shot = d.sy * perRow + d.sx
        let s = shots[d.shot]
        if (!s) {
          s = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, ibs: 0 }
          shots[d.shot] = s
        }
        s.x0 = Math.min(s.x0, d.x)
        s.y0 = Math.min(s.y0, d.y)
        s.x1 = Math.max(s.x1, d.x + die)
        s.y1 = Math.max(s.y1, d.y + die)
        if (d.lit) s.ibs++
      }
    }

    const frame = (now: number) => {
      if (!start) start = now
      const t = now - start
      ctx.clearRect(0, 0, w, h)
      if (!dies.length) {
        raf = requestAnimationFrame(frame)
        return
      }

      const total = shots.length
      const raw = instant ? total + 2 : ((t - START_MS) / SCAN_MS) * total
      const cur = Math.floor(raw)
      const ph = raw - cur
      const finished = raw > total
      const devP = finished ? Math.min(1, (raw - total) / 1.4) : 0
      const devY = cy - rad + devP * rad * 2.2

      if (finished && !completedRef.current) {
        completedRef.current = true
        onComplete?.()
      }

      // 웨이퍼 윤곽
      ctx.strokeStyle = 'rgba(120,170,200,.22)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(cx, cy, rad + 8, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(120,170,200,.10)'
      ctx.beginPath()
      ctx.arc(cx, cy, rad + 15, 0, Math.PI * 2)
      ctx.stroke();

      // 1) 상태 갱신 + 미노광 다이. 근접도는 여기서 한 번만 계산해 재사용한다.
      for (const d of dies) {
        const exposed = instant || d.shot < cur || (d.shot === cur && ph > 0.35)
        if (!exposed) {
          d.near = 0
          ctx.fillStyle = 'rgba(90,120,145,.05)' // 미노광 레지스트
          ctx.fillRect(d.x, d.y, die, die)
          continue
        }
        if (!d.exposed) {
          d.exposed = true
          d.heat = instant ? 0 : 1
        }
        d.heat *= 0.935
        if (finished && d.lit && Math.abs(d.my - devY) < 30) {
          d.heat = Math.max(d.heat, 0.75)
        }
        const pd = Math.hypot(d.mx - pointer.x, d.my - pointer.y)
        d.near = pd < 130 ? 1 - pd / 130 : 0
      }

      // 2) 헤일로. shadowBlur 를 다이 수천 개에 걸면 프레임을 통째로 잡아먹으므로
      //    큰 반투명 사각형을 뒤에 깔아 같은 인상을 훨씬 싸게 만든다.
      const halo = die + 6
      for (const d of dies) {
        if (!d.lit || !d.exposed) continue
        const g = Math.max(d.heat, d.near * 0.7)
        if (g < 0.12) continue
        ctx.fillStyle = `rgba(150,240,255,${(g * 0.22).toFixed(3)})`
        ctx.fillRect(d.x - 3, d.y - 3, halo, halo)
      }

      // 3) 노광된 다이 본체
      for (const d of dies) {
        if (!d.exposed) continue
        if (d.lit) {
          const heat = d.heat
          const r = Math.round(80 + 175 * heat + d.near * 50)
          const g = Math.min(255, Math.round(224 + 31 * heat))
          const b = Math.min(255, 247 + Math.round(8 * heat))
          const a = Math.min(1, 0.58 + d.near * 0.4 + heat * 0.42)
          ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`
        } else {
          const a = 0.1 + d.near * 0.2 + d.heat * 0.35
          ctx.fillStyle = `rgba(${Math.round(110 + 90 * d.heat)},145,175,${a.toFixed(3)})`
        }
        ctx.fillRect(d.x, d.y, die, die)
      }

      // 4) 현재 샷 — 정렬 / 노광 / 스텝
      const shot = !finished && cur >= 0 && cur < total ? shots[cur] : null
      if (shot) {
        const bx = shot.x0 - 4
        const by = shot.y0 - 4
        const bw = shot.x1 - shot.x0 + 8
        const bh = shot.y1 - shot.y0 + 8
        const strong = shot.ibs > 0

        if (ph < 0.35) {
          ctx.strokeStyle = 'rgba(103,232,249,.45)'
          ctx.lineWidth = 1
          ctx.setLineDash([3, 3])
          ctx.strokeRect(bx, by, bw, bh)
          ctx.setLineDash([])
        } else if (ph < 0.6) {
          const e = (ph - 0.35) / 0.25
          const pulse = Math.sin(e * Math.PI)
          ctx.fillStyle = `rgba(190,250,255,${(pulse * (strong ? 0.3 : 0.1)).toFixed(3)})`
          ctx.fillRect(bx, by, bw, bh)
          ctx.strokeStyle = `rgba(200,252,255,${(0.5 + pulse * 0.5).toFixed(2)})`
          ctx.lineWidth = 1.4
          ctx.strokeRect(bx, by, bw, bh)
          // 슬릿 스캔 — 실제 스캐너처럼 샷 내부를 훑는다
          const sy = by + e * bh
          const grad = ctx.createLinearGradient(bx, sy - 6, bx, sy + 6)
          grad.addColorStop(0, 'rgba(255,255,255,0)')
          grad.addColorStop(0.5, `rgba(240,255,255,${strong ? 0.85 : 0.4})`)
          grad.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = grad
          ctx.fillRect(bx, sy - 6, bw, 12)
        } else {
          ctx.strokeStyle = 'rgba(103,232,249,.22)'
          ctx.lineWidth = 1
          ctx.strokeRect(bx, by, bw, bh)
        }
      } else if (finished) {
        if (devP < 1) {
          const grad = ctx.createLinearGradient(0, devY - 26, 0, devY + 26)
          grad.addColorStop(0, 'rgba(103,232,249,0)')
          grad.addColorStop(0.5, 'rgba(103,232,249,.30)')
          grad.addColorStop(1, 'rgba(103,232,249,0)')
          ctx.fillStyle = grad
          ctx.fillRect(cx - rad - 20, devY - 26, rad * 2 + 40, 52)
        }
      }

      // 5) 커서 근처 — 맨해튼 배선 + 비아 + 얼라인먼트 크로스헤어
      if (finePointer && pointer.x > -1000) {
        const near: Die[] = []
        for (const d of dies) {
          if (!d.lit || !d.exposed || d.near <= 0) continue
          near.push(d)
          if (near.length > 24) break
        }
        ctx.strokeStyle = 'rgba(34,211,238,.34)'
        ctx.lineWidth = 0.9
        for (let i = 0; i + 1 < near.length; i += 2) {
          const a = near[i]
          const b = near[i + 1]
          if (Math.hypot(a.mx - b.mx, a.my - b.my) > cell * 9) continue
          ctx.beginPath()
          ctx.moveTo(a.mx, a.my)
          ctx.lineTo(b.mx, a.my) // 대각선을 쓰지 않는 것만으로 회로처럼 읽힌다
          ctx.lineTo(b.mx, b.my)
          ctx.stroke()
          ctx.fillStyle = 'rgba(103,232,249,.6)'
          ctx.beginPath()
          ctx.arc(b.mx, a.my, 1.6, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.strokeStyle = 'rgba(34,211,238,.42)'
        ctx.lineWidth = 0.9
        const gap = 9
        const len = 22
        ctx.beginPath()
        ctx.moveTo(pointer.x - gap - len, pointer.y)
        ctx.lineTo(pointer.x - gap, pointer.y)
        ctx.moveTo(pointer.x + gap, pointer.y)
        ctx.lineTo(pointer.x + gap + len, pointer.y)
        ctx.moveTo(pointer.x, pointer.y - gap - len)
        ctx.lineTo(pointer.x, pointer.y - gap)
        ctx.moveTo(pointer.x, pointer.y + gap)
        ctx.lineTo(pointer.x, pointer.y + gap + len)
        ctx.stroke()
        ctx.strokeRect(pointer.x - 4, pointer.y - 4, 8, 8)
      }

      raf = requestAnimationFrame(frame)
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    const onPointerLeave = () => {
      pointer.x = -9999
      pointer.y = -9999
    }

    if (finePointer) {
      host.addEventListener('pointermove', onPointerMove)
      host.addEventListener('pointerleave', onPointerLeave)
    }

    const ro = new ResizeObserver(build)
    ro.observe(host)

    build()
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (finePointer) {
        host.removeEventListener('pointermove', onPointerMove)
        host.removeEventListener('pointerleave', onPointerLeave)
      }
    }
  }, [text, fontReady, reducedMotion, skipIntro, onComplete])

  return (
    <div className={styles.host} ref={hostRef}>
      {/* 장식이므로 스크린리더에서 감춘다. 브랜드명은 폼 안의 워드마크가 전달한다. */}
      <canvas className={styles.canvas} ref={canvasRef} aria-hidden="true" />
    </div>
  )
}

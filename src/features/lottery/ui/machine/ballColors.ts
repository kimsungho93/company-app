export const BALL_COLORS = [
  '#f4b400',
  '#2463df',
  '#e53945',
  '#11975c',
  '#8246cc',
  '#ef771a',
  '#00a7c4',
  '#d32b82',
  '#a3bd24',
  '#087c80',
  '#4545a8',
  '#ee725e',
  '#b73ab7',
  '#9c622c',
  '#4c657b',
]

const rgbChannels = (hex: string) =>
  [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16))

const varyColor = (hex: string, hueShift: number, lightnessShift: number) => {
  const [red, green, blue] = rgbChannels(hex).map((channel) => channel / 255)
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const chroma = maximum - minimum
  const lightness = (maximum + minimum) / 2
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1))
  const hue =
    chroma === 0
      ? 0
      : maximum === red
        ? 60 * (((green - blue) / chroma) % 6)
        : maximum === green
          ? 60 * ((blue - red) / chroma + 2)
          : 60 * ((red - green) / chroma + 4)
  const shiftedHue = (((hue + hueShift) % 360) + 360) % 360
  const shiftedLightness = Math.max(0.24, Math.min(0.68, lightness + lightnessShift))
  const shiftedSaturation = Math.max(0.46, Math.min(0.94, saturation))
  const shiftedChroma = (1 - Math.abs(2 * shiftedLightness - 1)) * shiftedSaturation
  const intermediate = shiftedChroma * (1 - Math.abs(((shiftedHue / 60) % 2) - 1))
  const offset = shiftedLightness - shiftedChroma / 2
  const channels =
    shiftedHue < 60
      ? [shiftedChroma, intermediate, 0]
      : shiftedHue < 120
        ? [intermediate, shiftedChroma, 0]
        : shiftedHue < 180
          ? [0, shiftedChroma, intermediate]
          : shiftedHue < 240
            ? [0, intermediate, shiftedChroma]
            : shiftedHue < 300
              ? [intermediate, 0, shiftedChroma]
              : [shiftedChroma, 0, intermediate]
  return `#${channels
    .map((channel) =>
      Math.round((channel + offset) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

const extendedColors = [
  ...BALL_COLORS,
  ...BALL_COLORS.map((color) => varyColor(color, 7, -0.12)),
  ...BALL_COLORS.map((color) => varyColor(color, -9, 0.1)),
  ...BALL_COLORS.slice(0, 5).map((color) => varyColor(color, 17, -0.055)),
]

export const ballColor = (index: number) => {
  return extendedColors[index] ?? BALL_COLORS[0]
}

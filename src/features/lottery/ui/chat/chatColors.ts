const COLORS = ['#159a78', '#d8784d', '#8c5bce', '#ba8a1c', '#228ea8', '#346de0']

export const chatColor = (userId: number) => COLORS[Math.abs(userId) % COLORS.length]

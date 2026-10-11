import type { Terminal } from '@xterm/xterm'

/** Shared by local terminals and the read-only mirror of a host's terminal. */
export const TERMINAL_OPTIONS: ConstructorParameters<typeof Terminal>[0] = {
  // koda-token-exception: Xterm requires literal ANSI palette values at its terminal API boundary.
  theme: {
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    background: '#000000',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    foreground: '#c5c5c5',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    cursor: '#e07a5f',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    cursorAccent: '#000000',
    selectionBackground: 'rgba(224, 122, 95, 0.25)',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    black: '#141414',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    red: '#f87171',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    green: '#4ade80',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    yellow: '#fbbf24',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    blue: '#60a5fa',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    magenta: '#c084fc',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    cyan: '#22d3ee',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    white: '#c5c5c5',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    brightBlack: '#3a3a3a',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    brightRed: '#f87171',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    brightGreen: '#4ade80',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    brightYellow: '#facc15',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    brightBlue: '#60a5fa',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    brightMagenta: '#c084fc',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    brightCyan: '#22d3ee',
    // koda-token-exception: Xterm consumes literal ANSI palette colors at this API boundary.
    brightWhite: '#e8e8e8',
  },
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'bar',
  scrollback: 1000,
}

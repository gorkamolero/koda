import type { Terminal } from 'xterm'

/** Shared by local terminals and the read-only mirror of a host's terminal. */
export const TERMINAL_OPTIONS: ConstructorParameters<typeof Terminal>[0] = {
  theme: {
    background: '#000000',
    foreground: '#c5c5c5',
    cursor: '#e07a5f',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(224, 122, 95, 0.25)',
    black: '#141414',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#fbbf24',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: '#c5c5c5',
    brightBlack: '#3a3a3a',
    brightRed: '#f87171',
    brightGreen: '#4ade80',
    brightYellow: '#facc15',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#e8e8e8',
  },
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.2,
  cursorBlink: true,
  cursorStyle: 'bar',
  scrollback: 1000,
}

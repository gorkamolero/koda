// ============================================================================
// KODA ASCII Art Definitions
// ============================================================================

/**
 * Compact KODA letters using box-drawing characters
 * Each letter is 3 lines tall for inline use
 * @internal Reserved for future use in compact ASCII displays
 */
export const _KODA_COMPACT = {
  K: ['╻ ╻', '╠╸ ', '╹ ╹'],
  O: ['╭─╮', '│ │', '╰─╯'],
  D: ['╭─╮', '│ │', '╰─╯'].map((_line, i) => i === 0 ? '┌─╮' : i === 2 ? '└─╯' : '│ │'),
  A: ['╭─╮', '├─┤', '╵ ╵'],
}

/**
 * Large ASCII art KODA logo
 * Block-style letters for splash screens and loading
 */
export const KODA_LARGE = `
██╗  ██╗ ██████╗ ██████╗  █████╗
██║ ██╔╝██╔═══██╗██╔══██╗██╔══██╗
█████╔╝ ██║   ██║██║  ██║███████║
██╔═██╗ ██║   ██║██║  ██║██╔══██║
██║  ██╗╚██████╔╝██████╔╝██║  ██║
╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝
`.trim()

/**
 * Minimal KODA for very compact spaces
 */
export const KODA_MINIMAL = 'K·O·D·A'

/**
 * KODA using braille patterns for a unique look
 * @internal Reserved for future braille animation mode
 */
export const _KODA_BRAILLE = {
  frames: [
    '⣿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',  // Full
    '⣷⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',  // K animating
    '⣯⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',
    '⣟⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',
    '⡿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣿⣿⡇',
    '⣿⡇⡇⣷⣿⣷⡇⣿⡇⡇⣿⣿⡇',  // O animating
    '⣿⡇⡇⣯⣿⣯⡇⣿⡇⡇⣿⣿⡇',
    '⣿⡇⡇⣟⣿⣟⡇⣿⡇⡇⣿⣿⡇',
    '⣿⡇⡇⣿⣿⣿⡇⣷⡇⡇⣿⣿⡇',  // D animating
    '⣿⡇⡇⣿⣿⣿⡇⣯⡇⡇⣿⣿⡇',
    '⣿⡇⡇⣿⣿⣿⡇⣟⡇⡇⣿⣿⡇',
    '⣿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣷⣿⣷',  // A animating
    '⣿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣯⣿⣯',
    '⣿⡇⡇⣿⣿⣿⡇⣿⡇⡇⣟⣿⣟',
  ]
}


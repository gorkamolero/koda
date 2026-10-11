import noRawTokens from './no-raw-tokens.js'
import cssProcessor from './css-processor.js'

export default { processors: { css: cssProcessor }, rules: { 'no-raw-tokens': noRawTokens } }

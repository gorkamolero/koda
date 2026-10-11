import { memo, type ComponentProps } from 'react'
import { Streamdown } from 'streamdown'
import { cjk } from '@streamdown/cjk'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import { cn } from '@/lib/utils'

/** Streaming Markdown stays beside the transcript, independent of message chrome. */
export const MessageResponse = memo(function MessageResponse({ className, ...props }: ComponentProps<typeof Streamdown>) {
  return <Streamdown className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)} plugins={{ code, mermaid, math, cjk }} {...props} />
}, (previous, next) => previous.children === next.children)

import type { Meta, StoryObj } from '@storybook/react-vite'
import { TerminalFrame } from './index'
import { Button } from '../primitives'
import { expect, within } from 'storybook/test'

const meta = { title: 'Patterns/TerminalFrame', component: TerminalFrame, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { title: 'pnpm test', status: 'ready', children: <pre className="whitespace-pre-wrap">{'~/koda $ pnpm --filter @koda/desktop test\n✓ WorkspaceSharing (18 tests)\nTest Files  1 passed\nTests       18 passed'}</pre> },  } satisfies Meta<typeof TerminalFrame>
export default meta
type Story = StoryObj<typeof meta>
export const Host: Story = { args: { actions: <Button variant="bracket" size="sm">Clear</Button> } }
export const ReadOnlyMirror: Story = { args: { readOnly: true } }
export const Running: Story = { args: { status: 'running', children: '$ pnpm test — running…' } }
export const Disconnected: Story = { args: { status: 'disconnected', readOnly: true, children: 'The host is unreachable. Last output is shown above.' } }
export const FillsAvailableHeight: Story = {
  args: { className: 'h-64', bodyClassName: 'min-h-0 flex-1', children: <pre data-testid="terminal-output">$ pnpm test</pre> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const frame = canvas.getByRole('region', { name: 'pnpm test' })
    const body = canvas.getByTestId('terminal-output').parentElement!
    await expect(body.clientHeight).toBeGreaterThan(frame.clientHeight / 2)
  },
}


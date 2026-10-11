import type { Meta, StoryObj } from '@storybook/react-vite'
import { ToolBlock } from './index'
import { useState } from 'react'
import { Button } from '../primitives'
import { expect, userEvent, within } from 'storybook/test'
function Lifecycle(props: React.ComponentProps<typeof ToolBlock>) { const [done, setDone] = useState(false); return <div className="space-y-4"><ToolBlock {...props} status={done ? 'done' : 'running'} /><Button onClick={() => setDone(true)}>Complete tool</Button></div> }
const meta = { title: 'Patterns/ToolBlock', component: ToolBlock, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { tool: 'exec_command', status: 'running', summary: 'Checking the reconnect regression', children: <pre className="whitespace-pre-wrap">{'$ pnpm --filter @koda/desktop test -- WorkspaceSharing\nRunning 18 tests…'}</pre> },  } satisfies Meta<typeof ToolBlock>
export default meta
type Story = StoryObj<typeof meta>
export const Running: Story = { play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true') } }
export const Done: Story = { args: { status: 'done', summary: '18 tests passed', duration: '1.8s', children: 'All 18 tests passed.' }, play: async ({ canvasElement }) => { const button = within(canvasElement).getByRole('button'); await expect(button).toHaveAttribute('aria-expanded', 'false'); await userEvent.click(button); await expect(button).toHaveAttribute('aria-expanded', 'true') } }
export const Failed: Story = { args: { status: 'failed', summary: 'Reconnect test failed', duration: '2.1s', children: 'Expected reconnect timer to be cancelled.' }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true'); await expect(within(canvasElement).getByText('Expected reconnect timer to be cancelled.')).toBeVisible() } }
export const ExpandedResult: Story = { args: { status: 'done', defaultOpen: true, children: '18 tests passed.' } }
export const CompletionCollapses: Story = { render: (args) => <Lifecycle {...args} />, play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('button', { name: 'Complete tool' })); await expect(canvas.getByRole('button', { name: /exec_command/ })).toHaveAttribute('aria-expanded', 'false') } }


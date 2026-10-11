import type { Meta, StoryObj } from '@storybook/react-vite'
import { MessageBubble } from './index'
import { Button } from '../primitives'
import { expect, userEvent, within } from 'storybook/test'

const meta = { title: 'Patterns/MessageBubble', component: MessageBubble, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { variant: 'assistant', author: 'Codex', timestamp: '10:42', children: <p>I found a stale reconnect timer. I’ll cancel it when the shared workspace closes and add a regression check.</p> },  } satisfies Meta<typeof MessageBubble>
export default meta
type Story = StoryObj<typeof meta>
export const Assistant: Story = {}
export const User: Story = { args: { variant: 'user', author: 'Gorka', children: 'Fix the reconnect loop when the host closes a shared workspace.' } }
export const System: Story = { args: { variant: 'system', author: undefined, children: 'Ana joined this workspace with view permission.' } }
export const SharedAuthor: Story = { args: { variant: 'user', author: 'Ana', children: 'I can reproduce this after switching Wi-Fi networks.' } }
export const HoverActions: Story = { args: { actions: <Button size="sm" variant="bracket">Copy message</Button> }, play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.hover(canvas.getByRole('article')); const action = canvas.getByRole('button', { name: 'Copy message' }); action.focus(); await expect(action).toHaveFocus() } }


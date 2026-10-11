import type { Meta, StoryObj } from '@storybook/react-vite'
import { NavItem } from './index'
import { GitBranch } from 'lucide-react'
import { Button } from '../primitives'
import { expect, userEvent, within, fn } from 'storybook/test'

const meta = { title: 'Brand/NavItem', component: NavItem, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { label: 'Fix reconnect handling', meta: 'codex/reconnect · 4 files', icon: <GitBranch className="size-4" />, onClick: fn() },  } satisfies Meta<typeof NavItem>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Active: Story = { args: { active: true } }
export const Unread: Story = { args: { unread: true } }
export const Running: Story = { args: { running: true } }
export const Disabled: Story = { args: { disabled: true }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole('button', { name: /Fix reconnect/ })).toBeDisabled() } }
export const WithCount: Story = { args: { trailing: <span>4</span> } }
export const HoverActions: Story = { args: { actions: <Button size="sm" variant="bracket">Archive</Button> }, play: async ({ canvasElement, args }) => { const row = within(canvasElement).getByRole('button', { name: /Fix reconnect/ }); await userEvent.hover(row); await userEvent.click(row); await expect(args.onClick).toHaveBeenCalled() } }
export const KeyboardFocus: Story = { play: async ({ canvasElement }) => { const button = within(canvasElement).getByRole('button', { name: /Fix reconnect/ }); button.focus(); await expect(button).toHaveFocus() } }


export const DisabledActions: Story = { args: { disabled: true, actions: <Button size="sm" variant="bracket">Archive</Button> }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole('button', { name: 'Archive' })).toBeDisabled() } }

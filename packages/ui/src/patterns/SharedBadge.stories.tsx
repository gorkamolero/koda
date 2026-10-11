import type { Meta, StoryObj } from '@storybook/react-vite'
import { SharedBadge } from './index'
import { expect, within } from 'storybook/test'

const meta = { title: 'Patterns/SharedBadge', component: SharedBadge, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { hostName: 'Gorka', permission: 'control', showStatus: true },  } satisfies Meta<typeof SharedBadge>
export default meta
type Story = StoryObj<typeof meta>
export const Control: Story = { play: async ({ canvasElement }) => { await expect(within(canvasElement).getByTestId('shared-workspace-badge')).toHaveAttribute('data-permission', 'control') } }
export const View: Story = { args: { permission: 'view' }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByTestId('shared-workspace-badge')).toHaveAttribute('data-permission', 'view') } }
export const Connecting: Story = { args: { status: 'connecting' } }
export const Reconnecting: Story = { args: { status: 'reconnecting' } }
export const Disconnected: Story = { args: { status: 'disconnected' } }
export const Initializing: Story = { args: { status: 'initializing' } }
export const BadgeOnly: Story = { args: { showStatus: false } }


export const ConnectionStatus: Story = { args: { connectionOnly: true, showLabel: true }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByTitle('Collaboration: Connected')).toHaveTextContent('Connected') } }

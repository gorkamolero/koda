import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Toast } from './feedback'
const meta = { title: 'Primitives/Toast', component: Toast, tags: ['autodocs'], args: { title: 'Workspace shared', description: 'Maya can now follow this session.', onDismiss: fn() } } satisfies Meta<typeof Toast>
export default meta
type Story = StoryObj<typeof meta>
export const Info: Story = {}
export const Success: Story = { args: { tone: 'success', title: 'Changes committed', description: '84 additions and 12 deletions.' } }
export const Warning: Story = { args: { tone: 'warning', title: 'Context almost full', description: 'Start a new session to continue.' } }
export const Error: Story = { args: { tone: 'error', title: 'Host unreachable', description: 'The host needs to reconnect before messages can be sent.' } }
export const WithAction: Story = { args: { action: { label: 'Copy invitation', onClick: fn() } } }
export const Persistent: Story = { args: { onDismiss: undefined } }

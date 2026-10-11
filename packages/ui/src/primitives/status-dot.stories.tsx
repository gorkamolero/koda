import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatusDot } from './badge'
const meta = { title: 'Primitives/StatusDot', component: StatusDot, tags: ['autodocs'], args: { status: 'success' , label: 'Success' } } satisfies Meta<typeof StatusDot>
export default meta
type Story = StoryObj<typeof meta>
export const Success: Story = { args: { status: 'success', label: 'Success' } }
export const Warning: Story = { args: { status: 'warning', label: 'Warning' } }
export const Error: Story = { args: { status: 'error', label: 'Error' } }
export const Processing: Story = { args: { status: 'processing', label: 'Processing' } }
export const Reviewing: Story = { args: { status: 'reviewing', label: 'Reviewing' } }
export const Ready: Story = { args: { status: 'ready', label: 'Ready' } }
export const Unread: Story = { args: { status: 'unread', label: 'Unread' } }
export const Unknown: Story = { args: { status: 'unknown', label: 'Unknown' } }

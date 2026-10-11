import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatusBadge } from './badge'
const meta = { title: 'Primitives/StatusBadge', component: StatusBadge, tags: ['autodocs'], args: { status: 'success'  } } satisfies Meta<typeof StatusBadge>
export default meta
type Story = StoryObj<typeof meta>
export const Success: Story = { args: { status: 'success' } }
export const Warning: Story = { args: { status: 'warning' } }
export const Error: Story = { args: { status: 'error' } }
export const Processing: Story = { args: { status: 'processing' } }
export const Reviewing: Story = { args: { status: 'reviewing' } }
export const Ready: Story = { args: { status: 'ready' } }
export const Unread: Story = { args: { status: 'unread' } }
export const Unknown: Story = { args: { status: 'unknown' } }

import type { Meta, StoryObj } from '@storybook/react-vite'
import { WorkingIndicator } from './index'


const meta = { title: 'Brand/WorkingIndicator', component: WorkingIndicator, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { elapsedMs: 83000, label: 'working', compact: false },  } satisfies Meta<typeof WorkingIndicator>
export default meta
type Story = StoryObj<typeof meta>
export const Full: Story = {}
export const Compact: Story = { args: { compact: true } }
export const JustStarted: Story = { args: { elapsedMs: 0 } }
export const CustomLabel: Story = { args: { label: 'reviewing changes', elapsedMs: 15000 } }


import type { Meta, StoryObj } from '@storybook/react-vite'
import { Meter } from './progress'
const meta = { title: 'Primitives/Meter', component: Meter, tags: ['autodocs'], args: { label: 'Context usage', value: 42, className: 'w-80' } } satisfies Meta<typeof Meter>
export default meta
type Story = StoryObj<typeof meta>
export const Normal: Story = {}
export const Warning: Story = { args: { value: 78 } }
export const Critical: Story = { args: { value: 94 } }
export const Empty: Story = { args: { value: 0 } }
export const Full: Story = { args: { value: 100 } }
export const TokenCount: Story = { args: { value: 64000, max: 200000, valueText: '64K / 200K' } }

export const Continuous: Story = { args: { variant: 'continuous', value: 32, max: 100, label: 'Context usage', valueText: '32.0K / 100.0K' } }

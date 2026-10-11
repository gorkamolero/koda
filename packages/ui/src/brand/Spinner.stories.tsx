import type { Meta, StoryObj } from '@storybook/react-vite'
import { Spinner } from './index'


const meta = { title: 'Brand/Spinner', component: Spinner, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { label: 'Loading workspace', variant: 'wave', showLabel: true }, argTypes: { variant: { control: 'select', options: ['wave', 'scan', 'pulse', 'matrix', 'bounce'] } },  } satisfies Meta<typeof Spinner>
export default meta
type Story = StoryObj<typeof meta>
export const Wave: Story = { args: { variant: 'wave' } }
export const Scan: Story = { args: { variant: 'scan' } }
export const Pulse: Story = { args: { variant: 'pulse' } }
export const Matrix: Story = { args: { variant: 'matrix' } }
export const Bounce: Story = { args: { variant: 'bounce' } }
export const WithoutLabel: Story = { args: { showLabel: false } }


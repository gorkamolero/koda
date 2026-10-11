import type { Meta, StoryObj } from '@storybook/react-vite'
import { Progress } from './progress'
const meta = { title: 'Primitives/Progress', component: Progress, tags: ['autodocs'], args: { 'aria-label': 'Indexing repository', value: 45, className: 'w-80' } } satisfies Meta<typeof Progress>
export default meta
type Story = StoryObj<typeof meta>
export const InProgress: Story = {}
export const Empty: Story = { args: { value: 0 } }
export const Complete: Story = { args: { value: 100 } }
export const Indeterminate: Story = { args: { value: null } }

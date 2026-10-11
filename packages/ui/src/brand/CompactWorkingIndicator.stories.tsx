import type { Meta, StoryObj } from '@storybook/react-vite'
import { CompactWorkingIndicator } from './index'


const meta = { title: 'Brand/CompactWorkingIndicator', component: CompactWorkingIndicator, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { elapsedMs: 15000 },  } satisfies Meta<typeof CompactWorkingIndicator>
export default meta
type Story = StoryObj<typeof meta>
export const Compact: Story = {}

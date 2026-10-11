import type { Meta, StoryObj } from '@storybook/react-vite'
import { ToolCallSummary } from './index'


const meta = { title: 'Patterns/ToolCallSummary', component: ToolCallSummary, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { tool: 'exec_command', status: 'done', summary: '18 tests passed', duration: '1.8s' },  } satisfies Meta<typeof ToolCallSummary>
export default meta
type Story = StoryObj<typeof meta>
export const Done: Story = {}
export const Running: Story = { args: { status: 'running', summary: 'Running workspace tests', duration: undefined } }
export const Failed: Story = { args: { status: 'failed', summary: 'Process exited with code 1' } }


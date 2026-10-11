import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './select'
const meta = { title: 'Primitives/Select', component: Select, subcomponents: { SelectTrigger, SelectContent, SelectItem }, tags: ['autodocs'], args: { defaultValue: 'codex' }, render: args => <Select {...args}><SelectTrigger aria-label="Agent model" className="w-64"><SelectValue placeholder="Choose model" /></SelectTrigger><SelectContent><SelectItem value="codex">Codex</SelectItem><SelectItem value="claude">Claude</SelectItem><SelectItem value="offline" disabled>Local model · offline</SelectItem></SelectContent></Select> } satisfies Meta<typeof Select>
export default meta
type Story = StoryObj<typeof meta>
export const Model: Story = {}
export const Permission: Story = { args: { defaultValue: 'view' }, render: args => <Select {...args}><SelectTrigger aria-label="Session permission" className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="view">VIEW · Read only</SelectItem><SelectItem value="control">CONTROL · Can send messages</SelectItem></SelectContent></Select> }
export const ReadOnlyCollaborator: Story = { args: { disabled: true } }
export const Invalid: Story = { render: args => <Select {...args}><SelectTrigger aria-label="Agent model" aria-invalid className="w-64 border-status-error"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="codex">Codex</SelectItem></SelectContent></Select> }
export const Keyboard: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); const trigger = canvas.getByRole('combobox'); trigger.focus(); await userEvent.keyboard('{Enter}'); await userEvent.keyboard('{ArrowDown}{Enter}'); await expect(trigger).toHaveTextContent('Claude') } }

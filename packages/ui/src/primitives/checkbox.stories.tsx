import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Checkbox } from './choice'
const meta = { title: 'Primitives/Checkbox', component: Checkbox, tags: ['autodocs'], args: { 'aria-label': 'Include untracked files' }, render: args => <label className="flex items-center gap-3 font-code text-sm text-text-primary"><Checkbox {...args} />Include untracked files</label> } satisfies Meta<typeof Checkbox>
export default meta
type Story = StoryObj<typeof meta>
export const Unchecked: Story = {}
export const Checked: Story = { args: { defaultChecked: true } }
export const Indeterminate: Story = { args: { checked: 'indeterminate' } }
export const Disabled: Story = { args: { disabled: true } }
export const Keyboard: Story = { play: async ({ canvasElement }) => { const control = within(canvasElement).getByRole('checkbox'); control.focus(); await userEvent.keyboard(' '); await expect(control).toBeChecked() } }

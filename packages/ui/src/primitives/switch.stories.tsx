import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Switch } from './choice'
const meta = { title: 'Primitives/Switch', component: Switch, tags: ['autodocs'], args: { 'aria-label': 'Desktop notifications' }, render: args => <label className="flex items-center gap-3 font-code text-sm text-text-primary"><Switch {...args} />Desktop notifications</label> } satisfies Meta<typeof Switch>
export default meta
type Story = StoryObj<typeof meta>
export const Off: Story = {}
export const On: Story = { args: { defaultChecked: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Keyboard: Story = { play: async ({ canvasElement }) => { const control = within(canvasElement).getByRole('switch'); control.focus(); await userEvent.keyboard(' '); await expect(control).toBeChecked() } }

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import { RadioGroup, RadioGroupItem } from './choice'
const meta = { title: 'Primitives/RadioGroup', component: RadioGroup, subcomponents: { RadioGroupItem }, tags: ['autodocs'], args: { 'aria-label': 'Approval policy', defaultValue: 'ask' }, render: args => <RadioGroup {...args}><label className="flex items-center gap-2"><RadioGroupItem value="ask" />Ask before commands</label><label className="flex items-center gap-2"><RadioGroupItem value="files" />Allow file edits</label><label className="flex items-center gap-2"><RadioGroupItem value="network" disabled />Network unavailable</label></RadioGroup> } satisfies Meta<typeof RadioGroup>
export default meta
type Story = StoryObj<typeof meta>
export const Selected: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const Keyboard: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); canvas.getByRole('radio', { name: 'Ask before commands' }).focus(); await userEvent.keyboard('{ArrowDown>}'); await waitFor(() => expect(canvas.getByRole('radio', { name: 'Allow file edits' })).toBeChecked()); await userEvent.keyboard('{/ArrowDown}') } }

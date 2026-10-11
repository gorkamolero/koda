import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { SegmentedControl } from './button-group'
const meta = { title: 'Primitives/SegmentedControl', component: SegmentedControl, tags: ['autodocs'], args: { 'aria-label': 'Share permission', defaultValue: 'view', options: [{ value: 'view', label: 'VIEW' }, { value: 'control', label: 'CONTROL' }] } } satisfies Meta<typeof SegmentedControl>
export default meta
type Story = StoryObj<typeof meta>
export const View: Story = {}
export const Control: Story = { args: { defaultValue: 'control' } }
export const Disabled: Story = { args: { disabled: true } }
export const Keyboard: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); canvas.getByRole('radio', { name: 'VIEW' }).focus(); await userEvent.keyboard('{ArrowRight}'); await expect(canvas.getByRole('radio', { name: 'CONTROL' })).toBeChecked() } }

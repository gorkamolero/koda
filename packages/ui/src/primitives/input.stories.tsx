import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from './input'
const meta = { title: 'Primitives/Input', component: Input, tags: ['autodocs'], args: { 'aria-label': 'Workspace name', placeholder: 'design-system' } } satisfies Meta<typeof Input>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Invalid: Story = { args: { 'aria-invalid': true, defaultValue: 'main' } }
export const Disabled: Story = { args: { disabled: true, defaultValue: 'design-system' } }
export const ReadOnly: Story = { args: { readOnly: true, value: 'design-system' } }

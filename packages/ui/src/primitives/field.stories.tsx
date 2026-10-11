import type { Meta, StoryObj } from '@storybook/react-vite'
import { Field, Input } from './input'
const meta = { title: 'Primitives/Field', component: Field, tags: ['autodocs'], args: { label: 'Workspace name', children: <Input placeholder="design-system" /> } } satisfies Meta<typeof Field>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Hint: Story = { args: { hint: 'Use a short name for this branch.' } }
export const Error: Story = { args: { error: 'A workspace with this name already exists.' } }
export const Disabled: Story = { args: { children: <Input disabled value="design-system" /> } }

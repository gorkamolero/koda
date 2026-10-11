import type { Meta, StoryObj } from '@storybook/react-vite'
import { InputGroup, Textarea } from './input'
const meta = { title: 'Primitives/Textarea', component: Textarea, tags: ['autodocs'], args: { 'aria-label': 'Agent instructions', placeholder: 'Ask Codex to improve the settings screen…' } } satisfies Meta<typeof Textarea>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Invalid: Story = { args: { 'aria-invalid': true, defaultValue: 'Please add more detail.' } }
export const Disabled: Story = { args: { disabled: true } }

export const WithAddons: Story = {
  render: args => <InputGroup leading="❯" trailing="Markdown"><Textarea {...args} /></InputGroup>,
}

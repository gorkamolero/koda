import type { Meta, StoryObj } from '@storybook/react-vite'
import { TerminalSection } from './index'
import { Button } from '../primitives'

const meta = { title: 'Brand/TerminalSection', component: TerminalSection, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { title: 'AGENT SETTINGS', description: 'Defaults for new Codex sessions.', children: <p className="text-text-primary">Model: GPT-5.4 · Approval: on request</p> },  } satisfies Meta<typeof TerminalSection>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const WithHeaderAction: Story = { args: { action: <Button variant="bracket" size="sm">Edit</Button> } }
export const WithoutDescription: Story = { args: { description: undefined } }


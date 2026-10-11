import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible'
import { Button } from './button'
const meta = { title: 'Primitives/Collapsible', component: Collapsible, subcomponents: { CollapsibleTrigger, CollapsibleContent }, tags: ['autodocs'], render: args => <Collapsible {...args}><CollapsibleTrigger asChild><Button variant="bracket">Tool output</Button></CollapsibleTrigger><CollapsibleContent className="p-4 font-code text-xs text-text-primary">Build succeeded. 84 modules transformed.</CollapsibleContent></Collapsible> } satisfies Meta<typeof Collapsible>
export default meta
type Story = StoryObj<typeof meta>
export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Keyboard: Story = { play: async ({ canvasElement }) => { const trigger = within(canvasElement).getByRole('button'); trigger.focus(); await userEvent.keyboard('{Enter}'); await expect(trigger).toHaveAttribute('aria-expanded', 'true') } }

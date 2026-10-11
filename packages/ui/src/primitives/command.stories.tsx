import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from './command'
const meta = { title: 'Primitives/Command', component: Command, subcomponents: { CommandInput, CommandList, CommandGroup, CommandItem }, tags: ['autodocs'], args: { label: 'Workspace commands' }, render: args => <Command {...args} className="w-80 border border-border-muted"><CommandInput placeholder="Search commands…" aria-label="Search commands" /><CommandList><CommandEmpty>No matching commands.</CommandEmpty><CommandGroup heading="Workspace"><CommandItem value="New session">New session<CommandShortcut>⌘N</CommandShortcut></CommandItem><CommandItem value="Share workspace">Share workspace</CommandItem><CommandItem value="Archive workspace" disabled>Archive workspace · host only</CommandItem></CommandGroup></CommandList></Command> } satisfies Meta<typeof Command>
export default meta
type Story = StoryObj<typeof meta>
export const Commands: Story = {}
export const Filtered: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.type(canvas.getByRole('combobox'), 'Share'); await expect(canvas.getByRole('option', { name: 'Share workspace' })).toBeVisible(); await expect(canvas.queryByRole('option', { name: /New session/ })).not.toBeInTheDocument() } }
export const Empty: Story = { play: async ({ canvasElement }) => { await userEvent.type(within(canvasElement).getByRole('combobox'), 'missing-command') } }

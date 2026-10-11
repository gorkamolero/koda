import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from './command'
import { Command as CommandIcon } from 'lucide-react'
import { Kbd } from './badge'
const meta = { title: 'Primitives/Command', component: Command, subcomponents: { CommandInput, CommandList, CommandGroup, CommandItem }, tags: ['autodocs'], args: { label: 'Workspace commands' }, render: args => <Command {...args} className="w-80 border border-border-muted"><CommandInput placeholder="Search commands…" aria-label="Search commands" /><CommandList><CommandEmpty>No matching commands.</CommandEmpty><CommandGroup heading="Workspace"><CommandItem value="New session">New session<CommandShortcut>⌘N</CommandShortcut></CommandItem><CommandItem value="Share workspace">Share workspace</CommandItem><CommandItem value="Archive workspace" disabled>Archive workspace · host only</CommandItem></CommandGroup></CommandList></Command> } satisfies Meta<typeof Command>
export default meta
type Story = StoryObj<typeof meta>
export const Commands: Story = {}
export const Filtered: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.type(canvas.getByRole('combobox'), 'Share'); await expect(canvas.getByRole('option', { name: 'Share workspace' })).toBeVisible(); await expect(canvas.queryByRole('option', { name: /New session/ })).not.toBeInTheDocument() } }
export const Empty: Story = { play: async ({ canvasElement }) => { await userEvent.type(within(canvasElement).getByRole('combobox'), 'missing-command') } }
export const DialogHeaderSlots: Story = {
  render: () => <CommandDialog defaultOpen commandProps={{ label: 'Search commands' }} contentProps={{ showClose: false, overlayClassName: 'backdrop-blur-sm' }}><CommandInput icon={<CommandIcon aria-hidden="true" className="mr-2 size-4" />} trailing={<Kbd>Esc</Kbd>} wrapperClassName="gap-2"></CommandInput><CommandList><CommandItem value="New session">New session</CommandItem></CommandList></CommandDialog>,
  play: async ({ canvasElement }) => {
    const document = within(canvasElement.ownerDocument.body)
    await expect(document.getByRole('combobox', { name: 'Search commands' })).toHaveFocus()
    await expect(document.getByText('Esc')).toBeVisible()
    await expect(document.queryByRole('button', { name: '[ESC] CLOSE' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await expect(document.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

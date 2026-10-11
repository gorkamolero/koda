import type { Meta, StoryObj } from '@storybook/react-vite'
import { CommandPalette } from './index'
import { FileCode, GitBranch, Share2 } from 'lucide-react'
import { expect, userEvent, within, fn } from 'storybook/test'

const meta = { title: 'Patterns/CommandPalette', component: CommandPalette, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { commands: [{ id: 'new', label: 'New workspace', group: 'Workspace', shortcut: '⌘N', icon: <GitBranch className="size-4" />, onSelect: fn() }, { id: 'share', label: 'Share workspace', group: 'Workspace', icon: <Share2 className="size-4" />, onSelect: fn() }, { id: 'file', label: 'WorkspaceSharing.tsx', group: 'Files', icon: <FileCode className="size-4" />, onSelect: fn() }, { id: 'deploy', label: 'Deploy workspace', group: 'Workspace', disabled: true }] },  } satisfies Meta<typeof CommandPalette>
export default meta
type Story = StoryObj<typeof meta>
export const Embedded: Story = {}
export const Search: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.type(canvas.getByRole('combobox'), 'WorkspaceSharing'); await expect(canvas.getByRole('option', { name: 'WorkspaceSharing.tsx' })).toBeVisible(); await expect(canvas.queryByRole('option', { name: 'New workspace ⌘N' })).not.toBeInTheDocument() } }
export const EmptyResults: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.type(canvas.getByRole('combobox'), 'no-matching-command'); await expect(canvas.getByText('No matching commands.')).toBeVisible() } }
export const KeyboardSelection: Story = { play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('combobox')); await userEvent.keyboard('{ArrowDown}{Enter}'); await expect(args.commands[1]?.onSelect).toHaveBeenCalled() } }
export const Modal: Story = { args: { open: true, onOpenChange: fn() }, parameters: { layout: 'fullscreen' } }

export const NativeAttributes: Story = { args: { onKeyDown: fn(), className: 'max-w-xl' }, render: (args) => <CommandPalette {...args} data-testid="workspace-command-palette" role="region" aria-label="Workspace commands" />, play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); const shell = canvas.getByTestId('workspace-command-palette'); await expect(shell).toHaveClass('max-w-xl'); await expect(canvas.getByRole('region', { name: 'Workspace commands' })).toBe(shell); await userEvent.click(canvas.getByRole('combobox')); await userEvent.keyboard('{ArrowDown}'); await expect(args.onKeyDown).toHaveBeenCalled() } }
export const ModalAttributes: Story = { args: { open: true, onOpenChange: fn(), className: 'max-w-xl' }, render: (args) => <CommandPalette {...args} data-testid="modal-command-palette" />, play: async () => { await expect(within(document.body).getByTestId('modal-command-palette')).toHaveClass('max-w-xl') } }

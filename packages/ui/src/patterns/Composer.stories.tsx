import type { Meta, StoryObj } from '@storybook/react-vite'
import { Composer } from './index'
import { useState } from 'react'
import { Button, Badge } from '../primitives'
import { expect, userEvent, within, fn } from 'storybook/test'
import type { ComposerProps } from './index'
function ControlledComposer(props: ComposerProps) { const [value, setValue] = useState(props.value); return <Composer {...props} value={value} onValueChange={setValue} /> }
const meta = { title: 'Patterns/Composer', component: Composer, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { value: '', modelSelector: <Button variant="ghost" size="sm" aria-label="Model: GPT-5.4">GPT-5.4</Button>, onSend: fn(), onStop: fn(), onPermissionChange: fn() }, render: (args) => <ControlledComposer {...args} /> , } satisfies Meta<typeof Composer>
export default meta
type Story = StoryObj<typeof meta>
export const OwnSession: Story = { play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await expect(canvas.getByRole('button', { name: 'Send' })).toBeDisabled(); await userEvent.type(canvas.getByRole('textbox', { name: 'Message' }), 'Fix the reconnect timer.'); await userEvent.click(canvas.getByRole('button', { name: 'Send' })); await expect(args.onSend).toHaveBeenCalledOnce() } }
export const SomeoneElsesSession: Story = { args: { mode: 'shared', ownerName: 'Gorka' }, play: async ({ canvasElement }) => { const canvas = within(canvasElement); await expect(canvas.getByRole('combobox', { name: 'Permission mode' })).toBeDisabled(); await expect(canvas.getByRole('button', { name: 'Model: GPT-5.4' })).toBeDisabled() } }
export const ViewOnly: Story = { args: { mode: 'view-only', ownerName: 'Gorka', value: 'A draft cannot be sent with view permission.' }, play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await expect(canvas.getByRole('textbox')).toBeDisabled(); await expect(canvas.getByRole('button', { name: 'Send' })).toBeDisabled(); await expect(canvas.getByRole('combobox')).toBeDisabled(); await expect(args.onSend).not.toHaveBeenCalled() } }
export const WithAttachments: Story = { args: { attachments: <Badge>WorkspaceSharing.tsx</Badge>, value: 'Review this change.' } }
export const Running: Story = { args: { running: true }, play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: 'Stop' })); await expect(args.onStop).toHaveBeenCalledOnce() } }
export const ViewOnlyRunning: Story = { args: { running: true, mode: 'view-only' }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole('button', { name: 'Stop' })).toBeDisabled() } }
export const Disabled: Story = { args: { disabled: true } }
export const CustomPlaceholder: Story = { args: { placeholder: 'Describe the expected reconnect behavior…' } }


export const TerminalComposer: Story = { args: { appearance: 'terminal', textareaProps: { 'data-testid': 'chat-input' }, footer: <div className="border-t border-dashed border-border-subtle p-2"><Button type="submit" variant="bracket" size="sm">Send</Button></div> }, play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await userEvent.type(canvas.getByTestId('chat-input'), 'Review the session.'); await userEvent.click(canvas.getByRole('button', { name: 'Send' })); await expect(args.onSend).toHaveBeenCalledOnce() } }

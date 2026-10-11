import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApprovalCard } from './index'
import { expect, userEvent, within, fn } from 'storybook/test'

const meta = { title: 'Patterns/ApprovalCard', component: ApprovalCard, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { kind: 'command', reason: 'Codex needs to run the workspace unit tests to verify the reconnect fix.', command: 'pnpm --filter @koda/desktop test -- WorkspaceSharing', path: '/workspaces/koda', onApprove: fn(), onDeny: fn() },  } satisfies Meta<typeof ApprovalCard>
export default meta
type Story = StoryObj<typeof meta>
export const CommandRequest: Story = { play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: 'Approve once' })); await expect(args.onApprove).toHaveBeenCalledOnce() } }
export const FileRequest: Story = { args: { kind: 'file', reason: 'Codex wants to update the workspace sharing documentation.', command: undefined, path: '/workspaces/koda/DESIGN.md' } }
export const NetworkRequest: Story = { args: { kind: 'network', reason: 'Codex needs to fetch the official package metadata.', command: undefined, path: undefined, network: 'https://registry.npmjs.org' } }
export const ReadOnly: Story = { args: { state: 'read-only', hostName: 'Gorka' }, play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await expect(canvas.getByRole('button', { name: 'Approve once' })).toBeDisabled(); await expect(canvas.getByRole('button', { name: 'Deny' })).toBeDisabled(); await expect(args.onApprove).not.toHaveBeenCalled() } }
export const CollaboratorWithControl: Story = { args: { hostName: 'Gorka' } }
export const Resolved: Story = { args: { state: 'resolved', resolution: 'Approved once by Gorka' } }
export const Withdrawn: Story = { args: { state: 'withdrawn' } }
export const Sending: Story = { args: { busy: true } }
export const ResponseError: Story = { args: { error: 'The host is unreachable. Reconnect before answering.' } }
export const RequestDetails: Story = { args: { details: '{ "tool": "exec_command", "command": "pnpm test", "cwd": "/workspaces/koda" }' } }
export const Deny: Story = { play: async ({ canvasElement, args }) => { await userEvent.click(within(canvasElement).getByRole('button', { name: 'Deny' })); await expect(args.onDeny).toHaveBeenCalledOnce() } }


export const FileChanges: Story = { args: { kind: 'file', command: undefined, path: undefined, reason: 'Codex wants to apply the reconnect fix and its regression test.', files: [{ path: 'src/components/WorkspaceSharing.tsx', kind: 'Update' }, { path: 'src/__tests__/WorkspaceSharing.test.tsx', kind: 'Update' }] } }

export const TerminalRequest: Story = { args: { appearance: 'terminal', 'aria-label': 'Permission request: command_execution' }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole('region', { name: 'Permission request: command_execution' })).toBeVisible() } }

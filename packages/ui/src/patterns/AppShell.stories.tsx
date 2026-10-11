import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppShell } from './index'
import { NavItem, PanelHeader } from '../brand'
import { SharedBadge, TerminalFrame } from './index'

const meta = { title: 'Patterns/AppShell', component: AppShell, tags: ['autodocs'],  args: { sidebar: <><PanelHeader title="Workspaces" count={2} /><NavItem label="koda" active /><NavItem label="Personal notes" /></>, topbar: <div className="flex justify-between text-xs"><span>koda / Fix reconnect handling</span><SharedBadge hostName="Gorka" permission="control" /></div>, main: <div className="space-y-4 p-6"><h1 className="text-lg">Workspace content</h1><p className="text-sm text-text-secondary">The desktop composes chat, approvals and the composer in this slot.</p></div>, rightPanel: <><PanelHeader title="Changes" count={2} /><NavItem label="WorkspaceSharing.tsx" /><NavItem label="collaboration.test.ts" /></> }, parameters: { layout: 'fullscreen' },  } satisfies Meta<typeof AppShell>
export default meta
type Story = StoryObj<typeof meta>
export const Workspace: Story = {}
export const WithoutRightPanel: Story = { args: { rightPanel: undefined } }
export const WithTerminal: Story = { args: { bottomPanel: <TerminalFrame title="Terminal">$ pnpm test</TerminalFrame> } }
export const Minimal: Story = { args: { sidebar: undefined, topbar: undefined, rightPanel: undefined } }


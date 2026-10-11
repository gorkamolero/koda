import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tree } from './index'
import { expect, userEvent, within, fn } from 'storybook/test'

const meta = { title: 'Brand/Tree', component: Tree, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { label: 'Workspace files', items: [{ id: 'src', label: 'src', children: [{ id: 'app', label: 'App.tsx' }, { id: 'index', label: 'index.ts' }] }, { id: 'readme', label: 'README.md' }, { id: 'lock', label: 'pnpm-lock.yaml', disabled: true }], onSelect: fn() },  } satisfies Meta<typeof Tree>
export default meta
type Story = StoryObj<typeof meta>
export const Collapsed: Story = {}
export const Expanded: Story = { args: { defaultExpandedIds: ['src'], selectedId: 'app' } }
export const DisabledItem: Story = { play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole('treeitem', { name: 'pnpm-lock.yaml' })).toHaveAttribute('aria-disabled', 'true') } }
export const Empty: Story = { args: { items: [] } }
export const KeyboardNavigation: Story = { play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); const root = canvas.getByRole('treeitem', { name: 'src' }); root.focus(); await userEvent.keyboard('{ArrowRight}'); await expect(root).toHaveAttribute('aria-expanded', 'true'); await userEvent.keyboard('{ArrowRight}'); await expect(canvas.getByRole('treeitem', { name: 'App.tsx' })).toHaveFocus(); await userEvent.keyboard('{ArrowDown}{Enter}'); await expect(args.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'index' })); await userEvent.keyboard('{ArrowLeft}'); await expect(root).toHaveFocus(); await userEvent.keyboard('{End}'); await expect(canvas.getByRole('treeitem', { name: 'README.md' })).toHaveFocus(); await userEvent.keyboard('{Home}'); await expect(root).toHaveFocus() } }


export const DisabledAncestorNavigation: Story = { args: { items: [{ id: 'disabled', label: 'Generated files', disabled: true, children: [{ id: 'child', label: 'types.ts' }] }, { id: 'readme', label: 'README.md' }], defaultExpandedIds: ['disabled'] }, play: async ({ canvasElement }) => { const canvas = within(canvasElement); const child = canvas.getByRole('treeitem', { name: 'types.ts' }); child.focus(); await userEvent.keyboard('{ArrowLeft}'); await expect(child).toHaveFocus(); await userEvent.keyboard('{ArrowDown}'); await expect(canvas.getByRole('treeitem', { name: 'README.md' })).toHaveFocus() } }

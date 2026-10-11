import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tree } from './index'
import { Input } from '../primitives'
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

/** The application supplies fetched children; Tree only signals the expansion intent. */
export const ControlledLazyChildren: Story = {
  render: function LazyTree(args) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [loaded, setLoaded] = useState(false)
    return <Tree {...args} items={[{ id: 'source', label: 'src', children: loaded ? [{ id: 'lazy-file', label: 'loaded.ts' }] : [] }]} expandedIds={expanded}
      onExpandedChange={(item, open) => { setExpanded(open ? new Set([item.id]) : new Set()); if (open) setLoaded(true) }}
      rowProps={item => ({ 'data-testid': `tree-row-${item.id}` })} />
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Expand' }))
    await expect(canvas.getByTestId('tree-row-source')).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(canvas.getByTestId('tree-row-lazy-file'))
    await expect(args.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'lazy-file' }))
    await userEvent.keyboard('{ArrowLeft}{Enter}')
    await expect(canvas.getByTestId('tree-row-source')).toHaveAttribute('aria-expanded', 'false')
  },
}

export const VirtualKeyboardNavigation: Story = {
  render: function VirtualTree(args) {
    const [start, setStart] = useState(0)
    const items = Array.from({ length: 100 }, (_, index) => ({ id: `file-${index}`, label: `file-${index}.ts` }))
    return <Tree {...args} items={items} className="h-32 overflow-auto" virtual={{ totalSize: 2800, rows: items.slice(start, start + 4).map((item, offset) => ({ index: start + offset, key: item.id, start: (start + offset) * 28 })), scrollToIndex: index => setStart(Math.max(0, index - 1)) }} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('treeitem', { name: 'file-0.ts' }).focus()
    await userEvent.keyboard('{End}')
    await expect(canvas.getByRole('treeitem', { name: 'file-99.ts' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    await expect(canvas.getByRole('treeitem', { name: 'file-0.ts' })).toHaveFocus()
  },
}

export const PreservesComposerFocus: Story = {
  render: function ComposerAndTree(args) {
    const [draft, setDraft] = useState('')
    return <><Input aria-label="Draft message" autoFocus value={draft} onChange={event => setDraft(event.target.value)} /><Tree {...args} selectedId="readme" virtual={{ totalSize: 84, rows: args.items.map((item, index) => ({ index, key: item.id, start: index * 28 })) }} /></>
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const composer = canvas.getByRole('textbox', { name: 'Draft message' })
    await expect(composer).toHaveFocus()
    await userEvent.type(composer, 'Keep this draft')
    await expect(composer).toHaveFocus()
    await expect(composer).toHaveValue('Keep this draft')
    canvas.getByRole('treeitem', { name: 'src' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('treeitem', { name: 'README.md' })).toHaveFocus()
    await userEvent.click(composer)
    await userEvent.type(composer, ' while files update')
    await expect(composer).toHaveFocus()
    await expect(composer).toHaveValue('Keep this draft while files update')
  },
}

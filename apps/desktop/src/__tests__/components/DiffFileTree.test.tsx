import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { FileTree } from '@/components/DiffView/FileTree'
import { diffFilesAtom, selectedFileIdAtom, type DiffFile } from '@/store/diff'

// jsdom has no layout; supply visible rows while exercising the real Tree and
// diff selection atoms used by the displayed file.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 32 })),
    getTotalSize: () => count * 32,
    getOffsetForIndex: () => [0, 0],
    scrollToOffset: vi.fn(),
    measureElement: vi.fn(),
  }),
}))

describe('Diff file tree keyboard selection', () => {
  it('changes the displayed diff with arrow keys while moving tree focus', () => {
    const store = createStore()
    const files: DiffFile[] = ['first.ts', 'second.ts'].map(path => ({ id: path, path, filename: path, status: 'modified', additions: 1, deletions: 0 }))
    store.set(diffFilesAtom, files)
    store.set(selectedFileIdAtom, 'first.ts')
    render(<Provider store={store}><FileTree /></Provider>)
    const first = screen.getByRole('treeitem', { name: 'first.ts' })
    const second = screen.getByRole('treeitem', { name: 'second.ts' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(store.get(selectedFileIdAtom)).toBe('second.ts')
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(second).toHaveFocus()
    fireEvent.keyDown(second, { key: 'ArrowUp' })
    expect(store.get(selectedFileIdAtom)).toBe('first.ts')
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'ArrowUp' })
    expect(store.get(selectedFileIdAtom)).toBe('first.ts')
  })

  it('keeps diff shortcuts from also invoking filename typeahead', () => {
    const store = createStore()
    const files: DiffFile[] = ['alpha.ts', 'beta.ts', 'jazz.ts'].map(path => ({ id: path, path, filename: path, status: 'modified', additions: 1, deletions: 0 }))
    store.set(diffFilesAtom, files)
    store.set(selectedFileIdAtom, 'alpha.ts')
    render(<Provider store={store}><FileTree /></Provider>)
    const first = screen.getByRole('treeitem', { name: 'alpha.ts' })
    first.focus()
    fireEvent.keyDown(first, { key: 'j' })
    expect(store.get(selectedFileIdAtom)).toBe('beta.ts')
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'k' })
    expect(store.get(selectedFileIdAtom)).toBe('alpha.ts')
    expect(first).toHaveFocus()
  })
})

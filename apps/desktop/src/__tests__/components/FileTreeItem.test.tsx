import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { FileTreeItem } from '@/components/FileExplorer/FileTreeItem'
import { selectedPathAtom, type FlattenedEntry } from '@/store/fileExplorer'

const createMockEntry = (
  overrides: Partial<FlattenedEntry> = {}
): FlattenedEntry => ({
  name: 'test-file.ts',
  path: '/root/test-file.ts',
  type: 'file',
  depth: 0,
  parentPath: null,
  ...overrides,
})

describe('FileTreeItem', () => {
  let store: ReturnType<typeof createStore>
  let onSelect: ReturnType<typeof vi.fn>
  let onOpen: ReturnType<typeof vi.fn>
  let onExpand: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = createStore()
    onSelect = vi.fn()
    onOpen = vi.fn()
    onExpand = vi.fn()
  })

  const renderWithStore = (entry: FlattenedEntry) => {
    return render(
      <Provider store={store}>
        <FileTreeItem
          entry={entry}
          onSelect={onSelect}
          onOpen={onOpen}
          onExpand={onExpand}
        />
      </Provider>
    )
  }

  describe('file behavior', () => {
    it('should render file name', () => {
      const entry = createMockEntry({ name: 'index.ts' })
      renderWithStore(entry)

      expect(screen.getByText('index.ts')).toBeInTheDocument()
    })

    it('should call onSelect and onOpen when file is clicked', () => {
      const entry = createMockEntry({ type: 'file' })
      renderWithStore(entry)

      fireEvent.click(screen.getByRole('treeitem'))

      expect(onSelect).toHaveBeenCalledWith(entry)
      expect(onOpen).toHaveBeenCalledWith(entry)
    })

    it('should NOT call onExpand for files', () => {
      const entry = createMockEntry({ type: 'file' })
      renderWithStore(entry)

      fireEvent.click(screen.getByRole('treeitem'))

      expect(onExpand).not.toHaveBeenCalled()
    })
  })

  describe('directory behavior', () => {
    it('should render directory name', () => {
      const entry = createMockEntry({
        name: 'src',
        type: 'directory',
        path: '/root/src',
      })
      renderWithStore(entry)

      expect(screen.getByText('src')).toBeInTheDocument()
    })

    it('should call onExpand when collapsed directory is clicked', () => {
      const entry = createMockEntry({
        name: 'src',
        type: 'directory',
        path: '/root/src',
        isExpanded: false,
      })
      renderWithStore(entry)

      fireEvent.click(screen.getByRole('treeitem'))

      expect(onExpand).toHaveBeenCalledWith(entry)
    })

    it('should NOT call onExpand when expanded directory is clicked', () => {
      const entry = createMockEntry({
        name: 'src',
        type: 'directory',
        path: '/root/src',
        isExpanded: true,
      })
      renderWithStore(entry)

      fireEvent.click(screen.getByRole('treeitem'))

      expect(onExpand).not.toHaveBeenCalled()
    })

    it('should NOT call onOpen for directories', () => {
      const entry = createMockEntry({
        name: 'src',
        type: 'directory',
        path: '/root/src',
      })
      renderWithStore(entry)

      fireEvent.click(screen.getByRole('treeitem'))

      expect(onOpen).not.toHaveBeenCalled()
    })

    it('should have expand button for directories', () => {
      const entry = createMockEntry({
        name: 'src',
        type: 'directory',
        path: '/root/src',
      })
      renderWithStore(entry)

      expect(screen.getByTestId('expand-button')).toBeInTheDocument()
    })

    it('should call onExpand when expand button is clicked on collapsed directory', () => {
      const entry = createMockEntry({
        name: 'src',
        type: 'directory',
        path: '/root/src',
        isExpanded: false,
      })
      renderWithStore(entry)

      fireEvent.click(screen.getByTestId('expand-button'))

      expect(onExpand).toHaveBeenCalledWith(entry)
    })
  })

  describe('keyboard navigation', () => {
    it('should toggle expansion on Enter for directories', () => {
      const entry = createMockEntry({
        name: 'src',
        type: 'directory',
        path: '/root/src',
        isExpanded: false,
      })
      renderWithStore(entry)

      fireEvent.keyDown(screen.getByRole('treeitem'), { key: 'Enter' })

      expect(onExpand).toHaveBeenCalledWith(entry)
    })

    it('should open file on Enter', () => {
      const entry = createMockEntry({ type: 'file' })
      renderWithStore(entry)

      fireEvent.keyDown(screen.getByRole('treeitem'), { key: 'Enter' })

      expect(onOpen).toHaveBeenCalledWith(entry)
    })

    it('should expand on ArrowRight for collapsed directory', () => {
      const entry = createMockEntry({
        name: 'src',
        type: 'directory',
        path: '/root/src',
        isExpanded: false,
      })
      renderWithStore(entry)

      fireEvent.keyDown(screen.getByRole('treeitem'), { key: 'ArrowRight' })

      expect(onExpand).toHaveBeenCalledWith(entry)
    })

    it('should NOT call onExpand on ArrowRight for already expanded directory', () => {
      const entry = createMockEntry({
        name: 'src',
        type: 'directory',
        path: '/root/src',
        isExpanded: true,
      })
      renderWithStore(entry)

      fireEvent.keyDown(screen.getByRole('treeitem'), { key: 'ArrowRight' })

      expect(onExpand).not.toHaveBeenCalled()
    })
  })

  describe('selection state', () => {
    it('should show selected state when path matches', () => {
      const entry = createMockEntry({ path: '/root/test.ts' })
      store.set(selectedPathAtom, '/root/test.ts')
      renderWithStore(entry)

      expect(screen.getByRole('treeitem')).toHaveAttribute(
        'data-selected',
        'true'
      )
    })

    it('should not show selected state when path does not match', () => {
      const entry = createMockEntry({ path: '/root/test.ts' })
      store.set(selectedPathAtom, '/root/other.ts')
      renderWithStore(entry)

      expect(screen.getByRole('treeitem')).toHaveAttribute(
        'data-selected',
        'false'
      )
    })
  })

  describe('indentation', () => {
    it('should indent based on depth', () => {
      const entry = createMockEntry({ depth: 2 })
      renderWithStore(entry)

      const item = screen.getByRole('treeitem')
      // Tree retains the two indentation steps using the shared spacing tokens.
      expect(item).toHaveStyle({ paddingLeft: 'calc(var(--space-2) + 2 * var(--space-4))' })
    })
  })
})

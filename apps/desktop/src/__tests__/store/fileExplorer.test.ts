import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import {
  flattenFileTree,
  collectAllFiles,
  fuzzyMatch,
  fileTreeAtom,
  expandedPathsAtom,
  flattenedTreeAtom,
  toggleExpandedAtom,
  setDirectoryChildrenAtom,
  type FileEntry,
} from '@/store/fileExplorer'

describe('fileExplorer store', () => {
  describe('flattenFileTree', () => {
    it('should flatten a simple tree', () => {
      const tree: FileEntry[] = [
        { name: 'file1.ts', path: '/root/file1.ts', type: 'file' },
        { name: 'file2.ts', path: '/root/file2.ts', type: 'file' },
      ]

      const result = flattenFileTree(tree)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        name: 'file1.ts',
        depth: 0,
        parentPath: null,
      })
    })

    it('should include expanded directory children', () => {
      const tree: FileEntry[] = [
        {
          name: 'src',
          path: '/root/src',
          type: 'directory',
          isExpanded: true,
          children: [
            { name: 'index.ts', path: '/root/src/index.ts', type: 'file' },
          ],
        },
      ]

      const result = flattenFileTree(tree)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ name: 'src', depth: 0 })
      expect(result[1]).toMatchObject({
        name: 'index.ts',
        depth: 1,
        parentPath: '/root/src',
      })
    })

    it('should NOT include collapsed directory children', () => {
      const tree: FileEntry[] = [
        {
          name: 'src',
          path: '/root/src',
          type: 'directory',
          isExpanded: false,
          children: [
            { name: 'index.ts', path: '/root/src/index.ts', type: 'file' },
          ],
        },
      ]

      const result = flattenFileTree(tree)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ name: 'src' })
    })

    it('should NOT include children when children is undefined (not loaded)', () => {
      const tree: FileEntry[] = [
        {
          name: 'src',
          path: '/root/src',
          type: 'directory',
          isExpanded: true,
          children: undefined, // Not loaded yet
        },
      ]

      const result = flattenFileTree(tree)

      expect(result).toHaveLength(1)
    })

    it('should handle deeply nested structures', () => {
      const tree: FileEntry[] = [
        {
          name: 'src',
          path: '/root/src',
          type: 'directory',
          isExpanded: true,
          children: [
            {
              name: 'components',
              path: '/root/src/components',
              type: 'directory',
              isExpanded: true,
              children: [
                {
                  name: 'Button.tsx',
                  path: '/root/src/components/Button.tsx',
                  type: 'file',
                },
              ],
            },
          ],
        },
      ]

      const result = flattenFileTree(tree)

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({ name: 'src', depth: 0 })
      expect(result[1]).toMatchObject({ name: 'components', depth: 1 })
      expect(result[2]).toMatchObject({ name: 'Button.tsx', depth: 2 })
    })
  })

  describe('collectAllFiles', () => {
    it('should collect all files from tree', () => {
      const tree: FileEntry[] = [
        { name: 'file1.ts', path: '/root/file1.ts', type: 'file' },
        {
          name: 'src',
          path: '/root/src',
          type: 'directory',
          children: [
            { name: 'index.ts', path: '/root/src/index.ts', type: 'file' },
          ],
        },
      ]

      const result = collectAllFiles(tree)

      expect(result).toHaveLength(2)
      expect(result.map((f) => f.name)).toEqual(['file1.ts', 'index.ts'])
    })

    it('should not include directories', () => {
      const tree: FileEntry[] = [
        {
          name: 'src',
          path: '/root/src',
          type: 'directory',
          children: [],
        },
      ]

      const result = collectAllFiles(tree)

      expect(result).toHaveLength(0)
    })
  })

  describe('fuzzyMatch', () => {
    it('should match exact strings', () => {
      expect(fuzzyMatch('hello', 'hello')).toBe(true)
    })

    it('should match subsequences', () => {
      expect(fuzzyMatch('hlo', 'hello')).toBe(true)
      expect(fuzzyMatch('btn', 'Button')).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(fuzzyMatch('BTN', 'button')).toBe(true)
    })

    it('should not match when pattern is not a subsequence', () => {
      expect(fuzzyMatch('xyz', 'hello')).toBe(false)
    })

    it('should match empty pattern', () => {
      expect(fuzzyMatch('', 'hello')).toBe(true)
    })
  })

  describe('atoms', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
      store = createStore()
    })

    describe('toggleExpandedAtom', () => {
      it('should add path to expanded set', () => {
        store.set(toggleExpandedAtom, '/root/src')

        const expanded = store.get(expandedPathsAtom)
        expect(expanded.has('/root/src')).toBe(true)
      })

      it('should remove path from expanded set when toggled again', () => {
        store.set(toggleExpandedAtom, '/root/src')
        store.set(toggleExpandedAtom, '/root/src')

        const expanded = store.get(expandedPathsAtom)
        expect(expanded.has('/root/src')).toBe(false)
      })
    })

    describe('setDirectoryChildrenAtom', () => {
      it('should set children on a directory', () => {
        const tree: FileEntry[] = [
          { name: 'src', path: '/root/src', type: 'directory' },
        ]
        store.set(fileTreeAtom, tree)

        const children: FileEntry[] = [
          { name: 'index.ts', path: '/root/src/index.ts', type: 'file' },
        ]
        store.set(setDirectoryChildrenAtom, { path: '/root/src', children })

        const updatedTree = store.get(fileTreeAtom)
        expect(updatedTree[0]?.children).toEqual(children)
      })

      it('should set children on nested directories', () => {
        const tree: FileEntry[] = [
          {
            name: 'src',
            path: '/root/src',
            type: 'directory',
            children: [
              {
                name: 'components',
                path: '/root/src/components',
                type: 'directory',
              },
            ],
          },
        ]
        store.set(fileTreeAtom, tree)

        const children: FileEntry[] = [
          {
            name: 'Button.tsx',
            path: '/root/src/components/Button.tsx',
            type: 'file',
          },
        ]
        store.set(setDirectoryChildrenAtom, {
          path: '/root/src/components',
          children,
        })

        const updatedTree = store.get(fileTreeAtom)
        expect(updatedTree[0]?.children?.[0]?.children).toEqual(children)
      })
    })

    describe('flattenedTreeAtom', () => {
      it('should derive flattened tree from fileTree and expandedPaths', () => {
        const tree: FileEntry[] = [
          {
            name: 'src',
            path: '/root/src',
            type: 'directory',
            children: [
              { name: 'index.ts', path: '/root/src/index.ts', type: 'file' },
            ],
          },
        ]
        store.set(fileTreeAtom, tree)
        store.set(toggleExpandedAtom, '/root/src') // Expand

        const flattened = store.get(flattenedTreeAtom)

        expect(flattened).toHaveLength(2)
        expect(flattened[0]?.isExpanded).toBe(true)
        expect(flattened[1]?.name).toBe('index.ts')
      })

      it('should show only root when directory is collapsed', () => {
        const tree: FileEntry[] = [
          {
            name: 'src',
            path: '/root/src',
            type: 'directory',
            children: [
              { name: 'index.ts', path: '/root/src/index.ts', type: 'file' },
            ],
          },
        ]
        store.set(fileTreeAtom, tree)
        // Don't expand

        const flattened = store.get(flattenedTreeAtom)

        expect(flattened).toHaveLength(1)
        expect(flattened[0]?.isExpanded).toBe(false)
      })
    })
  })
})

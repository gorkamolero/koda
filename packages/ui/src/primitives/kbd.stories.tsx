import type { Meta, StoryObj } from '@storybook/react-vite'
import { Kbd } from './badge'
const meta = { title: 'Primitives/Kbd', component: Kbd, tags: ['autodocs'], args: { children: '[ESC]' } } satisfies Meta<typeof Kbd>
export default meta
type Story = StoryObj<typeof meta>
export const Escape: Story = {}
export const Shortcut: Story = { args: { children: '⌘K', 'aria-label': 'Command K' } }

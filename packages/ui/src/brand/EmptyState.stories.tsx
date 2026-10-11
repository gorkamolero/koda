import type { Meta, StoryObj } from '@storybook/react-vite'
import { EmptyState } from './index'
import { Folder } from 'lucide-react'
import { Button } from '../primitives'

const meta = { title: 'Brand/EmptyState', component: EmptyState, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { message: 'No workspace yet', description: 'Start a workspace to give Koda a place to work.' },  } satisfies Meta<typeof EmptyState>
export default meta
type Story = StoryObj<typeof meta>
export const Message: Story = {}
export const AsciiArt: Story = { args: { art: '┌──────────┐\n│ ~/koda   │\n└──────────┘' } }
export const WithIcon: Story = { args: { icon: <Folder className="size-4" /> } }
export const WithAction: Story = { args: { action: <Button variant="bracket">Create workspace</Button> } }


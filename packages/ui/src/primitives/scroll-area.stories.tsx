import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScrollArea } from './scroll-area'
const meta = { title: 'Primitives/ScrollArea', component: ScrollArea, tags: ['autodocs'], args: { className: 'h-48 w-80 border border-border-muted', children: <ul className="space-y-3 p-4 font-code text-sm text-text-primary">{Array.from({ length: 30 }, (_, index) => <li key={index}>Session {index + 1} · Improve workspace sharing</li>)}</ul> } } satisfies Meta<typeof ScrollArea>
export default meta
type Story = StoryObj<typeof meta>
export const Overflow: Story = {}
export const Fits: Story = { args: { children: <p className="p-4 font-code text-sm text-text-primary">No more sessions.</p> } }

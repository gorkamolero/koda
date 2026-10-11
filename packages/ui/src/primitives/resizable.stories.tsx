import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ResizablePanels, ResizablePanel, ResizableHandle } from './resizable'
const meta = { title: 'Primitives/ResizablePanels', component: ResizablePanels, subcomponents: { ResizablePanel, ResizableHandle }, tags: ['autodocs'], args: { direction: 'horizontal' }, render: args => <div className="h-64 w-full max-w-2xl border border-border-muted"><ResizablePanels {...args}><ResizablePanel defaultSize={30} minSize={20}><div className="p-4 text-sm">Files</div></ResizablePanel><ResizableHandle aria-label="Resize workspace panels" /><ResizablePanel minSize={20}><div className="p-4 text-sm">Editor · tokens.css</div></ResizablePanel></ResizablePanels></div> } satisfies Meta<typeof ResizablePanels>
export default meta
type Story = StoryObj<typeof meta>
export const Horizontal: Story = {}
export const Vertical: Story = { args: { direction: 'vertical' } }
export const Keyboard: Story = { play: async ({ canvasElement }) => { const handle = within(canvasElement).getByRole('separator'); const before = handle.getAttribute('aria-valuenow'); handle.focus(); await userEvent.keyboard('{ArrowRight}'); await expect(handle.getAttribute('aria-valuenow')).not.toBe(before) } }

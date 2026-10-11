import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
const meta = { title: 'Primitives/Tabs', component: Tabs, subcomponents: { TabsList, TabsTrigger, TabsContent }, tags: ['autodocs'], args: { defaultValue: 'files' }, render: args => <Tabs {...args}><TabsList aria-label="Workspace panels"><TabsTrigger value="files">Files</TabsTrigger><TabsTrigger value="changes">Changes · 3</TabsTrigger><TabsTrigger value="checks" disabled>Checks</TabsTrigger></TabsList><TabsContent value="files" className="p-4 font-code text-sm text-text-primary">src/components, README.md, package.json</TabsContent><TabsContent value="changes" className="p-4 font-code text-sm text-text-primary">3 files changed · +84 −12</TabsContent></Tabs> } satisfies Meta<typeof Tabs>
export default meta
type Story = StoryObj<typeof meta>
export const Panel: Story = {}
export const Underline: Story = { args: { variant: 'underline' } }
export const Keyboard: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); canvas.getByRole('tab', { name: 'Files' }).focus(); await userEvent.keyboard('{ArrowRight}'); await expect(canvas.getByRole('tab', { name: 'Changes · 3' })).toHaveAttribute('aria-selected', 'true'); await expect(canvas.getByRole('tabpanel')).toHaveTextContent('3 files changed') } }

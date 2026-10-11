import type { Meta, StoryObj } from '@storybook/react-vite'
import { Separator } from './separator'
const meta = { title: 'Primitives/Separator', component: Separator, tags: ['autodocs'], args: { decorative: false } } satisfies Meta<typeof Separator>
export default meta
type Story = StoryObj<typeof meta>
export const Horizontal: Story = { render: args => <div className="w-80 space-y-4 font-code text-sm text-text-primary"><p>Workspaces</p><Separator {...args} /><p>Archived sessions</p></div> }
export const Vertical: Story = { args: { orientation: 'vertical' }, render: args => <div className="flex h-8 items-center gap-4 font-code text-sm text-text-primary"><span>Editor</span><Separator {...args} /><span>Terminal</span></div> }

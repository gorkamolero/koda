import type { Meta, StoryObj } from '@storybook/react-vite'
import { Popover, PopoverTrigger, PopoverContent } from './popover'
import { Button } from './button'
import { Field, Input } from './input'
const meta = { title: 'Primitives/Popover', component: Popover, subcomponents: { PopoverContent, PopoverTrigger }, tags: ['autodocs'], render: args => <Popover {...args}><PopoverTrigger asChild><Button variant="bracket">Branch details</Button></PopoverTrigger><PopoverContent aria-label="Branch details"><Field label="Branch"><Input readOnly value="codex/design-system" /></Field></PopoverContent></Popover> } satisfies Meta<typeof Popover>
export default meta
type Story = StoryObj<typeof meta>
export const Closed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }

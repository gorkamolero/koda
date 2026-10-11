import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './tooltip'
import { Button } from './button'
const meta = { title: 'Primitives/Tooltip', component: Tooltip, subcomponents: { TooltipContent, TooltipTrigger }, tags: ['autodocs'], render: args => <TooltipProvider delayDuration={0}><Tooltip {...args}><TooltipTrigger asChild><Button variant="bracket">Review</Button></TooltipTrigger><TooltipContent>Review 3 changed files</TooltipContent></Tooltip></TooltipProvider> } satisfies Meta<typeof Tooltip>
export default meta
type Story = StoryObj<typeof meta>
export const Closed: Story = {}
export const Open: Story = { args: { open: true } }

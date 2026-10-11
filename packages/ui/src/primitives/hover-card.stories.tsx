import type { Meta, StoryObj } from '@storybook/react-vite'
import { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card'
const meta = { title: 'Primitives/HoverCard', component: HoverCard, subcomponents: { HoverCardContent, HoverCardTrigger }, tags: ['autodocs'], render: args => <HoverCard {...args}><HoverCardTrigger asChild><a href="#gorka" className="font-code text-sm text-text-primary underline focus-visible:ring-2 focus-visible:ring-focus">Gorka · host</a></HoverCardTrigger><HoverCardContent><p className="font-code text-sm text-text-primary">Gorka Molero</p><p className="mt-2 font-code text-xs text-text-secondary">Working on codex/design-system. Controls the agent and approval decisions.</p></HoverCardContent></HoverCard> } satisfies Meta<typeof HoverCard>
export default meta
type Story = StoryObj<typeof meta>
export const Closed: Story = {}
export const Open: Story = { args: { open: true } }

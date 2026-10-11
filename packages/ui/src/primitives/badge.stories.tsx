import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './badge'
const meta = { title: 'Primitives/Badge', component: Badge, tags: ['autodocs'], args: { children: 'CODEX' } } satisfies Meta<typeof Badge>
export default meta
type Story = StoryObj<typeof meta>
export const Neutral: Story = {}
export const Accent: Story = { args: { variant: 'accent' } }
export const Outline: Story = { args: { variant: 'outline' } }
export const Small: Story = { args: { size: 'sm' }, render: args => <div className="flex gap-3">{(['neutral', 'accent', 'outline'] as const).map(variant => <Badge key={variant} {...args} variant={variant} />)}</div> }
export const Medium: Story = { ...Small, args: { size: 'md' } }

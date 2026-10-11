import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar, AvatarImage, AvatarFallback } from './avatar'
const portrait = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Ctext y="60" font-size="64"%3E🧑%3C/text%3E%3C/svg%3E'
const meta = { title: 'Primitives/Avatar', component: Avatar, subcomponents: { AvatarImage, AvatarFallback }, tags: ['autodocs'], render: args => <Avatar {...args}><AvatarImage src={portrait} alt="Gorka Molero" /><AvatarFallback>GM</AvatarFallback></Avatar> } satisfies Meta<typeof Avatar>
export default meta
type Story = StoryObj<typeof meta>
export const Image: Story = {}
export const Fallback: Story = { render: args => <Avatar {...args}><AvatarFallback role="img" aria-label="Gorka Molero">GM</AvatarFallback></Avatar> }

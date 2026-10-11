import type { Meta, StoryObj } from '@storybook/react-vite'
import { ButtonGroup } from './button-group'
import { Button } from './button'
const meta = { title: 'Primitives/ButtonGroup', component: ButtonGroup, tags: ['autodocs'], args: { 'aria-label': 'Workspace actions', children: <><Button variant="outline">Open</Button><Button variant="outline">Share</Button><Button variant="outline" disabled>Archive</Button></> } } satisfies Meta<typeof ButtonGroup>
export default meta
type Story = StoryObj<typeof meta>
export const Horizontal: Story = {}
export const Vertical: Story = { args: { orientation: 'vertical' } }

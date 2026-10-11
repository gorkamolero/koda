import type { Meta, StoryObj } from '@storybook/react-vite'
import { Panel } from './index'
import { Button } from '../primitives'
import { NavItem } from './index'

const meta = { title: 'Brand/Panel', component: Panel, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { title: 'Sessions', count: 3, children: <><NavItem label="Fix reconnect handling" active /><NavItem label="Review authentication" unread /><NavItem label="Document workspace sharing" /></> },  } satisfies Meta<typeof Panel>
export default meta
type Story = StoryObj<typeof meta>
export const Sidebar: Story = {}
export const RightPanel: Story = { args: { variant: 'right', title: 'Changed files', count: 2 } }
export const WithActions: Story = { args: { actions: <Button size="sm" variant="bracket">New</Button> } }


import type { Meta, StoryObj } from '@storybook/react-vite'
import { PanelHeader } from './index'
import { Button } from '../primitives'

const meta = { title: 'Brand/PanelHeader', component: PanelHeader, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { title: 'Changed files', count: 4 },  } satisfies Meta<typeof PanelHeader>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const WithActions: Story = { args: { actions: <Button size="sm" variant="bracket">Refresh</Button> } }
export const WithoutCount: Story = { args: { count: undefined } }


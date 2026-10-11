import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Share2 } from 'lucide-react'
import { IconButton } from './button'
const meta = { title: 'Primitives/IconButton', component: IconButton, tags: ['autodocs'], args: { 'aria-label': 'Share workspace', children: <Share2 /> } } satisfies Meta<typeof IconButton>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const WithTooltip: Story = { args: { tooltip: 'Share workspace' } }
export const Disabled: Story = { args: { disabled: true } }
export const Loading: Story = { args: { loading: true } }

export const TooltipVisible: Story = {
  args: { tooltip: 'Share workspace' },
  play: async ({ canvasElement }) => {
    await userEvent.tab()
    await expect(within(canvasElement).getByRole('button', { name: 'Share workspace' })).toHaveFocus()
    await expect(await within(canvasElement.ownerDocument.body).findByRole('tooltip')).toHaveTextContent('Share workspace')
  },
}

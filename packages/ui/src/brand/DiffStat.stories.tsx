import type { Meta, StoryObj } from '@storybook/react-vite'
import { DiffStat } from './index'
import { expect, within } from 'storybook/test'


const meta = { title: 'Brand/DiffStat', component: DiffStat, tags: ['autodocs'], parameters: { layout: 'padded' }, args: { additions: 12, deletions: 3, showBar: true },  } satisfies Meta<typeof DiffStat>
export default meta
type Story = StoryObj<typeof meta>
export const Mixed: Story = {}
export const OnlyAdditions: Story = { args: { additions: 42, deletions: 0 } }
export const OnlyDeletions: Story = { args: { additions: 0, deletions: 8 } }
export const Unchanged: Story = { args: { additions: 0, deletions: 0 } }
export const CountsOnly: Story = { args: { showBar: false } }


export const HideZeroCounts: Story = {
  args: { additions: 3, deletions: 0, showBar: false, hideZero: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: '3 additions, 0 deletions' })).toBeVisible()
    await expect(canvas.getByText('+3')).toBeVisible()
    await expect(canvas.queryByText('−0')).not.toBeInTheDocument()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { WorkspaceDemo } from './workspace-demo'

const meta = { title: 'App screens', component: WorkspaceDemo, tags: ['autodocs'], parameters: { layout: 'fullscreen' } } satisfies Meta<typeof WorkspaceDemo>
export default meta
type Story = StoryObj<typeof meta>
export const HostWorkspace: Story = {
  args: { collaborator: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: 'Message' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Approve once' })).toBeEnabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Approve once' }))
    await expect(canvas.getByText('[RESOLVED] Approved once')).toBeVisible()
  },
}
export const CollaboratorWorkspace: Story = {
  args: { collaborator: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Approve once' })).toBeDisabled()
    await expect(canvas.getByTestId('shared-workspace-badge')).toHaveAttribute('data-permission', 'view')
    await expect(canvas.getByText('field-notes')).toBeVisible()
    await expect(canvas.getByText('· read-only mirror')).toBeVisible()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { Callout } from './feedback'
const meta = { title: 'Primitives/Callout', component: Callout, tags: ['autodocs'], args: { children: 'Secret answers stay on the host. They are never shared with collaborators.' } } satisfies Meta<typeof Callout>
export default meta
type Story = StoryObj<typeof meta>
export const Info: Story = {}
export const Warning: Story = { args: { tone: 'warning', title: 'Host unreachable', children: 'Waiting for Gorka to reconnect.' } }
export const Error: Story = { args: { tone: 'error', title: 'Could not create invitation', children: 'Try sharing the workspace again.' } }
export const ViewOnly: Story = { args: { tone: 'view-only', children: 'You can follow this session. Only Gorka can approve tool requests.' } }

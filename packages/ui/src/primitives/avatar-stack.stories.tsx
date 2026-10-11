import type { Meta, StoryObj } from '@storybook/react-vite'
import { AvatarStack } from './avatar'
const meta = { title: 'Primitives/AvatarStack', component: AvatarStack, tags: ['autodocs'], args: { people: [{ id: 'gorka', name: 'Gorka Molero', status: 'ready' }, { id: 'maya', name: 'Maya Chen', status: 'processing' }, { id: 'jules', name: 'Jules Rivera', status: 'reviewing' }, { id: 'sam', name: 'Sam Kim', status: 'unknown' }] } } satisfies Meta<typeof AvatarStack>
export default meta
type Story = StoryObj<typeof meta>
export const Small: Story = {}
export const Medium: Story = { args: { size: 'md' } }
export const NoOverflow: Story = { args: { maxVisible: 4 } }
export const Empty: Story = { args: { people: [] } }

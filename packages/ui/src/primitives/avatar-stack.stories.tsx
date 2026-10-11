import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AvatarStack } from './avatar'
const meta = { title: 'Primitives/AvatarStack', component: AvatarStack, tags: ['autodocs'], args: { people: [{ id: 'gorka', name: 'Gorka Molero', status: 'ready' }, { id: 'maya', name: 'Maya Chen', status: 'processing' }, { id: 'jules', name: 'Jules Rivera', status: 'reviewing' }, { id: 'sam', name: 'Sam Kim', status: 'unknown' }] } } satisfies Meta<typeof AvatarStack>
export default meta
type Story = StoryObj<typeof meta>
export const Small: Story = {}
export const Medium: Story = { args: { size: 'md' } }
export const NoOverflow: Story = { args: { maxVisible: 4 } }
export const Empty: Story = { args: { people: [] } }

export const IdentityColors: Story = {
  args: {
    maxVisible: 6,
    size: 'md',
    people: [
      { id: 'gorka', name: 'Gorka Molero', tone: 'blue', status: 'ready' },
      { id: 'maya', name: 'Maya Chen', tone: 'green', status: 'ready' },
      { id: 'jules', name: 'Jules Rivera', tone: 'amber', status: 'ready' },
      { id: 'sam', name: 'Sam Kim', tone: 'rose', status: 'ready' },
      { id: 'ana', name: 'Ana Costa', tone: 'cyan', status: 'ready' },
      { id: 'leo', name: 'Leo Park', tone: 'terracotta', status: 'ready' },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const colors = args.people.map(person => getComputedStyle(canvas.getByRole('img', { name: person.name })).backgroundColor)
    await expect(new Set(colors).size).toBe(args.people.length)
    await expect(canvas.getAllByRole('img', { name: /: ready$/ })).toHaveLength(args.people.length)
  },
}

export const CompactPresence: Story = { args: { compact: true, people: [{ id: 'host', name: 'Host', tone: 'presence-blue' }, { id: 'peer', name: 'Peer', tone: 'presence-green' }] } }

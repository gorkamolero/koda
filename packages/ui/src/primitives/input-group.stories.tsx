import type { Meta, StoryObj } from '@storybook/react-vite'
import { Search } from 'lucide-react'
import { InputGroup, Input } from './input'
import { Kbd } from './badge'
const meta = { title: 'Primitives/InputGroup', component: InputGroup, tags: ['autodocs'], args: { leading: <Search aria-hidden="true" className="size-4" />, children: <Input aria-label="Search files" placeholder="Search files…" /> } } satisfies Meta<typeof InputGroup>
export default meta
type Story = StoryObj<typeof meta>
export const Leading: Story = {}
export const Trailing: Story = { args: { leading: undefined, trailing: <Kbd>⌘K</Kbd> } }
export const Both: Story = { args: { trailing: <Kbd>⌘K</Kbd> } }
export const Invalid: Story = { args: { children: <Input aria-label="Search files" aria-invalid defaultValue="Unknown file" /> } }
export const Disabled: Story = { args: { children: <Input aria-label="Search files" disabled placeholder="Host only" /> } }

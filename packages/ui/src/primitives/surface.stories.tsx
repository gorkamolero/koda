import type { Meta, StoryObj } from '@storybook/react-vite'
import { Surface, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card'
import { Button } from './button'
const meta = { title: 'Primitives/Surface', component: Surface, subcomponents: { CardHeader, CardTitle, CardDescription, CardContent, CardFooter }, tags: ['autodocs'], args: { className: 'w-80', children: <CardContent>Codex is ready to work on your repository.</CardContent> } } satisfies Meta<typeof Surface>
export default meta
type Story = StoryObj<typeof meta>
export const Plain: Story = {}
export const Strong: Story = { args: { variant: 'strong' } }
export const Muted: Story = { args: { variant: 'muted' } }
export const Approval: Story = { args: { variant: 'approval' } }
export const WithHeaderAndFooter: Story = { args: { header: <h3 className="font-semibold">design-system</h3>, footer: <Button variant="bracket" size="sm">Open workspace</Button> } }

import type { Meta, StoryObj } from '@storybook/react-vite'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion'
const meta = { title: 'Primitives/Accordion', component: Accordion, subcomponents: { AccordionItem, AccordionTrigger, AccordionContent }, tags: ['autodocs'], args: { type: 'single', collapsible: true }, render: args => <Accordion {...args} className="w-80"><AccordionItem value="permissions"><AccordionTrigger>Permission settings</AccordionTrigger><AccordionContent>Ask before running commands or accessing the network.</AccordionContent></AccordionItem><AccordionItem value="sharing"><AccordionTrigger>Sharing settings</AccordionTrigger><AccordionContent>View collaborators can follow the session without sending messages.</AccordionContent></AccordionItem><AccordionItem value="advanced" disabled><AccordionTrigger>Advanced · unavailable</AccordionTrigger><AccordionContent>Unavailable.</AccordionContent></AccordionItem></Accordion> } satisfies Meta<typeof Accordion>
export default meta
type Story = StoryObj<typeof meta>
export const Collapsed: Story = {}
export const Expanded: Story = { args: { defaultValue: 'permissions' } }
export const Multiple: Story = { args: { type: 'multiple', defaultValue: ['permissions', 'sharing'] } }

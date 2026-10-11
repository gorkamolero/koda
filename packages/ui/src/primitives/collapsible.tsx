"use client"

import type * as React from "react"
import { cn } from "./utils"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

function CollapsibleTrigger(props: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) { return <CollapsiblePrimitive.CollapsibleTrigger {...props} className={cn("font-code focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus", props.className)} /> }

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }

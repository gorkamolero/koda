import{j as e}from"./iframe-DE7TzujU.js";import{u as o,M as r}from"./blocks-B_Rcs1An.js";import"./preload-helper-D6W3bvzQ.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";function t(s){const n={code:"code",h1:"h1",h2:"h2",p:"p",pre:"pre",strong:"strong",...o(),...s.components};return e.jsxs(e.Fragment,{children:[e.jsx(r,{title:"Introduction"}),`
`,e.jsx(n.h1,{id:"koda",children:"Koda"}),`
`,e.jsx(n.p,{children:"The review-first, collaborative agent IDE. Run Codex or Claude in an isolated worktree, review the change, and share the same session with a teammate."}),`
`,e.jsx(n.h2,{id:"a-terminal-with-room-to-think",children:"A terminal, with room to think"}),`
`,e.jsxs(n.p,{children:["Koda's interface uses mono-first type, quiet surfaces, a warm accent, the ASCII KODA mark and ",e.jsx(n.code,{children:"[BRACKET]"})," actions. The design system codifies that interface in ",e.jsx(n.code,{children:"@koda/ui"}),"."]}),`
`,e.jsxs(n.p,{children:["Start with ",e.jsx(n.strong,{children:"Foundations"})," for the four themes and token scales. ",e.jsx(n.strong,{children:"Primitives"})," are the accessible controls. ",e.jsx(n.strong,{children:"Brand"})," contains Koda's distinctive marks and terminal framing. ",e.jsx(n.strong,{children:"Patterns"})," composes them into agent conversations and permission flows. ",e.jsx(n.strong,{children:"App screens"})," shows the host and collaborator looking at the same workspace."]}),`
`,e.jsx(n.h2,{id:"props-in-events-out",children:"Props in, events out"}),`
`,e.jsx(n.p,{children:"Components render supplied data and report interaction through callbacks. They have no sidecar, network, database or application-store dependency. Stories use realistic, local mock content. Secret answers are never requested on the collaborator's device."}),`
`,e.jsxs(n.p,{children:["Use the theme toolbar to switch between ",e.jsx(n.strong,{children:"Obsidian"}),", ",e.jsx(n.strong,{children:"Light"}),", ",e.jsx(n.strong,{children:"Dim"})," and ",e.jsx(n.strong,{children:"Graphite"}),". Each component's Docs page describes its props; Canvas shows states and interactions. The accessibility and Vitest panels run the same checks as the command line."]}),`
`,e.jsx(n.h2,{id:"package-usage",children:"Package usage"}),`
`,e.jsx(n.pre,{children:e.jsx(n.code,{className:"language-tsx",children:`import { Button, SharedBadge } from '@koda/ui'
import '@koda/ui/tokens.css'
import '@koda/ui/styles.css'

<Button variant="bracket" onClick={onShare}>Share</Button>
<SharedBadge hostName="Gorka" permission="view" />
`})}),`
`,e.jsx(n.p,{children:"Desktop composes these components throughout navigation, chat, workspace panels, settings and sharing. Data fetching, stores and permission checks remain in desktop. The duplicated primitives have been removed and token lint is enforced as an error."})]})}function l(s={}){const{wrapper:n}={...o(),...s.components};return n?e.jsx(n,{...s,children:e.jsx(t,{...s})}):t(s)}export{l as default};

import{j as n}from"./iframe-C30QeG3e.js";import{T as E}from"./index-j3SeIR8-.js";import{B as H}from"./button-Bwmd7Lx7.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-hftMsCUE.js";import"./index-Dgyi4PT8.js";import"./index-CsaGnVJ7.js";import"./createLucideIcon-DiERuOeT.js";import"./chevron-down-jjy896LW.js";import"./chevron-right-DkAA3o_8.js";import"./check-Drblxday.js";import"./x-CKH70IuT.js";import"./circle-CdA5RCPp.js";import"./select-IEJesnEj.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-BdQq_4o_.js";import"./index-DXdei5Yc.js";import"./index-BrwFzwur.js";import"./index-Bwn99cpp.js";import"./index-BhoyFe3d.js";import"./index-DfSbsrIq.js";import"./index-CBNOem9o.js";import"./index-BWdqTsTJ.js";import"./Combination-B4nG-NNF.js";import"./index-BdqpzMJG.js";import"./index-DEQL6lI-.js";import"./index-rWZk3uLI.js";import"./index-Cs7Omgh0.js";import"./command-CU-bzmEJ.js";import"./dialog-VgvBVMd7.js";import"./index-jxSttbKr.js";import"./index-C66jsOMg.js";import"./search-Cca7vlyw.js";const{expect:R,within:S}=__STORYBOOK_MODULE_TEST__,ce={title:"Patterns/TerminalFrame",component:E,tags:["autodocs"],parameters:{layout:"padded"},args:{title:"pnpm test",status:"ready",children:n.jsx("pre",{className:"whitespace-pre-wrap",children:`~/koda $ pnpm --filter @koda/desktop test
✓ WorkspaceSharing (18 tests)
Test Files  1 passed
Tests       18 passed`})}},e={args:{actions:n.jsx(H,{variant:"bracket",size:"sm",children:"Clear"})}},t={args:{readOnly:!0}},r={args:{status:"running",children:"$ pnpm test — running…"}},a={args:{status:"disconnected",readOnly:!0,children:"The host is unreachable. Last output is shown above."}},s={args:{className:"h-64",bodyClassName:"min-h-0 flex-1",children:n.jsx("pre",{"data-testid":"terminal-output",children:"$ pnpm test"})},play:async({canvasElement:O})=>{const o=S(O),f=o.getByRole("region",{name:"pnpm test"}),w=o.getByTestId("terminal-output").parentElement;await R(w.clientHeight).toBeGreaterThan(f.clientHeight/2)}},le=["Host","ReadOnlyMirror","Running","Disconnected","FillsAvailableHeight"];var i,p,m;e.parameters={...e.parameters,docs:{...(i=e.parameters)==null?void 0:i.docs,source:{originalSource:`{
  args: {
    actions: <Button variant="bracket" size="sm">Clear</Button>
  }
}`,...(m=(p=e.parameters)==null?void 0:p.docs)==null?void 0:m.source}}};var c,l,d;t.parameters={...t.parameters,docs:{...(c=t.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    readOnly: true
  }
}`,...(d=(l=t.parameters)==null?void 0:l.docs)==null?void 0:d.source}}};var u,g,h;r.parameters={...r.parameters,docs:{...(u=r.parameters)==null?void 0:u.docs,source:{originalSource:`{
  args: {
    status: 'running',
    children: '$ pnpm test — running…'
  }
}`,...(h=(g=r.parameters)==null?void 0:g.docs)==null?void 0:h.source}}};var y,T,b;a.parameters={...a.parameters,docs:{...(y=a.parameters)==null?void 0:y.docs,source:{originalSource:`{
  args: {
    status: 'disconnected',
    readOnly: true,
    children: 'The host is unreachable. Last output is shown above.'
  }
}`,...(b=(T=a.parameters)==null?void 0:T.docs)==null?void 0:b.source}}};var v,x,B;s.parameters={...s.parameters,docs:{...(v=s.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    className: 'h-64',
    bodyClassName: 'min-h-0 flex-1',
    children: <pre data-testid="terminal-output">$ pnpm test</pre>
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByRole('region', {
      name: 'pnpm test'
    });
    const body = canvas.getByTestId('terminal-output').parentElement!;
    await expect(body.clientHeight).toBeGreaterThan(frame.clientHeight / 2);
  }
}`,...(B=(x=s.parameters)==null?void 0:x.docs)==null?void 0:B.source}}};export{a as Disconnected,s as FillsAvailableHeight,e as Host,t as ReadOnlyMirror,r as Running,le as __namedExportsOrder,ce as default};

import{j as n}from"./iframe-DE7TzujU.js";import{T as E}from"./index-wUnCDLfM.js";import{B as H}from"./button-Uby9EqSj.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-CBiaNcZN.js";import"./index-DoCxpYiM.js";import"./index-D_CN-DGt.js";import"./createLucideIcon-CN_pcOxQ.js";import"./chevron-down-DpyZTu1h.js";import"./chevron-right-DZVBjrBM.js";import"./check-Chom1XTU.js";import"./x-BdgyrbM3.js";import"./circle-CJYlI7Zv.js";import"./select-BrHGEVqJ.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";import"./index-BdQq_4o_.js";import"./index-VVr9I5lv.js";import"./index-DAhMItIG.js";import"./index-DqpRPQyA.js";import"./index-DVXr51on.js";import"./index-DGAFZVLh.js";import"./index-D-meXGpZ.js";import"./index-COPJbcdq.js";import"./Combination-DhmAmB1C.js";import"./index-DisSJ1av.js";import"./index-C0Q7PqkE.js";import"./index-Bdp5erAT.js";import"./index-DnbC6_Py.js";import"./command-DCy9NVkh.js";import"./dialog-cOnglls5.js";import"./index-Dxe8mkPd.js";import"./index-B9cV_AZ9.js";import"./search-Bv1CouGp.js";const{expect:R,within:S}=__STORYBOOK_MODULE_TEST__,ce={title:"Patterns/TerminalFrame",component:E,tags:["autodocs"],parameters:{layout:"padded"},args:{title:"pnpm test",status:"ready",children:n.jsx("pre",{className:"whitespace-pre-wrap",children:`~/koda $ pnpm --filter @koda/desktop test
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

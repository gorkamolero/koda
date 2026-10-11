import{j as n,r as H}from"./iframe-C30QeG3e.js";import{c as A}from"./index-j3SeIR8-.js";import{B as C}from"./button-Bwmd7Lx7.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-hftMsCUE.js";import"./index-Dgyi4PT8.js";import"./index-CsaGnVJ7.js";import"./createLucideIcon-DiERuOeT.js";import"./chevron-down-jjy896LW.js";import"./chevron-right-DkAA3o_8.js";import"./check-Drblxday.js";import"./x-CKH70IuT.js";import"./circle-CdA5RCPp.js";import"./select-IEJesnEj.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-BdQq_4o_.js";import"./index-DXdei5Yc.js";import"./index-BrwFzwur.js";import"./index-Bwn99cpp.js";import"./index-BhoyFe3d.js";import"./index-DfSbsrIq.js";import"./index-CBNOem9o.js";import"./index-BWdqTsTJ.js";import"./Combination-B4nG-NNF.js";import"./index-BdqpzMJG.js";import"./index-DEQL6lI-.js";import"./index-rWZk3uLI.js";import"./index-Cs7Omgh0.js";import"./command-CU-bzmEJ.js";import"./dialog-VgvBVMd7.js";import"./index-jxSttbKr.js";import"./index-C66jsOMg.js";import"./search-Cca7vlyw.js";const{expect:a,userEvent:k,within:r}=__STORYBOOK_MODULE_TEST__;function S(e){const[t,_]=H.useState(!1);return n.jsxs("div",{className:"space-y-4",children:[n.jsx(A,{...e,status:t?"done":"running"}),n.jsx(C,{onClick:()=>_(!0),children:"Complete tool"})]})}const de={title:"Patterns/ToolBlock",component:A,tags:["autodocs"],parameters:{layout:"padded"},args:{tool:"exec_command",status:"running",summary:"Checking the reconnect regression",children:n.jsx("pre",{className:"whitespace-pre-wrap",children:`$ pnpm --filter @koda/desktop test -- WorkspaceSharing
Running 18 tests…`})}},o={play:async({canvasElement:e})=>{await a(r(e).getByRole("button")).toHaveAttribute("aria-expanded","true")}},s={args:{status:"done",summary:"18 tests passed",duration:"1.8s",children:"All 18 tests passed."},play:async({canvasElement:e})=>{const t=r(e).getByRole("button");await a(t).toHaveAttribute("aria-expanded","false"),await k.click(t),await a(t).toHaveAttribute("aria-expanded","true")}},i={args:{status:"failed",summary:"Reconnect test failed",duration:"2.1s",children:"Expected reconnect timer to be cancelled."},play:async({canvasElement:e})=>{await a(r(e).getByRole("button")).toHaveAttribute("aria-expanded","true"),await a(r(e).getByText("Expected reconnect timer to be cancelled.")).toBeVisible()}},c={args:{status:"done",defaultOpen:!0,children:"18 tests passed."}},p={render:e=>n.jsx(S,{...e}),play:async({canvasElement:e})=>{const t=r(e);await k.click(t.getByRole("button",{name:"Complete tool"})),await a(t.getByRole("button",{name:/exec_command/})).toHaveAttribute("aria-expanded","false")}},ue=["Running","Done","Failed","ExpandedResult","CompletionCollapses"];var m,l,d;o.parameters={...o.parameters,docs:{...(m=o.parameters)==null?void 0:m.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  }
}`,...(d=(l=o.parameters)==null?void 0:l.docs)==null?void 0:d.source}}};var u,x,y;s.parameters={...s.parameters,docs:{...(u=s.parameters)==null?void 0:u.docs,source:{originalSource:`{
  args: {
    status: 'done',
    summary: '18 tests passed',
    duration: '1.8s',
    children: 'All 18 tests passed.'
  },
  play: async ({
    canvasElement
  }) => {
    const button = within(canvasElement).getByRole('button');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  }
}`,...(y=(x=s.parameters)==null?void 0:x.docs)==null?void 0:y.source}}};var g,b,v;i.parameters={...i.parameters,docs:{...(g=i.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    status: 'failed',
    summary: 'Reconnect test failed',
    duration: '2.1s',
    children: 'Expected reconnect timer to be cancelled.'
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await expect(within(canvasElement).getByText('Expected reconnect timer to be cancelled.')).toBeVisible();
  }
}`,...(v=(b=i.parameters)==null?void 0:b.docs)==null?void 0:v.source}}};var w,E,h;c.parameters={...c.parameters,docs:{...(w=c.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    status: 'done',
    defaultOpen: true,
    children: '18 tests passed.'
  }
}`,...(h=(E=c.parameters)==null?void 0:E.docs)==null?void 0:h.source}}};var f,B,R;p.parameters={...p.parameters,docs:{...(f=p.parameters)==null?void 0:f.docs,source:{originalSource:`{
  render: args => <Lifecycle {...args} />,
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Complete tool'
    }));
    await expect(canvas.getByRole('button', {
      name: /exec_command/
    })).toHaveAttribute('aria-expanded', 'false');
  }
}`,...(R=(B=p.parameters)==null?void 0:B.docs)==null?void 0:R.source}}};export{p as CompletionCollapses,s as Done,c as ExpandedResult,i as Failed,o as Running,ue as __namedExportsOrder,de as default};

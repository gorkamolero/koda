import{j as c}from"./iframe-C30QeG3e.js";import{M as I}from"./index-j3SeIR8-.js";import{B as M}from"./button-Bwmd7Lx7.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-hftMsCUE.js";import"./index-Dgyi4PT8.js";import"./index-CsaGnVJ7.js";import"./createLucideIcon-DiERuOeT.js";import"./chevron-down-jjy896LW.js";import"./chevron-right-DkAA3o_8.js";import"./check-Drblxday.js";import"./x-CKH70IuT.js";import"./circle-CdA5RCPp.js";import"./select-IEJesnEj.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-BdQq_4o_.js";import"./index-DXdei5Yc.js";import"./index-BrwFzwur.js";import"./index-Bwn99cpp.js";import"./index-BhoyFe3d.js";import"./index-DfSbsrIq.js";import"./index-CBNOem9o.js";import"./index-BWdqTsTJ.js";import"./Combination-B4nG-NNF.js";import"./index-BdqpzMJG.js";import"./index-DEQL6lI-.js";import"./index-rWZk3uLI.js";import"./index-Cs7Omgh0.js";import"./command-CU-bzmEJ.js";import"./dialog-VgvBVMd7.js";import"./index-jxSttbKr.js";import"./index-C66jsOMg.js";import"./search-Cca7vlyw.js";const{expect:D,userEvent:K,within:z}=__STORYBOOK_MODULE_TEST__,fe={title:"Patterns/MessageBubble",component:I,tags:["autodocs"],parameters:{layout:"padded"},args:{variant:"assistant",author:"Codex",timestamp:"10:42",children:c.jsx("p",{children:"I found a stale reconnect timer. I’ll cancel it when the shared workspace closes and add a regression check."})}},e={},r={args:{variant:"user",author:"Gorka",children:"Fix the reconnect loop when the host closes a shared workspace."}},a={args:{variant:"system",author:void 0,children:"Ana joined this workspace with view permission."}},s={args:{variant:"user",author:"Ana",children:"I can reproduce this after switching Wi-Fi networks."}},t={args:{actions:c.jsx(M,{size:"sm",variant:"bracket",children:"Copy message"})},play:async({canvasElement:H})=>{const m=z(H);await K.hover(m.getByRole("article"));const p=m.getByRole("button",{name:"Copy message"});p.focus(),await D(p).toHaveFocus()}},o={args:{appearance:"terminal",heading:c.jsx("span",{children:"┌─ KODA"}),footer:c.jsx("div",{className:"px-3 py-1 text-text-muted",children:"└─────────────────────┘"})}},n={args:{appearance:"terminal",variant:"user",author:"Ana"}},i={args:{appearance:"terminal",variant:"system",author:void 0}},ke=["Assistant","User","System","SharedAuthor","HoverActions","TerminalAssistant","TerminalUser","TerminalSystem"];var u,d,l;e.parameters={...e.parameters,docs:{...(u=e.parameters)==null?void 0:u.docs,source:{originalSource:"{}",...(l=(d=e.parameters)==null?void 0:d.docs)==null?void 0:l.source}}};var h,g,v;r.parameters={...r.parameters,docs:{...(h=r.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    variant: 'user',
    author: 'Gorka',
    children: 'Fix the reconnect loop when the host closes a shared workspace.'
  }
}`,...(v=(g=r.parameters)==null?void 0:g.docs)==null?void 0:v.source}}};var y,w,x;a.parameters={...a.parameters,docs:{...(y=a.parameters)==null?void 0:y.docs,source:{originalSource:`{
  args: {
    variant: 'system',
    author: undefined,
    children: 'Ana joined this workspace with view permission.'
  }
}`,...(x=(w=a.parameters)==null?void 0:w.docs)==null?void 0:x.source}}};var A,S,f;s.parameters={...s.parameters,docs:{...(A=s.parameters)==null?void 0:A.docs,source:{originalSource:`{
  args: {
    variant: 'user',
    author: 'Ana',
    children: 'I can reproduce this after switching Wi-Fi networks.'
  }
}`,...(f=(S=s.parameters)==null?void 0:S.docs)==null?void 0:f.source}}};var k,B,T;t.parameters={...t.parameters,docs:{...(k=t.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    actions: <Button size="sm" variant="bracket">Copy message</Button>
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('article'));
    const action = canvas.getByRole('button', {
      name: 'Copy message'
    });
    action.focus();
    await expect(action).toHaveFocus();
  }
}`,...(T=(B=t.parameters)==null?void 0:B.docs)==null?void 0:T.source}}};var b,j,E;o.parameters={...o.parameters,docs:{...(b=o.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    appearance: 'terminal',
    heading: <span>┌─ KODA</span>,
    footer: <div className="px-3 py-1 text-text-muted">└─────────────────────┘</div>
  }
}`,...(E=(j=o.parameters)==null?void 0:j.docs)==null?void 0:E.source}}};var _,O,C;n.parameters={...n.parameters,docs:{...(_=n.parameters)==null?void 0:_.docs,source:{originalSource:`{
  args: {
    appearance: 'terminal',
    variant: 'user',
    author: 'Ana'
  }
}`,...(C=(O=n.parameters)==null?void 0:O.docs)==null?void 0:C.source}}};var F,R,U;i.parameters={...i.parameters,docs:{...(F=i.parameters)==null?void 0:F.docs,source:{originalSource:`{
  args: {
    appearance: 'terminal',
    variant: 'system',
    author: undefined
  }
}`,...(U=(R=i.parameters)==null?void 0:R.docs)==null?void 0:U.source}}};export{e as Assistant,t as HoverActions,s as SharedAuthor,a as System,o as TerminalAssistant,i as TerminalSystem,n as TerminalUser,r as User,ke as __namedExportsOrder,fe as default};

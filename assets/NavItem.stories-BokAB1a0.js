import{j as a}from"./iframe-C30QeG3e.js";import{N as P}from"./index-hftMsCUE.js";import{S as Q}from"./badge-D90OA0A3.js";import{G as V}from"./git-branch-aEYDLIPa.js";import{B as J}from"./button-Bwmd7Lx7.js";import"./preload-helper-D6W3bvzQ.js";import"./index-Dgyi4PT8.js";import"./index-CsaGnVJ7.js";import"./utils-B7o975cr.js";import"./createLucideIcon-DiERuOeT.js";import"./chevron-down-jjy896LW.js";import"./chevron-right-DkAA3o_8.js";import"./index-DXdei5Yc.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-BhoyFe3d.js";import"./index-DfSbsrIq.js";import"./index-CBNOem9o.js";import"./index-BWdqTsTJ.js";import"./index-BdqpzMJG.js";import"./index-DEQL6lI-.js";import"./index-jxSttbKr.js";import"./index-rWZk3uLI.js";const{expect:d,userEvent:b,within:g,fn:X}=__STORYBOOK_MODULE_TEST__,we={title:"Brand/NavItem",component:P,tags:["autodocs"],parameters:{layout:"padded"},args:{label:"Fix reconnect handling",meta:"codex/reconnect · 4 files",icon:a.jsx(V,{className:"size-4"}),onClick:X()}},r={},n={args:{active:!0}},s={args:{unread:!0}},o={args:{running:!0}},c={args:{disabled:!0},play:async({canvasElement:e})=>{await d(g(e).getByRole("button",{name:/Fix reconnect/})).toBeDisabled()}},i={args:{trailing:a.jsx("span",{children:"4"})}},m={args:{actions:a.jsx(J,{size:"sm",variant:"bracket",children:"Archive"})},play:async({canvasElement:e,args:t})=>{const v=g(e).getByRole("button",{name:/Fix reconnect/});await b.hover(v),await b.click(v),await d(t.onClick).toHaveBeenCalled()}},u={play:async({canvasElement:e})=>{const t=g(e).getByRole("button",{name:/Fix reconnect/});t.focus(),await d(t).toHaveFocus()}},p={args:{disabled:!0,actions:a.jsx(J,{size:"sm",variant:"bracket",children:"Archive"})},play:async({canvasElement:e})=>{await d(g(e).getByRole("button",{name:"Archive"})).toBeDisabled()}},l={args:{trailing:a.jsx(Q,{status:"ready"})}},Se=["Default","Active","Unread","Running","Disabled","WithCount","HoverActions","KeyboardFocus","DisabledActions","WithStatus"];var y,B,h;r.parameters={...r.parameters,docs:{...(y=r.parameters)==null?void 0:y.docs,source:{originalSource:"{}",...(h=(B=r.parameters)==null?void 0:B.docs)==null?void 0:h.source}}};var x,w,S;n.parameters={...n.parameters,docs:{...(x=n.parameters)==null?void 0:x.docs,source:{originalSource:`{
  args: {
    active: true
  }
}`,...(S=(w=n.parameters)==null?void 0:w.docs)==null?void 0:S.source}}};var E,f,A;s.parameters={...s.parameters,docs:{...(E=s.parameters)==null?void 0:E.docs,source:{originalSource:`{
  args: {
    unread: true
  }
}`,...(A=(f=s.parameters)==null?void 0:f.docs)==null?void 0:A.source}}};var R,D,F;o.parameters={...o.parameters,docs:{...(R=o.parameters)==null?void 0:R.docs,source:{originalSource:`{
  args: {
    running: true
  }
}`,...(F=(D=o.parameters)==null?void 0:D.docs)==null?void 0:F.source}}};var k,_,j;c.parameters={...c.parameters,docs:{...(k=c.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    disabled: true
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('button', {
      name: /Fix reconnect/
    })).toBeDisabled();
  }
}`,...(j=(_=c.parameters)==null?void 0:_.docs)==null?void 0:j.source}}};var C,H,z;i.parameters={...i.parameters,docs:{...(C=i.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    trailing: <span>4</span>
  }
}`,...(z=(H=i.parameters)==null?void 0:H.docs)==null?void 0:z.source}}};var O,N,W;m.parameters={...m.parameters,docs:{...(O=m.parameters)==null?void 0:O.docs,source:{originalSource:`{
  args: {
    actions: <Button size="sm" variant="bracket">Archive</Button>
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const row = within(canvasElement).getByRole('button', {
      name: /Fix reconnect/
    });
    await userEvent.hover(row);
    await userEvent.click(row);
    await expect(args.onClick).toHaveBeenCalled();
  }
}`,...(W=(N=m.parameters)==null?void 0:N.docs)==null?void 0:W.source}}};var K,T,U;u.parameters={...u.parameters,docs:{...(K=u.parameters)==null?void 0:K.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const button = within(canvasElement).getByRole('button', {
      name: /Fix reconnect/
    });
    button.focus();
    await expect(button).toHaveFocus();
  }
}`,...(U=(T=u.parameters)==null?void 0:T.docs)==null?void 0:U.source}}};var G,I,L;p.parameters={...p.parameters,docs:{...(G=p.parameters)==null?void 0:G.docs,source:{originalSource:`{
  args: {
    disabled: true,
    actions: <Button size="sm" variant="bracket">Archive</Button>
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('button', {
      name: 'Archive'
    })).toBeDisabled();
  }
}`,...(L=(I=p.parameters)==null?void 0:I.docs)==null?void 0:L.source}}};var M,Y,q;l.parameters={...l.parameters,docs:{...(M=l.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    trailing: <StatusBadge status="ready" />
  }
}`,...(q=(Y=l.parameters)==null?void 0:Y.docs)==null?void 0:q.source}}};export{n as Active,r as Default,c as Disabled,p as DisabledActions,m as HoverActions,u as KeyboardFocus,o as Running,s as Unread,i as WithCount,l as WithStatus,Se as __namedExportsOrder,we as default};

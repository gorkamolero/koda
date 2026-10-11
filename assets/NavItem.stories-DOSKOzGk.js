import{j as u}from"./iframe-BDUbmM24.js";import{N as M}from"./index-6LWTzUp_.js";import{G as Y}from"./git-branch-DmHUUDkX.js";import{B as L}from"./button-BasZ35wm.js";import"./preload-helper-D6W3bvzQ.js";import"./index-CCQdZNI7.js";import"./index-DbX3ht9U.js";import"./utils-B7o975cr.js";import"./createLucideIcon-B6tXQlyD.js";import"./chevron-down-DzoDJT8Q.js";import"./chevron-right-BEutbkUU.js";import"./index-CDLDA8NU.js";import"./index-OlRYfNBu.js";import"./index-iWPVPrYK.js";import"./index-Cic-oAX7.js";import"./index-DV1FpbQh.js";import"./index-FqwwTXOA.js";import"./index-BZr_kTKH.js";import"./index-CWXJao91.js";import"./index-Bh-xOyeg.js";import"./index-D20LO2AZ.js";import"./index-DIxJW5Vf.js";const{expect:l,userEvent:v,within:d,fn:q}=__STORYBOOK_MODULE_TEST__,ve={title:"Brand/NavItem",component:M,tags:["autodocs"],parameters:{layout:"padded"},args:{label:"Fix reconnect handling",meta:"codex/reconnect · 4 files",icon:u.jsx(Y,{className:"size-4"}),onClick:q()}},t={},r={args:{active:!0}},n={args:{unread:!0}},s={args:{running:!0}},o={args:{disabled:!0},play:async({canvasElement:e})=>{await l(d(e).getByRole("button",{name:/Fix reconnect/})).toBeDisabled()}},c={args:{trailing:u.jsx("span",{children:"4"})}},i={args:{actions:u.jsx(L,{size:"sm",variant:"bracket",children:"Archive"})},play:async({canvasElement:e,args:a})=>{const g=d(e).getByRole("button",{name:/Fix reconnect/});await v.hover(g),await v.click(g),await l(a.onClick).toHaveBeenCalled()}},m={play:async({canvasElement:e})=>{const a=d(e).getByRole("button",{name:/Fix reconnect/});a.focus(),await l(a).toHaveFocus()}},p={args:{disabled:!0,actions:u.jsx(L,{size:"sm",variant:"bracket",children:"Archive"})},play:async({canvasElement:e})=>{await l(d(e).getByRole("button",{name:"Archive"})).toBeDisabled()}},be=["Default","Active","Unread","Running","Disabled","WithCount","HoverActions","KeyboardFocus","DisabledActions"];var b,y,B;t.parameters={...t.parameters,docs:{...(b=t.parameters)==null?void 0:b.docs,source:{originalSource:"{}",...(B=(y=t.parameters)==null?void 0:y.docs)==null?void 0:B.source}}};var w,x,h;r.parameters={...r.parameters,docs:{...(w=r.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    active: true
  }
}`,...(h=(x=r.parameters)==null?void 0:x.docs)==null?void 0:h.source}}};var E,A,R;n.parameters={...n.parameters,docs:{...(E=n.parameters)==null?void 0:E.docs,source:{originalSource:`{
  args: {
    unread: true
  }
}`,...(R=(A=n.parameters)==null?void 0:A.docs)==null?void 0:R.source}}};var f,D,F;s.parameters={...s.parameters,docs:{...(f=s.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    running: true
  }
}`,...(F=(D=s.parameters)==null?void 0:D.docs)==null?void 0:F.source}}};var S,k,_;o.parameters={...o.parameters,docs:{...(S=o.parameters)==null?void 0:S.docs,source:{originalSource:`{
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
}`,...(_=(k=o.parameters)==null?void 0:k.docs)==null?void 0:_.source}}};var C,j,H;c.parameters={...c.parameters,docs:{...(C=c.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    trailing: <span>4</span>
  }
}`,...(H=(j=c.parameters)==null?void 0:j.docs)==null?void 0:H.source}}};var z,O,N;i.parameters={...i.parameters,docs:{...(z=i.parameters)==null?void 0:z.docs,source:{originalSource:`{
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
}`,...(N=(O=i.parameters)==null?void 0:O.docs)==null?void 0:N.source}}};var K,T,U;m.parameters={...m.parameters,docs:{...(K=m.parameters)==null?void 0:K.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const button = within(canvasElement).getByRole('button', {
      name: /Fix reconnect/
    });
    button.focus();
    await expect(button).toHaveFocus();
  }
}`,...(U=(T=m.parameters)==null?void 0:T.docs)==null?void 0:U.source}}};var G,I,W;p.parameters={...p.parameters,docs:{...(G=p.parameters)==null?void 0:G.docs,source:{originalSource:`{
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
}`,...(W=(I=p.parameters)==null?void 0:I.docs)==null?void 0:W.source}}};export{r as Active,t as Default,o as Disabled,p as DisabledActions,i as HoverActions,m as KeyboardFocus,s as Running,n as Unread,c as WithCount,be as __namedExportsOrder,ve as default};

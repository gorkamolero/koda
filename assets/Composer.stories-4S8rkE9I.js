import{j as o,r as U}from"./iframe-BDUbmM24.js";import{b as K}from"./index-CY8AJswe.js";import{B as L}from"./button-BasZ35wm.js";import{B as Y}from"./badge-DrkOXWGm.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-6LWTzUp_.js";import"./index-CCQdZNI7.js";import"./index-DbX3ht9U.js";import"./createLucideIcon-B6tXQlyD.js";import"./chevron-down-DzoDJT8Q.js";import"./chevron-right-BEutbkUU.js";import"./check-cfLWj2WE.js";import"./x-C0KTbnLC.js";import"./circle-DGMtMHH9.js";import"./select-BNAvgY25.js";import"./index-OlRYfNBu.js";import"./index-iWPVPrYK.js";import"./index-BdQq_4o_.js";import"./index-CDLDA8NU.js";import"./index-BQ035UTa.js";import"./index-Bz4jA-VL.js";import"./index-Cic-oAX7.js";import"./index-DV1FpbQh.js";import"./index-FqwwTXOA.js";import"./index-BZr_kTKH.js";import"./Combination-CJub336x.js";import"./index-CWXJao91.js";import"./index-Bh-xOyeg.js";import"./index-DIxJW5Vf.js";import"./index-Bk0okdtA.js";import"./command-CzSzYJ1c.js";import"./dialog-D6vekFOA.js";import"./index-D20LO2AZ.js";import"./index-DVpI-cC2.js";import"./search-D8R2c2Kq.js";const{expect:t,userEvent:r,within:s,fn:b}=__STORYBOOK_MODULE_TEST__;function q(e){const[a,n]=U.useState(e.value);return o.jsx(K,{...e,value:a,onValueChange:n})}const Te={title:"Patterns/Composer",component:K,tags:["autodocs"],parameters:{layout:"padded"},args:{value:"",modelSelector:o.jsx(L,{variant:"ghost",size:"sm","aria-label":"Model: GPT-5.4",children:"GPT-5.4"}),onSend:b(),onStop:b(),onPermissionChange:b()},render:e=>o.jsx(q,{...e})},i={play:async({canvasElement:e,args:a})=>{const n=s(e);await t(n.getByRole("button",{name:"Send"})).toBeDisabled(),await r.type(n.getByRole("textbox",{name:"Message"}),"Fix the reconnect timer."),await r.click(n.getByRole("button",{name:"Send"})),await t(a.onSend).toHaveBeenCalledOnce()}},c={args:{mode:"shared",ownerName:"Gorka"},play:async({canvasElement:e})=>{const a=s(e);await t(a.getByRole("combobox",{name:"Permission mode"})).toBeDisabled(),await t(a.getByRole("button",{name:"Model: GPT-5.4"})).toBeDisabled()}},m={args:{mode:"view-only",ownerName:"Gorka",value:"A draft cannot be sent with view permission."},play:async({canvasElement:e,args:a})=>{const n=s(e);await t(n.getByRole("textbox")).toBeDisabled(),await t(n.getByRole("button",{name:"Send"})).toBeDisabled(),await t(n.getByRole("combobox")).toBeDisabled(),await t(a.onSend).not.toHaveBeenCalled()}},l={args:{attachments:o.jsx(Y,{children:"WorkspaceSharing.tsx"}),value:"Review this change."}},p={args:{running:!0},play:async({canvasElement:e,args:a})=>{await r.click(s(e).getByRole("button",{name:"Stop"})),await t(a.onStop).toHaveBeenCalledOnce()}},d={args:{running:!0,mode:"view-only"},play:async({canvasElement:e})=>{await t(s(e).getByRole("button",{name:"Stop"})).toBeDisabled()}},u={args:{disabled:!0}},g={args:{placeholder:"Describe the expected reconnect behavior…"}},v={args:{appearance:"terminal",textareaProps:{"data-testid":"chat-input"},footer:o.jsx("div",{className:"border-t border-dashed border-border-subtle bg-surface-composer text-text-on-composer p-2",children:o.jsx(L,{type:"submit",variant:"bracket",size:"sm",children:"Send"})})},play:async({canvasElement:e,args:a})=>{const n=s(e);await r.type(n.getByTestId("chat-input"),"Review the session."),await r.click(n.getByRole("button",{name:"Send"})),await t(a.onSend).toHaveBeenCalledOnce()}},je=["OwnSession","SomeoneElsesSession","ViewOnly","WithAttachments","Running","ViewOnlyRunning","Disabled","CustomPlaceholder","TerminalComposer"];var y,w,B;i.parameters={...i.parameters,docs:{...(y=i.parameters)==null?void 0:y.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Send'
    })).toBeDisabled();
    await userEvent.type(canvas.getByRole('textbox', {
      name: 'Message'
    }), 'Fix the reconnect timer.');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Send'
    }));
    await expect(args.onSend).toHaveBeenCalledOnce();
  }
}`,...(B=(w=i.parameters)==null?void 0:w.docs)==null?void 0:B.source}}};var h,x,S;c.parameters={...c.parameters,docs:{...(h=c.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    mode: 'shared',
    ownerName: 'Gorka'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('combobox', {
      name: 'Permission mode'
    })).toBeDisabled();
    await expect(canvas.getByRole('button', {
      name: 'Model: GPT-5.4'
    })).toBeDisabled();
  }
}`,...(S=(x=c.parameters)==null?void 0:x.docs)==null?void 0:S.source}}};var R,E,D;m.parameters={...m.parameters,docs:{...(R=m.parameters)==null?void 0:R.docs,source:{originalSource:`{
  args: {
    mode: 'view-only',
    ownerName: 'Gorka',
    value: 'A draft cannot be sent with view permission.'
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox')).toBeDisabled();
    await expect(canvas.getByRole('button', {
      name: 'Send'
    })).toBeDisabled();
    await expect(canvas.getByRole('combobox')).toBeDisabled();
    await expect(args.onSend).not.toHaveBeenCalled();
  }
}`,...(D=(E=m.parameters)==null?void 0:E.docs)==null?void 0:D.source}}};var C,O,k;l.parameters={...l.parameters,docs:{...(C=l.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    attachments: <Badge>WorkspaceSharing.tsx</Badge>,
    value: 'Review this change.'
  }
}`,...(k=(O=l.parameters)==null?void 0:O.docs)==null?void 0:k.source}}};var f,P,T;p.parameters={...p.parameters,docs:{...(f=p.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    running: true
  },
  play: async ({
    canvasElement,
    args
  }) => {
    await userEvent.click(within(canvasElement).getByRole('button', {
      name: 'Stop'
    }));
    await expect(args.onStop).toHaveBeenCalledOnce();
  }
}`,...(T=(P=p.parameters)==null?void 0:P.docs)==null?void 0:T.source}}};var j,G,H;d.parameters={...d.parameters,docs:{...(j=d.parameters)==null?void 0:j.docs,source:{originalSource:`{
  args: {
    running: true,
    mode: 'view-only'
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('button', {
      name: 'Stop'
    })).toBeDisabled();
  }
}`,...(H=(G=d.parameters)==null?void 0:G.docs)==null?void 0:H.source}}};var _,M,N;u.parameters={...u.parameters,docs:{...(_=u.parameters)==null?void 0:_.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(N=(M=u.parameters)==null?void 0:M.docs)==null?void 0:N.source}}};var V,A,W;g.parameters={...g.parameters,docs:{...(V=g.parameters)==null?void 0:V.docs,source:{originalSource:`{
  args: {
    placeholder: 'Describe the expected reconnect behavior…'
  }
}`,...(W=(A=g.parameters)==null?void 0:A.docs)==null?void 0:W.source}}};var z,F,I;v.parameters={...v.parameters,docs:{...(z=v.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    appearance: 'terminal',
    textareaProps: {
      'data-testid': 'chat-input'
    },
    footer: <div className="border-t border-dashed border-border-subtle bg-surface-composer text-text-on-composer p-2"><Button type="submit" variant="bracket" size="sm">Send</Button></div>
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByTestId('chat-input'), 'Review the session.');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Send'
    }));
    await expect(args.onSend).toHaveBeenCalledOnce();
  }
}`,...(I=(F=v.parameters)==null?void 0:F.docs)==null?void 0:I.source}}};export{g as CustomPlaceholder,u as Disabled,i as OwnSession,p as Running,c as SomeoneElsesSession,v as TerminalComposer,m as ViewOnly,d as ViewOnlyRunning,l as WithAttachments,je as __namedExportsOrder,Te as default};

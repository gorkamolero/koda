import{j as s,r as Q}from"./iframe-C30QeG3e.js";import{b as q}from"./index-j3SeIR8-.js";import{B as J}from"./button-Bwmd7Lx7.js";import{B as X}from"./badge-D90OA0A3.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-hftMsCUE.js";import"./index-Dgyi4PT8.js";import"./index-CsaGnVJ7.js";import"./createLucideIcon-DiERuOeT.js";import"./chevron-down-jjy896LW.js";import"./chevron-right-DkAA3o_8.js";import"./check-Drblxday.js";import"./x-CKH70IuT.js";import"./circle-CdA5RCPp.js";import"./select-IEJesnEj.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-BdQq_4o_.js";import"./index-DXdei5Yc.js";import"./index-BrwFzwur.js";import"./index-Bwn99cpp.js";import"./index-BhoyFe3d.js";import"./index-DfSbsrIq.js";import"./index-CBNOem9o.js";import"./index-BWdqTsTJ.js";import"./Combination-B4nG-NNF.js";import"./index-BdqpzMJG.js";import"./index-DEQL6lI-.js";import"./index-rWZk3uLI.js";import"./index-Cs7Omgh0.js";import"./command-CU-bzmEJ.js";import"./dialog-VgvBVMd7.js";import"./index-jxSttbKr.js";import"./index-C66jsOMg.js";import"./search-Cca7vlyw.js";const{expect:n,userEvent:r,within:o,fn:y}=__STORYBOOK_MODULE_TEST__;function Z(e){const[a,t]=Q.useState(e.value);return s.jsx(q,{...e,value:a,onValueChange:t})}const je={title:"Patterns/Composer",component:q,tags:["autodocs"],parameters:{layout:"padded"},args:{value:"",modelSelector:s.jsx(J,{variant:"ghost",size:"sm","aria-label":"Model: GPT-5.4",children:"GPT-5.4"}),onSend:y(),onStop:y(),onPermissionChange:y()},render:e=>s.jsx(Z,{...e})},i={play:async({canvasElement:e,args:a})=>{const t=o(e);await n(t.getByRole("button",{name:"Send"})).toBeDisabled(),await r.type(t.getByRole("textbox",{name:"Message"}),"Fix the reconnect timer."),await r.click(t.getByRole("button",{name:"Send"})),await n(a.onSend).toHaveBeenCalledOnce()}},c={args:{mode:"shared",ownerName:"Gorka"},play:async({canvasElement:e})=>{const a=o(e);await n(a.getByRole("combobox",{name:"Permission mode"})).toBeDisabled(),await n(a.getByRole("button",{name:"Model: GPT-5.4"})).toBeDisabled()}},l={args:{mode:"view-only",ownerName:"Gorka",value:"A draft cannot be sent with view permission."},play:async({canvasElement:e,args:a})=>{const t=o(e);await n(t.getByRole("textbox")).toBeDisabled(),await n(t.getByRole("button",{name:"Send"})).toBeDisabled(),await n(t.getByRole("combobox")).toBeDisabled(),await n(a.onSend).not.toHaveBeenCalled()}},m={args:{attachments:s.jsx(X,{children:"WorkspaceSharing.tsx"}),value:"Review this change."}},p={args:{running:!0},play:async({canvasElement:e,args:a})=>{await r.click(o(e).getByRole("button",{name:"Stop"})),await n(a.onStop).toHaveBeenCalledOnce()}},d={args:{running:!0,mode:"view-only"},play:async({canvasElement:e})=>{await n(o(e).getByRole("button",{name:"Stop"})).toBeDisabled()}},u={args:{disabled:!0}},g={args:{placeholder:"Describe the expected reconnect behavior…"}},v={args:{appearance:"terminal",textareaProps:{"data-testid":"chat-input"},footer:s.jsx("div",{className:"border-t border-dashed border-border-subtle bg-surface-composer text-text-on-composer p-2",children:s.jsx(J,{type:"submit",variant:"bracket",size:"sm",children:"Send"})})},play:async({canvasElement:e,args:a})=>{const t=o(e);await r.type(t.getByTestId("chat-input"),"Review the session."),await r.click(t.getByRole("button",{name:"Send"})),await n(a.onSend).toHaveBeenCalledOnce()}},w={args:{mode:"view-only",ownerName:"Gorka",value:""},play:async({canvasElement:e})=>{const a=o(e).getByRole("textbox",{name:"Message"});await n(a).toHaveValue(""),await n(a).toHaveAttribute("placeholder","View only · Gorka controls this session"),await n(a).toBeDisabled()}},Me=["OwnSession","SomeoneElsesSession","ViewOnly","WithAttachments","Running","ViewOnlyRunning","Disabled","CustomPlaceholder","TerminalComposer","ViewOnlyPlaceholder"];var b,B,h;i.parameters={...i.parameters,docs:{...(b=i.parameters)==null?void 0:b.docs,source:{originalSource:`{
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
}`,...(h=(B=i.parameters)==null?void 0:B.docs)==null?void 0:h.source}}};var x,S,R;c.parameters={...c.parameters,docs:{...(x=c.parameters)==null?void 0:x.docs,source:{originalSource:`{
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
}`,...(R=(S=c.parameters)==null?void 0:S.docs)==null?void 0:R.source}}};var E,D,O;l.parameters={...l.parameters,docs:{...(E=l.parameters)==null?void 0:E.docs,source:{originalSource:`{
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
}`,...(O=(D=l.parameters)==null?void 0:D.docs)==null?void 0:O.source}}};var k,C,P;m.parameters={...m.parameters,docs:{...(k=m.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    attachments: <Badge>WorkspaceSharing.tsx</Badge>,
    value: 'Review this change.'
  }
}`,...(P=(C=m.parameters)==null?void 0:C.docs)==null?void 0:P.source}}};var f,G,H;p.parameters={...p.parameters,docs:{...(f=p.parameters)==null?void 0:f.docs,source:{originalSource:`{
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
}`,...(H=(G=p.parameters)==null?void 0:G.docs)==null?void 0:H.source}}};var V,T,j;d.parameters={...d.parameters,docs:{...(V=d.parameters)==null?void 0:V.docs,source:{originalSource:`{
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
}`,...(j=(T=d.parameters)==null?void 0:T.docs)==null?void 0:j.source}}};var M,N,_;u.parameters={...u.parameters,docs:{...(M=u.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(_=(N=u.parameters)==null?void 0:N.docs)==null?void 0:_.source}}};var A,W,z;g.parameters={...g.parameters,docs:{...(A=g.parameters)==null?void 0:A.docs,source:{originalSource:`{
  args: {
    placeholder: 'Describe the expected reconnect behavior…'
  }
}`,...(z=(W=g.parameters)==null?void 0:W.docs)==null?void 0:z.source}}};var F,I,K;v.parameters={...v.parameters,docs:{...(F=v.parameters)==null?void 0:F.docs,source:{originalSource:`{
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
}`,...(K=(I=v.parameters)==null?void 0:I.docs)==null?void 0:K.source}}};var L,U,Y;w.parameters={...w.parameters,docs:{...(L=w.parameters)==null?void 0:L.docs,source:{originalSource:`{
  args: {
    mode: 'view-only',
    ownerName: 'Gorka',
    value: ''
  },
  play: async ({
    canvasElement
  }) => {
    const input = within(canvasElement).getByRole('textbox', {
      name: 'Message'
    });
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', 'View only · Gorka controls this session');
    await expect(input).toBeDisabled();
  }
}`,...(Y=(U=w.parameters)==null?void 0:U.docs)==null?void 0:Y.source}}};export{g as CustomPlaceholder,u as Disabled,i as OwnSession,p as Running,c as SomeoneElsesSession,v as TerminalComposer,l as ViewOnly,w as ViewOnlyPlaceholder,d as ViewOnlyRunning,m as WithAttachments,Me as __namedExportsOrder,je as default};

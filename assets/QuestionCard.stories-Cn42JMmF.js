import{j as o,r as de}from"./iframe-BOlOcktz.js";import{Q as pe}from"./index-BK65kbgY.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-D38G4VL6.js";import"./index-CJvINIPD.js";import"./index-DszZT9yc.js";import"./createLucideIcon-BKtcNsTW.js";import"./button-DETrAiRn.js";import"./index-DcWWjj0g.js";import"./index-B-iRab8W.js";import"./index-CI6IeoH0.js";import"./index-YGWuIb40.js";import"./index-CkWDtAJP.js";import"./index-DSkAjUYK.js";import"./index-zTO-c2Cr.js";import"./index-_nmx2gS7.js";import"./index-wkeOesEn.js";import"./index-BlUyFi_Y.js";import"./index-Dxe6Gktq.js";import"./chevron-down-D3xL0QhO.js";import"./chevron-right-D4CXFYMT.js";import"./check-DnZ2MnjI.js";import"./x-rhw8hwOp.js";import"./circle-JpOebGTw.js";import"./select-B18DPH7j.js";import"./index-BdQq_4o_.js";import"./index-DWVDe7sO.js";import"./index-CLWpyE0l.js";import"./Combination-C0-Js29n.js";import"./index-CzawmuLc.js";import"./command-BGMfk9ja.js";import"./dialog-HLE40si2.js";import"./index-CxHxyMlZ.js";import"./search-DhSWCOmI.js";const{expect:t,userEvent:r,within:s,fn:S}=__STORYBOOK_MODULE_TEST__;function ge(e){const[n,a]=de.useState(e.value??(e.variant==="multiple"?[]:""));return o.jsx(pe,{...e,value:n,onValueChange:x=>{var R;a(x),(R=e.onValueChange)==null||R.call(e,x)}})}const Je={title:"Patterns/QuestionCard",component:pe,tags:["autodocs"],parameters:{layout:"padded"},args:{question:"How should reconnect failures be shown?",variant:"single",options:[{value:"inline",label:"Inline status (recommended)",description:"Keep the session visible and show connection progress."},{value:"modal",label:"Blocking dialog",description:"Wait for confirmation before continuing."}],onSubmit:S(),onCancel:S(),onValueChange:S()},render:e=>o.jsx(ge,{...e})},i={play:async({canvasElement:e,args:n})=>{const a=s(e);await t(a.getByRole("button",{name:"Submit answer"})).toBeDisabled(),await r.click(a.getByRole("radio",{name:"Inline status (recommended)"})),await r.click(a.getByRole("button",{name:"Submit answer"})),await t(n.onSubmit).toHaveBeenCalledWith("inline")}},c={args:{variant:"multiple",question:"Which checks should run before sharing?"},play:async({canvasElement:e,args:n})=>{const a=s(e);await r.click(a.getByRole("checkbox",{name:"Inline status (recommended)"})),await r.click(a.getByRole("checkbox",{name:"Blocking dialog"})),await r.click(a.getByRole("button",{name:"Submit answer"})),await t(n.onSubmit).toHaveBeenCalledWith(["inline","modal"])}},l={args:{variant:"text",question:"What should the reconnect status say?",options:[]},play:async({canvasElement:e,args:n})=>{const a=s(e);await r.type(a.getByRole("textbox",{name:"Your answer"}),"Reconnecting to Gorka’s workspace…"),await r.click(a.getByRole("button",{name:"Submit answer"})),await t(n.onSubmit).toHaveBeenCalledWith("Reconnecting to Gorka’s workspace…")}},m={args:{variant:"secret",question:"Enter the temporary access phrase on this host.",options:[]},play:async({canvasElement:e})=>{await t(s(e).getByLabelText("Secret answer")).toHaveAttribute("type","password")}},u={args:{state:"read-only",hostName:"Gorka",value:"inline"},play:async({canvasElement:e})=>{const n=s(e);await t(n.getByRole("button",{name:"Submit answer"})).toBeDisabled(),await t(n.getByRole("radio",{name:"Inline status (recommended)"})).toBeDisabled()}},p={args:{variant:"secret",question:"Enter the temporary access phrase.",hostName:"Gorka",value:"never-render-this-example-value"},play:async({canvasElement:e,args:n})=>{const a=s(e);await t(a.queryByLabelText("Secret answer")).not.toBeInTheDocument(),await t(e.innerHTML).not.toContain("never-render-this-example-value"),await t(a.getByRole("button",{name:"Submit answer"})).toBeDisabled(),await t(a.getByRole("button",{name:"Cancel and stop"})).toBeDisabled(),await t(n.onSubmit).not.toHaveBeenCalled()}},d={args:{variant:"secret",state:"read-only",hostName:"Gorka"}},g={args:{state:"resolved",value:"inline"}},h={args:{state:"withdrawn"}},v={args:{busy:!0,value:"inline"}},w={args:{error:"The host disconnected before this answer was sent.",value:"inline"}},b={args:{appearance:"terminal",ready:!0,submitLabel:"Submit answers",children:o.jsxs("fieldset",{children:[o.jsx("legend",{children:"Approach"}),o.jsx("p",{children:"Use the existing reconnect behavior."})]})},play:async({canvasElement:e,args:n})=>{await r.click(s(e).getByRole("button",{name:"Submit answers"})),await t(n.onSubmit).toHaveBeenCalledOnce()}},y={args:{appearance:"terminal",requiresHost:!0,hostName:"Gorka",ready:!0,children:o.jsx("p",{children:"A private answer is required."})},play:async({canvasElement:e})=>{await t(s(e).getByRole("button",{name:"Submit answer"})).toBeDisabled()}},B={args:{appearance:"interview",hideActions:!0,heading:o.jsx("h3",{className:"mb-6 text-xl font-semibold text-text-strong",children:"What should the feature do?"}),variant:"text",question:"Describe the feature requirements"}},Xe=["SingleChoice","MultipleChoice","FreeText","SecretAnswer","ReadOnly","AnswerOnHost","SecretReadOnly","Resolved","Withdrawn","Sending","ResponseError","ComposedRequest","ComposedSecretOnHost","Interview"];var k,E,C;i.parameters={...i.parameters,docs:{...(k=i.parameters)==null?void 0:k.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Submit answer'
    })).toBeDisabled();
    await userEvent.click(canvas.getByRole('radio', {
      name: 'Inline status (recommended)'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: 'Submit answer'
    }));
    await expect(args.onSubmit).toHaveBeenCalledWith('inline');
  }
}`,...(C=(E=i.parameters)==null?void 0:E.docs)==null?void 0:C.source}}};var f,q,H;c.parameters={...c.parameters,docs:{...(f=c.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    variant: 'multiple',
    question: 'Which checks should run before sharing?'
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', {
      name: 'Inline status (recommended)'
    }));
    await userEvent.click(canvas.getByRole('checkbox', {
      name: 'Blocking dialog'
    }));
    await userEvent.click(canvas.getByRole('button', {
      name: 'Submit answer'
    }));
    await expect(args.onSubmit).toHaveBeenCalledWith(['inline', 'modal']);
  }
}`,...(H=(q=c.parameters)==null?void 0:q.docs)==null?void 0:H.source}}};var D,O,T;l.parameters={...l.parameters,docs:{...(D=l.parameters)==null?void 0:D.docs,source:{originalSource:`{
  args: {
    variant: 'text',
    question: 'What should the reconnect status say?',
    options: []
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', {
      name: 'Your answer'
    }), 'Reconnecting to Gorka’s workspace…');
    await userEvent.click(canvas.getByRole('button', {
      name: 'Submit answer'
    }));
    await expect(args.onSubmit).toHaveBeenCalledWith('Reconnecting to Gorka’s workspace…');
  }
}`,...(T=(O=l.parameters)==null?void 0:O.docs)==null?void 0:T.source}}};var W,A,G;m.parameters={...m.parameters,docs:{...(W=m.parameters)==null?void 0:W.docs,source:{originalSource:`{
  args: {
    variant: 'secret',
    question: 'Enter the temporary access phrase on this host.',
    options: []
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByLabelText('Secret answer')).toHaveAttribute('type', 'password');
  }
}`,...(G=(A=m.parameters)==null?void 0:A.docs)==null?void 0:G.source}}};var I,N,j;u.parameters={...u.parameters,docs:{...(I=u.parameters)==null?void 0:I.docs,source:{originalSource:`{
  args: {
    state: 'read-only',
    hostName: 'Gorka',
    value: 'inline'
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Submit answer'
    })).toBeDisabled();
    await expect(canvas.getByRole('radio', {
      name: 'Inline status (recommended)'
    })).toBeDisabled();
  }
}`,...(j=(N=u.parameters)==null?void 0:N.docs)==null?void 0:j.source}}};var L,_,M;p.parameters={...p.parameters,docs:{...(L=p.parameters)==null?void 0:L.docs,source:{originalSource:`{
  args: {
    variant: 'secret',
    question: 'Enter the temporary access phrase.',
    hostName: 'Gorka',
    value: 'never-render-this-example-value'
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByLabelText('Secret answer')).not.toBeInTheDocument();
    await expect(canvasElement.innerHTML).not.toContain('never-render-this-example-value');
    await expect(canvas.getByRole('button', {
      name: 'Submit answer'
    })).toBeDisabled();
    await expect(canvas.getByRole('button', {
      name: 'Cancel and stop'
    })).toBeDisabled();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  }
}`,...(M=(_=p.parameters)==null?void 0:_.docs)==null?void 0:M.source}}};var Q,V,U;d.parameters={...d.parameters,docs:{...(Q=d.parameters)==null?void 0:Q.docs,source:{originalSource:`{
  args: {
    variant: 'secret',
    state: 'read-only',
    hostName: 'Gorka'
  }
}`,...(U=(V=d.parameters)==null?void 0:V.docs)==null?void 0:U.source}}};var Y,F,K;g.parameters={...g.parameters,docs:{...(Y=g.parameters)==null?void 0:Y.docs,source:{originalSource:`{
  args: {
    state: 'resolved',
    value: 'inline'
  }
}`,...(K=(F=g.parameters)==null?void 0:F.docs)==null?void 0:K.source}}};var P,z,J;h.parameters={...h.parameters,docs:{...(P=h.parameters)==null?void 0:P.docs,source:{originalSource:`{
  args: {
    state: 'withdrawn'
  }
}`,...(J=(z=h.parameters)==null?void 0:z.docs)==null?void 0:J.source}}};var X,Z,$;v.parameters={...v.parameters,docs:{...(X=v.parameters)==null?void 0:X.docs,source:{originalSource:`{
  args: {
    busy: true,
    value: 'inline'
  }
}`,...($=(Z=v.parameters)==null?void 0:Z.docs)==null?void 0:$.source}}};var ee,ae,ne;w.parameters={...w.parameters,docs:{...(ee=w.parameters)==null?void 0:ee.docs,source:{originalSource:`{
  args: {
    error: 'The host disconnected before this answer was sent.',
    value: 'inline'
  }
}`,...(ne=(ae=w.parameters)==null?void 0:ae.docs)==null?void 0:ne.source}}};var te,re,se;b.parameters={...b.parameters,docs:{...(te=b.parameters)==null?void 0:te.docs,source:{originalSource:`{
  args: {
    appearance: 'terminal',
    ready: true,
    submitLabel: 'Submit answers',
    children: <fieldset><legend>Approach</legend><p>Use the existing reconnect behavior.</p></fieldset>
  },
  play: async ({
    canvasElement,
    args
  }) => {
    await userEvent.click(within(canvasElement).getByRole('button', {
      name: 'Submit answers'
    }));
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  }
}`,...(se=(re=b.parameters)==null?void 0:re.docs)==null?void 0:se.source}}};var oe,ie,ce;y.parameters={...y.parameters,docs:{...(oe=y.parameters)==null?void 0:oe.docs,source:{originalSource:`{
  args: {
    appearance: 'terminal',
    requiresHost: true,
    hostName: 'Gorka',
    ready: true,
    children: <p>A private answer is required.</p>
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('button', {
      name: 'Submit answer'
    })).toBeDisabled();
  }
}`,...(ce=(ie=y.parameters)==null?void 0:ie.docs)==null?void 0:ce.source}}};var le,me,ue;B.parameters={...B.parameters,docs:{...(le=B.parameters)==null?void 0:le.docs,source:{originalSource:`{
  args: {
    appearance: 'interview',
    hideActions: true,
    heading: <h3 className="mb-6 text-xl font-semibold text-text-strong">What should the feature do?</h3>,
    variant: 'text',
    question: 'Describe the feature requirements'
  }
}`,...(ue=(me=B.parameters)==null?void 0:me.docs)==null?void 0:ue.source}}};export{p as AnswerOnHost,b as ComposedRequest,y as ComposedSecretOnHost,l as FreeText,B as Interview,c as MultipleChoice,u as ReadOnly,g as Resolved,w as ResponseError,m as SecretAnswer,d as SecretReadOnly,v as Sending,i as SingleChoice,h as Withdrawn,Xe as __namedExportsOrder,Je as default};

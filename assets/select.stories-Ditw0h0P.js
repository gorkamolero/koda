import{j as e}from"./iframe-DE7TzujU.js";import{S as o,a as m,b as p,c as t,d as b}from"./select-BrHGEVqJ.js";import"./preload-helper-D6W3bvzQ.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";import"./index-BdQq_4o_.js";import"./index-VVr9I5lv.js";import"./index-D_CN-DGt.js";import"./index-DAhMItIG.js";import"./index-DqpRPQyA.js";import"./index-DVXr51on.js";import"./index-DGAFZVLh.js";import"./index-D-meXGpZ.js";import"./index-COPJbcdq.js";import"./Combination-DhmAmB1C.js";import"./index-DisSJ1av.js";import"./index-C0Q7PqkE.js";import"./index-Bdp5erAT.js";import"./index-DnbC6_Py.js";import"./utils-B7o975cr.js";import"./check-Chom1XTU.js";import"./createLucideIcon-CN_pcOxQ.js";import"./chevron-down-DpyZTu1h.js";const{expect:g,userEvent:v,within:S}=__STORYBOOK_MODULE_TEST__,pe={title:"Primitives/Select",component:t,subcomponents:{SelectTrigger:p,SelectContent:m,SelectItem:o},tags:["autodocs"],args:{defaultValue:"codex"},render:a=>e.jsxs(t,{...a,children:[e.jsx(p,{"aria-label":"Agent model",className:"w-64",children:e.jsx(b,{placeholder:"Choose model"})}),e.jsxs(m,{children:[e.jsx(o,{value:"codex",children:"Codex"}),e.jsx(o,{value:"claude",children:"Claude"}),e.jsx(o,{value:"offline",disabled:!0,children:"Local model · offline"})]})]})},l={},s={args:{defaultValue:"view"},render:a=>e.jsxs(t,{...a,children:[e.jsx(p,{"aria-label":"Session permission",className:"w-64",children:e.jsx(b,{})}),e.jsxs(m,{children:[e.jsx(o,{value:"view",children:"VIEW · Read only"}),e.jsx(o,{value:"control",children:"CONTROL · Can send messages"})]})]})},r={args:{disabled:!0}},n={render:a=>e.jsxs(t,{...a,children:[e.jsx(p,{"aria-label":"Agent model","aria-invalid":!0,className:"w-64 border-status-error",children:e.jsx(b,{})}),e.jsx(m,{children:e.jsx(o,{value:"codex",children:"Codex"})})]})},c={play:async({canvasElement:a})=>{const w=S(a).getByRole("combobox");w.focus(),await v.keyboard("{Enter}"),await v.keyboard("{ArrowDown}{Enter}"),await g(w).toHaveTextContent("Claude")}},i={render:()=>e.jsxs(t,{native:!0,"aria-label":"Agent model",defaultValue:"codex",children:[e.jsx("option",{value:"codex",children:"Codex"}),e.jsx("option",{value:"claude",children:"Claude"})]}),play:async({canvasElement:a})=>{const x=S(a).getByRole("combobox");await v.selectOptions(x,"claude"),await g(x).toHaveValue("claude")}},d={render:()=>e.jsx(t,{native:!0,"aria-label":"Permissions",defaultValue:"view",disabled:!0,children:e.jsx("option",{value:"view",children:"View only"})}),play:async({canvasElement:a})=>{await g(S(a).getByRole("combobox")).toBeDisabled()}},u={render:()=>e.jsxs("div",{className:"space-y-4 bg-surface-messages p-4",children:[e.jsxs("label",{className:"block text-text-muted",children:["Default agent",e.jsxs(t,{native:!0,"aria-label":"Default agent",className:"mt-2 block w-full px-3 py-2",defaultValue:"codex",children:[e.jsx("option",{value:"codex",children:"Codex"}),e.jsx("option",{value:"claude",children:"Claude"})]})]}),e.jsxs("label",{className:"block text-text-muted",children:["New conversation permissions",e.jsxs(t,{native:!0,"aria-label":"New conversation permissions",className:"mt-2 block w-full px-3 py-2",defaultValue:"default",children:[e.jsx("option",{value:"default",children:"Ask when needed"}),e.jsx("option",{value:"read-only",children:"Read only"})]})]})]})},xe=["Model","Permission","ReadOnlyCollaborator","Invalid","Keyboard","NativeModel","NativeReadOnly","NativeSettings"];var y,h,f;l.parameters={...l.parameters,docs:{...(y=l.parameters)==null?void 0:y.docs,source:{originalSource:"{}",...(f=(h=l.parameters)==null?void 0:h.docs)==null?void 0:f.source}}};var j,C,N;s.parameters={...s.parameters,docs:{...(j=s.parameters)==null?void 0:j.docs,source:{originalSource:`{
  args: {
    defaultValue: 'view'
  },
  render: args => <Select {...args}><SelectTrigger aria-label="Session permission" className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="view">VIEW · Read only</SelectItem><SelectItem value="control">CONTROL · Can send messages</SelectItem></SelectContent></Select>
}`,...(N=(C=s.parameters)==null?void 0:C.docs)==null?void 0:N.source}}};var E,V,R;r.parameters={...r.parameters,docs:{...(E=r.parameters)==null?void 0:E.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(R=(V=r.parameters)==null?void 0:V.docs)==null?void 0:R.source}}};var O,k,T;n.parameters={...n.parameters,docs:{...(O=n.parameters)==null?void 0:O.docs,source:{originalSource:`{
  render: args => <Select {...args}><SelectTrigger aria-label="Agent model" aria-invalid className="w-64 border-status-error"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="codex">Codex</SelectItem></SelectContent></Select>
}`,...(T=(k=n.parameters)==null?void 0:k.docs)==null?void 0:T.source}}};var B,I,A;c.parameters={...c.parameters,docs:{...(B=c.parameters)==null?void 0:B.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(trigger).toHaveTextContent('Claude');
  }
}`,...(A=(I=c.parameters)==null?void 0:I.docs)==null?void 0:A.source}}};var D,_,M;i.parameters={...i.parameters,docs:{...(D=i.parameters)==null?void 0:D.docs,source:{originalSource:`{
  render: () => <Select native aria-label="Agent model" defaultValue="codex"><option value="codex">Codex</option><option value="claude">Claude</option></Select>,
  play: async ({
    canvasElement
  }) => {
    const select = within(canvasElement).getByRole('combobox');
    await userEvent.selectOptions(select, 'claude');
    await expect(select).toHaveValue('claude');
  }
}`,...(M=(_=i.parameters)==null?void 0:_.docs)==null?void 0:M.source}}};var P,H,L;d.parameters={...d.parameters,docs:{...(P=d.parameters)==null?void 0:P.docs,source:{originalSource:`{
  render: () => <Select native aria-label="Permissions" defaultValue="view" disabled><option value="view">View only</option></Select>,
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('combobox')).toBeDisabled();
  }
}`,...(L=(H=d.parameters)==null?void 0:H.docs)==null?void 0:L.source}}};var K,W,U;u.parameters={...u.parameters,docs:{...(K=u.parameters)==null?void 0:K.docs,source:{originalSource:`{
  render: () => <div className="space-y-4 bg-surface-messages p-4"><label className="block text-text-muted">Default agent<Select native aria-label="Default agent" className="mt-2 block w-full px-3 py-2" defaultValue="codex"><option value="codex">Codex</option><option value="claude">Claude</option></Select></label><label className="block text-text-muted">New conversation permissions<Select native aria-label="New conversation permissions" className="mt-2 block w-full px-3 py-2" defaultValue="default"><option value="default">Ask when needed</option><option value="read-only">Read only</option></Select></label></div>
}`,...(U=(W=u.parameters)==null?void 0:W.docs)==null?void 0:U.source}}};export{n as Invalid,c as Keyboard,l as Model,i as NativeModel,d as NativeReadOnly,u as NativeSettings,s as Permission,r as ReadOnlyCollaborator,xe as __namedExportsOrder,pe as default};

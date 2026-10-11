import{j as e}from"./iframe-BOlOcktz.js";import{S as r,a as m,b as u,c as t,d as x}from"./select-B18DPH7j.js";import"./preload-helper-D6W3bvzQ.js";import"./index-B-iRab8W.js";import"./index-CI6IeoH0.js";import"./index-BdQq_4o_.js";import"./index-DcWWjj0g.js";import"./index-DszZT9yc.js";import"./index-DWVDe7sO.js";import"./index-CLWpyE0l.js";import"./index-YGWuIb40.js";import"./index-CkWDtAJP.js";import"./index-DSkAjUYK.js";import"./index-zTO-c2Cr.js";import"./Combination-C0-Js29n.js";import"./index-_nmx2gS7.js";import"./index-wkeOesEn.js";import"./index-Dxe6Gktq.js";import"./index-CzawmuLc.js";import"./utils-B7o975cr.js";import"./check-DnZ2MnjI.js";import"./createLucideIcon-BKtcNsTW.js";import"./chevron-down-D3xL0QhO.js";const{expect:g,userEvent:v,within:S}=__STORYBOOK_MODULE_TEST__,ie={title:"Primitives/Select",component:t,subcomponents:{SelectTrigger:u,SelectContent:m,SelectItem:r},tags:["autodocs"],args:{defaultValue:"codex"},render:a=>e.jsxs(t,{...a,children:[e.jsx(u,{"aria-label":"Agent model",className:"w-64",children:e.jsx(x,{placeholder:"Choose model"})}),e.jsxs(m,{children:[e.jsx(r,{value:"codex",children:"Codex"}),e.jsx(r,{value:"claude",children:"Claude"}),e.jsx(r,{value:"offline",disabled:!0,children:"Local model · offline"})]})]})},o={},s={args:{defaultValue:"view"},render:a=>e.jsxs(t,{...a,children:[e.jsx(u,{"aria-label":"Session permission",className:"w-64",children:e.jsx(x,{})}),e.jsxs(m,{children:[e.jsx(r,{value:"view",children:"VIEW · Read only"}),e.jsx(r,{value:"control",children:"CONTROL · Can send messages"})]})]})},n={args:{disabled:!0}},l={render:a=>e.jsxs(t,{...a,children:[e.jsx(u,{"aria-label":"Agent model","aria-invalid":!0,className:"w-64 border-status-error",children:e.jsx(x,{})}),e.jsx(m,{children:e.jsx(r,{value:"codex",children:"Codex"})})]})},c={play:async({canvasElement:a})=>{const b=S(a).getByRole("combobox");b.focus(),await v.keyboard("{Enter}"),await v.keyboard("{ArrowDown}{Enter}"),await g(b).toHaveTextContent("Claude")}},i={render:()=>e.jsxs(t,{native:!0,"aria-label":"Agent model",defaultValue:"codex",children:[e.jsx("option",{value:"codex",children:"Codex"}),e.jsx("option",{value:"claude",children:"Claude"})]}),play:async({canvasElement:a})=>{const p=S(a).getByRole("combobox");await v.selectOptions(p,"claude"),await g(p).toHaveValue("claude")}},d={render:()=>e.jsx(t,{native:!0,"aria-label":"Permissions",defaultValue:"view",disabled:!0,children:e.jsx("option",{value:"view",children:"View only"})}),play:async({canvasElement:a})=>{await g(S(a).getByRole("combobox")).toBeDisabled()}},de=["Model","Permission","ReadOnlyCollaborator","Invalid","Keyboard","NativeModel","NativeReadOnly"];var w,y,h;o.parameters={...o.parameters,docs:{...(w=o.parameters)==null?void 0:w.docs,source:{originalSource:"{}",...(h=(y=o.parameters)==null?void 0:y.docs)==null?void 0:h.source}}};var j,C,E;s.parameters={...s.parameters,docs:{...(j=s.parameters)==null?void 0:j.docs,source:{originalSource:`{
  args: {
    defaultValue: 'view'
  },
  render: args => <Select {...args}><SelectTrigger aria-label="Session permission" className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="view">VIEW · Read only</SelectItem><SelectItem value="control">CONTROL · Can send messages</SelectItem></SelectContent></Select>
}`,...(E=(C=s.parameters)==null?void 0:C.docs)==null?void 0:E.source}}};var f,R,V;n.parameters={...n.parameters,docs:{...(f=n.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(V=(R=n.parameters)==null?void 0:R.docs)==null?void 0:V.source}}};var O,T,B;l.parameters={...l.parameters,docs:{...(O=l.parameters)==null?void 0:O.docs,source:{originalSource:`{
  render: args => <Select {...args}><SelectTrigger aria-label="Agent model" aria-invalid className="w-64 border-status-error"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="codex">Codex</SelectItem></SelectContent></Select>
}`,...(B=(T=l.parameters)==null?void 0:T.docs)==null?void 0:B.source}}};var I,N,_;c.parameters={...c.parameters,docs:{...(I=c.parameters)==null?void 0:I.docs,source:{originalSource:`{
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
}`,...(_=(N=c.parameters)==null?void 0:N.docs)==null?void 0:_.source}}};var A,D,M;i.parameters={...i.parameters,docs:{...(A=i.parameters)==null?void 0:A.docs,source:{originalSource:`{
  render: () => <Select native aria-label="Agent model" defaultValue="codex"><option value="codex">Codex</option><option value="claude">Claude</option></Select>,
  play: async ({
    canvasElement
  }) => {
    const select = within(canvasElement).getByRole('combobox');
    await userEvent.selectOptions(select, 'claude');
    await expect(select).toHaveValue('claude');
  }
}`,...(M=(D=i.parameters)==null?void 0:D.docs)==null?void 0:M.source}}};var P,k,H;d.parameters={...d.parameters,docs:{...(P=d.parameters)==null?void 0:P.docs,source:{originalSource:`{
  render: () => <Select native aria-label="Permissions" defaultValue="view" disabled><option value="view">View only</option></Select>,
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('combobox')).toBeDisabled();
  }
}`,...(H=(k=d.parameters)==null?void 0:k.docs)==null?void 0:H.source}}};export{l as Invalid,c as Keyboard,o as Model,i as NativeModel,d as NativeReadOnly,s as Permission,n as ReadOnlyCollaborator,de as __namedExportsOrder,ie as default};

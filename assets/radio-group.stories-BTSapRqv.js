import{j as e}from"./iframe-C30QeG3e.js";import{R as a,a as i}from"./choice-BW4eZoSd.js";import"./preload-helper-D6W3bvzQ.js";import"./index-Bx4RmBV1.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-DXdei5Yc.js";import"./index-CsaGnVJ7.js";import"./index-rWZk3uLI.js";import"./index-CBNOem9o.js";import"./index-Cs7Omgh0.js";import"./index-BWdqTsTJ.js";import"./utils-B7o975cr.js";import"./check-Drblxday.js";import"./createLucideIcon-DiERuOeT.js";const{expect:v,userEvent:c,within:y,waitFor:g}=__STORYBOOK_MODULE_TEST__,C={title:"Primitives/RadioGroup",component:i,subcomponents:{RadioGroupItem:a},tags:["autodocs"],args:{"aria-label":"Approval policy",defaultValue:"ask"},render:t=>e.jsxs(i,{...t,children:[e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(a,{value:"ask"}),"Ask before commands"]}),e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(a,{value:"files"}),"Allow file edits"]}),e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(a,{value:"network",disabled:!0}),"Network unavailable"]})]})},r={},o={args:{disabled:!0}},s={play:async({canvasElement:t})=>{const n=y(t);n.getByRole("radio",{name:"Ask before commands"}).focus(),await c.keyboard("{ArrowDown>}"),await g(()=>v(n.getByRole("radio",{name:"Allow file edits"})).toBeChecked()),await c.keyboard("{/ArrowDown}")}},F=["Selected","Disabled","Keyboard"];var l,m,d;r.parameters={...r.parameters,docs:{...(l=r.parameters)==null?void 0:l.docs,source:{originalSource:"{}",...(d=(m=r.parameters)==null?void 0:m.docs)==null?void 0:d.source}}};var p,u,w;o.parameters={...o.parameters,docs:{...(p=o.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(w=(u=o.parameters)==null?void 0:u.docs)==null?void 0:w.source}}};var b,f,x;s.parameters={...s.parameters,docs:{...(b=s.parameters)==null?void 0:b.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('radio', {
      name: 'Ask before commands'
    }).focus();
    await userEvent.keyboard('{ArrowDown>}');
    await waitFor(() => expect(canvas.getByRole('radio', {
      name: 'Allow file edits'
    })).toBeChecked());
    await userEvent.keyboard('{/ArrowDown}');
  }
}`,...(x=(f=s.parameters)==null?void 0:f.docs)==null?void 0:x.source}}};export{o as Disabled,s as Keyboard,r as Selected,F as __namedExportsOrder,C as default};

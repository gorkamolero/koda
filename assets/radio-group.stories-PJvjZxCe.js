import{j as e}from"./iframe-BDUbmM24.js";import{R as a,a as i}from"./choice-116u0UqV.js";import"./preload-helper-D6W3bvzQ.js";import"./index-CL0zHlKb.js";import"./index-OlRYfNBu.js";import"./index-iWPVPrYK.js";import"./index-CDLDA8NU.js";import"./index-DbX3ht9U.js";import"./index-DIxJW5Vf.js";import"./index-FqwwTXOA.js";import"./index-Bk0okdtA.js";import"./index-BZr_kTKH.js";import"./utils-B7o975cr.js";import"./check-cfLWj2WE.js";import"./createLucideIcon-B6tXQlyD.js";const{expect:v,userEvent:c,within:y,waitFor:g}=__STORYBOOK_MODULE_TEST__,C={title:"Primitives/RadioGroup",component:i,subcomponents:{RadioGroupItem:a},tags:["autodocs"],args:{"aria-label":"Approval policy",defaultValue:"ask"},render:t=>e.jsxs(i,{...t,children:[e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(a,{value:"ask"}),"Ask before commands"]}),e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(a,{value:"files"}),"Allow file edits"]}),e.jsxs("label",{className:"flex items-center gap-2",children:[e.jsx(a,{value:"network",disabled:!0}),"Network unavailable"]})]})},r={},o={args:{disabled:!0}},s={play:async({canvasElement:t})=>{const n=y(t);n.getByRole("radio",{name:"Ask before commands"}).focus(),await c.keyboard("{ArrowDown>}"),await g(()=>v(n.getByRole("radio",{name:"Allow file edits"})).toBeChecked()),await c.keyboard("{/ArrowDown}")}},F=["Selected","Disabled","Keyboard"];var l,m,d;r.parameters={...r.parameters,docs:{...(l=r.parameters)==null?void 0:l.docs,source:{originalSource:"{}",...(d=(m=r.parameters)==null?void 0:m.docs)==null?void 0:d.source}}};var p,u,w;o.parameters={...o.parameters,docs:{...(p=o.parameters)==null?void 0:p.docs,source:{originalSource:`{
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

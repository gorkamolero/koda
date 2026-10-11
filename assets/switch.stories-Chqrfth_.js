import{j as c}from"./iframe-C30QeG3e.js";import{S as n}from"./choice-BW4eZoSd.js";import"./preload-helper-D6W3bvzQ.js";import"./index-Bx4RmBV1.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-DXdei5Yc.js";import"./index-CsaGnVJ7.js";import"./index-rWZk3uLI.js";import"./index-CBNOem9o.js";import"./index-Cs7Omgh0.js";import"./index-BWdqTsTJ.js";import"./utils-B7o975cr.js";import"./check-Drblxday.js";import"./createLucideIcon-DiERuOeT.js";const{expect:w,userEvent:O,within:S}=__STORYBOOK_MODULE_TEST__,U={title:"Primitives/Switch",component:n,tags:["autodocs"],args:{"aria-label":"Desktop notifications"},render:a=>c.jsxs("label",{className:"flex items-center gap-3 font-code text-sm text-text-primary",children:[c.jsx(n,{...a}),"Desktop notifications"]})},e={},r={args:{defaultChecked:!0}},t={args:{disabled:!0}},o={play:async({canvasElement:a})=>{const s=S(a).getByRole("switch");s.focus(),await O.keyboard(" "),await w(s).toBeChecked()}},Y=["Off","On","Disabled","Keyboard"];var i,m,p;e.parameters={...e.parameters,docs:{...(i=e.parameters)==null?void 0:i.docs,source:{originalSource:"{}",...(p=(m=e.parameters)==null?void 0:m.docs)==null?void 0:p.source}}};var d,l,u;r.parameters={...r.parameters,docs:{...(d=r.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    defaultChecked: true
  }
}`,...(u=(l=r.parameters)==null?void 0:l.docs)==null?void 0:u.source}}};var f,g,x;t.parameters={...t.parameters,docs:{...(f=t.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(x=(g=t.parameters)==null?void 0:g.docs)==null?void 0:x.source}}};var h,y,b;o.parameters={...o.parameters,docs:{...(h=o.parameters)==null?void 0:h.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const control = within(canvasElement).getByRole('switch');
    control.focus();
    await userEvent.keyboard(' ');
    await expect(control).toBeChecked();
  }
}`,...(b=(y=o.parameters)==null?void 0:y.docs)==null?void 0:b.source}}};export{t as Disabled,o as Keyboard,e as Off,r as On,Y as __namedExportsOrder,U as default};

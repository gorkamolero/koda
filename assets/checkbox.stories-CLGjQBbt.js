import{j as n}from"./iframe-C30QeG3e.js";import{C as i}from"./choice-BW4eZoSd.js";import"./preload-helper-D6W3bvzQ.js";import"./index-Bx4RmBV1.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-DXdei5Yc.js";import"./index-CsaGnVJ7.js";import"./index-rWZk3uLI.js";import"./index-CBNOem9o.js";import"./index-Cs7Omgh0.js";import"./index-BWdqTsTJ.js";import"./utils-B7o975cr.js";import"./check-Drblxday.js";import"./createLucideIcon-DiERuOeT.js";const{expect:S,userEvent:w,within:v}=__STORYBOOK_MODULE_TEST__,z={title:"Primitives/Checkbox",component:i,tags:["autodocs"],args:{"aria-label":"Include untracked files"},render:s=>n.jsxs("label",{className:"flex items-center gap-3 font-code text-sm text-text-primary",children:[n.jsx(i,{...s}),"Include untracked files"]})},e={},r={args:{defaultChecked:!0}},t={args:{checked:"indeterminate"}},a={args:{disabled:!0}},o={play:async({canvasElement:s})=>{const c=v(s).getByRole("checkbox");c.focus(),await w.keyboard(" "),await S(c).toBeChecked()}},A=["Unchecked","Checked","Indeterminate","Disabled","Keyboard"];var d,m,p;e.parameters={...e.parameters,docs:{...(d=e.parameters)==null?void 0:d.docs,source:{originalSource:"{}",...(p=(m=e.parameters)==null?void 0:m.docs)==null?void 0:p.source}}};var l,u,k;r.parameters={...r.parameters,docs:{...(l=r.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    defaultChecked: true
  }
}`,...(k=(u=r.parameters)==null?void 0:u.docs)==null?void 0:k.source}}};var h,g,x;t.parameters={...t.parameters,docs:{...(h=t.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    checked: 'indeterminate'
  }
}`,...(x=(g=t.parameters)==null?void 0:g.docs)==null?void 0:x.source}}};var b,f,y;a.parameters={...a.parameters,docs:{...(b=a.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(y=(f=a.parameters)==null?void 0:f.docs)==null?void 0:y.source}}};var C,E,_;o.parameters={...o.parameters,docs:{...(C=o.parameters)==null?void 0:C.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const control = within(canvasElement).getByRole('checkbox');
    control.focus();
    await userEvent.keyboard(' ');
    await expect(control).toBeChecked();
  }
}`,...(_=(E=o.parameters)==null?void 0:E.docs)==null?void 0:_.source}}};export{r as Checked,a as Disabled,t as Indeterminate,o as Keyboard,e as Unchecked,A as __namedExportsOrder,z as default};

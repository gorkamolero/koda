import{j as o}from"./iframe-BDUbmM24.js";import{B as N}from"./badge-DrkOXWGm.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";const _={title:"Primitives/Badge",component:N,tags:["autodocs"],args:{children:"CODEX"}},e={},r={args:{variant:"accent"}},s={args:{variant:"outline"}},a={args:{size:"sm"},render:O=>o.jsx("div",{className:"flex gap-3",children:["neutral","accent","outline"].map(n=>o.jsx(N,{...O,variant:n},n))})},t={...a,args:{size:"md"}},k=["Neutral","Accent","Outline","Small","Medium"];var c,m,i;e.parameters={...e.parameters,docs:{...(c=e.parameters)==null?void 0:c.docs,source:{originalSource:"{}",...(i=(m=e.parameters)==null?void 0:m.docs)==null?void 0:i.source}}};var d,p,u;r.parameters={...r.parameters,docs:{...(d=r.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    variant: 'accent'
  }
}`,...(u=(p=r.parameters)==null?void 0:p.docs)==null?void 0:u.source}}};var l,g,v;s.parameters={...s.parameters,docs:{...(l=s.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    variant: 'outline'
  }
}`,...(v=(g=s.parameters)==null?void 0:g.docs)==null?void 0:v.source}}};var x,S,f;a.parameters={...a.parameters,docs:{...(x=a.parameters)==null?void 0:x.docs,source:{originalSource:`{
  args: {
    size: 'sm'
  },
  render: args => <div className="flex gap-3">{(['neutral', 'accent', 'outline'] as const).map(variant => <Badge key={variant} {...args} variant={variant} />)}</div>
}`,...(f=(S=a.parameters)==null?void 0:S.docs)==null?void 0:f.source}}};var j,z,B;t.parameters={...t.parameters,docs:{...(j=t.parameters)==null?void 0:j.docs,source:{originalSource:`{
  ...Small,
  args: {
    size: 'md'
  }
}`,...(B=(z=t.parameters)==null?void 0:z.docs)==null?void 0:B.source}}};export{r as Accent,t as Medium,e as Neutral,s as Outline,a as Small,k as __namedExportsOrder,_ as default};

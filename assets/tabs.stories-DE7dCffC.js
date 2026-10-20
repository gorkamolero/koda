import{j as e}from"./iframe-DE7TzujU.js";import{T as i,a,b as c,c as l}from"./tabs-Db-45CAt.js";import"./preload-helper-D6W3bvzQ.js";import"./index-VVr9I5lv.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";import"./index-D_CN-DGt.js";import"./index-B8itXeje.js";import"./index-DAhMItIG.js";import"./index-DisSJ1av.js";import"./index-D-meXGpZ.js";import"./index-DGAFZVLh.js";import"./index-Bdp5erAT.js";import"./index-DqpRPQyA.js";import"./index-Dxe8mkPd.js";import"./utils-B7o975cr.js";const{expect:m,userEvent:f,within:T}=__STORYBOOK_MODULE_TEST__,D={title:"Primitives/Tabs",component:l,subcomponents:{TabsList:c,TabsTrigger:a,TabsContent:i},tags:["autodocs"],args:{defaultValue:"files"},render:n=>e.jsxs(l,{...n,children:[e.jsxs(c,{"aria-label":"Workspace panels",children:[e.jsx(a,{value:"files",children:"Files"}),e.jsx(a,{value:"changes",children:"Changes · 3"}),e.jsx(a,{value:"checks",disabled:!0,children:"Checks"})]}),e.jsx(i,{value:"files",className:"p-4 font-code text-sm text-text-primary",children:"src/components, README.md, package.json"}),e.jsx(i,{value:"changes",className:"p-4 font-code text-sm text-text-primary",children:"3 files changed · +84 −12"})]})},t={},s={args:{variant:"underline"}},r={play:async({canvasElement:n})=>{const o=T(n);o.getByRole("tab",{name:"Files"}).focus(),await f.keyboard("{ArrowRight}"),await m(o.getByRole("tab",{name:"Changes · 3"})).toHaveAttribute("aria-selected","true"),await m(o.getByRole("tabpanel")).toHaveTextContent("3 files changed")}},L=["Panel","Underline","Keyboard"];var p,d,u;t.parameters={...t.parameters,docs:{...(p=t.parameters)==null?void 0:p.docs,source:{originalSource:"{}",...(u=(d=t.parameters)==null?void 0:d.docs)==null?void 0:u.source}}};var g,x,b;s.parameters={...s.parameters,docs:{...(g=s.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    variant: 'underline'
  }
}`,...(b=(x=s.parameters)==null?void 0:x.docs)==null?void 0:b.source}}};var h,v,y;r.parameters={...r.parameters,docs:{...(h=r.parameters)==null?void 0:h.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('tab', {
      name: 'Files'
    }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', {
      name: 'Changes · 3'
    })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('3 files changed');
  }
}`,...(y=(v=r.parameters)==null?void 0:v.docs)==null?void 0:y.source}}};export{r as Keyboard,t as Panel,s as Underline,L as __namedExportsOrder,D as default};

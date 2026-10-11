import{j as e}from"./iframe-BOlOcktz.js";import{T as i,a,b as c,c as l}from"./tabs-C0dvLFau.js";import"./preload-helper-D6W3bvzQ.js";import"./index-DcWWjj0g.js";import"./index-B-iRab8W.js";import"./index-CI6IeoH0.js";import"./index-DszZT9yc.js";import"./index-DUSu_92s.js";import"./index-DWVDe7sO.js";import"./index-_nmx2gS7.js";import"./index-DSkAjUYK.js";import"./index-CkWDtAJP.js";import"./index-Dxe6Gktq.js";import"./index-CLWpyE0l.js";import"./index-BlUyFi_Y.js";import"./utils-B7o975cr.js";const{expect:m,userEvent:f,within:T}=__STORYBOOK_MODULE_TEST__,D={title:"Primitives/Tabs",component:l,subcomponents:{TabsList:c,TabsTrigger:a,TabsContent:i},tags:["autodocs"],args:{defaultValue:"files"},render:n=>e.jsxs(l,{...n,children:[e.jsxs(c,{"aria-label":"Workspace panels",children:[e.jsx(a,{value:"files",children:"Files"}),e.jsx(a,{value:"changes",children:"Changes · 3"}),e.jsx(a,{value:"checks",disabled:!0,children:"Checks"})]}),e.jsx(i,{value:"files",className:"p-4 font-code text-sm text-text-primary",children:"src/components, README.md, package.json"}),e.jsx(i,{value:"changes",className:"p-4 font-code text-sm text-text-primary",children:"3 files changed · +84 −12"})]})},t={},s={args:{variant:"underline"}},r={play:async({canvasElement:n})=>{const o=T(n);o.getByRole("tab",{name:"Files"}).focus(),await f.keyboard("{ArrowRight}"),await m(o.getByRole("tab",{name:"Changes · 3"})).toHaveAttribute("aria-selected","true"),await m(o.getByRole("tabpanel")).toHaveTextContent("3 files changed")}},L=["Panel","Underline","Keyboard"];var p,d,u;t.parameters={...t.parameters,docs:{...(p=t.parameters)==null?void 0:p.docs,source:{originalSource:"{}",...(u=(d=t.parameters)==null?void 0:d.docs)==null?void 0:u.source}}};var g,x,b;s.parameters={...s.parameters,docs:{...(g=s.parameters)==null?void 0:g.docs,source:{originalSource:`{
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

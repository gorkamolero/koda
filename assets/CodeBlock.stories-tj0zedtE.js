import{C as S}from"./index-hftMsCUE.js";import"./iframe-C30QeG3e.js";import"./preload-helper-D6W3bvzQ.js";import"./index-Dgyi4PT8.js";import"./index-CsaGnVJ7.js";import"./utils-B7o975cr.js";import"./createLucideIcon-DiERuOeT.js";import"./button-Bwmd7Lx7.js";import"./index-DXdei5Yc.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-BhoyFe3d.js";import"./index-DfSbsrIq.js";import"./index-CBNOem9o.js";import"./index-BWdqTsTJ.js";import"./index-BdqpzMJG.js";import"./index-DEQL6lI-.js";import"./index-jxSttbKr.js";import"./index-rWZk3uLI.js";import"./chevron-down-jjy896LW.js";import"./chevron-right-DkAA3o_8.js";const{expect:f,userEvent:B,within:h,fn:E}=__STORYBOOK_MODULE_TEST__,N={title:"Brand/CodeBlock",component:S,tags:["autodocs"],parameters:{layout:"padded"},args:{language:"typescript",code:`const workspace = await koda.workspaces.create({ name: 'Fix reconnect handling' })
console.log(workspace.id)`,onCopy:E()}},e={},o={args:{wrap:!0,code:"pnpm --filter @koda/desktop test -- src/__tests__/components/WorkspaceSharing.test.tsx src/__tests__/components/QuestionRequests.test.tsx"}},t={args:{copied:!0}},r={play:async({canvasElement:x,args:s})=>{await B.click(h(x).getByRole("button",{name:"Copy code"})),await f(s.onCopy).toHaveBeenCalledWith(s.code)}},a={args:{onCopy:void 0}},P=["Default","Wrapped","Copied","Copy","CopyUnavailable"];var n,p,c;e.parameters={...e.parameters,docs:{...(n=e.parameters)==null?void 0:n.docs,source:{originalSource:"{}",...(c=(p=e.parameters)==null?void 0:p.docs)==null?void 0:c.source}}};var i,m,d;o.parameters={...o.parameters,docs:{...(i=o.parameters)==null?void 0:i.docs,source:{originalSource:`{
  args: {
    wrap: true,
    code: 'pnpm --filter @koda/desktop test -- src/__tests__/components/WorkspaceSharing.test.tsx src/__tests__/components/QuestionRequests.test.tsx'
  }
}`,...(d=(m=o.parameters)==null?void 0:m.docs)==null?void 0:d.source}}};var l,u,_;t.parameters={...t.parameters,docs:{...(l=t.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    copied: true
  }
}`,...(_=(u=t.parameters)==null?void 0:u.docs)==null?void 0:_.source}}};var g,y,C;r.parameters={...r.parameters,docs:{...(g=r.parameters)==null?void 0:g.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    await userEvent.click(within(canvasElement).getByRole('button', {
      name: 'Copy code'
    }));
    await expect(args.onCopy).toHaveBeenCalledWith(args.code);
  }
}`,...(C=(y=r.parameters)==null?void 0:y.docs)==null?void 0:C.source}}};var k,w,v;a.parameters={...a.parameters,docs:{...(k=a.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    onCopy: undefined
  }
}`,...(v=(w=a.parameters)==null?void 0:w.docs)==null?void 0:v.source}}};export{t as Copied,r as Copy,a as CopyUnavailable,e as Default,o as Wrapped,P as __namedExportsOrder,N as default};

import{D as E}from"./index-hftMsCUE.js";import"./iframe-C30QeG3e.js";import"./preload-helper-D6W3bvzQ.js";import"./index-Dgyi4PT8.js";import"./index-CsaGnVJ7.js";import"./utils-B7o975cr.js";import"./createLucideIcon-DiERuOeT.js";import"./button-Bwmd7Lx7.js";import"./index-DXdei5Yc.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-BhoyFe3d.js";import"./index-DfSbsrIq.js";import"./index-CBNOem9o.js";import"./index-BWdqTsTJ.js";import"./index-BdqpzMJG.js";import"./index-DEQL6lI-.js";import"./index-jxSttbKr.js";import"./index-rWZk3uLI.js";import"./chevron-down-jjy896LW.js";import"./chevron-right-DkAA3o_8.js";const{expect:i,within:b}=__STORYBOOK_MODULE_TEST__,Q={title:"Brand/DiffStat",component:E,tags:["autodocs"],parameters:{layout:"padded"},args:{additions:12,deletions:3,showBar:!0}},e={},t={args:{additions:42,deletions:0}},s={args:{additions:0,deletions:8}},a={args:{additions:0,deletions:0}},o={args:{showBar:!1}},r={args:{additions:3,deletions:0,showBar:!1,hideZero:!0},play:async({canvasElement:v})=>{const n=b(v);await i(n.getByRole("img",{name:"3 additions, 0 deletions"})).toBeVisible(),await i(n.getByText("+3")).toBeVisible(),await i(n.queryByText("−0")).not.toBeInTheDocument()}},W=["Mixed","OnlyAdditions","OnlyDeletions","Unchanged","CountsOnly","HideZeroCounts"];var d,c,m;e.parameters={...e.parameters,docs:{...(d=e.parameters)==null?void 0:d.docs,source:{originalSource:"{}",...(m=(c=e.parameters)==null?void 0:c.docs)==null?void 0:m.source}}};var p,l,u;t.parameters={...t.parameters,docs:{...(p=t.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    additions: 42,
    deletions: 0
  }
}`,...(u=(l=t.parameters)==null?void 0:l.docs)==null?void 0:u.source}}};var g,y,B;s.parameters={...s.parameters,docs:{...(g=s.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    additions: 0,
    deletions: 8
  }
}`,...(B=(y=s.parameters)==null?void 0:y.docs)==null?void 0:B.source}}};var h,w,x;a.parameters={...a.parameters,docs:{...(h=a.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    additions: 0,
    deletions: 0
  }
}`,...(x=(w=a.parameters)==null?void 0:w.docs)==null?void 0:x.source}}};var O,f,S;o.parameters={...o.parameters,docs:{...(O=o.parameters)==null?void 0:O.docs,source:{originalSource:`{
  args: {
    showBar: false
  }
}`,...(S=(f=o.parameters)==null?void 0:f.docs)==null?void 0:S.source}}};var T,D,_;r.parameters={...r.parameters,docs:{...(T=r.parameters)==null?void 0:T.docs,source:{originalSource:`{
  args: {
    additions: 3,
    deletions: 0,
    showBar: false,
    hideZero: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', {
      name: '3 additions, 0 deletions'
    })).toBeVisible();
    await expect(canvas.getByText('+3')).toBeVisible();
    await expect(canvas.queryByText('−0')).not.toBeInTheDocument();
  }
}`,...(_=(D=r.parameters)==null?void 0:D.docs)==null?void 0:_.source}}};export{o as CountsOnly,r as HideZeroCounts,e as Mixed,t as OnlyAdditions,s as OnlyDeletions,a as Unchanged,W as __namedExportsOrder,Q as default};

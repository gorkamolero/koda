import{D as E}from"./index-6LWTzUp_.js";import"./iframe-BDUbmM24.js";import"./preload-helper-D6W3bvzQ.js";import"./index-CCQdZNI7.js";import"./index-DbX3ht9U.js";import"./utils-B7o975cr.js";import"./createLucideIcon-B6tXQlyD.js";import"./button-BasZ35wm.js";import"./index-CDLDA8NU.js";import"./index-OlRYfNBu.js";import"./index-iWPVPrYK.js";import"./index-Cic-oAX7.js";import"./index-DV1FpbQh.js";import"./index-FqwwTXOA.js";import"./index-BZr_kTKH.js";import"./index-CWXJao91.js";import"./index-Bh-xOyeg.js";import"./index-D20LO2AZ.js";import"./index-DIxJW5Vf.js";import"./chevron-down-DzoDJT8Q.js";import"./chevron-right-BEutbkUU.js";const{expect:i,within:b}=__STORYBOOK_MODULE_TEST__,Q={title:"Brand/DiffStat",component:E,tags:["autodocs"],parameters:{layout:"padded"},args:{additions:12,deletions:3,showBar:!0}},e={},t={args:{additions:42,deletions:0}},s={args:{additions:0,deletions:8}},a={args:{additions:0,deletions:0}},o={args:{showBar:!1}},r={args:{additions:3,deletions:0,showBar:!1,hideZero:!0},play:async({canvasElement:v})=>{const n=b(v);await i(n.getByRole("img",{name:"3 additions, 0 deletions"})).toBeVisible(),await i(n.getByText("+3")).toBeVisible(),await i(n.queryByText("−0")).not.toBeInTheDocument()}},W=["Mixed","OnlyAdditions","OnlyDeletions","Unchanged","CountsOnly","HideZeroCounts"];var d,c,m;e.parameters={...e.parameters,docs:{...(d=e.parameters)==null?void 0:d.docs,source:{originalSource:"{}",...(m=(c=e.parameters)==null?void 0:c.docs)==null?void 0:m.source}}};var p,l,u;t.parameters={...t.parameters,docs:{...(p=t.parameters)==null?void 0:p.docs,source:{originalSource:`{
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

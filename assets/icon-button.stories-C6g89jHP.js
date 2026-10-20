import{j as T}from"./iframe-DE7TzujU.js";import{I as f}from"./button-Uby9EqSj.js";import{S as E}from"./share-2-CzmRp0Pu.js";import"./preload-helper-D6W3bvzQ.js";import"./index-DoCxpYiM.js";import"./index-D_CN-DGt.js";import"./utils-B7o975cr.js";import"./index-VVr9I5lv.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";import"./index-DVXr51on.js";import"./index-DGAFZVLh.js";import"./index-D-meXGpZ.js";import"./index-COPJbcdq.js";import"./index-DisSJ1av.js";import"./index-C0Q7PqkE.js";import"./index-Dxe8mkPd.js";import"./index-Bdp5erAT.js";import"./createLucideIcon-CN_pcOxQ.js";const{expect:i,userEvent:_,within:n}=__STORYBOOK_MODULE_TEST__,A={title:"Primitives/IconButton",component:f,tags:["autodocs"],args:{"aria-label":"Share workspace",children:T.jsx(E,{})}},e={},o={args:{tooltip:"Share workspace"}},a={args:{disabled:!0}},r={args:{loading:!0}},t={args:{tooltip:"Share workspace"},play:async({canvasElement:s})=>{await _.tab(),await i(n(s).getByRole("button",{name:"Share workspace"})).toHaveFocus(),await i(await n(s.ownerDocument.body).findByRole("tooltip")).toHaveTextContent("Share workspace")}},G=["Default","WithTooltip","Disabled","Loading","TooltipVisible"];var p,c,m;e.parameters={...e.parameters,docs:{...(p=e.parameters)==null?void 0:p.docs,source:{originalSource:"{}",...(m=(c=e.parameters)==null?void 0:c.docs)==null?void 0:m.source}}};var l,d,u;o.parameters={...o.parameters,docs:{...(l=o.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    tooltip: 'Share workspace'
  }
}`,...(u=(d=o.parameters)==null?void 0:d.docs)==null?void 0:u.source}}};var w,g,S;a.parameters={...a.parameters,docs:{...(w=a.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(S=(g=a.parameters)==null?void 0:g.docs)==null?void 0:S.source}}};var h,b,x;r.parameters={...r.parameters,docs:{...(h=r.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    loading: true
  }
}`,...(x=(b=r.parameters)==null?void 0:b.docs)==null?void 0:x.source}}};var y,k,v;t.parameters={...t.parameters,docs:{...(y=t.parameters)==null?void 0:y.docs,source:{originalSource:`{
  args: {
    tooltip: 'Share workspace'
  },
  play: async ({
    canvasElement
  }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole('button', {
      name: 'Share workspace'
    })).toHaveFocus();
    await expect(await within(canvasElement.ownerDocument.body).findByRole('tooltip')).toHaveTextContent('Share workspace');
  }
}`,...(v=(k=t.parameters)==null?void 0:k.docs)==null?void 0:v.source}}};export{e as Default,a as Disabled,r as Loading,t as TooltipVisible,o as WithTooltip,G as __namedExportsOrder,A as default};

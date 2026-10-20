import{S as L}from"./index-wUnCDLfM.js";import"./iframe-DE7TzujU.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-CBiaNcZN.js";import"./index-DoCxpYiM.js";import"./index-D_CN-DGt.js";import"./createLucideIcon-CN_pcOxQ.js";import"./button-Uby9EqSj.js";import"./index-VVr9I5lv.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";import"./index-DVXr51on.js";import"./index-DGAFZVLh.js";import"./index-D-meXGpZ.js";import"./index-COPJbcdq.js";import"./index-DisSJ1av.js";import"./index-C0Q7PqkE.js";import"./index-Dxe8mkPd.js";import"./index-Bdp5erAT.js";import"./chevron-down-DpyZTu1h.js";import"./chevron-right-DZVBjrBM.js";import"./check-Chom1XTU.js";import"./x-BdgyrbM3.js";import"./circle-CJYlI7Zv.js";import"./select-BrHGEVqJ.js";import"./index-BdQq_4o_.js";import"./index-DAhMItIG.js";import"./index-DqpRPQyA.js";import"./Combination-DhmAmB1C.js";import"./index-DnbC6_Py.js";import"./command-DCy9NVkh.js";import"./dialog-cOnglls5.js";import"./index-B9cV_AZ9.js";import"./search-Bv1CouGp.js";const{expect:p,within:m}=__STORYBOOK_MODULE_TEST__,Se={title:"Patterns/SharedBadge",component:L,tags:["autodocs"],parameters:{layout:"padded"},args:{hostName:"Gorka",permission:"control",showStatus:!0}},t={play:async({canvasElement:e})=>{await p(m(e).getByTestId("shared-workspace-badge")).toHaveAttribute("data-permission","control")}},a={args:{permission:"view"},play:async({canvasElement:e})=>{await p(m(e).getByTestId("shared-workspace-badge")).toHaveAttribute("data-permission","view")}},r={args:{status:"connecting"}},o={args:{status:"reconnecting"}},s={args:{status:"disconnected"}},n={args:{status:"initializing"}},i={args:{showStatus:!1}},c={args:{connectionOnly:!0,showLabel:!0},play:async({canvasElement:e})=>{await p(m(e).getByTitle("Collaboration: Connected")).toHaveTextContent("Connected")}},he=["Control","View","Connecting","Reconnecting","Disconnected","Initializing","BadgeOnly","ConnectionStatus"];var d,g,u;t.parameters={...t.parameters,docs:{...(d=t.parameters)==null?void 0:d.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByTestId('shared-workspace-badge')).toHaveAttribute('data-permission', 'control');
  }
}`,...(u=(g=t.parameters)==null?void 0:g.docs)==null?void 0:u.source}}};var l,w,y;a.parameters={...a.parameters,docs:{...(l=a.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    permission: 'view'
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByTestId('shared-workspace-badge')).toHaveAttribute('data-permission', 'view');
  }
}`,...(y=(w=a.parameters)==null?void 0:w.docs)==null?void 0:y.source}}};var S,h,v;r.parameters={...r.parameters,docs:{...(S=r.parameters)==null?void 0:S.docs,source:{originalSource:`{
  args: {
    status: 'connecting'
  }
}`,...(v=(h=r.parameters)==null?void 0:h.docs)==null?void 0:v.source}}};var C,b,B;o.parameters={...o.parameters,docs:{...(C=o.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    status: 'reconnecting'
  }
}`,...(B=(b=o.parameters)==null?void 0:b.docs)==null?void 0:B.source}}};var T,E,O;s.parameters={...s.parameters,docs:{...(T=s.parameters)==null?void 0:T.docs,source:{originalSource:`{
  args: {
    status: 'disconnected'
  }
}`,...(O=(E=s.parameters)==null?void 0:E.docs)==null?void 0:O.source}}};var x,_,H;n.parameters={...n.parameters,docs:{...(x=n.parameters)==null?void 0:x.docs,source:{originalSource:`{
  args: {
    status: 'initializing'
  }
}`,...(H=(_=n.parameters)==null?void 0:_.docs)==null?void 0:H.source}}};var I,k,f;i.parameters={...i.parameters,docs:{...(I=i.parameters)==null?void 0:I.docs,source:{originalSource:`{
  args: {
    showStatus: false
  }
}`,...(f=(k=i.parameters)==null?void 0:k.docs)==null?void 0:f.source}}};var z,A,D;c.parameters={...c.parameters,docs:{...(z=c.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    connectionOnly: true,
    showLabel: true
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByTitle('Collaboration: Connected')).toHaveTextContent('Connected');
  }
}`,...(D=(A=c.parameters)==null?void 0:A.docs)==null?void 0:D.source}}};export{i as BadgeOnly,r as Connecting,c as ConnectionStatus,t as Control,s as Disconnected,n as Initializing,o as Reconnecting,a as View,he as __namedExportsOrder,Se as default};

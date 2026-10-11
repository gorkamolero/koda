import{S as L}from"./index-BK65kbgY.js";import"./iframe-BOlOcktz.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-D38G4VL6.js";import"./index-CJvINIPD.js";import"./index-DszZT9yc.js";import"./createLucideIcon-BKtcNsTW.js";import"./button-DETrAiRn.js";import"./index-DcWWjj0g.js";import"./index-B-iRab8W.js";import"./index-CI6IeoH0.js";import"./index-YGWuIb40.js";import"./index-CkWDtAJP.js";import"./index-DSkAjUYK.js";import"./index-zTO-c2Cr.js";import"./index-_nmx2gS7.js";import"./index-wkeOesEn.js";import"./index-BlUyFi_Y.js";import"./index-Dxe6Gktq.js";import"./chevron-down-D3xL0QhO.js";import"./chevron-right-D4CXFYMT.js";import"./check-DnZ2MnjI.js";import"./x-rhw8hwOp.js";import"./circle-JpOebGTw.js";import"./select-B18DPH7j.js";import"./index-BdQq_4o_.js";import"./index-DWVDe7sO.js";import"./index-CLWpyE0l.js";import"./Combination-C0-Js29n.js";import"./index-CzawmuLc.js";import"./command-BGMfk9ja.js";import"./dialog-HLE40si2.js";import"./index-CxHxyMlZ.js";import"./search-DhSWCOmI.js";const{expect:p,within:m}=__STORYBOOK_MODULE_TEST__,Se={title:"Patterns/SharedBadge",component:L,tags:["autodocs"],parameters:{layout:"padded"},args:{hostName:"Gorka",permission:"control",showStatus:!0}},t={play:async({canvasElement:e})=>{await p(m(e).getByTestId("shared-workspace-badge")).toHaveAttribute("data-permission","control")}},a={args:{permission:"view"},play:async({canvasElement:e})=>{await p(m(e).getByTestId("shared-workspace-badge")).toHaveAttribute("data-permission","view")}},r={args:{status:"connecting"}},o={args:{status:"reconnecting"}},s={args:{status:"disconnected"}},n={args:{status:"initializing"}},i={args:{showStatus:!1}},c={args:{connectionOnly:!0,showLabel:!0},play:async({canvasElement:e})=>{await p(m(e).getByTitle("Collaboration: Connected")).toHaveTextContent("Connected")}},he=["Control","View","Connecting","Reconnecting","Disconnected","Initializing","BadgeOnly","ConnectionStatus"];var d,g,u;t.parameters={...t.parameters,docs:{...(d=t.parameters)==null?void 0:d.docs,source:{originalSource:`{
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

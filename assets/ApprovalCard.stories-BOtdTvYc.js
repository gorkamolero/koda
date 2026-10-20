import{a as te}from"./index-wUnCDLfM.js";import"./iframe-DE7TzujU.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./index-CBiaNcZN.js";import"./index-DoCxpYiM.js";import"./index-D_CN-DGt.js";import"./createLucideIcon-CN_pcOxQ.js";import"./button-Uby9EqSj.js";import"./index-VVr9I5lv.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";import"./index-DVXr51on.js";import"./index-DGAFZVLh.js";import"./index-D-meXGpZ.js";import"./index-COPJbcdq.js";import"./index-DisSJ1av.js";import"./index-C0Q7PqkE.js";import"./index-Dxe8mkPd.js";import"./index-Bdp5erAT.js";import"./chevron-down-DpyZTu1h.js";import"./chevron-right-DZVBjrBM.js";import"./check-Chom1XTU.js";import"./x-BdgyrbM3.js";import"./circle-CJYlI7Zv.js";import"./select-BrHGEVqJ.js";import"./index-BdQq_4o_.js";import"./index-DAhMItIG.js";import"./index-DqpRPQyA.js";import"./Combination-DhmAmB1C.js";import"./index-DnbC6_Py.js";import"./command-DCy9NVkh.js";import"./dialog-cOnglls5.js";import"./index-B9cV_AZ9.js";import"./search-Bv1CouGp.js";const{expect:a,userEvent:oe,within:k,fn:y}=__STORYBOOK_MODULE_TEST__,je={title:"Patterns/ApprovalCard",component:te,tags:["autodocs"],parameters:{layout:"padded"},args:{kind:"command",reason:"Codex needs to run the workspace unit tests to verify the reconnect fix.",command:"pnpm --filter @koda/desktop test -- WorkspaceSharing",path:"/workspaces/koda",onApprove:y(),onDeny:y()}},r={play:async({canvasElement:e,args:n})=>{await oe.click(k(e).getByRole("button",{name:"Approve once"})),await a(n.onApprove).toHaveBeenCalledOnce()}},o={args:{kind:"file",reason:"Codex wants to update the workspace sharing documentation.",command:void 0,path:"/workspaces/koda/DESIGN.md"}},t={args:{kind:"network",reason:"Codex needs to fetch the official package metadata.",command:void 0,path:void 0,network:"https://registry.npmjs.org"}},s={args:{state:"read-only",hostName:"Gorka"},play:async({canvasElement:e,args:n})=>{const w=k(e);await a(w.getByRole("button",{name:"Approve once"})).toBeDisabled(),await a(w.getByRole("button",{name:"Deny"})).toBeDisabled(),await a(n.onApprove).not.toHaveBeenCalled()}},c={args:{hostName:"Gorka"}},i={args:{state:"resolved",resolution:"Approved once by Gorka"}},p={args:{state:"withdrawn"}},m={args:{busy:!0}},d={args:{error:"The host is unreachable. Reconnect before answering."}},l={args:{details:'{ "tool": "exec_command", "command": "pnpm test", "cwd": "/workspaces/koda" }'}},u={play:async({canvasElement:e,args:n})=>{await oe.click(k(e).getByRole("button",{name:"Deny"})),await a(n.onDeny).toHaveBeenCalledOnce()}},g={args:{kind:"file",command:void 0,path:void 0,reason:"Codex wants to apply the reconnect fix and its regression test.",files:[{path:"src/components/WorkspaceSharing.tsx",kind:"Update"},{path:"src/__tests__/WorkspaceSharing.test.tsx",kind:"Update"}]}},h={args:{appearance:"terminal","aria-label":"Permission request: command_execution"},play:async({canvasElement:e})=>{await a(k(e).getByRole("region",{name:"Permission request: command_execution"})).toBeVisible()}},Ie=["CommandRequest","FileRequest","NetworkRequest","ReadOnly","CollaboratorWithControl","Resolved","Withdrawn","Sending","ResponseError","RequestDetails","Deny","FileChanges","TerminalRequest"];var v,x,R;r.parameters={...r.parameters,docs:{...(v=r.parameters)==null?void 0:v.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    await userEvent.click(within(canvasElement).getByRole('button', {
      name: 'Approve once'
    }));
    await expect(args.onApprove).toHaveBeenCalledOnce();
  }
}`,...(R=(x=r.parameters)==null?void 0:x.docs)==null?void 0:R.source}}};var f,b,S;o.parameters={...o.parameters,docs:{...(f=o.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    kind: 'file',
    reason: 'Codex wants to update the workspace sharing documentation.',
    command: undefined,
    path: '/workspaces/koda/DESIGN.md'
  }
}`,...(S=(b=o.parameters)==null?void 0:b.docs)==null?void 0:S.source}}};var B,C,_;t.parameters={...t.parameters,docs:{...(B=t.parameters)==null?void 0:B.docs,source:{originalSource:`{
  args: {
    kind: 'network',
    reason: 'Codex needs to fetch the official package metadata.',
    command: undefined,
    path: undefined,
    network: 'https://registry.npmjs.org'
  }
}`,...(_=(C=t.parameters)==null?void 0:C.docs)==null?void 0:_.source}}};var D,E,q;s.parameters={...s.parameters,docs:{...(D=s.parameters)==null?void 0:D.docs,source:{originalSource:`{
  args: {
    state: 'read-only',
    hostName: 'Gorka'
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', {
      name: 'Approve once'
    })).toBeDisabled();
    await expect(canvas.getByRole('button', {
      name: 'Deny'
    })).toBeDisabled();
    await expect(args.onApprove).not.toHaveBeenCalled();
  }
}`,...(q=(E=s.parameters)==null?void 0:E.docs)==null?void 0:q.source}}};var A,O,W;c.parameters={...c.parameters,docs:{...(A=c.parameters)==null?void 0:A.docs,source:{originalSource:`{
  args: {
    hostName: 'Gorka'
  }
}`,...(W=(O=c.parameters)==null?void 0:O.docs)==null?void 0:W.source}}};var G,N,T;i.parameters={...i.parameters,docs:{...(G=i.parameters)==null?void 0:G.docs,source:{originalSource:`{
  args: {
    state: 'resolved',
    resolution: 'Approved once by Gorka'
  }
}`,...(T=(N=i.parameters)==null?void 0:N.docs)==null?void 0:T.source}}};var H,P,U;p.parameters={...p.parameters,docs:{...(H=p.parameters)==null?void 0:H.docs,source:{originalSource:`{
  args: {
    state: 'withdrawn'
  }
}`,...(U=(P=p.parameters)==null?void 0:P.docs)==null?void 0:U.source}}};var F,j,I;m.parameters={...m.parameters,docs:{...(F=m.parameters)==null?void 0:F.docs,source:{originalSource:`{
  args: {
    busy: true
  }
}`,...(I=(j=m.parameters)==null?void 0:j.docs)==null?void 0:I.source}}};var V,K,L;d.parameters={...d.parameters,docs:{...(V=d.parameters)==null?void 0:V.docs,source:{originalSource:`{
  args: {
    error: 'The host is unreachable. Reconnect before answering.'
  }
}`,...(L=(K=d.parameters)==null?void 0:K.docs)==null?void 0:L.source}}};var M,Y,z;l.parameters={...l.parameters,docs:{...(M=l.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    details: '{ "tool": "exec_command", "command": "pnpm test", "cwd": "/workspaces/koda" }'
  }
}`,...(z=(Y=l.parameters)==null?void 0:Y.docs)==null?void 0:z.source}}};var J,Q,X;u.parameters={...u.parameters,docs:{...(J=u.parameters)==null?void 0:J.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    await userEvent.click(within(canvasElement).getByRole('button', {
      name: 'Deny'
    }));
    await expect(args.onDeny).toHaveBeenCalledOnce();
  }
}`,...(X=(Q=u.parameters)==null?void 0:Q.docs)==null?void 0:X.source}}};var Z,$,ee;g.parameters={...g.parameters,docs:{...(Z=g.parameters)==null?void 0:Z.docs,source:{originalSource:`{
  args: {
    kind: 'file',
    command: undefined,
    path: undefined,
    reason: 'Codex wants to apply the reconnect fix and its regression test.',
    files: [{
      path: 'src/components/WorkspaceSharing.tsx',
      kind: 'Update'
    }, {
      path: 'src/__tests__/WorkspaceSharing.test.tsx',
      kind: 'Update'
    }]
  }
}`,...(ee=($=g.parameters)==null?void 0:$.docs)==null?void 0:ee.source}}};var ae,ne,re;h.parameters={...h.parameters,docs:{...(ae=h.parameters)==null?void 0:ae.docs,source:{originalSource:`{
  args: {
    appearance: 'terminal',
    'aria-label': 'Permission request: command_execution'
  },
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('region', {
      name: 'Permission request: command_execution'
    })).toBeVisible();
  }
}`,...(re=(ne=h.parameters)==null?void 0:ne.docs)==null?void 0:re.source}}};export{c as CollaboratorWithControl,r as CommandRequest,u as Deny,g as FileChanges,o as FileRequest,t as NetworkRequest,s as ReadOnly,l as RequestDetails,i as Resolved,d as ResponseError,m as Sending,h as TerminalRequest,p as Withdrawn,Ie as __namedExportsOrder,je as default};

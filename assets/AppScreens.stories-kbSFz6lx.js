import{W as b}from"./workspace-demo-l7ApbRJq.js";import"./iframe-BOlOcktz.js";import"./preload-helper-D6W3bvzQ.js";import"./index-BK65kbgY.js";import"./utils-B7o975cr.js";import"./index-D38G4VL6.js";import"./index-CJvINIPD.js";import"./index-DszZT9yc.js";import"./createLucideIcon-BKtcNsTW.js";import"./button-DETrAiRn.js";import"./index-DcWWjj0g.js";import"./index-B-iRab8W.js";import"./index-CI6IeoH0.js";import"./index-YGWuIb40.js";import"./index-CkWDtAJP.js";import"./index-DSkAjUYK.js";import"./index-zTO-c2Cr.js";import"./index-_nmx2gS7.js";import"./index-wkeOesEn.js";import"./index-BlUyFi_Y.js";import"./index-Dxe6Gktq.js";import"./chevron-down-D3xL0QhO.js";import"./chevron-right-D4CXFYMT.js";import"./check-DnZ2MnjI.js";import"./x-rhw8hwOp.js";import"./circle-JpOebGTw.js";import"./select-B18DPH7j.js";import"./index-BdQq_4o_.js";import"./index-DWVDe7sO.js";import"./index-CLWpyE0l.js";import"./Combination-C0-Js29n.js";import"./index-CzawmuLc.js";import"./command-BGMfk9ja.js";import"./dialog-HLE40si2.js";import"./index-CxHxyMlZ.js";import"./search-DhSWCOmI.js";import"./tabs-C0dvLFau.js";import"./index-DUSu_92s.js";import"./progress-BbC2yIKB.js";import"./index-DCEhUHk9.js";import"./badge-xa7nXPzb.js";import"./feedback-BYcokOgT.js";import"./git-branch-DNwGVwmb.js";import"./share-2-_5K0iWNX.js";import"./input-DMXCcbYi.js";const{expect:t,userEvent:B,within:l}=__STORYBOOK_MODULE_TEST__,ne={title:"App screens",component:b,tags:["autodocs"],parameters:{layout:"fullscreen"}},a={args:{collaborator:!1},play:async({canvasElement:r})=>{const e=l(r);await t(e.getByRole("textbox",{name:"Message"})).toBeEnabled(),await t(e.getByRole("button",{name:"Approve once"})).toBeEnabled(),await B.click(e.getByRole("button",{name:"Approve once"})),await t(e.getByText("[RESOLVED] Approved once")).toBeVisible()}},o={args:{collaborator:!0},play:async({canvasElement:r})=>{const e=l(r);await t(e.getByRole("textbox",{name:"Message"})).toBeDisabled(),await t(e.getByRole("button",{name:"Approve once"})).toBeDisabled(),await t(e.getByTestId("shared-workspace-badge")).toHaveAttribute("data-permission","view"),await t(e.getByText("field-notes")).toBeVisible(),await t(e.getByText("· read-only mirror")).toBeVisible()}},ie=["HostWorkspace","CollaboratorWorkspace"];var n,i,s;a.parameters={...a.parameters,docs:{...(n=a.parameters)==null?void 0:n.docs,source:{originalSource:`{
  args: {
    collaborator: false
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', {
      name: 'Message'
    })).toBeEnabled();
    await expect(canvas.getByRole('button', {
      name: 'Approve once'
    })).toBeEnabled();
    await userEvent.click(canvas.getByRole('button', {
      name: 'Approve once'
    }));
    await expect(canvas.getByText('[RESOLVED] Approved once')).toBeVisible();
  }
}`,...(s=(i=a.parameters)==null?void 0:i.docs)==null?void 0:s.source}}};var p,c,m;o.parameters={...o.parameters,docs:{...(p=o.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    collaborator: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', {
      name: 'Message'
    })).toBeDisabled();
    await expect(canvas.getByRole('button', {
      name: 'Approve once'
    })).toBeDisabled();
    await expect(canvas.getByTestId('shared-workspace-badge')).toHaveAttribute('data-permission', 'view');
    await expect(canvas.getByText('field-notes')).toBeVisible();
    await expect(canvas.getByText('· read-only mirror')).toBeVisible();
  }
}`,...(m=(c=o.parameters)==null?void 0:c.docs)==null?void 0:m.source}}};export{o as CollaboratorWorkspace,a as HostWorkspace,ie as __namedExportsOrder,ne as default};

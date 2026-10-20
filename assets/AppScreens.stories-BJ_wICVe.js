import{W as b}from"./workspace-demo-Cj8ZI7kn.js";import"./iframe-DE7TzujU.js";import"./preload-helper-D6W3bvzQ.js";import"./index-wUnCDLfM.js";import"./utils-B7o975cr.js";import"./index-CBiaNcZN.js";import"./index-DoCxpYiM.js";import"./index-D_CN-DGt.js";import"./createLucideIcon-CN_pcOxQ.js";import"./button-Uby9EqSj.js";import"./index-VVr9I5lv.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";import"./index-DVXr51on.js";import"./index-DGAFZVLh.js";import"./index-D-meXGpZ.js";import"./index-COPJbcdq.js";import"./index-DisSJ1av.js";import"./index-C0Q7PqkE.js";import"./index-Dxe8mkPd.js";import"./index-Bdp5erAT.js";import"./chevron-down-DpyZTu1h.js";import"./chevron-right-DZVBjrBM.js";import"./check-Chom1XTU.js";import"./x-BdgyrbM3.js";import"./circle-CJYlI7Zv.js";import"./select-BrHGEVqJ.js";import"./index-BdQq_4o_.js";import"./index-DAhMItIG.js";import"./index-DqpRPQyA.js";import"./Combination-DhmAmB1C.js";import"./index-DnbC6_Py.js";import"./command-DCy9NVkh.js";import"./dialog-cOnglls5.js";import"./index-B9cV_AZ9.js";import"./search-Bv1CouGp.js";import"./tabs-Db-45CAt.js";import"./index-B8itXeje.js";import"./progress-JkIDkJD0.js";import"./index-Chgx5DdY.js";import"./badge-DVGUyZy7.js";import"./feedback-CfFaOf8B.js";import"./git-branch-Db4yRsE6.js";import"./share-2-CzmRp0Pu.js";import"./input-BbOF167n.js";const{expect:t,userEvent:B,within:l}=__STORYBOOK_MODULE_TEST__,ne={title:"App screens",component:b,tags:["autodocs"],parameters:{layout:"fullscreen"}},a={args:{collaborator:!1},play:async({canvasElement:r})=>{const e=l(r);await t(e.getByRole("textbox",{name:"Message"})).toBeEnabled(),await t(e.getByRole("button",{name:"Approve once"})).toBeEnabled(),await B.click(e.getByRole("button",{name:"Approve once"})),await t(e.getByText("[RESOLVED] Approved once")).toBeVisible()}},o={args:{collaborator:!0},play:async({canvasElement:r})=>{const e=l(r);await t(e.getByRole("textbox",{name:"Message"})).toBeDisabled(),await t(e.getByRole("button",{name:"Approve once"})).toBeDisabled(),await t(e.getByTestId("shared-workspace-badge")).toHaveAttribute("data-permission","view"),await t(e.getByText("field-notes")).toBeVisible(),await t(e.getByText("· read-only mirror")).toBeVisible()}},ie=["HostWorkspace","CollaboratorWorkspace"];var n,i,s;a.parameters={...a.parameters,docs:{...(n=a.parameters)==null?void 0:n.docs,source:{originalSource:`{
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

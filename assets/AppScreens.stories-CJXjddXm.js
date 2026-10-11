import{W as b}from"./workspace-demo-OMwHrZKe.js";import"./iframe-C30QeG3e.js";import"./preload-helper-D6W3bvzQ.js";import"./index-j3SeIR8-.js";import"./utils-B7o975cr.js";import"./index-hftMsCUE.js";import"./index-Dgyi4PT8.js";import"./index-CsaGnVJ7.js";import"./createLucideIcon-DiERuOeT.js";import"./button-Bwmd7Lx7.js";import"./index-DXdei5Yc.js";import"./index-Ap8JIR2S.js";import"./index-t8JfViMG.js";import"./index-BhoyFe3d.js";import"./index-DfSbsrIq.js";import"./index-CBNOem9o.js";import"./index-BWdqTsTJ.js";import"./index-BdqpzMJG.js";import"./index-DEQL6lI-.js";import"./index-jxSttbKr.js";import"./index-rWZk3uLI.js";import"./chevron-down-jjy896LW.js";import"./chevron-right-DkAA3o_8.js";import"./check-Drblxday.js";import"./x-CKH70IuT.js";import"./circle-CdA5RCPp.js";import"./select-IEJesnEj.js";import"./index-BdQq_4o_.js";import"./index-BrwFzwur.js";import"./index-Bwn99cpp.js";import"./Combination-B4nG-NNF.js";import"./index-Cs7Omgh0.js";import"./command-CU-bzmEJ.js";import"./dialog-VgvBVMd7.js";import"./index-C66jsOMg.js";import"./search-Cca7vlyw.js";import"./tabs-DWi61bpT.js";import"./index-CddkfWRW.js";import"./progress-D99g9_a_.js";import"./index-B5yVMKXX.js";import"./badge-D90OA0A3.js";import"./feedback-CsiIA6O3.js";import"./git-branch-aEYDLIPa.js";import"./share-2-sHhdp0JY.js";import"./input-CJcCF2mt.js";const{expect:t,userEvent:B,within:l}=__STORYBOOK_MODULE_TEST__,ne={title:"App screens",component:b,tags:["autodocs"],parameters:{layout:"fullscreen"}},a={args:{collaborator:!1},play:async({canvasElement:r})=>{const e=l(r);await t(e.getByRole("textbox",{name:"Message"})).toBeEnabled(),await t(e.getByRole("button",{name:"Approve once"})).toBeEnabled(),await B.click(e.getByRole("button",{name:"Approve once"})),await t(e.getByText("[RESOLVED] Approved once")).toBeVisible()}},o={args:{collaborator:!0},play:async({canvasElement:r})=>{const e=l(r);await t(e.getByRole("textbox",{name:"Message"})).toBeDisabled(),await t(e.getByRole("button",{name:"Approve once"})).toBeDisabled(),await t(e.getByTestId("shared-workspace-badge")).toHaveAttribute("data-permission","view"),await t(e.getByText("field-notes")).toBeVisible(),await t(e.getByText("· read-only mirror")).toBeVisible()}},ie=["HostWorkspace","CollaboratorWorkspace"];var n,i,s;a.parameters={...a.parameters,docs:{...(n=a.parameters)==null?void 0:n.docs,source:{originalSource:`{
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

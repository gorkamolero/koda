import{W as b}from"./workspace-demo-DIR7l9rX.js";import"./iframe-BDUbmM24.js";import"./preload-helper-D6W3bvzQ.js";import"./index-CY8AJswe.js";import"./utils-B7o975cr.js";import"./index-6LWTzUp_.js";import"./index-CCQdZNI7.js";import"./index-DbX3ht9U.js";import"./createLucideIcon-B6tXQlyD.js";import"./button-BasZ35wm.js";import"./index-CDLDA8NU.js";import"./index-OlRYfNBu.js";import"./index-iWPVPrYK.js";import"./index-Cic-oAX7.js";import"./index-DV1FpbQh.js";import"./index-FqwwTXOA.js";import"./index-BZr_kTKH.js";import"./index-CWXJao91.js";import"./index-Bh-xOyeg.js";import"./index-D20LO2AZ.js";import"./index-DIxJW5Vf.js";import"./chevron-down-DzoDJT8Q.js";import"./chevron-right-BEutbkUU.js";import"./check-cfLWj2WE.js";import"./x-C0KTbnLC.js";import"./circle-DGMtMHH9.js";import"./select-BNAvgY25.js";import"./index-BdQq_4o_.js";import"./index-BQ035UTa.js";import"./index-Bz4jA-VL.js";import"./Combination-CJub336x.js";import"./index-Bk0okdtA.js";import"./command-CzSzYJ1c.js";import"./dialog-D6vekFOA.js";import"./index-DVpI-cC2.js";import"./search-D8R2c2Kq.js";import"./tabs-ChVOTPh5.js";import"./index-dHl1fFq7.js";import"./progress-BlwFgRPI.js";import"./index-DgTdIDf2.js";import"./badge-DrkOXWGm.js";import"./feedback-CJTJ-zAi.js";import"./git-branch-DmHUUDkX.js";import"./share-2-DXXVWBEf.js";import"./input-D9F_6Zyd.js";const{expect:t,userEvent:B,within:l}=__STORYBOOK_MODULE_TEST__,ne={title:"App screens",component:b,tags:["autodocs"],parameters:{layout:"fullscreen"}},a={args:{collaborator:!1},play:async({canvasElement:r})=>{const e=l(r);await t(e.getByRole("textbox",{name:"Message"})).toBeEnabled(),await t(e.getByRole("button",{name:"Approve once"})).toBeEnabled(),await B.click(e.getByRole("button",{name:"Approve once"})),await t(e.getByText("[RESOLVED] Approved once")).toBeVisible()}},o={args:{collaborator:!0},play:async({canvasElement:r})=>{const e=l(r);await t(e.getByRole("textbox",{name:"Message"})).toBeDisabled(),await t(e.getByRole("button",{name:"Approve once"})).toBeDisabled(),await t(e.getByTestId("shared-workspace-badge")).toHaveAttribute("data-permission","view"),await t(e.getByText("field-notes")).toBeVisible(),await t(e.getByText("· read-only mirror")).toBeVisible()}},ie=["HostWorkspace","CollaboratorWorkspace"];var n,i,s;a.parameters={...a.parameters,docs:{...(n=a.parameters)==null?void 0:n.docs,source:{originalSource:`{
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

import{j as e}from"./iframe-BOlOcktz.js";import{D as d,a as g,b as u,c as h,d as y,e as w,f as x,g as C,h as H}from"./dialog-HLE40si2.js";import{B as v}from"./button-DETrAiRn.js";import{F as L,I as M}from"./input-DMXCcbYi.js";import"./preload-helper-D6W3bvzQ.js";import"./index-DcWWjj0g.js";import"./index-B-iRab8W.js";import"./index-CI6IeoH0.js";import"./index-DszZT9yc.js";import"./index-_nmx2gS7.js";import"./index-DSkAjUYK.js";import"./index-Dxe6Gktq.js";import"./index-YGWuIb40.js";import"./index-CkWDtAJP.js";import"./index-zTO-c2Cr.js";import"./Combination-C0-Js29n.js";import"./index-wkeOesEn.js";import"./index-BlUyFi_Y.js";import"./utils-B7o975cr.js";import"./index-CJvINIPD.js";import"./createLucideIcon-BKtcNsTW.js";const{expect:i,userEvent:c,within:m}=__STORYBOOK_MODULE_TEST__,ie={title:"Primitives/Dialog",component:x,subcomponents:{Dialog:w,DialogHeader:y,DialogTitle:h,DialogDescription:u,DialogBody:g,DialogFooter:d},tags:["autodocs"],args:{size:"md"},render:a=>e.jsxs(w,{children:[e.jsx(C,{asChild:!0,children:e.jsx(v,{variant:"bracket",children:"Share workspace"})}),e.jsxs(x,{...a,children:[e.jsxs(y,{children:[e.jsx(h,{children:"Share workspace"}),e.jsx(u,{children:"Invite a collaborator to the design-system branch."})]}),e.jsx(g,{children:e.jsx(L,{label:"Invitation link",hint:"Only people with this link can join.",children:e.jsx(M,{readOnly:!0,value:"koda://join/design-system-demo"})})}),e.jsx(d,{children:e.jsx(H,{asChild:!0,children:e.jsx(v,{variant:"bracket",children:"Done"})})})]})]})},r={},o={args:{size:"sm"}},t={args:{size:"lg"}},s={play:async({canvasElement:a})=>{const l=m(a).getByRole("button",{name:"Share workspace"});await c.click(l);const p=m(a.ownerDocument.body);await i(p.getByRole("dialog")).toBeVisible(),await c.keyboard("{Escape}"),await i(p.queryByRole("dialog")).not.toBeInTheDocument(),await i(l).toHaveFocus()}},n={play:async({canvasElement:a})=>{await c.click(m(a).getByRole("button",{name:"Share workspace"}))}},ce=["Medium","Small","Large","OpenAndEscape","Open"];var D,b,j;r.parameters={...r.parameters,docs:{...(D=r.parameters)==null?void 0:D.docs,source:{originalSource:"{}",...(j=(b=r.parameters)==null?void 0:b.docs)==null?void 0:j.source}}};var k,B,E;o.parameters={...o.parameters,docs:{...(k=o.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    size: 'sm'
  }
}`,...(E=(B=o.parameters)==null?void 0:B.docs)==null?void 0:E.source}}};var S,O,R;t.parameters={...t.parameters,docs:{...(S=t.parameters)==null?void 0:S.docs,source:{originalSource:`{
  args: {
    size: 'lg'
  }
}`,...(R=(O=t.parameters)==null?void 0:O.docs)==null?void 0:R.source}}};var _,T,f;s.parameters={...s.parameters,docs:{...(_=s.parameters)==null?void 0:_.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', {
      name: 'Share workspace'
    });
    await userEvent.click(trigger);
    const document = within(canvasElement.ownerDocument.body);
    await expect(document.getByRole('dialog')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(document.queryByRole('dialog')).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
  }
}`,...(f=(T=s.parameters)==null?void 0:T.docs)==null?void 0:f.source}}};var I,z,F;n.parameters={...n.parameters,docs:{...(I=n.parameters)==null?void 0:I.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    await userEvent.click(within(canvasElement).getByRole('button', {
      name: 'Share workspace'
    }));
  }
}`,...(F=(z=n.parameters)==null?void 0:z.docs)==null?void 0:F.source}}};export{t as Large,r as Medium,n as Open,s as OpenAndEscape,o as Small,ce as __namedExportsOrder,ie as default};

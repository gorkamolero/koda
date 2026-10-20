import{j as e}from"./iframe-DE7TzujU.js";import{D as u,a as h,b as y,c as w,d as v,e as x,f as S,g as Y,h as G}from"./dialog-cOnglls5.js";import{B as b}from"./button-Uby9EqSj.js";import{F as J,I as N}from"./input-BbOF167n.js";import"./preload-helper-D6W3bvzQ.js";import"./index-VVr9I5lv.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";import"./index-D_CN-DGt.js";import"./index-DisSJ1av.js";import"./index-D-meXGpZ.js";import"./index-Bdp5erAT.js";import"./index-DVXr51on.js";import"./index-DGAFZVLh.js";import"./index-COPJbcdq.js";import"./Combination-DhmAmB1C.js";import"./index-C0Q7PqkE.js";import"./index-Dxe8mkPd.js";import"./utils-B7o975cr.js";import"./index-DoCxpYiM.js";import"./createLucideIcon-CN_pcOxQ.js";const{expect:m,userEvent:p,within:l}=__STORYBOOK_MODULE_TEST__,we={title:"Primitives/Dialog",component:S,subcomponents:{Dialog:x,DialogHeader:v,DialogTitle:w,DialogDescription:y,DialogBody:h,DialogFooter:u},tags:["autodocs"],args:{size:"md"},render:a=>e.jsxs(x,{children:[e.jsx(Y,{asChild:!0,children:e.jsx(b,{variant:"bracket",children:"Share workspace"})}),e.jsxs(S,{...a,children:[e.jsxs(v,{children:[e.jsx(w,{children:"Share workspace"}),e.jsx(y,{children:"Invite a collaborator to the design-system branch."})]}),e.jsx(h,{children:e.jsx(J,{label:"Invitation link",hint:"Only people with this link can join.",children:e.jsx(N,{readOnly:!0,value:"koda://join/design-system-demo"})})}),e.jsx(u,{children:e.jsx(G,{asChild:!0,children:e.jsx(b,{variant:"bracket",children:"Done"})})})]})]})},o={},t={args:{size:"sm"}},n={args:{size:"lg"}},i={play:async({canvasElement:a})=>{const d=l(a).getByRole("button",{name:"Share workspace"});await p.click(d);const g=l(a.ownerDocument.body);await m(g.getByRole("dialog")).toBeVisible(),await p.keyboard("{Escape}"),await m(g.queryByRole("dialog")).not.toBeInTheDocument(),await m(d).toHaveFocus()}},r={play:async({canvasElement:a})=>{await p.click(l(a).getByRole("button",{name:"Share workspace"}))}},s={...r,args:{size:"sm"}},c={...r,args:{size:"lg"}},ve=["Medium","Small","Large","OpenAndEscape","Open","OpenSmall","OpenLarge"];var D,j,k;o.parameters={...o.parameters,docs:{...(D=o.parameters)==null?void 0:D.docs,source:{originalSource:"{}",...(k=(j=o.parameters)==null?void 0:j.docs)==null?void 0:k.source}}};var O,B,E;t.parameters={...t.parameters,docs:{...(O=t.parameters)==null?void 0:O.docs,source:{originalSource:`{
  args: {
    size: 'sm'
  }
}`,...(E=(B=t.parameters)==null?void 0:B.docs)==null?void 0:E.source}}};var R,z,_;n.parameters={...n.parameters,docs:{...(R=n.parameters)==null?void 0:R.docs,source:{originalSource:`{
  args: {
    size: 'lg'
  }
}`,...(_=(z=n.parameters)==null?void 0:z.docs)==null?void 0:_.source}}};var T,f,I;i.parameters={...i.parameters,docs:{...(T=i.parameters)==null?void 0:T.docs,source:{originalSource:`{
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
}`,...(I=(f=i.parameters)==null?void 0:f.docs)==null?void 0:I.source}}};var L,F,C;r.parameters={...r.parameters,docs:{...(L=r.parameters)==null?void 0:L.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    await userEvent.click(within(canvasElement).getByRole('button', {
      name: 'Share workspace'
    }));
  }
}`,...(C=(F=r.parameters)==null?void 0:F.docs)==null?void 0:C.source}}};var H,M,q,A,V;s.parameters={...s.parameters,docs:{...(H=s.parameters)==null?void 0:H.docs,source:{originalSource:`{
  ...Open,
  args: {
    size: 'sm'
  }
}`,...(q=(M=s.parameters)==null?void 0:M.docs)==null?void 0:q.source},description:{story:"Leave the small and large widths open so both the canvas and axe inspect the actual modal.",...(V=(A=s.parameters)==null?void 0:A.docs)==null?void 0:V.description}}};var K,P,U;c.parameters={...c.parameters,docs:{...(K=c.parameters)==null?void 0:K.docs,source:{originalSource:`{
  ...Open,
  args: {
    size: 'lg'
  }
}`,...(U=(P=c.parameters)==null?void 0:P.docs)==null?void 0:U.source}}};export{n as Large,o as Medium,r as Open,i as OpenAndEscape,c as OpenLarge,s as OpenSmall,t as Small,ve as __namedExportsOrder,we as default};

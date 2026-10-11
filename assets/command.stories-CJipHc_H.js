import{j as e}from"./iframe-BOlOcktz.js";import{C as s,a as u,b as i,c as d,d as y,e as R,f as D,g as I}from"./command-BGMfk9ja.js";import{K as k}from"./badge-xa7nXPzb.js";import{c as f}from"./createLucideIcon-BKtcNsTW.js";import"./preload-helper-D6W3bvzQ.js";import"./dialog-HLE40si2.js";import"./index-DcWWjj0g.js";import"./index-B-iRab8W.js";import"./index-CI6IeoH0.js";import"./index-DszZT9yc.js";import"./index-_nmx2gS7.js";import"./index-DSkAjUYK.js";import"./index-Dxe6Gktq.js";import"./index-YGWuIb40.js";import"./index-CkWDtAJP.js";import"./index-zTO-c2Cr.js";import"./Combination-C0-Js29n.js";import"./index-wkeOesEn.js";import"./index-BlUyFi_Y.js";import"./utils-B7o975cr.js";import"./button-DETrAiRn.js";import"./index-CJvINIPD.js";import"./index-CxHxyMlZ.js";import"./search-DhSWCOmI.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T=f("Command",[["path",{d:"M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3",key:"11bfej"}]]),{expect:n,userEvent:p,within:l}=__STORYBOOK_MODULE_TEST__,ne={title:"Primitives/Command",component:y,subcomponents:{CommandInput:d,CommandList:i,CommandGroup:u,CommandItem:s},tags:["autodocs"],args:{label:"Workspace commands"},render:o=>e.jsxs(y,{...o,className:"w-80 border border-border-muted",children:[e.jsx(d,{placeholder:"Search commands…","aria-label":"Search commands"}),e.jsxs(i,{children:[e.jsx(D,{children:"No matching commands."}),e.jsxs(u,{heading:"Workspace",children:[e.jsxs(s,{value:"New session",children:["New session",e.jsx(I,{children:"⌘N"})]}),e.jsx(s,{value:"Share workspace",children:"Share workspace"}),e.jsx(s,{value:"Archive workspace",disabled:!0,children:"Archive workspace · host only"})]})]})]})},t={},r={play:async({canvasElement:o})=>{const a=l(o);await p.type(a.getByRole("combobox"),"Share"),await n(a.getByRole("option",{name:"Share workspace"})).toBeVisible(),await n(a.queryByRole("option",{name:/New session/})).not.toBeInTheDocument()}},m={play:async({canvasElement:o})=>{await p.type(l(o).getByRole("combobox"),"missing-command")}},c={render:()=>e.jsxs(R,{defaultOpen:!0,commandProps:{label:"Search commands"},contentProps:{showClose:!1,overlayClassName:"backdrop-blur-sm"},children:[e.jsx(d,{icon:e.jsx(T,{"aria-hidden":"true",className:"mr-2 size-4"}),trailing:e.jsx(k,{children:"Esc"}),wrapperClassName:"gap-2"}),e.jsx(i,{children:e.jsx(s,{value:"New session",children:"New session"})})]}),play:async({canvasElement:o})=>{const a=l(o.ownerDocument.body);await n(a.getByRole("combobox",{name:"Search commands"})).toHaveFocus(),await n(a.getByText("Esc")).toBeVisible(),await n(a.queryByRole("button",{name:"[ESC] CLOSE"})).not.toBeInTheDocument(),await p.keyboard("{Escape}"),await n(a.queryByRole("dialog")).not.toBeInTheDocument()}},se=["Commands","Filtered","Empty","DialogHeaderSlots"];var h,w,b;t.parameters={...t.parameters,docs:{...(h=t.parameters)==null?void 0:h.docs,source:{originalSource:"{}",...(b=(w=t.parameters)==null?void 0:w.docs)==null?void 0:b.source}}};var x,C,g;r.parameters={...r.parameters,docs:{...(x=r.parameters)==null?void 0:x.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox'), 'Share');
    await expect(canvas.getByRole('option', {
      name: 'Share workspace'
    })).toBeVisible();
    await expect(canvas.queryByRole('option', {
      name: /New session/
    })).not.toBeInTheDocument();
  }
}`,...(g=(C=r.parameters)==null?void 0:C.docs)==null?void 0:g.source}}};var v,B,E;m.parameters={...m.parameters,docs:{...(v=m.parameters)==null?void 0:v.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    await userEvent.type(within(canvasElement).getByRole('combobox'), 'missing-command');
  }
}`,...(E=(B=m.parameters)==null?void 0:B.docs)==null?void 0:E.source}}};var S,j,N;c.parameters={...c.parameters,docs:{...(S=c.parameters)==null?void 0:S.docs,source:{originalSource:`{
  render: () => <CommandDialog defaultOpen commandProps={{
    label: 'Search commands'
  }} contentProps={{
    showClose: false,
    overlayClassName: 'backdrop-blur-sm'
  }}><CommandInput icon={<CommandIcon aria-hidden="true" className="mr-2 size-4" />} trailing={<Kbd>Esc</Kbd>} wrapperClassName="gap-2"></CommandInput><CommandList><CommandItem value="New session">New session</CommandItem></CommandList></CommandDialog>,
  play: async ({
    canvasElement
  }) => {
    const document = within(canvasElement.ownerDocument.body);
    await expect(document.getByRole('combobox', {
      name: 'Search commands'
    })).toHaveFocus();
    await expect(document.getByText('Esc')).toBeVisible();
    await expect(document.queryByRole('button', {
      name: '[ESC] CLOSE'
    })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect(document.queryByRole('dialog')).not.toBeInTheDocument();
  }
}`,...(N=(j=c.parameters)==null?void 0:j.docs)==null?void 0:N.source}}};export{t as Commands,c as DialogHeaderSlots,m as Empty,r as Filtered,se as __namedExportsOrder,ne as default};

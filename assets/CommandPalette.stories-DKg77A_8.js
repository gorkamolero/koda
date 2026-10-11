import{j as c}from"./iframe-BOlOcktz.js";import{C as u}from"./index-BK65kbgY.js";import{G as I}from"./git-branch-DNwGVwmb.js";import{S as M}from"./share-2-_5K0iWNX.js";import{e as P}from"./index-D38G4VL6.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./check-DnZ2MnjI.js";import"./createLucideIcon-BKtcNsTW.js";import"./x-rhw8hwOp.js";import"./chevron-down-D3xL0QhO.js";import"./chevron-right-D4CXFYMT.js";import"./button-DETrAiRn.js";import"./index-CJvINIPD.js";import"./index-DszZT9yc.js";import"./index-DcWWjj0g.js";import"./index-B-iRab8W.js";import"./index-CI6IeoH0.js";import"./index-YGWuIb40.js";import"./index-CkWDtAJP.js";import"./index-DSkAjUYK.js";import"./index-zTO-c2Cr.js";import"./index-_nmx2gS7.js";import"./index-wkeOesEn.js";import"./index-BlUyFi_Y.js";import"./index-Dxe6Gktq.js";import"./circle-JpOebGTw.js";import"./select-B18DPH7j.js";import"./index-BdQq_4o_.js";import"./index-DWVDe7sO.js";import"./index-CLWpyE0l.js";import"./Combination-C0-Js29n.js";import"./index-CzawmuLc.js";import"./command-BGMfk9ja.js";import"./dialog-HLE40si2.js";import"./index-CxHxyMlZ.js";import"./search-DhSWCOmI.js";const{expect:o,userEvent:n,within:m,fn:t}=__STORYBOOK_MODULE_TEST__,Ee={title:"Patterns/CommandPalette",component:u,tags:["autodocs"],parameters:{layout:"padded"},args:{commands:[{id:"new",label:"New workspace",group:"Workspace",shortcut:"⌘N",icon:c.jsx(I,{className:"size-4"}),onSelect:t()},{id:"share",label:"Share workspace",group:"Workspace",icon:c.jsx(M,{className:"size-4"}),onSelect:t()},{id:"file",label:"WorkspaceSharing.tsx",group:"Files",icon:c.jsx(P,{className:"size-4"}),onSelect:t()},{id:"deploy",label:"Deploy workspace",group:"Workspace",disabled:!0}]}},i={},p={play:async({canvasElement:e})=>{const a=m(e);await n.type(a.getByRole("combobox"),"WorkspaceSharing"),await o(a.getByRole("option",{name:"WorkspaceSharing.tsx"})).toBeVisible(),await o(a.queryByRole("option",{name:"New workspace ⌘N"})).not.toBeInTheDocument()}},l={play:async({canvasElement:e})=>{const a=m(e);await n.type(a.getByRole("combobox"),"no-matching-command"),await o(a.getByText("No matching commands.")).toBeVisible()}},d={play:async({canvasElement:e,args:a})=>{var r;const s=m(e);await n.click(s.getByRole("combobox")),await n.keyboard("{ArrowDown}{Enter}"),await o((r=a.commands[1])==null?void 0:r.onSelect).toHaveBeenCalled()}},w={args:{open:!0,onOpenChange:t()},parameters:{layout:"fullscreen"}},y={args:{onKeyDown:t(),className:"max-w-xl"},render:e=>c.jsx(u,{...e,"data-testid":"workspace-command-palette",role:"region","aria-label":"Workspace commands"}),play:async({canvasElement:e,args:a})=>{const s=m(e),r=s.getByTestId("workspace-command-palette");await o(r).toHaveClass("max-w-xl"),await o(s.getByRole("region",{name:"Workspace commands"})).toBe(r),await n.click(s.getByRole("combobox")),await n.keyboard("{ArrowDown}"),await o(a.onKeyDown).toHaveBeenCalled()}},g={args:{open:!0,onOpenChange:t(),className:"max-w-xl"},render:e=>c.jsx(u,{...e,"data-testid":"modal-command-palette"}),play:async()=>{await o(m(document.body).getByTestId("modal-command-palette")).toHaveClass("max-w-xl")}},Ce=["Embedded","Search","EmptyResults","KeyboardSelection","Modal","NativeAttributes","ModalAttributes"];var x,v,b;i.parameters={...i.parameters,docs:{...(x=i.parameters)==null?void 0:x.docs,source:{originalSource:"{}",...(b=(v=i.parameters)==null?void 0:v.docs)==null?void 0:b.source}}};var B,h,k;p.parameters={...p.parameters,docs:{...(B=p.parameters)==null?void 0:B.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox'), 'WorkspaceSharing');
    await expect(canvas.getByRole('option', {
      name: 'WorkspaceSharing.tsx'
    })).toBeVisible();
    await expect(canvas.queryByRole('option', {
      name: 'New workspace ⌘N'
    })).not.toBeInTheDocument();
  }
}`,...(k=(h=p.parameters)==null?void 0:h.docs)==null?void 0:k.source}}};var S,E,C;l.parameters={...l.parameters,docs:{...(S=l.parameters)==null?void 0:S.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox'), 'no-matching-command');
    await expect(canvas.getByText('No matching commands.')).toBeVisible();
  }
}`,...(C=(E=l.parameters)==null?void 0:E.docs)==null?void 0:C.source}}};var R,N,f;d.parameters={...d.parameters,docs:{...(R=d.parameters)==null?void 0:R.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.commands[1]?.onSelect).toHaveBeenCalled();
  }
}`,...(f=(N=d.parameters)==null?void 0:N.docs)==null?void 0:f.source}}};var D,W,T;w.parameters={...w.parameters,docs:{...(D=w.parameters)==null?void 0:D.docs,source:{originalSource:`{
  args: {
    open: true,
    onOpenChange: fn()
  },
  parameters: {
    layout: 'fullscreen'
  }
}`,...(T=(W=w.parameters)==null?void 0:W.docs)==null?void 0:T.source}}};var O,A,H;y.parameters={...y.parameters,docs:{...(O=y.parameters)==null?void 0:O.docs,source:{originalSource:`{
  args: {
    onKeyDown: fn(),
    className: 'max-w-xl'
  },
  render: args => <CommandPalette {...args} data-testid="workspace-command-palette" role="region" aria-label="Workspace commands" />,
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const shell = canvas.getByTestId('workspace-command-palette');
    await expect(shell).toHaveClass('max-w-xl');
    await expect(canvas.getByRole('region', {
      name: 'Workspace commands'
    })).toBe(shell);
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onKeyDown).toHaveBeenCalled();
  }
}`,...(H=(A=y.parameters)==null?void 0:A.docs)==null?void 0:H.source}}};var _,j,K;g.parameters={...g.parameters,docs:{...(_=g.parameters)==null?void 0:_.docs,source:{originalSource:`{
  args: {
    open: true,
    onOpenChange: fn(),
    className: 'max-w-xl'
  },
  render: args => <CommandPalette {...args} data-testid="modal-command-palette" />,
  play: async () => {
    await expect(within(document.body).getByTestId('modal-command-palette')).toHaveClass('max-w-xl');
  }
}`,...(K=(j=g.parameters)==null?void 0:j.docs)==null?void 0:K.source}}};export{i as Embedded,l as EmptyResults,d as KeyboardSelection,w as Modal,g as ModalAttributes,y as NativeAttributes,p as Search,Ce as __namedExportsOrder,Ee as default};

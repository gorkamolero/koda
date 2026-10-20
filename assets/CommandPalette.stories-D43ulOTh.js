import{j as c}from"./iframe-DE7TzujU.js";import{C as u}from"./index-wUnCDLfM.js";import{G as I}from"./git-branch-Db4yRsE6.js";import{S as M}from"./share-2-CzmRp0Pu.js";import{e as P}from"./index-CBiaNcZN.js";import"./preload-helper-D6W3bvzQ.js";import"./utils-B7o975cr.js";import"./check-Chom1XTU.js";import"./createLucideIcon-CN_pcOxQ.js";import"./x-BdgyrbM3.js";import"./chevron-down-DpyZTu1h.js";import"./chevron-right-DZVBjrBM.js";import"./button-Uby9EqSj.js";import"./index-DoCxpYiM.js";import"./index-D_CN-DGt.js";import"./index-VVr9I5lv.js";import"./index-BSJvn9Jz.js";import"./index-BFgiFKYz.js";import"./index-DVXr51on.js";import"./index-DGAFZVLh.js";import"./index-D-meXGpZ.js";import"./index-COPJbcdq.js";import"./index-DisSJ1av.js";import"./index-C0Q7PqkE.js";import"./index-Dxe8mkPd.js";import"./index-Bdp5erAT.js";import"./circle-CJYlI7Zv.js";import"./select-BrHGEVqJ.js";import"./index-BdQq_4o_.js";import"./index-DAhMItIG.js";import"./index-DqpRPQyA.js";import"./Combination-DhmAmB1C.js";import"./index-DnbC6_Py.js";import"./command-DCy9NVkh.js";import"./dialog-cOnglls5.js";import"./index-B9cV_AZ9.js";import"./search-Bv1CouGp.js";const{expect:o,userEvent:n,within:m,fn:t}=__STORYBOOK_MODULE_TEST__,Ee={title:"Patterns/CommandPalette",component:u,tags:["autodocs"],parameters:{layout:"padded"},args:{commands:[{id:"new",label:"New workspace",group:"Workspace",shortcut:"⌘N",icon:c.jsx(I,{className:"size-4"}),onSelect:t()},{id:"share",label:"Share workspace",group:"Workspace",icon:c.jsx(M,{className:"size-4"}),onSelect:t()},{id:"file",label:"WorkspaceSharing.tsx",group:"Files",icon:c.jsx(P,{className:"size-4"}),onSelect:t()},{id:"deploy",label:"Deploy workspace",group:"Workspace",disabled:!0}]}},i={},p={play:async({canvasElement:e})=>{const a=m(e);await n.type(a.getByRole("combobox"),"WorkspaceSharing"),await o(a.getByRole("option",{name:"WorkspaceSharing.tsx"})).toBeVisible(),await o(a.queryByRole("option",{name:"New workspace ⌘N"})).not.toBeInTheDocument()}},l={play:async({canvasElement:e})=>{const a=m(e);await n.type(a.getByRole("combobox"),"no-matching-command"),await o(a.getByText("No matching commands.")).toBeVisible()}},d={play:async({canvasElement:e,args:a})=>{var r;const s=m(e);await n.click(s.getByRole("combobox")),await n.keyboard("{ArrowDown}{Enter}"),await o((r=a.commands[1])==null?void 0:r.onSelect).toHaveBeenCalled()}},w={args:{open:!0,onOpenChange:t()},parameters:{layout:"fullscreen"}},y={args:{onKeyDown:t(),className:"max-w-xl"},render:e=>c.jsx(u,{...e,"data-testid":"workspace-command-palette",role:"region","aria-label":"Workspace commands"}),play:async({canvasElement:e,args:a})=>{const s=m(e),r=s.getByTestId("workspace-command-palette");await o(r).toHaveClass("max-w-xl"),await o(s.getByRole("region",{name:"Workspace commands"})).toBe(r),await n.click(s.getByRole("combobox")),await n.keyboard("{ArrowDown}"),await o(a.onKeyDown).toHaveBeenCalled()}},g={args:{open:!0,onOpenChange:t(),className:"max-w-xl"},render:e=>c.jsx(u,{...e,"data-testid":"modal-command-palette"}),play:async()=>{await o(m(document.body).getByTestId("modal-command-palette")).toHaveClass("max-w-xl")}},Ce=["Embedded","Search","EmptyResults","KeyboardSelection","Modal","NativeAttributes","ModalAttributes"];var x,v,b;i.parameters={...i.parameters,docs:{...(x=i.parameters)==null?void 0:x.docs,source:{originalSource:"{}",...(b=(v=i.parameters)==null?void 0:v.docs)==null?void 0:b.source}}};var B,h,k;p.parameters={...p.parameters,docs:{...(B=p.parameters)==null?void 0:B.docs,source:{originalSource:`{
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

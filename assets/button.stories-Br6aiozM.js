import{j as a}from"./iframe-BOlOcktz.js";import{B as r}from"./button-DETrAiRn.js";import"./preload-helper-D6W3bvzQ.js";import"./index-CJvINIPD.js";import"./index-DszZT9yc.js";import"./utils-B7o975cr.js";import"./index-DcWWjj0g.js";import"./index-B-iRab8W.js";import"./index-CI6IeoH0.js";import"./index-YGWuIb40.js";import"./index-CkWDtAJP.js";import"./index-DSkAjUYK.js";import"./index-zTO-c2Cr.js";import"./index-_nmx2gS7.js";import"./index-wkeOesEn.js";import"./index-BlUyFi_Y.js";import"./index-Dxe6Gktq.js";import"./createLucideIcon-BKtcNsTW.js";const{expect:i,fn:Le,userEvent:t,within:n}=__STORYBOOK_MODULE_TEST__,Xe={title:"Primitives/Button",component:r,tags:["autodocs"],args:{children:"Share workspace",onClick:Le()},argTypes:{variant:{control:"select",options:["primary","secondary","ghost","outline","destructive","link","bracket","unstyled"]},size:{control:"select",options:["sm","md","lg","icon","none"]}}},d={},l={args:{variant:"secondary"}},p={args:{variant:"ghost"}},u={args:{variant:"outline"}},m={args:{variant:"destructive",children:"Delete session"}},g={args:{variant:"link",children:"View changes"}},h={args:{variant:"bracket",children:"SHARE"}},v={render:()=>a.jsxs("div",{className:"flex items-center gap-4",children:[a.jsx(r,{size:"sm",children:"Small"}),a.jsx(r,{size:"md",children:"Medium"}),a.jsx(r,{size:"lg",children:"Large"}),a.jsx(r,{size:"icon","aria-label":"Add workspace",children:"+"})]})},y={args:{disabled:!0}},b={args:{loading:!0,children:"Sharing…"}},k={render:()=>a.jsx(r,{asChild:!0,variant:"bracket",children:a.jsx("a",{href:"#workspace",children:"Open workspace"})})},w={play:async({canvasElement:e})=>{await t.hover(n(e).getByRole("button"))}},B={play:async({canvasElement:e})=>{const s=n(e).getByRole("button");await t.tab(),await i(s).toHaveFocus(),await i(s.matches(":focus-visible")).toBe(!0)}},C={play:async({canvasElement:e})=>{await t.pointer({target:n(e).getByRole("button"),keys:"[MouseLeft>]"})}},S={play:async({canvasElement:e,args:s})=>{n(e).getByRole("button").focus(),await t.keyboard("{Enter}"),await i(s.onClick).toHaveBeenCalledOnce()}},c={args:{disabled:!0},render:e=>a.jsx(r,{asChild:!0,disabled:e.disabled,children:a.jsx("a",{href:"#workspace",onClick:e.onClick,children:"Open workspace"})}),play:async({canvasElement:e,args:s})=>{const f=n(e).getByRole("link");f.focus(),await t.keyboard("{Enter}"),await i(s.onClick).not.toHaveBeenCalled(),await i(f).toHaveAttribute("tabindex","-1")}},x={...c,args:{loading:!0},render:e=>a.jsx(r,{asChild:!0,loading:e.loading,children:a.jsx("a",{href:"#workspace",onClick:e.onClick,children:"Opening workspace"})})},E={args:{variant:"secondary"},play:async({canvasElement:e})=>{await t.hover(n(e).getByRole("button"))}},o={args:{variant:"unstyled",children:"[ESC] CANCEL",className:"font-code text-xs text-text-secondary"}},Ze=["Primary","Secondary","Ghost","Outline","Destructive","Link","Bracket","Sizes","Disabled","Loading","AsChild","Hover","Focus","Active","KeyboardActivation","DisabledChild","LoadingChild","SecondaryHover","Unstyled"];var R,O,A;d.parameters={...d.parameters,docs:{...(R=d.parameters)==null?void 0:R.docs,source:{originalSource:"{}",...(A=(O=d.parameters)==null?void 0:O.docs)==null?void 0:A.source}}};var H,j,L;l.parameters={...l.parameters,docs:{...(H=l.parameters)==null?void 0:H.docs,source:{originalSource:`{
  args: {
    variant: 'secondary'
  }
}`,...(L=(j=l.parameters)==null?void 0:j.docs)==null?void 0:L.source}}};var z,D,_;p.parameters={...p.parameters,docs:{...(z=p.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    variant: 'ghost'
  }
}`,...(_=(D=p.parameters)==null?void 0:D.docs)==null?void 0:_.source}}};var N,M,F;u.parameters={...u.parameters,docs:{...(N=u.parameters)==null?void 0:N.docs,source:{originalSource:`{
  args: {
    variant: 'outline'
  }
}`,...(F=(M=u.parameters)==null?void 0:M.docs)==null?void 0:F.source}}};var P,T,K;m.parameters={...m.parameters,docs:{...(P=m.parameters)==null?void 0:P.docs,source:{originalSource:`{
  args: {
    variant: 'destructive',
    children: 'Delete session'
  }
}`,...(K=(T=m.parameters)==null?void 0:T.docs)==null?void 0:K.source}}};var U,G,V;g.parameters={...g.parameters,docs:{...(U=g.parameters)==null?void 0:U.docs,source:{originalSource:`{
  args: {
    variant: 'link',
    children: 'View changes'
  }
}`,...(V=(G=g.parameters)==null?void 0:G.docs)==null?void 0:V.source}}};var Y,q,I;h.parameters={...h.parameters,docs:{...(Y=h.parameters)==null?void 0:Y.docs,source:{originalSource:`{
  args: {
    variant: 'bracket',
    children: 'SHARE'
  }
}`,...(I=(q=h.parameters)==null?void 0:q.docs)==null?void 0:I.source}}};var J,Q,W;v.parameters={...v.parameters,docs:{...(J=v.parameters)==null?void 0:J.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-4"><Button size="sm">Small</Button><Button size="md">Medium</Button><Button size="lg">Large</Button><Button size="icon" aria-label="Add workspace">+</Button></div>
}`,...(W=(Q=v.parameters)==null?void 0:Q.docs)==null?void 0:W.source}}};var X,Z,$;y.parameters={...y.parameters,docs:{...(X=y.parameters)==null?void 0:X.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...($=(Z=y.parameters)==null?void 0:Z.docs)==null?void 0:$.source}}};var ee,ae,re;b.parameters={...b.parameters,docs:{...(ee=b.parameters)==null?void 0:ee.docs,source:{originalSource:`{
  args: {
    loading: true,
    children: 'Sharing…'
  }
}`,...(re=(ae=b.parameters)==null?void 0:ae.docs)==null?void 0:re.source}}};var se,te,ne;k.parameters={...k.parameters,docs:{...(se=k.parameters)==null?void 0:se.docs,source:{originalSource:`{
  render: () => <Button asChild variant="bracket"><a href="#workspace">Open workspace</a></Button>
}`,...(ne=(te=k.parameters)==null?void 0:te.docs)==null?void 0:ne.source}}};var oe,ce,ie;w.parameters={...w.parameters,docs:{...(oe=w.parameters)==null?void 0:oe.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    await userEvent.hover(within(canvasElement).getByRole('button'));
  }
}`,...(ie=(ce=w.parameters)==null?void 0:ce.docs)==null?void 0:ie.source}}};var de,le,pe;B.parameters={...B.parameters,docs:{...(de=B.parameters)==null?void 0:de.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const button = within(canvasElement).getByRole('button');
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await expect(button.matches(':focus-visible')).toBe(true);
  }
}`,...(pe=(le=B.parameters)==null?void 0:le.docs)==null?void 0:pe.source}}};var ue,me,ge;C.parameters={...C.parameters,docs:{...(ue=C.parameters)==null?void 0:ue.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    await userEvent.pointer({
      target: within(canvasElement).getByRole('button'),
      keys: '[MouseLeft>]'
    });
  }
}`,...(ge=(me=C.parameters)==null?void 0:me.docs)==null?void 0:ge.source}}};var he,ve,ye;S.parameters={...S.parameters,docs:{...(he=S.parameters)==null?void 0:he.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const button = within(canvasElement).getByRole('button');
    button.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledOnce();
  }
}`,...(ye=(ve=S.parameters)==null?void 0:ve.docs)==null?void 0:ye.source}}};var be,ke,we;c.parameters={...c.parameters,docs:{...(be=c.parameters)==null?void 0:be.docs,source:{originalSource:`{
  args: {
    disabled: true
  },
  render: args => <Button asChild disabled={args.disabled}><a href="#workspace" onClick={args.onClick}>Open workspace</a></Button>,
  play: async ({
    canvasElement,
    args
  }) => {
    const anchor = within(canvasElement).getByRole('link');
    anchor.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(anchor).toHaveAttribute('tabindex', '-1');
  }
}`,...(we=(ke=c.parameters)==null?void 0:ke.docs)==null?void 0:we.source}}};var Be,Ce,Se;x.parameters={...x.parameters,docs:{...(Be=x.parameters)==null?void 0:Be.docs,source:{originalSource:`{
  ...DisabledChild,
  args: {
    loading: true
  },
  render: args => <Button asChild loading={args.loading}><a href="#workspace" onClick={args.onClick}>Opening workspace</a></Button>
}`,...(Se=(Ce=x.parameters)==null?void 0:Ce.docs)==null?void 0:Se.source}}};var xe,Ee,fe;E.parameters={...E.parameters,docs:{...(xe=E.parameters)==null?void 0:xe.docs,source:{originalSource:`{
  args: {
    variant: 'secondary'
  },
  play: async ({
    canvasElement
  }) => {
    await userEvent.hover(within(canvasElement).getByRole('button'));
  }
}`,...(fe=(Ee=E.parameters)==null?void 0:Ee.docs)==null?void 0:fe.source}}};var Re,Oe,Ae,He,je;o.parameters={...o.parameters,docs:{...(Re=o.parameters)==null?void 0:Re.docs,source:{originalSource:`{
  args: {
    variant: 'unstyled',
    children: '[ESC] CANCEL',
    className: 'font-code text-xs text-text-secondary'
  }
}`,...(Ae=(Oe=o.parameters)==null?void 0:Oe.docs)==null?void 0:Ae.source},description:{story:"Preserve custom terminal action typography while retaining shared focus and disabled behavior.",...(je=(He=o.parameters)==null?void 0:He.docs)==null?void 0:je.description}}};export{C as Active,k as AsChild,h as Bracket,m as Destructive,y as Disabled,c as DisabledChild,B as Focus,p as Ghost,w as Hover,S as KeyboardActivation,g as Link,b as Loading,x as LoadingChild,u as Outline,d as Primary,l as Secondary,E as SecondaryHover,v as Sizes,o as Unstyled,Ze as __namedExportsOrder,Xe as default};

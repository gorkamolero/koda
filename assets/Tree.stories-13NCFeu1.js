import{r as b,j as d}from"./iframe-BDUbmM24.js";import{d as E}from"./index-6LWTzUp_.js";import{I as X}from"./input-D9F_6Zyd.js";import"./preload-helper-D6W3bvzQ.js";import"./index-CCQdZNI7.js";import"./index-DbX3ht9U.js";import"./utils-B7o975cr.js";import"./createLucideIcon-B6tXQlyD.js";import"./button-BasZ35wm.js";import"./index-CDLDA8NU.js";import"./index-OlRYfNBu.js";import"./index-iWPVPrYK.js";import"./index-Cic-oAX7.js";import"./index-DV1FpbQh.js";import"./index-FqwwTXOA.js";import"./index-BZr_kTKH.js";import"./index-CWXJao91.js";import"./index-Bh-xOyeg.js";import"./index-D20LO2AZ.js";import"./index-DIxJW5Vf.js";import"./chevron-down-DzoDJT8Q.js";import"./chevron-right-BEutbkUU.js";const{expect:a,userEvent:n,within:l,fn:Z}=__STORYBOOK_MODULE_TEST__,he={title:"Brand/Tree",component:E,tags:["autodocs"],parameters:{layout:"padded"},args:{label:"Workspace files",items:[{id:"src",label:"src",children:[{id:"app",label:"App.tsx"},{id:"index",label:"index.ts"}]},{id:"readme",label:"README.md"},{id:"lock",label:"pnpm-lock.yaml",disabled:!0}],onSelect:Z()}},p={},u={args:{defaultExpandedIds:["src"],selectedId:"app"}},w={play:async({canvasElement:r})=>{await a(l(r).getByRole("treeitem",{name:"pnpm-lock.yaml"})).toHaveAttribute("aria-disabled","true")}},y={args:{items:[]}},v={play:async({canvasElement:r,args:t})=>{const e=l(r),s=e.getByRole("treeitem",{name:"src"});s.focus(),await n.keyboard("{ArrowRight}"),await a(s).toHaveAttribute("aria-expanded","true"),await n.keyboard("{ArrowRight}"),await a(e.getByRole("treeitem",{name:"App.tsx"})).toHaveFocus(),await n.keyboard("{ArrowDown}{Enter}"),await a(t.onSelect).toHaveBeenCalledWith(a.objectContaining({id:"index"})),await n.keyboard("{ArrowLeft}"),await a(s).toHaveFocus(),await n.keyboard("{End}"),await a(e.getByRole("treeitem",{name:"README.md"})).toHaveFocus(),await n.keyboard("{Home}"),await a(s).toHaveFocus()}},g={args:{items:[{id:"disabled",label:"Generated files",disabled:!0,children:[{id:"child",label:"types.ts"}]},{id:"readme",label:"README.md"}],defaultExpandedIds:["disabled"]},play:async({canvasElement:r})=>{const t=l(r),e=t.getByRole("treeitem",{name:"types.ts"});e.focus(),await n.keyboard("{ArrowLeft}"),await a(e).toHaveFocus(),await n.keyboard("{ArrowDown}"),await a(t.getByRole("treeitem",{name:"README.md"})).toHaveFocus()}},m={render:function(t){const[e,s]=b.useState(new Set),[c,o]=b.useState(!1);return d.jsx(E,{...t,items:[{id:"source",label:"src",children:c?[{id:"lazy-file",label:"loaded.ts"}]:[]}],expandedIds:e,onExpandedChange:(i,h)=>{s(h?new Set([i.id]):new Set),h&&o(!0)},rowProps:i=>({"data-testid":`tree-row-${i.id}`})})},play:async({canvasElement:r,args:t})=>{const e=l(r);await n.click(e.getByRole("button",{name:"Expand"})),await a(e.getByTestId("tree-row-source")).toHaveAttribute("aria-expanded","true"),await n.click(e.getByTestId("tree-row-lazy-file")),await a(t.onSelect).toHaveBeenCalledWith(a.objectContaining({id:"lazy-file"})),await n.keyboard("{ArrowLeft}{Enter}"),await a(e.getByTestId("tree-row-source")).toHaveAttribute("aria-expanded","false")}},f={render:function(t){const[e,s]=b.useState(0),c=Array.from({length:100},(o,i)=>({id:`file-${i}`,label:`file-${i}.ts`}));return d.jsx(E,{...t,items:c,className:"h-32 overflow-auto",virtual:{totalSize:2800,rows:c.slice(e,e+4).map((o,i)=>({index:e+i,key:o.id,start:(e+i)*28})),scrollToIndex:o=>s(Math.max(0,o-1))}})},play:async({canvasElement:r})=>{const t=l(r);t.getByRole("treeitem",{name:"file-0.ts"}).focus(),await n.keyboard("{End}"),await a(t.getByRole("treeitem",{name:"file-99.ts"})).toHaveFocus(),await n.keyboard("{Home}"),await a(t.getByRole("treeitem",{name:"file-0.ts"})).toHaveFocus()}},x={render:function(t){const[e,s]=b.useState("");return d.jsxs(d.Fragment,{children:[d.jsx(X,{"aria-label":"Draft message",autoFocus:!0,value:e,onChange:c=>s(c.target.value)}),d.jsx(E,{...t,selectedId:"readme",virtual:{totalSize:84,rows:t.items.map((c,o)=>({index:o,key:c.id,start:o*28}))}})]})},play:async({canvasElement:r})=>{const t=l(r),e=t.getByRole("textbox",{name:"Draft message"});await a(e).toHaveFocus(),await n.type(e,"Keep this draft"),await a(e).toHaveFocus(),await a(e).toHaveValue("Keep this draft"),t.getByRole("treeitem",{name:"src"}).focus(),await n.keyboard("{ArrowDown}"),await a(t.getByRole("treeitem",{name:"README.md"})).toHaveFocus(),await n.click(e),await n.type(e," while files update"),await a(e).toHaveFocus(),await a(e).toHaveValue("Keep this draft while files update")}},He=["Collapsed","Expanded","DisabledItem","Empty","KeyboardNavigation","DisabledAncestorNavigation","ControlledLazyChildren","VirtualKeyboardNavigation","PreservesComposerFocus"];var H,A,R;p.parameters={...p.parameters,docs:{...(H=p.parameters)==null?void 0:H.docs,source:{originalSource:"{}",...(R=(A=p.parameters)==null?void 0:A.docs)==null?void 0:R.source}}};var k,B,S;u.parameters={...u.parameters,docs:{...(k=u.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    defaultExpandedIds: ['src'],
    selectedId: 'app'
  }
}`,...(S=(B=u.parameters)==null?void 0:B.docs)==null?void 0:S.source}}};var F,D,T;w.parameters={...w.parameters,docs:{...(F=w.parameters)==null?void 0:F.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    await expect(within(canvasElement).getByRole('treeitem', {
      name: 'pnpm-lock.yaml'
    })).toHaveAttribute('aria-disabled', 'true');
  }
}`,...(T=(D=w.parameters)==null?void 0:D.docs)==null?void 0:T.source}}};var I,C,z;y.parameters={...y.parameters,docs:{...(I=y.parameters)==null?void 0:I.docs,source:{originalSource:`{
  args: {
    items: []
  }
}`,...(z=(C=y.parameters)==null?void 0:C.docs)==null?void 0:z.source}}};var L,M,j;v.parameters={...v.parameters,docs:{...(L=v.parameters)==null?void 0:L.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole('treeitem', {
      name: 'src'
    });
    root.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(root).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('treeitem', {
      name: 'App.tsx'
    })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: 'index'
    }));
    await userEvent.keyboard('{ArrowLeft}');
    await expect(root).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('treeitem', {
      name: 'README.md'
    })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(root).toHaveFocus();
  }
}`,...(j=(M=v.parameters)==null?void 0:M.docs)==null?void 0:j.source}}};var K,_,N;g.parameters={...g.parameters,docs:{...(K=g.parameters)==null?void 0:K.docs,source:{originalSource:`{
  args: {
    items: [{
      id: 'disabled',
      label: 'Generated files',
      disabled: true,
      children: [{
        id: 'child',
        label: 'types.ts'
      }]
    }, {
      id: 'readme',
      label: 'README.md'
    }],
    defaultExpandedIds: ['disabled']
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const child = canvas.getByRole('treeitem', {
      name: 'types.ts'
    });
    child.focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(child).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('treeitem', {
      name: 'README.md'
    })).toHaveFocus();
  }
}`,...(N=(_=g.parameters)==null?void 0:_.docs)==null?void 0:N.source}}};var V,$,O,W,P;m.parameters={...m.parameters,docs:{...(V=m.parameters)==null?void 0:V.docs,source:{originalSource:`{
  render: function LazyTree(args) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [loaded, setLoaded] = useState(false);
    return <Tree {...args} items={[{
      id: 'source',
      label: 'src',
      children: loaded ? [{
        id: 'lazy-file',
        label: 'loaded.ts'
      }] : []
    }]} expandedIds={expanded} onExpandedChange={(item, open) => {
      setExpanded(open ? new Set([item.id]) : new Set());
      if (open) setLoaded(true);
    }} rowProps={item => ({
      'data-testid': \`tree-row-\${item.id}\`
    })} />;
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', {
      name: 'Expand'
    }));
    await expect(canvas.getByTestId('tree-row-source')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(canvas.getByTestId('tree-row-lazy-file'));
    await expect(args.onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: 'lazy-file'
    }));
    await userEvent.keyboard('{ArrowLeft}{Enter}');
    await expect(canvas.getByTestId('tree-row-source')).toHaveAttribute('aria-expanded', 'false');
  }
}`,...(O=($=m.parameters)==null?void 0:$.docs)==null?void 0:O.source},description:{story:"The application supplies fetched children; Tree only signals the expansion intent.",...(P=(W=m.parameters)==null?void 0:W.docs)==null?void 0:P.description}}};var G,U,Y;f.parameters={...f.parameters,docs:{...(G=f.parameters)==null?void 0:G.docs,source:{originalSource:`{
  render: function VirtualTree(args) {
    const [start, setStart] = useState(0);
    const items = Array.from({
      length: 100
    }, (_, index) => ({
      id: \`file-\${index}\`,
      label: \`file-\${index}.ts\`
    }));
    return <Tree {...args} items={items} className="h-32 overflow-auto" virtual={{
      totalSize: 2800,
      rows: items.slice(start, start + 4).map((item, offset) => ({
        index: start + offset,
        key: item.id,
        start: (start + offset) * 28
      })),
      scrollToIndex: index => setStart(Math.max(0, index - 1))
    }} />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('treeitem', {
      name: 'file-0.ts'
    }).focus();
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('treeitem', {
      name: 'file-99.ts'
    })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(canvas.getByRole('treeitem', {
      name: 'file-0.ts'
    })).toHaveFocus();
  }
}`,...(Y=(U=f.parameters)==null?void 0:U.docs)==null?void 0:Y.source}}};var q,J,Q;x.parameters={...x.parameters,docs:{...(q=x.parameters)==null?void 0:q.docs,source:{originalSource:`{
  render: function ComposerAndTree(args) {
    const [draft, setDraft] = useState('');
    return <><Input aria-label="Draft message" autoFocus value={draft} onChange={event => setDraft(event.target.value)} /><Tree {...args} selectedId="readme" virtual={{
        totalSize: 84,
        rows: args.items.map((item, index) => ({
          index,
          key: item.id,
          start: index * 28
        }))
      }} /></>;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const composer = canvas.getByRole('textbox', {
      name: 'Draft message'
    });
    await expect(composer).toHaveFocus();
    await userEvent.type(composer, 'Keep this draft');
    await expect(composer).toHaveFocus();
    await expect(composer).toHaveValue('Keep this draft');
    canvas.getByRole('treeitem', {
      name: 'src'
    }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('treeitem', {
      name: 'README.md'
    })).toHaveFocus();
    await userEvent.click(composer);
    await userEvent.type(composer, ' while files update');
    await expect(composer).toHaveFocus();
    await expect(composer).toHaveValue('Keep this draft while files update');
  }
}`,...(Q=(J=x.parameters)==null?void 0:J.docs)==null?void 0:Q.source}}};export{p as Collapsed,m as ControlledLazyChildren,g as DisabledAncestorNavigation,w as DisabledItem,y as Empty,u as Expanded,v as KeyboardNavigation,x as PreservesComposerFocus,f as VirtualKeyboardNavigation,He as __namedExportsOrder,he as default};

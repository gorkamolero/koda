import{A as O}from"./avatar-Dv2LtJxV.js";import"./iframe-BDUbmM24.js";import"./preload-helper-D6W3bvzQ.js";import"./index-DgTdIDf2.js";import"./index-DV1FpbQh.js";import"./index-FqwwTXOA.js";import"./index-DVpI-cC2.js";import"./index-OlRYfNBu.js";import"./index-iWPVPrYK.js";import"./index-CCQdZNI7.js";import"./index-DbX3ht9U.js";import"./badge-DrkOXWGm.js";import"./utils-B7o975cr.js";const{expect:p,within:P}=__STORYBOOK_MODULE_TEST__,D={title:"Primitives/AvatarStack",component:O,tags:["autodocs"],args:{people:[{id:"gorka",name:"Gorka Molero",status:"ready"},{id:"maya",name:"Maya Chen",status:"processing"},{id:"jules",name:"Jules Rivera",status:"reviewing"},{id:"sam",name:"Sam Kim",status:"unknown"}]}},e={},a={args:{size:"md"}},n={args:{maxVisible:4}},r={args:{people:[]}},t={args:{maxVisible:6,size:"md",people:[{id:"gorka",name:"Gorka Molero",tone:"blue",status:"ready"},{id:"maya",name:"Maya Chen",tone:"green",status:"ready"},{id:"jules",name:"Jules Rivera",tone:"amber",status:"ready"},{id:"sam",name:"Sam Kim",tone:"rose",status:"ready"},{id:"ana",name:"Ana Costa",tone:"cyan",status:"ready"},{id:"leo",name:"Leo Park",tone:"terracotta",status:"ready"}]},play:async({canvasElement:A,args:s})=>{const m=P(A),B=s.people.map(E=>getComputedStyle(m.getByRole("img",{name:E.name})).backgroundColor);await p(new Set(B).size).toBe(s.people.length),await p(m.getAllByRole("img",{name:/: ready$/})).toHaveLength(s.people.length)}},o={args:{compact:!0,people:[{id:"host",name:"Host",tone:"presence-blue"},{id:"peer",name:"Peer",tone:"presence-green"}]}},U=["Small","Medium","NoOverflow","Empty","IdentityColors","CompactPresence"];var i,c,l;e.parameters={...e.parameters,docs:{...(i=e.parameters)==null?void 0:i.docs,source:{originalSource:"{}",...(l=(c=e.parameters)==null?void 0:c.docs)==null?void 0:l.source}}};var d,u,g;a.parameters={...a.parameters,docs:{...(d=a.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    size: 'md'
  }
}`,...(g=(u=a.parameters)==null?void 0:u.docs)==null?void 0:g.source}}};var y,S,v;n.parameters={...n.parameters,docs:{...(y=n.parameters)==null?void 0:y.docs,source:{originalSource:`{
  args: {
    maxVisible: 4
  }
}`,...(v=(S=n.parameters)==null?void 0:S.docs)==null?void 0:v.source}}};var h,k,C;r.parameters={...r.parameters,docs:{...(h=r.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    people: []
  }
}`,...(C=(k=r.parameters)==null?void 0:k.docs)==null?void 0:C.source}}};var b,w,x;t.parameters={...t.parameters,docs:{...(b=t.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    maxVisible: 6,
    size: 'md',
    people: [{
      id: 'gorka',
      name: 'Gorka Molero',
      tone: 'blue',
      status: 'ready'
    }, {
      id: 'maya',
      name: 'Maya Chen',
      tone: 'green',
      status: 'ready'
    }, {
      id: 'jules',
      name: 'Jules Rivera',
      tone: 'amber',
      status: 'ready'
    }, {
      id: 'sam',
      name: 'Sam Kim',
      tone: 'rose',
      status: 'ready'
    }, {
      id: 'ana',
      name: 'Ana Costa',
      tone: 'cyan',
      status: 'ready'
    }, {
      id: 'leo',
      name: 'Leo Park',
      tone: 'terracotta',
      status: 'ready'
    }]
  },
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const colors = args.people.map(person => getComputedStyle(canvas.getByRole('img', {
      name: person.name
    })).backgroundColor);
    await expect(new Set(colors).size).toBe(args.people.length);
    await expect(canvas.getAllByRole('img', {
      name: /: ready$/
    })).toHaveLength(args.people.length);
  }
}`,...(x=(w=t.parameters)==null?void 0:w.docs)==null?void 0:x.source}}};var M,R,_;o.parameters={...o.parameters,docs:{...(M=o.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    compact: true,
    people: [{
      id: 'host',
      name: 'Host',
      tone: 'presence-blue'
    }, {
      id: 'peer',
      name: 'Peer',
      tone: 'presence-green'
    }]
  }
}`,...(_=(R=o.parameters)==null?void 0:R.docs)==null?void 0:_.source}}};export{o as CompactPresence,r as Empty,t as IdentityColors,a as Medium,n as NoOverflow,e as Small,U as __namedExportsOrder,D as default};

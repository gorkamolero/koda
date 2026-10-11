import{S as R}from"./button-group-BA8Rf7MG.js";import"./iframe-BDUbmM24.js";import"./preload-helper-D6W3bvzQ.js";import"./index-CL0zHlKb.js";import"./index-OlRYfNBu.js";import"./index-iWPVPrYK.js";import"./utils-B7o975cr.js";const{expect:E,userEvent:s,within:O,waitFor:S}=__STORYBOOK_MODULE_TEST__,T={title:"Primitives/SegmentedControl",component:R,tags:["autodocs"],args:{"aria-label":"Share permission",defaultValue:"view",options:[{value:"view",label:"VIEW"},{value:"control",label:"CONTROL"}]}},e={},a={args:{defaultValue:"control"}},r={args:{disabled:!0}},o={play:async({canvasElement:b})=>{const t=O(b);t.getByRole("radio",{name:"VIEW"}).focus(),await s.keyboard("{ArrowRight>}"),await S(()=>E(t.getByRole("radio",{name:"CONTROL"})).toBeChecked()),await s.keyboard("{/ArrowRight}")}},x=["View","Control","Disabled","Keyboard"];var n,c,i;e.parameters={...e.parameters,docs:{...(n=e.parameters)==null?void 0:n.docs,source:{originalSource:"{}",...(i=(c=e.parameters)==null?void 0:c.docs)==null?void 0:i.source}}};var d,l,m;a.parameters={...a.parameters,docs:{...(d=a.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    defaultValue: 'control'
  }
}`,...(m=(l=a.parameters)==null?void 0:l.docs)==null?void 0:m.source}}};var p,u,g;r.parameters={...r.parameters,docs:{...(p=r.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(g=(u=r.parameters)==null?void 0:u.docs)==null?void 0:g.source}}};var w,v,y;o.parameters={...o.parameters,docs:{...(w=o.parameters)==null?void 0:w.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('radio', {
      name: 'VIEW'
    }).focus();
    await userEvent.keyboard('{ArrowRight>}');
    await waitFor(() => expect(canvas.getByRole('radio', {
      name: 'CONTROL'
    })).toBeChecked());
    await userEvent.keyboard('{/ArrowRight}');
  }
}`,...(y=(v=o.parameters)==null?void 0:v.docs)==null?void 0:y.source}}};export{a as Control,r as Disabled,o as Keyboard,e as View,x as __namedExportsOrder,T as default};

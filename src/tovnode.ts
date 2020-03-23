import vnode, { VNode } from './vnode';
import htmlDomApi, { DOMAPI } from './htmldomapi';
// 根据一个真实的dom去生成一个虚拟的dom对象，通过查询dom对象，可以得到想要的属性
export function toVNode(node: Node, domApi?: DOMAPI): VNode {
  // 是使用默认的dom api操作 还是你自己提供这样的方法，实现必须满足DOMAPI的接口 interface DOMAPI
  const api: DOMAPI = domApi !== undefined ? domApi : htmlDomApi;
  let text: string;
  // 如果是一个Element元素
  if (api.isElement(node)) {
    // 生成id string
    const id = node.id ? '#' + node.id : '';
    const cn = node.getAttribute('class');
    // 生成class string
    const c = cn ? '.' + cn.split(' ').join('.') : '';
    // vnode sel 生成
    const sel = api.tagName(node).toLowerCase() + id + c;
    const attrs: any = {};
    const children: VNode[] = [];
    let name: string;
    let i: number, n: number;
    const elmAttrs = node.attributes;
    const elmChildren = node.childNodes;
    // 访问当前dom上的属性对象，返回一个NamedNodeMap伪数组
    for (i = 0, n = elmAttrs.length; i < n; i++) {
      name = elmAttrs[i].nodeName;
      if (name !== 'id' && name !== 'class') {
        attrs[name] = elmAttrs[i].nodeValue;
      }
    }
    // 遍历子类，递归成功所有vnode
    for (i = 0, n = elmChildren.length; i < n; i++) {
      children.push(toVNode(elmChildren[i], domApi));
    }
    return vnode(sel, { attrs }, children, undefined, node);
    // 如果是文本节点
  } else if (api.isText(node)) {
    text = api.getTextContent(node) as string;
    return vnode(undefined, undefined, undefined, text, node);
    // 如果是注释节点
  } else if (api.isComment(node)) {
    text = api.getTextContent(node) as string;
    return vnode('!', {}, [], text, node as any);
    // 其它情况
  } else {
    return vnode('', {}, [], undefined, node as any);
  }
}